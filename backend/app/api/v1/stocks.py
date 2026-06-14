"""
Stock analysis API endpoint.

Triggers the full multi-agent analysis pipeline for a given ticker
and returns the decision with full reasoning.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user_id
from app.agents.graph import trading_graph, run_agent_pipeline
from app.services.portfolio_service import execute_trade
from app.models.stock import StockDetail, CandleData
from app.services.stock_service import get_stock_detail, get_candles
from app.core.market_hours import get_market_status
from app.services.recommendation_service import RecommendationService
from app.core.dependencies import get_db
from app.jobs.discovery_cron import run_discovery_cron
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


class AnalysisRequest(BaseModel):
    """Request body for stock analysis."""
    ticker: str


class AnalysisResponse(BaseModel):
    """Response with full agent decision and reasoning."""
    ticker: str
    decision: str
    confidence: float
    reasoning: str
    news_signal: dict
    fundamental_signal: dict
    technical_signal: dict
    trade_executed: bool = False


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_stock(
    request:  AnalysisRequest,
    user_id:  str                  = Depends(get_current_user_id),
    db:       AsyncIOMotorDatabase = Depends(get_db),
) -> AnalysisResponse:
    ticker = request.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticker cannot be empty")

    # ── Fetch user's risk preference ──────────────────────────────────────────
    user = await db["users"].find_one({"id": user_id}, {"risk_appetite": 1})
    risk_appetite = (user or {}).get("risk_appetite", "Moderate")

    try:
        result = await run_agent_pipeline(ticker=ticker, user_id=user_id, risk_appetite=risk_appetite, auto_execute=False)

        transaction = None
        if result["auto_execute"] and result["decision"] in ("BUY", "SELL"):
            try:
                transaction = await execute_trade(
                    user_id=user_id,
                    ticker=ticker,
                    action=result["decision"],
                    confidence=result["confidence"],
                    agent_reasoning=result["agent_reasoning"],
                    risk_appetite=risk_appetite,
                )
            except Exception as e:
                print(f"  ⚠️ Trade execution failed: {type(e).__name__}: {e}")

        return AnalysisResponse(
            ticker=ticker,
            decision=result["decision"],
            confidence=result["confidence"],
            reasoning=result["reasoning"],
            news_signal=result["news_signal"],
            fundamental_signal=result["fundamental_signal"],
            technical_signal=result["technical_signal"],
            trade_executed=transaction is not None,
        )

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
        detail=f"Analysis failed: {str(e)}") from e


@router.get("/market/status")
async def market_status() -> dict:
    """
    Returns current NYSE market status.
    No auth required — public information.
    Called by the frontend to show open/closed indicator.
    """
    return get_market_status()


@router.get("/recommended")
async def get_recommendation(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
) -> dict:
    """
    Get top-3 personalized stock recommendations for the current user.
    Generated daily by the discovery cron at 8AM ET.
    """
    service = RecommendationService(db)
    rec = await service.get_recommendations(user_id)

    if not rec:
        return {
            "recommendations": [],
            "generated_at": None,
            "message": "No recommendations yet — trigger discovery or wait for 8AM ET cron",
        }

    return {
        "recommendations":        rec.get("recommendations", []),
        "generated_at":           rec.get("generated_at"),
        "user_context_snapshot":  rec.get("user_context_snapshot", {}),
    }


@router.post("/recommended/generate")
async def trigger_discovery(
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Manually trigger discovery cron — for testing only."""
    await run_discovery_cron()
    return {"message": "Discovery cron triggered - refresh in 30 seconds"}


@router.get("/{ticker}", response_model=StockDetail)
async def get_stock(
    ticker: str,
    user_id: str = Depends(get_current_user_id),
) -> StockDetail:
    """
    Get live quote + company info for a ticker.
    Price is Redis-cached for 5 minutes.
    """
    return await get_stock_detail(ticker)


@router.get("/{ticker}/chart", response_model=CandleData)
async def get_stock_chart(
    ticker: str,
    resolution: str = "D",    # Query param: ?resolution=D
    days: int = 90,            # Query param: ?days=90
    user_id: str = Depends(get_current_user_id),
) -> CandleData:
    """
    Get OHLCV candlestick data for charting.

    Query params:
      resolution: D (daily), W (weekly), 60 (1hr), 15 (15min)
      days:       history window in days (default 90, max 365)
    """
    # Cap days to prevent massive responses
    days = min(days, 365)
    return await get_candles(ticker, resolution, days)