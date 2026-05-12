"""
Technical Agent — RAG over trading strategy documents.

Retrieves relevant chunks from uploaded trading strategy docs
(RSI, MACD, Bollinger Bands etc.) and applies them to interpret
the current market context for a ticker.

Output written to state: technical_signal
{
    "signal": "BUY" | "SELL" | "HOLD",
    "summary": "RSI at 28 indicates oversold conditions...",
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


async def technical_agent_node(state: AgentState) -> dict:
    """
    LangGraph node function for the Technical Agent.

    Retrieves trading strategy chunks from Qdrant and uses them
    as a knowledge base to interpret technical conditions.
    """
    ticker = state["ticker"]
    print(f"📈 Technical Agent analyzing: {ticker}")

    # ── Step 1: Retrieve strategy chunks ─────────────────────────────────────
    query = f"trading signals buy sell indicators RSI MACD momentum trend"
    chunks = await retrieve_chunks(
        query=query,
        collection=settings.QDRANT_COLLECTION_STRATEGIES,
        top_k=4,
        ticker=None,   # Strategy docs are not ticker-specific
    )

    if not chunks:
        return {
            "technical_signal": {
                "signal": "HOLD",
                "summary": "No trading strategy documents found",
                "sources": [],
            }
        }

    # ── Step 2: Apply strategies to current context ───────────────────────────
    technical_signal = await _analyze_technicals(ticker, chunks)
    print(f"  📈 Technical signal: {technical_signal['signal']}")

    return {"technical_signal": technical_signal}


async def _analyze_technicals(ticker: str, chunks: list[dict]) -> dict:
    """
    Use GPT-4o to apply retrieved strategy knowledge to produce a signal.
    """
    context = "\n\n---\n\n".join([
        f"Strategy: {c['source']} (page {c['page']})\n{c['text']}"
        for c in chunks
    ])

    system_prompt = """You are a technical stock analyst with expertise in trading strategies.
Using the provided trading strategy documents as your knowledge base,
analyze the general market context and return ONLY a JSON object:
{
    "signal": "<BUY|SELL|HOLD>",
    "summary": "<2-3 sentences referencing specific indicators from the documents>"
}
Return ONLY the JSON object, no other text."""

    user_prompt = f"Ticker: {ticker}\n\nTrading Strategy Knowledge Base:\n{context}"

    response = await _llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    raw = response.content.strip().strip("```json").strip("```").strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"signal": "HOLD", "summary": "Could not parse technical analysis"}

    return {
        "signal": parsed.get("signal", "HOLD"),
        "summary": parsed.get("summary", ""),
        "sources": chunks,
    }