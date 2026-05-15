"""
Pydantic models for all watchlist types.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Automated Watchlist ────────────────────────────────────────────────────────

class AutomatedWatchlistAdd(BaseModel):
    """Request body when adding a stock to the automated watchlist."""
    ticker: str = Field(..., description="Stock ticker symbol e.g. NVDA")
    stop_loss_pct: float = Field(
        default=0.05,
        ge=0.01,
        le=0.50,
        description="Stop loss % — e.g. 0.05 means sell if price drops 5% below buy price"
    )


class AutomatedWatchlistItem(BaseModel):
    """A single entry in the automated watchlist (response model)."""
    ticker: str
    stop_loss_pct: float
    stop_loss_price: Optional[float] = None   # Set when a position exists
    active: bool
    added_at: datetime


# ── Simple Watchlists (A and B) ───────────────────────────────────────────────

class WatchlistAdd(BaseModel):
    """Request body for adding a stock to watchlist A or B."""
    ticker: str = Field(..., description="Stock ticker symbol")


class WatchlistItem(BaseModel):
    """A single entry in watchlist A or B (response model)."""
    ticker: str
    added_at: datetime


# ── Response wrappers ─────────────────────────────────────────────────────────

class WatchlistResponse(BaseModel):
    """Generic list response for any watchlist."""
    items: list[WatchlistItem]
    count: int


class AutomatedWatchlistResponse(BaseModel):
    """Response for the automated watchlist."""
    items: list[AutomatedWatchlistItem]
    count: int