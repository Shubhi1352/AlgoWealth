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
import finnhub
import redis.asyncio as aioredis

from app.core.config import settings

# Redis client — module level singleton
_redis: aioredis.Redis | None = None

# Finnhub client — synchronous but fast
_finnhub_client: finnhub.Client | None = None


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