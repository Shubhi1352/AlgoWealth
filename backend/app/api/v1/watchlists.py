"""
Watchlist endpoints — three watchlists per user:
  POST/DELETE/GET /api/v1/watchlists/automated
  POST/DELETE/GET /api/v1/watchlists/a
  POST/DELETE/GET /api/v1/watchlists/b
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.dependencies import get_current_user_id, get_db
from app.models.watchlist import (
    AutomatedWatchlistAdd,
    AutomatedWatchlistResponse,
    WatchlistAdd,
    WatchlistResponse,
    StopLossPatchRequest,
)
from app.services.watchlist_service import WatchlistService

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


def get_watchlist_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> WatchlistService:
    """FastAPI dependency — injects WatchlistService with the DB connection."""
    return WatchlistService(db)


# ── Automated Watchlist ────────────────────────────────────────────────────────

@router.post("/automated", status_code=status.HTTP_201_CREATED)
async def add_to_automated(
    payload: AutomatedWatchlistAdd,
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> dict:
    """Add a stock to the automated watchlist with stop-loss configuration."""
    doc = await service.add_to_automated(user_id, payload)
    return {"message": f"{payload.ticker.upper()} added to automated watchlist", "item": doc}


@router.delete("/automated/{ticker}", status_code=status.HTTP_200_OK)
async def remove_from_automated(
    ticker: str,
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> dict:
    """Remove a stock from the automated watchlist."""
    deleted = await service.remove_from_automated(user_id, ticker)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker.upper()} not found in your automated watchlist",
        )
    return {"message": f"{ticker.upper()} removed from automated watchlist"}


@router.get("/automated", response_model=AutomatedWatchlistResponse)
async def get_automated(
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> AutomatedWatchlistResponse:
    """Get all stocks in the automated watchlist."""
    items = await service.get_automated(user_id)
    return AutomatedWatchlistResponse(items=items, count=len(items))


# ── Watchlist A ────────────────────────────────────────────────────────────────

@router.post("/a", status_code=status.HTTP_201_CREATED)
async def add_to_a(
    payload: WatchlistAdd,
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> dict:
    """Add a stock to watchlist A (observation only)."""
    doc = await service.add_to_a(user_id, payload.ticker)
    return {"message": f"{payload.ticker.upper()} added to watchlist A", "item": doc}


@router.delete("/a/{ticker}", status_code=status.HTTP_200_OK)
async def remove_from_a(
    ticker: str,
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> dict:
    """Remove a stock from watchlist A."""
    deleted = await service.remove_from_a(user_id, ticker)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker.upper()} not found in watchlist A",
        )
    return {"message": f"{ticker.upper()} removed from watchlist A"}


@router.get("/a", response_model=WatchlistResponse)
async def get_a(
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> WatchlistResponse:
    """Get all stocks in watchlist A."""
    items = await service.get_a(user_id)
    return WatchlistResponse(items=items, count=len(items))


# ── Watchlist B ────────────────────────────────────────────────────────────────

@router.post("/b", status_code=status.HTTP_201_CREATED)
async def add_to_b(
    payload: WatchlistAdd,
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> dict:
    """Add a stock to watchlist B (observation only)."""
    doc = await service.add_to_b(user_id, payload.ticker)
    return {"message": f"{payload.ticker.upper()} added to watchlist B", "item": doc}


@router.delete("/b/{ticker}", status_code=status.HTTP_200_OK)
async def remove_from_b(
    ticker: str,
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> dict:
    """Remove a stock from watchlist B."""
    deleted = await service.remove_from_b(user_id, ticker)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker.upper()} not found in watchlist B",
        )
    return {"message": f"{ticker.upper()} removed from watchlist B"}


@router.get("/b", response_model=WatchlistResponse)
async def get_b(
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> WatchlistResponse:
    """Get all stocks in watchlist B."""
    items = await service.get_b(user_id)
    return WatchlistResponse(items=items, count=len(items))


@router.patch("/automated/{ticker}/stop-loss", status_code=status.HTTP_200_OK)
async def update_stop_loss(
    ticker: str,
    payload: StopLossPatchRequest,
    user_id: str = Depends(get_current_user_id),
    service: WatchlistService = Depends(get_watchlist_service),
) -> dict:
    """
    Update stop_loss_pct for a single ticker in place.
    Preserves stop_loss_price — no DELETE + re-POST needed.
    """
    updated = await service.update_stop_loss_pct(
        user_id, ticker, payload.stop_loss_pct
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker.upper()} not found in your automated watchlist",
        )
    return {
        "message": f"Stop loss updated for {ticker.upper()}",
        "item": updated.model_dump(),
    }