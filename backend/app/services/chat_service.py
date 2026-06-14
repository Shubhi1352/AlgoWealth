"""
Chat service — core logic for the AI chat assistant.

Responsibilities:
- Build system prompt with page-aware context
- Route user intent to the right data source
- Stream Groq responses token by token
"""

import json
import logging
from typing import AsyncGenerator

from groq import AsyncGroq
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.db.mongodb import get_database
from app.services.portfolio_service import get_portfolio_summary
from app.services.stock_service import get_stock_detail
from app.agents.graph import run_agent_pipeline
from app.db.qdrant import get_qdrant_client

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
GROQ_MODEL        = settings.GROQ_MODEL
MAX_HISTORY_TURNS = 10          # keep last 10 turns in context window
RAG_TOP_K         = 4
USERS_COLLECTION = "users"

# ── System prompt ──────────────────────────────────────────────────────────────
def build_system_prompt(page_context: dict, portfolio_snapshot: dict | None) -> str:
    """
    Build a system prompt that is aware of:
    - What page the user is currently on
    - Their live portfolio state
    """
    base = (
        "You are AlgoWealth Assistant, an expert AI trading analyst embedded in "
        "a paper trading platform. You help users understand their portfolio, "
        "analyze stocks, and interpret AI agent decisions. "
        "Be concise, precise, and always ground your answers in the data provided. "
        "Never give financial advice or recommend real-money trades. "
        "If you don't have enough data to answer, say so clearly.\n\n"
    )

    # ── Page context ───────────────────────────────────────────────────────────
    page = page_context.get("page", "dashboard")
    base += f"The user is currently on the **{page}** page.\n"

    if page == "stock_detail" and page_context.get("ticker"):
        base += f"They are viewing ticker: {page_context['ticker']}.\n"

    if page == "trades" and page_context.get("recent_trades"):
        trades_summary = json.dumps(page_context["recent_trades"][:5], default=str)
        base += f"Recent trades visible to user:\n{trades_summary}\n"

    # ── Portfolio snapshot ─────────────────────────────────────────────────────
    if portfolio_snapshot:
        base += (
            f"\nUser portfolio snapshot:\n"
            f"- Total value: ${portfolio_snapshot.get('total_value', 0):,.2f}\n"
            f"- Cash balance: ${portfolio_snapshot.get('cash_balance', 0):,.2f}\n"
            f"- Total P&L: ${portfolio_snapshot.get('total_pnl', 0):,.2f} "
            f"({portfolio_snapshot.get('total_pnl_pct', 0):.2f}%)\n"
            f"- Open positions: {portfolio_snapshot.get('total_positions', 0)}\n"
        )

    base += (
        "\nCRITICAL INSTRUCTION: Only answer using data explicitly provided in this "
        "system prompt. If specific data is not present (e.g. watchlist tickers, "
        "position sizes, trade history), respond with exactly: "
        "'I don't have that data in context — please check the [relevant page] page directly.' "
        "Never invent, estimate, or fabricate stock names, prices, returns, or quantities.\n"
    )

    return base


# ── Intent routing ─────────────────────────────────────────────────────────────
def extract_ticker(message: str) -> str | None:
    """
    Naively extract a ticker from a message.
    Looks for 1–5 uppercase letters that appear to be a stock symbol.
    """
    import re
    # Match words like NVDA, AAPL, TSLA — all caps, 1-5 chars
    matches = re.findall(r'\b[A-Z]{1,5}\b', message)
    # Filter out common English words that are all-caps
    stopwords = {"I", "A", "AI", "THE", "BUY", "SELL", "FOR", "AND", "OR", "MY", "IN"}
    tickers = [m for m in matches if m not in stopwords]
    return tickers[0] if tickers else None


async def retrieve_rag_context(query: str, collection: str = "financials") -> str:
    """
    Retrieve relevant chunks from Qdrant for a given query.
    Falls back to empty string if Qdrant is unavailable.
    """
    try:
        from app.services.retrieval_service import retrieve_chunks
        chunks = await retrieve_chunks(query=query, collection=collection, top_k=RAG_TOP_K)
        if not chunks:
            return ""
        return "\n\n".join(c["text"] for c in chunks)
    except Exception as e:
        logger.warning("RAG retrieval failed: %s", e)
        return ""


