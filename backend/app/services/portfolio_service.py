"""
Portfolio service — trade execution and portfolio management.

Handles the full lifecycle of a paper trade:
1. Price lookup (via Redis-cached yfinance)
2. Position sizing (confidence-based)
3. Balance validation
4. Trade execution (MongoDB writes)
5. Portfolio metrics calculation
"""

from datetime import datetime, timezone

from app.core.config import settings
from app.db.mongodb import get_database
from app.models.portfolio import Position, PortfolioSummary, Transaction
from app.services.stock_service import get_stock_price, get_fresh_price
from app.services.snapshot_service import save_snapshot
from typing import Literal

# MongoDB collection names
USERS_COLLECTION = "users"
POSITIONS_COLLECTION = "positions"
TRANSACTIONS_COLLECTION = "transactions"
TRADE_TYPE = Literal["manual", "automated"]

# Position sizing: max % of available cash per trade
MAX_POSITION_SIZE_PCT = 0.10   # 10% of available cash per trade


async def _update_stop_loss_price(db, user_id: str, ticker: str, buy_price: float) -> None:
    """
    After a BUY executes, calculate and store the absolute stop loss price.
    Only updates if the ticker exists in the user's automated watchlist.
    
    Example: buy_price=$200, stop_loss_pct=0.05 → stop_loss_price=$190
    """
    watchlist_doc = await db["automated_watchlist"].find_one(
        {"user_id": user_id, "ticker": ticker, "active": True}
    )
    
    if not watchlist_doc:
        return  # Not in automated watchlist — no stop loss to set
    
    stop_loss_pct = watchlist_doc.get("stop_loss_pct", 0.05)
    stop_loss_price = round(buy_price * (1 - stop_loss_pct), 4)
    
    await db["automated_watchlist"].update_one(
        {"user_id": user_id, "ticker": ticker},
        {"$set": {"stop_loss_price": stop_loss_price}}
    )
    print(f"  🛡️ Stop loss set for {ticker}: ${stop_loss_price} ({stop_loss_pct:.0%} below ${buy_price})")


async def execute_trade(
    user_id: str,
    ticker: str,
    action: str,
    confidence: float,
    agent_reasoning: dict,
    trade_type: TRADE_TYPE = "automated",
    quantity: float = 0.0,
    db=None,
) -> Transaction:
    """
    Execute a paper trade based on agent decision.

    For automated trades: position size = confidence × MAX_POSITION_SIZE_PCT × cash
    For manual trades: quantity field used directly as share count

    Args:
        user_id:         Authenticated user's ID.
        ticker:          Stock ticker e.g. "NVDA".
        action:          "BUY" or "SELL".
        confidence:      Agent confidence 0.0–1.0.
        agent_reasoning: Reasoning dict from Synthesis Agent or {"manual": True}.
        trade_type:      "manual" or "automated" — controls sizing logic.
        quantity:        Share count for manual trades (fractional allowed).
        db:              Injected MongoDB client.

    Returns:
        Completed Transaction record.

    Raises:
        ValueError: Insufficient balance, no position, invalid action, bad quantity.
    """
    if db is None:
        db = get_database()

    # ── Fetch current price ───────────────────────────────────────────────────
    price = await get_fresh_price(ticker)

    # ── Get user's current balance ────────────────────────────────────────────
    user = await db[USERS_COLLECTION].find_one({"id": user_id})
    if not user:
        raise ValueError(f"User not found: {user_id}")

    cash_balance = float(user["virtual_balance"])

    if action == "BUY":
        transaction = await _execute_buy(
            db, user_id, ticker, price, confidence,
            cash_balance, agent_reasoning,
            trade_type=trade_type, manual_quantity=quantity,
        )
    elif action == "SELL":
        transaction = await _execute_sell(
            db, user_id, ticker, price, confidence,
            agent_reasoning,
            trade_type=trade_type, manual_quantity=quantity,
        )
    else:
        raise ValueError(f"Invalid action: {action}. Must be BUY or SELL.")

    # Snapshot after every trade — fire and forget, never blocks the response
    await save_snapshot(user_id=user_id, db=db, trigger="trade")

    return transaction


