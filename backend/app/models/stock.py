"""
Pydantic models for stock data — price quotes, company info, and OHLCV candles.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StockQuote(BaseModel):
    """Live price data from Finnhub /quote."""
    ticker: str
    current_price: float
    open: float
    high: float
    low: float
    prev_close: float
    change: float           # Absolute change from prev close
    change_pct: float       # Percentage change from prev close
    cached: bool = False    # True if this came from Redis


class CompanyInfo(BaseModel):
    """Company profile from Finnhub /stock/profile2."""
    ticker: str
    name: str
    sector: Optional[str] = None
    market_cap: Optional[float] = None   # In millions USD
    logo_url: Optional[str] = None
    exchange: Optional[str] = None
    ipo_date: Optional[str] = None


class StockDetail(BaseModel):
    """Combined response for the stock detail page."""
    quote: StockQuote
    company: Optional[CompanyInfo] = None


class CandleBar(BaseModel):
    """A single OHLCV candlestick bar."""
    timestamp: int      # Unix timestamp (seconds)
    open: float
    high: float
    low: float
    close: float
    volume: float


class CandleData(BaseModel):
    """Full candlestick response for charting."""
    ticker: str
    resolution: str             # "D", "W", "60", "15" etc.
    bars: list[CandleBar]
    count: int


class RecommendedStock(BaseModel):
    """A personalized stock recommendation for a user."""
    user_id: str
    ticker: str
    sentiment_score: float
    summary: str
    reasoning: str          # Why this stock fits this user
    generated_at: datetime
    articles: list[dict] = []


class DocumentRegistry(BaseModel):
    """Tracks every PDF ingested into the Qdrant knowledge base."""
    id: str
    collection: str                     # "financials" or "trading_strategies"
    ticker: str | None = None           # None for strategy docs
    document_type: str                  # "10K", "earnings", "strategy"
    filename: str
    chunks_count: int
    ingested_at: datetime
    supersedes: str | None = None       # Previous filename this replaced