async def load_page_data(page_context: dict, user_id: str, db: AsyncIOMotorDatabase) -> str:
    """
    Fetch real data per page and return it as a formatted string
    to append to the system prompt.
    """
    page = page_context.get("page", "")
    lines: list[str] = []

    try:
        logger.debug("Checking recommendations for user %s", user_id[:8])
        if page == "watchlist_automated":
            docs = await db["automated_watchlist"].find(
                {"user_id": user_id, "active": True},
                {"ticker": 1, "stop_loss_pct": 1, "stop_loss_price": 1, "_id": 0},
            ).to_list(length=50)
            if docs:
                lines.append("User's automated watchlist:")
                for d in docs:
                    stop_pct   = d.get('stop_loss_pct') or 0
                    stop_price = d.get('stop_loss_price') or 0
                    lines.append(
                        f"  - {d['ticker']}: stop loss {stop_pct * 100:.1f}% "
                        f"(price: ${stop_price:.2f})"
                    )
            else:
                lines.append("Automated watchlist is empty.")

        elif page == "watchlist_ab":
            for list_name in ("watchlist_a", "watchlist_b"):
                docs = await db[list_name].find(
                    {"user_id": user_id},
                    {"ticker": 1, "_id": 0},
                ).to_list(length=50)
                label = "A" if list_name == "watchlist_a" else "B"
                tickers = [d["ticker"] for d in docs]
                lines.append(f"Watchlist {label}: {', '.join(tickers) if tickers else 'empty'}")

        elif page == "portfolio":
            docs = await db["positions"].find(
                {"user_id": user_id, "quantity": {"$gt": 0}},
                {"ticker": 1, "quantity": 1, "avg_buy_price": 1, "current_price": 1, "current_value": 1, "_id": 0},
            ).to_list(length=50)
            if docs:
                lines.append("User's open positions:")
                for d in docs:
                    lines.append(
                        f"  - {d['ticker']}: {d.get('quantity', 0):.4f} shares @ "
                        f"${d.get('avg_buy_price', 0):.2f} avg, "
                        f"current value ${d.get('current_value', 0):.2f}"
                    )
            else:
                lines.append("No open positions.")

        elif page == "stock_detail" and page_context.get("ticker"):
            ticker = page_context["ticker"]
            position = await db["positions"].find_one(
                {"user_id": user_id, "ticker": ticker, "quantity": {"$gt": 0}},
                {"quantity": 1, "avg_price": 1, "current_value": 1, "_id": 0},
            )
            if position:
                lines.append(f"User's position in {ticker}:")
                lines.append(f"  - Shares held: {position.get('quantity', 0)}")
                lines.append(f"  - Avg buy price: ${position.get('avg_buy_price', 0):.2f}")
                lines.append(f"  - Current value: ${position.get('current_value', 0):.2f}")
            else:
                lines.append(f"User holds no position in {ticker}.")

        elif page == "trades":
            docs = await db["transactions"].find(
                {"user_id": user_id},
                {"ticker": 1, "action": 1, "quantity": 1, "price": 1, "timestamp": 1, "_id": 0},
            ).sort("timestamp", -1).limit(10).to_list(length=10)
            if docs:
                lines.append("Last 10 trades:")
                for d in docs:
                    lines.append(
                        f"  - {d.get('timestamp', '')}: {d['action']} {d.get('quantity', 0)} "
                        f"x {d['ticker']} @ ${d.get('price', 0):.2f}"
                    )
            else:
                lines.append("No trade history found.")

        elif page == "profile":
            user = await db["users"].find_one(
                {"id": user_id},
                {"email": 1, "risk_appetite": 1, "virtual_balance": 1, "created_at": 1, "_id": 0},
            )
            if user:
                lines.append("User profile:")
                lines.append(f"  - Email: {user.get('email', 'N/A')}")
                lines.append(f"  - Risk appetite: {user.get('risk_appetite', 'Moderate')}")
                lines.append(f"  - Current cash balance: ${user.get('virtual_balance', 100000):,.2f}")
                created = user.get("created_at")
                if created:
                    lines.append(f"  - Member since: {created.strftime('%Y-%m-%d')}")

            docs = await db["document_registry"].find(
                {},
                {"filename": 1, "collection": 1, "ticker": 1, "_id": 0},
            ).to_list(length=20)
            if docs:
                lines.append(f"  - Uploaded documents ({len(docs)}):")
                for d in docs:
                    ticker_label = f" [{d['ticker']}]" if d.get("ticker") else ""
                    lines.append(f"      • {d.get('filename', 'unknown')} → {d.get('collection', 'unknown')}{ticker_label}")
            else:
                lines.append("  - No documents uploaded yet.")
        elif page == "dashboard":
            rec_doc = await db["recommended_stocks"].find_one(
                {"user_id": user_id},
                {"recommendations": 1, "generated_at": 1, "_id": 0},
            )
            if rec_doc and rec_doc.get("recommendations"):
                lines.append("Today's recommended stocks:")
                for r in rec_doc["recommendations"][:5]:
                    lines.append(f"  - {r.get('ticker')}: {r.get('reasoning', '')[:80]}")    

    except Exception as e:
        logger.warning("load_page_data failed for page %s: %s", page, e, exc_info=True)

    return "\n".join(lines)

