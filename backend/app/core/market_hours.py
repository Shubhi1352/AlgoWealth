"""
Market hours utility — checks if the US stock market (NYSE) is currently open.

Uses the exchange-calendars library which contains the full NYSE calendar
including all public holidays (Christmas, Thanksgiving, early closes etc.)

Why not just check 9:30-4PM Monday-Friday?
  That misses ~10 market holidays per year and early closes (e.g. day after
  Thanksgiving closes at 1PM). Getting this wrong means executing trades at
  stale prices — corrupting portfolio P&L metrics.
"""
import exchange_calendars as xcals
from datetime import datetime
from zoneinfo import ZoneInfo   # Python 3.9+ standard library

# NYSE timezone — all market hours are Eastern Time
NYSE_TZ = ZoneInfo("America/New_York")

# Load the NYSE calendar once at module level — not per call
# This is an in-memory object, no network call needed
_nyse = xcals.get_calendar("XNYS")


def is_market_open() -> bool:
    """
    Check if the NYSE is currently open for trading.

    Returns:
        True if market is open right now, False otherwise.

    Examples:
        Monday 10:00 AM ET  → True
        Monday 9:29 AM ET   → False (pre-market)
        Saturday any time   → False
        Christmas Day       → False (holiday)
    """
    now = datetime.now(NYSE_TZ)
    return _nyse.is_open_on_minute(now)


def get_next_open() -> datetime:
    """
    Get the next market open time.
    Used for scheduling queued trades to execute at market open.

    Returns:
        datetime of the next NYSE open in Eastern Time.
    """
    now = datetime.now(NYSE_TZ)
    next_open = _nyse.next_open(now)
    # Convert from UTC (exchange-calendars default) to ET for readability
    return next_open.astimezone(NYSE_TZ)


def get_market_status() -> dict:
    """
    Return a human-readable market status dict for the API response.

    Returns:
        {
            "is_open": bool,
            "current_time_et": str,
            "next_open": str | None   # None if market is currently open
        }
    """
    now = datetime.now(NYSE_TZ)
    open_now = _nyse.is_open_on_minute(now)

    return {
        "is_open": open_now,
        "current_time_et": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "next_open": None if open_now else get_next_open().strftime("%Y-%m-%d %H:%M:%S %Z"),
    }