async def _execute_buy(
    db, user_id, ticker, price, confidence, cash_balance, agent_reasoning, trade_type: str, manual_quantity: float,
) -> Transaction:
    """Execute a BUY order."""

    # ── Calculate position size ───────────────────────────────────────────────
    if trade_type == "manual":
        if manual_quantity <= 0:
            raise ValueError("quantity must be greater than 0 for manual trades")
        quantity   = manual_quantity
        trade_value = round(quantity * price, 2)
    else:
        trade_value = confidence * MAX_POSITION_SIZE_PCT * cash_balance
        quantity    = trade_value / price

    if trade_value > cash_balance:
        raise ValueError(
            f"Insufficient balance. Need ${trade_value:.2f}, have ${cash_balance:.2f}"
        )

    if quantity < 0.0001:
        raise ValueError("Position size too small to execute")

    # ── Record transaction ────────────────────────────────────────────────────
    transaction = Transaction(
        user_id=user_id,
        ticker=ticker,
        action="BUY",
        quantity=round(quantity, 6),
        price=price,
        total_value=trade_value,
        confidence_score=confidence,
        agent_reasoning=agent_reasoning,
    )
    await db[TRANSACTIONS_COLLECTION].insert_one(transaction.model_dump())

    # ── Update or create position ─────────────────────────────────────────────
    existing = await db[POSITIONS_COLLECTION].find_one(
        {"user_id": user_id, "ticker": ticker}
    )

    if existing:
        # Average down/up: recalculate avg buy price
        old_qty = float(existing["quantity"])
        old_avg = float(existing["avg_buy_price"])
        new_qty = old_qty + quantity
        new_avg = ((old_qty * old_avg) + (quantity * price)) / new_qty

        await db[POSITIONS_COLLECTION].update_one(
            {"user_id": user_id, "ticker": ticker},
            {"$set": {
                "quantity": round(new_qty, 6),
                "avg_buy_price": round(new_avg, 2),
                "updated_at": datetime.now(timezone.utc),
            }}
        )
    else:
        position = Position(
            user_id=user_id,
            ticker=ticker,
            quantity=round(quantity, 6),
            avg_buy_price=price,
        )
        await db[POSITIONS_COLLECTION].insert_one(position.model_dump())

    # ── Deduct from balance ───────────────────────────────────────────────────
    await db[USERS_COLLECTION].update_one(
        {"id": user_id},
        {"$inc": {"virtual_balance": -trade_value}}
    )

    print(f"  ✅ BUY executed user={user_id} ticker={ticker} qty={quantity:.4f} price={price:.2f} type={trade_type}")
    
    await _update_stop_loss_price(db, user_id, ticker, price)

    return transaction


async def _execute_sell(
    db, user_id, ticker, price, confidence, agent_reasoning, trade_type: str, manual_quantity: float,
) -> Transaction:
    """Execute a SELL order — sells entire position."""

    # ── Check position exists ─────────────────────────────────────────────────
    position = await db[POSITIONS_COLLECTION].find_one(
        {"user_id": user_id, "ticker": ticker}
    )
    if not position:
        raise ValueError(f"No position found for {ticker}")

    held = float(position["quantity"])

    if trade_type == "manual":
        if manual_quantity <= 0:
            raise ValueError("quantity must be greater than 0 for manual trades")
        if manual_quantity > held:
            raise ValueError(
                f"Cannot sell {manual_quantity} shares — you only hold {held:.4f}"
            )
        quantity = manual_quantity
    else:
        quantity = held   # automated always closes full position
    
    total_value = round(quantity * price, 2)

    # ── Record transaction ────────────────────────────────────────────────────
    transaction = Transaction(
        user_id=user_id,
        ticker=ticker,
        action="SELL",
        quantity=round(quantity, 6),
        price=price,
        total_value=total_value,
        confidence_score=confidence,
        agent_reasoning=agent_reasoning,
    )
    await db[TRANSACTIONS_COLLECTION].insert_one(transaction.model_dump())

    remaining = round(held - quantity, 6)

    if remaining < 0.0001:
        # Full position closed — remove document entirely
        await db[POSITIONS_COLLECTION].delete_one(
            {"user_id": user_id, "ticker": ticker}
        )
    else:
        # Partial sell — update quantity, avg cost unchanged
        await db[POSITIONS_COLLECTION].update_one(
            {"user_id": user_id, "ticker": ticker},
            {"$set": {
                "quantity":   remaining,
                "updated_at": datetime.now(timezone.utc),
            }}
        )

    await db[USERS_COLLECTION].update_one(
        {"id": user_id},
        {"$inc": {"virtual_balance": total_value}}
    )

    print(f"SELL executed user={user_id} ticker={ticker} qty={quantity:.4f} price={price:.2f} type={trade_type}")
    return transaction


