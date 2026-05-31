"""
Portfolio API endpoints.

Exposes portfolio summary, positions, and transaction history.
All endpoints are protected — require valid JWT.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.services.trade_queue_service import TradeQueueService
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Literal
import asyncio
from app.services.portfolio_service import save_snapshot
from app.models.user import RiskAppetite, RISK_CONFIG

from app.core.dependencies import get_current_user_id, get_db
from app.db.mongodb import get_database
from app.models.portfolio import PortfolioSummary
from app.services.portfolio_service import (
    execute_trade,
    get_portfolio_summary,
    get_positions,
    get_transactions,
)

router = APIRouter()


class TradeRequest(BaseModel):
    """Manual trade request body."""
    ticker: str
    action: str        # "BUY" or "SELL"
    confidence: float  # 0.0 - 1.0
    quantity: float = 0.0
    trade_type: Literal["manual", "automated"] = "automated"


@router.get("/", response_model=PortfolioSummary)
async def get_portfolio(
    user_id: str = Depends(get_current_user_id),
) -> PortfolioSummary:
    """Get portfolio summary — total value, cash, P&L metrics."""
    try:
        return await get_portfolio_summary(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/positions")
async def get_open_positions(
    user_id: str = Depends(get_current_user_id),
) -> list[dict]:
    """Get all open positions with current prices and unrealized P&L."""
    return await get_positions(user_id)


@router.get("/transactions")
async def get_transaction_history(
    user_id: str = Depends(get_current_user_id),
) -> list[dict]:
    """Get full transaction history with agent reasoning."""
    return await get_transactions(user_id)


@router.post("/trade")
async def manual_trade(
    request: TradeRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """
    Execute a manual paper trade.
    Useful for testing the portfolio engine directly.
    """
    try:
        transaction = await execute_trade(
            user_id=user_id,
            ticker=request.ticker.upper(),
            action=request.action.upper(),
            confidence=request.confidence,
            agent_reasoning={"manual": True, "note": "Manually triggered trade"},
            trade_type=request.trade_type,
            quantity=request.quantity,
        )
        return {
            "message": f"{transaction.action} executed successfully",
            "ticker": transaction.ticker,
            "quantity": transaction.quantity,
            "price": transaction.price,
            "total_value": transaction.total_value,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/queue")
async def get_trade_queue(
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Get all pending after-hours trades for the current user.
    Frontend shows these as "Queued — executes at market open".
    """
    service = TradeQueueService(db)
    pending = await service.get_pending_trades(user_id)

    # Convert ObjectId to string for JSON serialization
    for trade in pending:
        trade["_id"] = str(trade["_id"])

    return {"trades": pending, "count": len(pending)}


@router.get("/history")
async def get_portfolio_history(
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Returns daily portfolio value snapshots for the P&L chart.
    Sorted ascending by date.
    """
    snapshots = await db["portfolio_snapshots"].find(
        {"user_id": current_user_id},
        {"_id": 0, "date": 1, "total_value": 1, "cash_balance": 1, "positions_value": 1}
    ).sort("date", 1).to_list(length=365)

    return {"history": snapshots}


@router.post("/reset", status_code=200)
async def reset_portfolio(
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Restore the user's cash balance to the starting amount.
    Positions and transaction history are preserved.
    """
    STARTING_BALANCE = 100_000.00

    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"virtual_balance": STARTING_BALANCE}}
    )

    await save_snapshot(user_id, db, trigger="reset")

    return {"message": "Cash balance reset successfully", "cash_balance": STARTING_BALANCE}


class PreferencesUpdate(BaseModel):
    risk_appetite: RiskAppetite

@router.patch("/preferences", response_model=dict)
async def update_preferences(
    body: PreferencesUpdate,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Update the user's trading risk appetite."""
    db = get_database()
    await db["users"].update_one(
        {"id": user_id},
        {"$set": {"risk_appetite": body.risk_appetite}}
    )
    config = RISK_CONFIG[body.risk_appetite]
    return {
        "risk_appetite":        body.risk_appetite,
        "confidence_threshold": config["confidence_threshold"],
        "position_size_pct":    config["position_size_pct"],
    }


@router.get("/me", response_model=dict)
async def get_me(user_id: str = Depends(get_current_user_id)) -> dict:
    db = get_database()
    user = await db["users"].find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id":      user_id,
        "email":        user["email"],
        "created_at":   user["created_at"].isoformat(),
        "risk_appetite": user.get("risk_appetite", "Moderate"),
        "message":      "Token is valid",
    }