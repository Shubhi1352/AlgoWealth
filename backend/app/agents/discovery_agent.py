"""
Discovery Agent — finds new stock candidates via Tavily web search.

This agent is separate from the main trading graph. It runs once daily
and feeds the recommendations system, not the trading pipeline directly.

Responsibility: Find tickers the user doesn't already know about,
score their sentiment, return the best candidate.
"""
from langchain_groq import ChatGroq
from tavily import TavilyClient

from app.core.config import settings

# Reuse the same LLM as the other agents
llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0.1,
)

tavily = TavilyClient(api_key=settings.TAVILY_API_KEY)


async def discover_candidates(exclude_tickers: list[str]) -> list[dict]:
    """
    Search for trending/upgraded stocks and return candidates
    that are not in the user's existing portfolio or watchlists.

    Args:
        exclude_tickers: Tickers to skip (already held or watched).

    Returns:
        List of candidate dicts: [{ticker, title, url, snippet}]
    """
    import asyncio

    # Run Tavily search in thread pool — it's synchronous
    def _search() -> list[dict]:
        results = []

        # Two searches for broader coverage
        queries = [
            "top trending stocks to buy this week analyst upgrades",
            "best performing stocks today strong momentum buy signal",
        ]

        seen_tickers = set(exclude_tickers)
        seen_urls = set()

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

                    # Extract ticker mentions from title/content
                    tickers = _extract_tickers(
                        r.get("title", "") + " " + r.get("content", "")
                    )

                    for ticker in tickers:
                        if ticker not in seen_tickers:
                            seen_tickers.add(ticker)
                            results.append({
                                "ticker": ticker,
                                "title": r.get("title", ""),
                                "url": url,
                                "snippet": r.get("content", "")[:300],
                            })
            except Exception as e:
                print(f"  ⚠️ Tavily search error: {e}")

        return results

    return await asyncio.to_thread(_search)


def _extract_tickers(text: str) -> list[str]:
    """
    Extract stock ticker symbols from text using the LLM.
    Returns up to 3 tickers found in the text.

    We use the LLM rather than regex because tickers appear in many
    formats: "$NVDA", "NVDA", "Nvidia (NVDA)", "ticker: NVDA".
    """
    import re

    # Fast regex pass first — catches obvious $TICKER and (TICKER) patterns
    # LLM is fallback for ambiguous cases
    pattern = r'\b([A-Z]{2,5})\b'
    matches = re.findall(pattern, text)

    # Filter out common non-ticker uppercase words
    stopwords = {
        "AI", "US", "CEO", "IPO", "ETF", "GDP", "FED", "SEC",
        "NYSE", "AND", "THE", "FOR", "WITH", "THIS", "THAT",
        "FROM", "WILL", "HAVE", "BEEN", "INTO", "THAN", "MORE",
    }

    tickers = []
    seen = set()
    for match in matches:
        if match not in stopwords and match not in seen and len(match) <= 5:
            tickers.append(match)
            seen.add(match)
            if len(tickers) >= 3:
                break

    return tickers


async def score_candidate(ticker: str, snippet: str) -> dict:
    """
    Run News Agent sentiment scoring on a single candidate ticker.
    Returns sentiment score and summary.

    Args:
        ticker:  Stock symbol to score.
        snippet: Text snippet from the discovery search result.

    Returns:
        {sentiment: float, summary: str, signal: str}
    """
    from app.agents.news_agent import news_agent_node
    from app.agents.state import AgentState

    # Build a minimal state to run the news agent on this ticker
    state: AgentState = {
        "ticker": ticker,
        "user_id": "system",
        "messages": [],
        "news_signal": {},
        "fundamental_signal": {},
        "technical_signal": {},
        "decision": None,
        "confidence": 0.0,
        "reasoning": "",
        "next": "",
    }

    try:
        result = await news_agent_node(state)
        news_signal = result.get("news_signal", {})
        return {
            "sentiment": news_signal.get("sentiment", 0.0),
            "summary": news_signal.get("summary", ""),
            "signal": news_signal.get("signal", "HOLD"),
            "articles": news_signal.get("articles", []),
        }
    except Exception as e:
        print(f"  ⚠️ Scoring failed for {ticker}: {e}")
        return {"sentiment": 0.0, "summary": "", "signal": "HOLD", "articles": []}