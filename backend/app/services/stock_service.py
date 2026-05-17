"""
Stock price service with Redis caching.

Uses Finnhub API for real-time stock prices.
Caches in Redis to minimize API calls and stay within rate limits.

Cache strategy:
- Key:   "price:{ticker}"
- Value: JSON string with price and timestamp
- TTL:   5 minutes (REDIS_PRICE_TTL from config)
"""

import json
import time
import httpx
import finnhub
import redis.asyncio as aioredis
import yfinance as yf

from fastapi import HTTPException
from app.core.config import settings
from app.models.stock import StockQuote, CompanyInfo, StockDetail, CandleBar, CandleData

# Redis client — module level singleton
_redis: aioredis.Redis | None = None

# Finnhub client — synchronous but fast
_finnhub_client: finnhub.Client | None = None

# Finnhub base URL — defined once, not repeated in every method
FINNHUB_BASE = "https://finnhub.io/api/v1"

# Twelve Data interval mapping
RESOLUTION_MAP = {
    "D": "1day",
    "W": "1week",
    "60": "1h",
    "15": "15min",
    "5": "5min",
}


def get_redis() -> aioredis.Redis:
    """Return shared Redis client, initializing if needed."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


def get_finnhub() -> finnhub.Client:
    """Return shared Finnhub client, initializing if needed."""
    global _finnhub_client
    if _finnhub_client is None:
        _finnhub_client = finnhub.Client(api_key=settings.FINNHUB_API_KEY)
    return _finnhub_client


async def get_stock_price(ticker: str) -> float:
    """
    Get current stock price with Redis cache.

    Flow:
    1. Check Redis cache — return immediately if found
    2. Cache miss → fetch from Finnhub
    3. Store in Redis with TTL
    4. Return price

    Args:
        ticker: Stock ticker symbol e.g. "NVDA"

    Returns:
        Current stock price as float.

    Raises:
        ValueError: If price cannot be fetched.
    """
    cache_key = f"price:{ticker.upper()}"
    redis = get_redis()

    # ── Step 1: Check cache ───────────────────────────────────────────────────
    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        print(f"  💾 Cache HIT for {ticker}: ${data['price']}")
        return float(data["price"])

    # ── Step 2: Cache miss — fetch from Finnhub ───────────────────────────────
    print(f"  🌐 Cache MISS for {ticker} — fetching from Finnhub")
    price = _fetch_price_from_finnhub(ticker)

    # ── Step 3: Store in Redis with TTL ───────────────────────────────────────
    await redis.setex(
        cache_key,
        settings.REDIS_PRICE_TTL,
        json.dumps({"price": price, "ticker": ticker}),
    )

    return price


async def get_stock_quote(ticker: str) -> StockQuote:
    """
    Get full quote data (price, open, high, low, change%) for a ticker.
    Checks Redis cache first. On miss, fetches full /quote from Finnhub.

    This is separate from get_stock_price() which returns a bare float —
    that function is kept for internal use (portfolio P&L calculations).

    Args:
        ticker: Stock symbol e.g. "NVDA"

    Returns:
        StockQuote with all price fields populated.
    """
    ticker = ticker.upper().strip()
    cache_key = f"quote:{ticker}"   # Different key from "price:{ticker}"
    redis = get_redis()

    # ── Step 1: Check cache ───────────────────────────────────────────────────
    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        print(f"  💾 Quote cache HIT for {ticker}")
        return StockQuote(**data, cached=True)

    # ── Step 2: Fetch full quote from Finnhub /quote ──────────────────────────
    print(f"  🌐 Quote cache MISS for {ticker} — fetching from Finnhub")
    url = f"{FINNHUB_BASE}/quote"
    params = {"symbol": ticker, "token": settings.FINNHUB_API_KEY}

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    # Finnhub returns c=0 for unknown tickers
    if not data.get("c"):
        raise HTTPException(
            status_code=404,
            detail=f"No price data found for ticker: {ticker}"
        )

    prev_close = data.get("pc", 0.0)
    current = data.get("c", 0.0)

    quote = StockQuote(
        ticker=ticker,
        current_price=current,
        open=data.get("o", 0.0),
        high=data.get("h", 0.0),
        low=data.get("l", 0.0),
        prev_close=prev_close,
        change=round(current - prev_close, 4),
        change_pct=round(data.get("dp", 0.0), 4),
        cached=False,
    )

    # ── Step 3: Cache the full quote dict ─────────────────────────────────────
    await redis.setex(
        cache_key,
        settings.REDIS_PRICE_TTL,
        json.dumps(quote.model_dump()),
    )

    return quote


def _fetch_price_from_finnhub(ticker: str) -> float:
    """
    Fetch real-time price from Finnhub quote endpoint.

    Finnhub /quote returns:
    {
        "c": 121.45,   ← current price  (this is what we want)
        "h": 123.00,   ← high of day
        "l": 119.00,   ← low of day
        "o": 120.00,   ← open price
        "pc": 120.50,  ← previous close
        "t": 1234567   ← timestamp
    }

    Raises:
        ValueError: If ticker invalid or API returns no data.
    """
    try:
        client = get_finnhub()
        quote = client.quote(ticker.upper())

        price = quote.get("c")   # "c" = current price

        if not price or float(price) <= 0:
            # Market might be closed — fall back to previous close
            price = quote.get("pc")

        if not price or float(price) <= 0:
            raise ValueError(f"No valid price returned for {ticker}")

        print(f"  📈 Finnhub price for {ticker}: ${price}")
        return round(float(price), 2)

    except Exception as e:
        raise ValueError(f"Could not fetch price for {ticker}: {e}") from e


async def get_stock_info(ticker: str) -> dict:
    """
    Get basic stock info (name, sector, market cap) from Finnhub.
    Used for the stock detail page.

    Returns dict with company profile or empty dict if unavailable.
    """
    try:
        client = get_finnhub()
        profile = client.company_profile2(symbol=ticker.upper())

        if not profile:
            return {}

        return {
            "ticker": profile.get("ticker"),
            "name": profile.get("name"),
            "sector": profile.get("finnhubIndustry"),
            "market_cap": profile.get("marketCapitalization"),
            "logo": profile.get("logo"),
            "exchange": profile.get("exchange"),
            "ipo_date": profile.get("ipo"),
            "website": profile.get("weburl"),
        }
    except Exception:
        return {}


async def get_stock_detail(ticker: str) -> StockDetail:
    """
    Fetch live quote + company profile for a ticker.
    Quote is Redis-cached (5min TTL). Company info is fetched fresh each call
    (it changes rarely, but caching it adds complexity for minimal gain at MVP).

    Args:
        ticker: Stock symbol e.g. "NVDA"

    Returns:
        StockDetail with quote and company info.

    Raises:
        HTTPException 404 if Finnhub returns no data for the ticker.
    """
    ticker = ticker.upper().strip()

    # get_stock_price already handles Redis cache — reuse it
    quote = await get_stock_quote(ticker)   # your existing function

    # Fetch company profile (no cache at MVP)
    company = await _fetch_company_info(ticker)

    return StockDetail(quote=quote, company=company)


async def _fetch_company_info(ticker: str) -> CompanyInfo | None:
    """
    Fetch company profile from Finnhub /stock/profile2.
    Returns None if Finnhub has no profile (e.g. unknown ticker).

    This is a private helper — only called from get_stock_detail.
    """
    url = f"{FINNHUB_BASE}/stock/profile2"
    params = {"symbol": ticker, "token": settings.FINNHUB_API_KEY}

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    # Finnhub returns an empty dict {} for unknown tickers
    if not data or "name" not in data:
        return None

    return CompanyInfo(
        ticker=ticker,
        name=data.get("name", ""),
        sector=data.get("finnhubIndustry"),
        market_cap=data.get("marketCapitalization"),  # Already in millions
        logo_url=data.get("logo"),
        exchange=data.get("exchange"),
        ipo_date=data.get("ipo"),
    )


async def get_candles(
    ticker: str,
    resolution: str = "D",
    days: int = 90,
) -> CandleData:
    """
    Fetch OHLCV candlestick data from Twelve Data API (free tier: 800 req/day).
    
    Twelve Data returns bars in descending order (newest first).
    We reverse to ascending (oldest first) for charting libraries.

    Args:
        ticker:     Stock symbol e.g. "NVDA"
        resolution: Bar size — "D" (daily), "W" (weekly), "60" (1hr), "15" (15min)
        days:       How many days of history to fetch (default: 90)

    Returns:
        CandleData with bars in ascending order (oldest → newest).
    """
    from fastapi import HTTPException

    ticker = ticker.upper().strip()
    interval = RESOLUTION_MAP.get(resolution, "1day")

    # Twelve Data uses outputsize (number of bars), not a date range
    # Daily: ~252 trading days/year, so days ≈ bars for daily resolution
    outputsize = min(days, 500)   # Twelve Data max is 5000, we cap at 500

    url = "https://api.twelvedata.com/time_series"
    params = {
        "symbol": ticker,
        "interval": interval,
        "outputsize": outputsize,
        "order": "ASC",          # Oldest first — ready for charting
        "apikey": settings.TWELVE_DATA_API_KEY,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    # Twelve Data returns {"status": "error", "message": "..."} on bad ticker
    if data.get("status") == "error":
        raise HTTPException(
            status_code=404,
            detail=f"No candle data for {ticker}: {data.get('message', 'unknown error')}",
        )

    raw_bars = data.get("values", [])
    if not raw_bars:
        raise HTTPException(
            status_code=404,
            detail=f"No candle data returned for {ticker}",
        )

    bars = []
    for bar in raw_bars:
        try:
            bars.append(CandleBar(
                timestamp=int(__import__('datetime').datetime.fromisoformat(bar["datetime"]).timestamp()),
                open=round(float(bar["open"]), 4),
                high=round(float(bar["high"]), 4),
                low=round(float(bar["low"]), 4),
                close=round(float(bar["close"]), 4),
                volume=float(bar.get("volume", 0)),
            ))
        except (KeyError, ValueError):
            # Skip malformed bars rather than failing the entire request
            continue

    return CandleData(
        ticker=ticker,
        resolution=resolution,
        bars=bars,
        count=len(bars),
    )


async def get_fresh_price(ticker: str) -> float:
    """
    Fetch price directly from Finnhub, bypassing Redis cache.
    Used for trade execution where stale price = financial inaccuracy.
    Cache is updated after fetch so subsequent reads benefit.
    
    Args:
        ticker: Stock symbol e.g. "NVDA"
    
    Returns:
        Current price as float, guaranteed fresh from Finnhub.
    """
    ticker = ticker.upper().strip()
    
    # Fetch directly from Finnhub — skip cache read
    price = _fetch_price_from_finnhub(ticker)
    
    # Update cache so next read within 5min gets this fresh price
    cache_key = f"price:{ticker}"
    redis = get_redis()
    await redis.setex(
        cache_key,
        settings.REDIS_PRICE_TTL,
        json.dumps({"price": price, "ticker": ticker}),
    )
    
    print(f"  📈 Fresh price for {ticker}: ${price}")
    return price