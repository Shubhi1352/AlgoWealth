"""
News Agent — fetches live news and scores market sentiment.

Uses Tavily search to find recent news articles about a ticker,
then uses GPT-4o to extract a sentiment score and trading signal.

Output written to state: news_signal
{
    "signal": "BUY" | "SELL" | "HOLD",
    "sentiment": 0.82,          # -1.0 (very bearish) to 1.0 (very bullish)
    "articles": [...],          # Raw article summaries from Tavily
    "summary": "3 bullish articles about AI chip demand..."
}
"""

import json
from tavily import TavilyClient
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.agents.state import AgentState

# Clients — module level, reused across calls
_tavily = TavilyClient(api_key=settings.TAVILY_API_KEY)
_llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0,   # Deterministic — we want consistent analysis, not creativity
)

# Sentiment thresholds for signal conversion
BULLISH_THRESHOLD = 0.3
BEARISH_THRESHOLD = -0.3


async def news_agent_node(state: AgentState) -> dict:
    """
    LangGraph node function for the News Agent.

    Args:
        state: Current graph state containing ticker and user_id.

    Returns:
        Dict with updated state fields (LangGraph merges this into state).
    """
    ticker = state["ticker"]
    print(f"📰 News Agent analyzing: {ticker}")

    # ── Step 1: Fetch live news via Tavily ───────────────────────────────────
    articles = _fetch_news(ticker)
    if not articles:
        return {
            "news_signal": {
                "signal": "HOLD",
                "sentiment": 0.0,
                "articles": [],
                "summary": "No recent news found",
            }
        }

    # ── Step 2: Score sentiment with GPT-4o ──────────────────────────────────
    news_signal = await _score_sentiment(ticker, articles)
    print(f"  📰 News signal: {news_signal['signal']} (sentiment: {news_signal['sentiment']})")

    return {"news_signal": news_signal}


def _fetch_news(ticker: str) -> list[dict]:
    """
    Fetch recent news articles for a ticker using Tavily.

    Returns:
        List of article dicts with title, content, url, score.
    """
    try:
        response = _tavily.search(
            query=f"{ticker} stock news analysis",
            max_results=5,
            search_depth="basic",
        )
        return response.get("results", [])
    except Exception as e:
        print(f"  ⚠️ Tavily search failed: {e}")
        return []


async def _score_sentiment(ticker: str, articles: list[dict]) -> dict:
    """
    Use GPT-4o to score sentiment across fetched articles.

    Prompts the LLM to return structured JSON with sentiment score
    and trading signal — deterministic, parseable output.
    """
    articles_text = "\n\n".join([
        f"Title: {a.get('title', 'N/A')}\nContent: {a.get('content', '')[:500]}"
        for a in articles[:5]
    ])

    system_prompt = """You are a financial news analyst. 
Analyze the provided news articles and return ONLY a JSON object with this exact structure:
{
    "sentiment": <float between -1.0 and 1.0>,
    "signal": "<BUY|SELL|HOLD>",
    "summary": "<one sentence summary of the news sentiment>"
}
Rules:
- sentiment > 0.3 → signal must be BUY
- sentiment < -0.3 → signal must be SELL  
- otherwise → signal must be HOLD
- Return ONLY the JSON object, no other text."""

    user_prompt = f"Ticker: {ticker}\n\nArticles:\n{articles_text}"

    response = await _llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    # Parse JSON response — strip any markdown fences if present
    raw = response.content.strip().strip("```json").strip("```").strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback if LLM doesn't follow instructions perfectly
        parsed = {"sentiment": 0.0, "signal": "HOLD", "summary": "Could not parse sentiment"}

    return {
        "signal": parsed.get("signal", "HOLD"),
        "sentiment": float(parsed.get("sentiment", 0.0)),
        "summary": parsed.get("summary", ""),
        "articles": [
            {"title": a.get("title"), "url": a.get("url")}
            for a in articles[:5]
        ],
    }