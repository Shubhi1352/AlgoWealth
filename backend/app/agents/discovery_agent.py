"""
Discovery Agent — finds and scores stock candidates for recommendations.

Scoring pipeline per candidate:
  1. News Agent      → sentiment score (0.0-1.0)
  2. Technical Agent → strategy signal (BUY/SELL/HOLD → 1.0/0.0/0.5)
  3. Live quote      → price context fed into Technical Agent
  4. Fit score       → personalization based on user portfolio state
  5. Final score     → market_score × 0.70 + fit_score × 0.30
"""

import asyncio
import logging

from langchain_groq import ChatGroq
from tavily import TavilyClient

from app.core.config import settings

logger = logging.getLogger(__name__)

llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0.1,
)

tavily = TavilyClient(api_key=settings.TAVILY_API_KEY)

# Signal → numeric conversion for weighted scoring
SIGNAL_SCORES: dict[str, float] = {
    "BUY":  1.0,
    "HOLD": 0.5,
    "SELL": 0.0,
}


# ── Candidate Discovery ────────────────────────────────────────────────────────

async def discover_candidates(exclude_tickers: list[str]) -> list[dict]:
    """
    Search for trending stocks via Tavily and return candidates
    not already in the user's portfolio or watchlists.

    Args:
        exclude_tickers: Tickers to skip.

    Returns:
        List of candidate dicts: [{ticker, title, url, snippet}]
    """
    def _search() -> list[dict]:
        results = []
        queries = [
            "top trending stocks to buy this week analyst upgrades",
            "best performing stocks today strong momentum buy signal",
        ]

        seen_tickers = set(exclude_tickers)
        seen_urls: set[str] = set()

        for query in queries:
            try:
                response = tavily.search(
                    query=query,
                    max_results=5,
                    search_depth="basic",
                )
                for r in response.get("results", []):
                    url = r.get("url", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    tickers = _extract_tickers(
                        r.get("title", "") + " " + r.get("content", "")
                    )

                    for ticker in tickers:
                        if ticker not in seen_tickers:
                            seen_tickers.add(ticker)
                            results.append({
                                "ticker": ticker,
                                "title":   r.get("title", ""),
                                "url":     url,
                                "snippet": r.get("content", "")[:300],
                            })
            except Exception as e:
                logger.warning("Tavily search error: %s", e)

        return results

    return await asyncio.to_thread(_search)


def _extract_tickers(text: str) -> list[str]:
    """Extract stock ticker symbols from text via regex."""
    import re

    pattern = r'\b([A-Z]{2,5})\b'
    matches = re.findall(pattern, text)

    stopwords = {
        "AI", "US", "CEO", "IPO", "ETF", "GDP", "FED", "SEC",
        "NYSE", "AND", "THE", "FOR", "WITH", "THIS", "THAT",
        "FROM", "WILL", "HAVE", "BEEN", "INTO", "THAN", "MORE",
        "SAYS", "SAYS", "NEXT", "WEEK", "YEAR", "ALSO", "OVER",
    }

    tickers = []
    seen: set[str] = set()
    for match in matches:
        if match not in stopwords and match not in seen and len(match) <= 5:
            tickers.append(match)
            seen.add(match)
            if len(tickers) >= 3:
                break

    return tickers


# ── Candidate Scoring ──────────────────────────────────────────────────────────

async def score_candidate(
    ticker: str,
    snippet: str,
    user_context: dict,
) -> dict:
    """
    Score a single candidate using News Agent + Technical Agent + live quote.
    Returns a fully scored candidate dict ready for ranking.

    Args:
        ticker:       Stock symbol.
        snippet:      Text snippet from discovery search.
        user_context: User portfolio state from RecommendationService.

    Returns:
        {
            ticker, news_signal, technical_signal,
            news_summary, technical_summary,
            current_price, price_change_pct,
            market_score, fit_score, final_score,
            reasoning, articles
        }
    """
    from app.agents.news_agent import news_agent_node
    from app.agents.technical_agent import technical_agent_node
    from app.agents.state import AgentState
    from app.services.stock_service import get_stock_quote

    # ── Build minimal agent state ──────────────────────────────────────────
    base_state: AgentState = {
        "ticker":            ticker,
        "user_id":           "system",
        "messages":          [],
        "news_signal":       {},
        "fundamental_signal": {},
        "technical_signal":  {},
        "decision":          None,
        "confidence":        0.0,
        "reasoning":         "",
        "next":              "",
    }

    # ── Fetch live quote + run News and Technical agents in parallel ───────
    try:
        quote_result, news_result, technical_result = await asyncio.gather(
            _safe_get_quote(ticker),
            _safe_run_agent(news_agent_node, base_state),
            _safe_run_agent(technical_agent_node, base_state),
        )
    except Exception as e:
        logger.error("score_candidate gather failed for %s: %s", ticker, e)
        return _failed_candidate(ticker)

    # ── Extract signals ────────────────────────────────────────────────────
    news_signal     = news_result.get("news_signal", {})
    technical_signal = technical_result.get("technical_signal", {})

    news_sentiment   = float(news_signal.get("sentiment", 0.0))
    news_sig_str     = news_signal.get("signal", "HOLD")
    news_summary     = news_signal.get("summary", "")
    articles         = news_signal.get("articles", [])

    tech_sig_str     = technical_signal.get("signal", "HOLD")
    tech_summary     = technical_signal.get("summary", "")

    current_price    = quote_result.get("current_price", 0.0)
    price_change_pct = quote_result.get("price_change_pct", 0.0)

    # ── Market score: news sentiment + technical signal ────────────────────
    # News sentiment already 0.0-1.0
    # Technical signal converted: BUY=1.0, HOLD=0.5, SELL=0.0
    tech_numeric = SIGNAL_SCORES.get(tech_sig_str, 0.5)
    market_score = (news_sentiment * 0.55) + (tech_numeric * 0.45)

    # ── Fit score: how well this pick suits this user right now ────────────
    fit_score = compute_fit_score(
        ticker=ticker,
        market_score=market_score,
        user_context=user_context,
    )

    # ── Final score ────────────────────────────────────────────────────────
    final_score = (market_score * 0.70) + (fit_score * 0.30)

    # ── One-line reasoning for the UI ─────────────────────────────────────
    reasoning = _build_reasoning(
        ticker, news_sig_str, tech_sig_str,
        news_summary, tech_summary,
        current_price, price_change_pct,
    )

    return {
        "ticker":            ticker,
        "news_signal":       news_sig_str,
        "technical_signal":  tech_sig_str,
        "news_summary":      news_summary,
        "technical_summary": tech_summary,
        "current_price":     current_price,
        "price_change_pct":  price_change_pct,
        "market_score":      round(market_score, 4),
        "fit_score":         round(fit_score, 4),
        "final_score":       round(final_score, 4),
        "reasoning":         reasoning,
        "articles":          articles,
    }


def compute_fit_score(
    ticker: str,
    market_score: float,
    user_context: dict,
) -> float:
    """
    Score how well a candidate fits the current user's situation.

    Penalises picks that don't suit the user's cash position,
    risk profile (based on P&L), or existing exposure.

    Args:
        ticker:       Candidate ticker.
        market_score: Combined news + technical score (0.0-1.0).
        user_context: From RecommendationService.get_user_context().

    Returns:
        Fit score 0.0-1.0.
    """
    score = 1.0

    cash_balance  = float(user_context.get("cash_balance", 0))
    total_pnl_pct = float(user_context.get("total_pnl_pct", 0))
    held_tickers  = set(user_context.get("exclude_tickers", []))

    # ── Already held — exclude entirely ───────────────────────────────────
    if ticker in held_tickers:
        return 0.0

    # ── Insufficient cash — can't take a meaningful position ──────────────
    # Minimum meaningful position = 2% of starting balance = $2,000
    min_position = cash_balance * 0.05
    if min_position < 500:
        score -= 0.60   # nearly pointless to recommend
    elif min_position < 1_000:
        score -= 0.30   # small position possible but not ideal

    # ── User is in significant loss — be more conservative ────────────────
    # Only recommend high-conviction picks (market_score > 0.70) when down >5%
    if total_pnl_pct < -0.05:
        if market_score < 0.70:
            score -= 0.35   # weak signal + user losing = bad combo

    # ── User is doing well — slightly favour more picks ───────────────────
    if total_pnl_pct > 0.05 and market_score > 0.65:
        score += 0.10   # reward: profitable user, decent signal

    return round(max(0.0, min(1.0, score)), 4)


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _safe_get_quote(ticker: str) -> dict:
    """Fetch live quote — returns zeros on failure, never raises."""
    try:
        from app.services.stock_service import get_stock_quote
        quote = await get_stock_quote(ticker)
        return {
            "current_price":    quote.current_price,
            "price_change_pct": quote.percent_change,
        }
    except Exception as e:
        logger.warning("Could not fetch quote for %s: %s", ticker, e)
        return {"current_price": 0.0, "price_change_pct": 0.0}


async def _safe_run_agent(agent_fn, state: dict) -> dict:
    """Run an agent node — returns empty dict on failure, never raises."""
    try:
        return await agent_fn(state)
    except Exception as e:
        logger.warning("Agent %s failed: %s", agent_fn.__name__, e)
        return {}


def _build_reasoning(
    ticker: str,
    news_sig: str,
    tech_sig: str,
    news_summary: str,
    tech_summary: str,
    price: float,
    change_pct: float,
) -> str:
    """Build a single display sentence summarising both signals."""
    direction = "up" if change_pct >= 0 else "down"
    price_str = f"${price:.2f} ({direction} {abs(change_pct):.1f}%)" if price else "price unavailable"

    if news_sig == tech_sig == "BUY":
        return f"Both news sentiment and technical strategy agree: BUY. Trading at {price_str}."
    if news_sig == tech_sig == "SELL":
        return f"Both signals indicate caution: SELL. Trading at {price_str}."
    if news_sig == "BUY":
        return f"Positive news sentiment ({news_summary[:80]}...). Technical: {tech_sig}. At {price_str}."
    if tech_sig == "BUY":
        return f"Technical strategy signals BUY. News: {news_sig}. Trading at {price_str}."
    return f"Mixed signals — news: {news_sig}, technical: {tech_sig}. At {price_str}."


def _failed_candidate(ticker: str) -> dict:
    """Return a zeroed-out candidate when scoring fails entirely."""
    return {
        "ticker":            ticker,
        "news_signal":       "HOLD",
        "technical_signal":  "HOLD",
        "news_summary":      "Scoring unavailable",
        "technical_summary": "Scoring unavailable",
        "current_price":     0.0,
        "price_change_pct":  0.0,
        "market_score":      0.0,
        "fit_score":         0.0,
        "final_score":       0.0,
        "reasoning":         "Could not score this candidate.",
        "articles":          [],
    }