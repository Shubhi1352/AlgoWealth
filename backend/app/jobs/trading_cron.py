"""
Automated Trading Cron — fires every 1 hour via APScheduler.

For each user with an active automated watchlist:
  1. Get their watchlist tickers
  2. Run full agent pipeline per ticker
  3. Execute trade (market open) or queue it (market closed)

Design note: We process users sequentially, not in parallel.
At MVP scale this is fine. At 1000+ users, switch to asyncio.gather()
with a semaphore to limit concurrent agent calls.
"""
import asyncio
from app.core.market_hours import is_market_open
from app.db.mongodb import get_database


async def run_trading_cron() -> None:
    """
    Main entry point for the hourly trading cron.
    Orchestrates the full automated trading pipeline.
    """
    print("\n🤖 Automated trading cron started")

    db = get_database()
    market_open = is_market_open()
    print(f"  📈 Market open: {market_open}")

    # ── If market just opened, process queued after-hours trades first ─────────
    if market_open:
        await _process_queued_trades(db)

    # ── Fetch all users who have active automated watchlist entries ────────────
    users = await _get_active_watchlist_users(db)
    print(f"  👥 Users with active watchlists: {len(users)}")

    if not users:
        print("  ℹ️  No active watchlists found — cron complete\n")
        return

    # ── Process each user's watchlist ─────────────────────────────────────────
    for user_id in users:
        await _process_user_watchlist(db, user_id, market_open)

    print("✅ Automated trading cron complete\n")


async def _process_queued_trades(db) -> None:
    """
    Drain the trade queue at market open.
    Executes all pending after-hours trades before running new analysis.
    """
    from app.services.trade_queue_service import TradeQueueService

    print("  🔄 Processing queued after-hours trades...")
    queue_service = TradeQueueService(db)
    result = await queue_service.process_pending_trades()
    print(f"  ✅ Queue processed: {result}")


async def _get_active_watchlist_users(db) -> list[str]:
    """
    Get distinct user_ids that have at least one active automated watchlist entry.
    Uses MongoDB distinct() — efficient, returns only unique user IDs.
    """
    return await db["automated_watchlist"].distinct(
        "user_id",
        {"active": True}
    )


async def _process_user_watchlist(db, user_id: str, market_open: bool) -> None:
    """
    Run the full agent pipeline for every ticker in a user's automated watchlist.

    Args:
        db:          MongoDB database instance.
        user_id:     The user to process.
        market_open: Whether to execute or queue the resulting trade.
    """
    from app.services.watchlist_service import WatchlistService
    from app.services.trade_queue_service import TradeQueueService
    from app.services.portfolio_service import execute_trade
    from app.agents.graph import run_agent_pipeline   # Your existing LangGraph pipeline
    from app.db.mongodb import USERS_COLLECTION

    watchlist_service = WatchlistService(db)
    queue_service = TradeQueueService(db)

    user = await db[USERS_COLLECTION].find_one({"id": user_id})
    if not user:
        print(f"  ⚠️  User {user_id[:8]}... not found — skipping")
        return

    risk_appetite = user.get("risk_appetite", "Moderate")

    tickers = await watchlist_service.get_automated_tickers(user_id)
    print(f"  👤 User {user_id[:8]}... [{risk_appetite}] — analyzing {len(tickers)} tickers: {tickers}")

    for ticker in tickers:
        try:
            print(f"    🔍 Analyzing {ticker}...")

            # ── Run full agent pipeline ────────────────────────────────────────
            result = await run_agent_pipeline(ticker=ticker, user_id=user_id, risk_appetite=risk_appetite)

            decision = result.get("decision")
            confidence = result.get("confidence", 0.0)
            reasoning = result.get("agent_reasoning", {})

            print(f"    📊 {ticker}: {decision} (confidence: {confidence:.0%})")

            # ── HOLD → skip, no trade ──────────────────────────────────────────
            if decision == "HOLD":
                print(f"    ⏸️  {ticker}: HOLD — no trade executed")
                continue

            # ── BUY/SELL → execute or queue ────────────────────────────────────
            if market_open:
                await execute_trade(
                    user_id=user_id,
                    ticker=ticker,
                    action=decision,
                    confidence=confidence,
                    agent_reasoning=reasoning,
                    risk_appetite=risk_appetite,
                    db=db,
                )
                print(f"    ✅ {ticker}: {decision} executed")
            else:
                await queue_service.queue_trade(
                    user_id=user_id,
                    ticker=ticker,
                    action=decision,
                    confidence=confidence,
                    agent_reasoning=reasoning,
                    risk_appetite=risk_appetite,
                    source="automated",
                )
                print(f"    🕐 {ticker}: {decision} queued (market closed)")

            # ── Small delay between tickers to avoid rate limiting ─────────────
            await asyncio.sleep(2)

        except Exception as e:
            # Log and continue — one failed ticker shouldn't stop the rest
            print(f"    ❌ Error processing {ticker} for user {user_id[:8]}: {e}")
            continue