async def get_portfolio_summary(user_id: str) -> PortfolioSummary:
    """
    Calculate current portfolio summary with live prices.

    Fetches all open positions, gets current prices from cache,
    and computes aggregate metrics.
    """
    db = get_database()

    # ── Get user balance ──────────────────────────────────────────────────────
    user = await db[USERS_COLLECTION].find_one({"id": user_id})
    if not user:
        raise ValueError(f"User not found: {user_id}")

    cash_balance = float(user["virtual_balance"])

    # ── Get all positions ─────────────────────────────────────────────────────
    positions_cursor = db[POSITIONS_COLLECTION].find({"user_id": user_id})
    positions = await positions_cursor.to_list(length=100)

    # ── Calculate positions value with live prices ────────────────────────────
    positions_value = 0.0
    for pos in positions:
        try:
            current_price = await get_stock_price(pos["ticker"])
            positions_value += float(pos["quantity"]) * current_price
        except ValueError:
            # Use last known price if fetch fails
            positions_value += float(pos.get("current_value", 0))

    # ── Aggregate metrics ─────────────────────────────────────────────────────
    total_value = cash_balance + positions_value
    starting_balance = 100_000.0
    total_pnl = total_value - starting_balance
    total_pnl_pct = (total_pnl / starting_balance) * 100

    total_trades = await db[TRANSACTIONS_COLLECTION].count_documents(
        {"user_id": user_id}
    )

    return PortfolioSummary(
        user_id=user_id,
        total_value=round(total_value, 2),
        cash_balance=round(cash_balance, 2),
        positions_value=round(positions_value, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_pct=round(total_pnl_pct, 4),
        total_positions=len(positions),
        total_trades=total_trades,
    )


async def get_positions(user_id: str) -> list[dict]:
    """Get all open positions with current prices and unrealized P&L."""
    db = get_database()
    positions_cursor = db[POSITIONS_COLLECTION].find({"user_id": user_id})
    positions = await positions_cursor.to_list(length=100)

    enriched = []
    for pos in positions:
        try:
            current_price = await get_stock_price(pos["ticker"])
        except ValueError:
            current_price = pos.get("avg_buy_price", 0)

        quantity = float(pos["quantity"])
        avg_buy = float(pos["avg_buy_price"])
        current_value = quantity * current_price
        cost_basis = quantity * avg_buy
        unrealized_pnl = current_value - cost_basis
        unrealized_pnl_pct = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0

        enriched.append({
            "ticker": pos["ticker"],
            "quantity": round(quantity, 4),
            "avg_buy_price": avg_buy,
            "current_price": current_price,
            "current_value": round(current_value, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "unrealized_pnl_pct": round(unrealized_pnl_pct, 4),
        })

    return enriched


async def get_transactions(user_id: str) -> list[dict]:
    """Get full transaction history with agent reasoning."""
    db = get_database()
    cursor = db[TRANSACTIONS_COLLECTION].find(
        {"user_id": user_id},
        sort=[("timestamp", -1)],   # Most recent first
    )
    transactions = await cursor.to_list(length=200)

    # Convert datetime objects to strings for JSON serialization
    for t in transactions:
        t.pop("_id", None)   # Remove MongoDB internal ID
        if isinstance(t.get("timestamp"), datetime):
            t["timestamp"] = t["timestamp"].isoformat()

    return transactions