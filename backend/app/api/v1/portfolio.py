"""
Portfolio API endpoints.

Exposes portfolio summary, positions, and transaction history.
All endpoints are protected — require valid JWT.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.services.trade_queue_service import TradeQueueService
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.dependencies import get_current_user_id, get_db
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