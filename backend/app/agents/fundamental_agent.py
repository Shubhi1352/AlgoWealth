"""
Fundamental Agent — RAG over financial filings.

Retrieves relevant chunks from uploaded 10-K filings, earnings reports,
and other financial documents in Qdrant, then uses GPT-4o to synthesize
a fundamental trading signal with cited sources.

Output written to state: fundamental_signal
{
    "signal": "BUY" | "SELL" | "HOLD",
    "summary": "Strong Q3 revenue growth...",
    "sources": [{text, source, page, score}, ...]
}
"""

import json
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.agents.state import AgentState
from app.services.retrieval_service import retrieve_chunks

_llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0,
)


async def fundamental_agent_node(state: AgentState) -> dict:
    """
    LangGraph node function for the Fundamental Agent.

    Retrieves financial document chunks from Qdrant filtered by ticker,
    then synthesizes a fundamental analysis signal.
    """
    ticker = state["ticker"]
    print(f"📊 Fundamental Agent analyzing: {ticker}")

    # ── Step 1: Retrieve relevant chunks from Qdrant ─────────────────────────
    query = f"{ticker} revenue earnings growth profit financial performance"
    chunks = await retrieve_chunks(
        query=query,
        collection=settings.QDRANT_COLLECTION_FINANCIALS,
        top_k=4,
        ticker=ticker,
    )

    if not chunks:
        return {
            "fundamental_signal": {
                "signal": "HOLD",
                "summary": f"No financial documents found for {ticker}",
                "sources": [],
            }
        }

    # ── Step 2: Synthesize signal from retrieved chunks ───────────────────────
    fundamental_signal = await _analyze_fundamentals(ticker, chunks)
    print(f"  📊 Fundamental signal: {fundamental_signal['signal']}")

    return {"fundamental_signal": fundamental_signal}


async def _analyze_fundamentals(ticker: str, chunks: list[dict]) -> dict:
    """
    Use GPT-4o to analyze retrieved financial chunks and produce a signal.
    """
    context = "\n\n---\n\n".join([
        f"Source: {c['source']} (page {c['page']})\n{c['text']}"
        for c in chunks
    ])

    system_prompt = """You are a fundamental stock analyst.
Analyze the provided financial document excerpts and return ONLY a JSON object:
{
    "signal": "<BUY|SELL|HOLD>",
    "summary": "<2-3 sentence analysis citing specific financial metrics>"
}
Base your signal on: revenue growth, profitability, debt levels, guidance.
Return ONLY the JSON object, no other text."""

    user_prompt = f"Ticker: {ticker}\n\nFinancial Documents:\n{context}"

    response = await _llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    raw = response.content.strip().strip("```json").strip("```").strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"signal": "HOLD", "summary": "Could not parse fundamental analysis"}

    return {
        "signal": parsed.get("signal", "HOLD"),
        "summary": parsed.get("summary", ""),
        "sources": chunks,
    }