# ── Main streaming function ────────────────────────────────────────────────────
async def stream_chat_response(
    message: str,
    conversation_history: list[dict],
    page_context: dict,
    user_id: str,
    db: AsyncIOMotorDatabase,
) -> AsyncGenerator[str, None]:
    """
    Core chat function. Yields response tokens as they stream from Groq.

    Flow:
    1. Fetch user portfolio for context
    2. Check if message needs agent analysis or RAG
    3. Build system prompt with all context
    4. Stream Groq response
    """
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    # ── 1. Fetch live portfolio for system prompt ──────────────────────────────
    portfolio_snapshot = None
    try:
        portfolio_snapshot = await get_portfolio_summary(user_id)
        if portfolio_snapshot:
            portfolio_snapshot = portfolio_snapshot.model_dump()
    except Exception as e:
        logger.warning("Could not fetch portfolio for chat context: %s", e)

    # ── 1b. Fetch page-specific data ───────────────────────────────────────────  ← ADD THIS BLOCK
    page_data = await load_page_data(page_context, user_id, db)

    # ── 2. Intent detection ────────────────────────────────────────────────────
    msg_upper = message.upper()
    extra_context = ""

    analyze_keywords = ("ANALYZE", "ANALYSIS", "SHOULD I BUY", "SHOULD I SELL", "WHAT DO YOU THINK ABOUT")
    rag_keywords     = ("10-K", "ANNUAL REPORT", "FILING", "DOCUMENT", "KNOWLEDGE BASE", "WHAT DOES THE")

    is_analyze_intent = any(kw in msg_upper for kw in analyze_keywords)
    is_rag_intent     = any(kw in msg_upper for kw in rag_keywords)

    ticker = extract_ticker(message) if (is_analyze_intent or page_context.get("page") == "stock_detail") else None
    if not ticker and page_context.get("ticker"):
        ticker = page_context["ticker"]

    # ── 3. Run agent pipeline if analyze intent ────────────────────────────────
    if db is None:
        db = get_database()
        
    if is_analyze_intent and ticker:
        try:
            user = await db[USERS_COLLECTION].find_one({"id": user_id}, {"risk_appetite": 1})
            risk_appetite = (user or {}).get("risk_appetite", "Moderate")

            result = await run_agent_pipeline(
                ticker=ticker,
                user_id=user_id,
                risk_appetite=risk_appetite,
                auto_execute=False,         # chat never auto-trades
            )
            extra_context = (
                f"\nFresh agent analysis for {ticker}:\n"
                f"- Decision: {result['decision']} (confidence: {result['confidence']:.0%})\n"
                f"- Reasoning: {result['reasoning']}\n"
                f"- News signal: {json.dumps(result['news_signal'])}\n"
                f"- Technical signal: {json.dumps(result['technical_signal'])}\n"
                f"- Fundamental signal: {json.dumps(result['fundamental_signal'])}\n"
            )
        except Exception as e:
            logger.warning("Agent pipeline failed during chat: %s", e)
            extra_context = f"\nAgent analysis for {ticker} failed: {e}\n"

    # ── 4. RAG retrieval if document intent ────────────────────────────────────
    elif is_rag_intent:
        rag_text = await retrieve_rag_context(message)
        if rag_text:
            extra_context = f"\nRelevant document excerpts:\n{rag_text}\n"

    # ── 5. Build final system prompt ───────────────────────────────────────────
    system_prompt = build_system_prompt(page_context, portfolio_snapshot)
    if page_data:
        system_prompt += f"\n{page_data}\n"
    if extra_context:
        system_prompt += extra_context

    # ── 6. Trim history to last N turns ───────────────────────────────────────
    trimmed_history = conversation_history[-(MAX_HISTORY_TURNS * 2):]

    messages = [
        {"role": "system", "content": system_prompt},
        *trimmed_history,
        {"role": "user", "content": message},
    ]

    # ── 7. Stream from Groq ────────────────────────────────────────────────────
    try:
        stream = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=1024,
            temperature=0.4,
            stream=True,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token
    except Exception as e:
        logger.error("Groq streaming failed: %s", e)
        yield f"\n[Error: could not reach AI model — {e}]"


