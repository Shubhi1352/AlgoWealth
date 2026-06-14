"""
Stop Loss Checker — fires every 15 minutes via APScheduler.

Checks every open position against its configured stop loss price.
If current price has breached the floor, executes an automatic SELL.

Only runs during market hours — prices are stale outside market hours
and triggering sells on stale data would corrupt P&L metrics.
"""
from app.core.market_hours import is_market_open
from app.db.mongodb import get_database


async def run_stop_loss_check() -> None:
    """
    Main entry point for the 15-minute stop loss check.
    """
    # ── Skip entirely outside market hours ────────────────────────────────────
    if not is_market_open():
        print("  🛡️ Stop loss check skipped — market closed")
        return

    print("\n🛡️ Stop loss check started")
    db = get_database()

    triggered_count = 0
    checked_count = 0

    # ── Fetch all automated watchlist entries that have a stop loss set ────────
    cursor = db["automated_watchlist"].find(
        {
            "active": True,
            "stop_loss_price": {"$ne": None},   # Only entries with stop loss set
        }
    )

    async for watchlist_entry in cursor:
        user_id = watchlist_entry["user_id"]
        ticker = watchlist_entry["ticker"]
        stop_loss_price = watchlist_entry["stop_loss_price"]

        # ── Check if user actually holds this position ─────────────────────────
        position = await db["positions"].find_one(
            {"user_id": user_id, "ticker": ticker}
        )

        if not position or position.get("quantity", 0) <= 0:
            continue   # No open position — nothing to protect

        checked_count += 1

        try:
            # ── Get current price (Redis cached, 5min TTL) ─────────────────────
            from app.services.stock_service import get_stock_price
            current_price = await get_stock_price(ticker)

            # ── Check breach ───────────────────────────────────────────────────
            if current_price < stop_loss_price:
                print(
                    f"  🚨 Stop loss triggered: {ticker} @ ${current_price:.2f} "
                    f"(floor: ${stop_loss_price:.2f}) for user {user_id[:8]}..."
                )

                await _execute_stop_loss_sell(db, user_id, ticker, current_price, stop_loss_price)
                triggered_count += 1
            else:
                print(
                    f"  ✅ {ticker} @ ${current_price:.2f} "
                    f"(floor: ${stop_loss_price:.2f}) — safe"
                )

        except Exception as e:
            print(f"  ❌ Error checking stop loss for {ticker} / user {user_id[:8]}: {e}")
            continue

    print(
        f"🛡️ Stop loss check complete — "
        f"checked: {checked_count}, triggered: {triggered_count}\n"
    )


async def _execute_stop_loss_sell(
    db,
    user_id: str,
    ticker: str,
    current_price: float,
    stop_loss_price: float,
) -> None:
    """
    Execute a stop loss SELL and clean up the watchlist entry.

    Args:
        db:               MongoDB database instance.
        user_id:          The user whose position is being protected.
        ticker:           Stock being sold.
        current_price:    Current market price (already below stop loss).
        stop_loss_price:  The configured floor price.
    """
    from app.services.portfolio_service import execute_trade

    reasoning = {
        "trigger": "stop_loss",
        "current_price": current_price,
        "stop_loss_price": stop_loss_price,
        "breach_amount": round(stop_loss_price - current_price, 4),
        "breach_pct": round((stop_loss_price - current_price) / stop_loss_price * 100, 2),
        "decision": "SELL",
        "confidence": 1.0,
        "reasoning": (
            f"Stop loss triggered: price ${current_price:.2f} fell below "
            f"floor ${stop_loss_price:.2f}"
        ),
        "news_signal":        {"signal": "SELL", "summary": "Stop loss triggered — automated exit."},
        "technical_signal":   {"signal": "SELL", "summary": f"Price ${current_price:.2f} breached stop floor ${stop_loss_price:.2f}."},
        "fundamental_signal": {"signal": "SELL", "summary": "Position closed by stop loss protection."},
    }

    await execute_trade(
        user_id=user_id,
        ticker=ticker,
        action="SELL",
        confidence=1.0,         # Stop loss is always full confidence
        agent_reasoning=reasoning,
        db=db,
    )

    # ── Clear stop loss price after sell — position is closed ─────────────────
    await db["automated_watchlist"].update_one(
        {"user_id": user_id, "ticker": ticker},
        {"$set": {"stop_loss_price": None}}
    )

    print(f"  ✅ Stop loss SELL executed: {ticker} for user {user_id[:8]}...")