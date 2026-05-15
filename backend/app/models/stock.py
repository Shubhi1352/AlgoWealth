"""
Pydantic models for stock data — price quotes, company info, and OHLCV candles.
"""
from pydantic import BaseModel
from typing import Optional


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