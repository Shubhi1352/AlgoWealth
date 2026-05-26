"""
WatchlistService — handles all watchlist CRUD operations against MongoDB.

Three watchlists:
  - automated_watchlist : stocks that trade via cron, with stop-loss config
  - watchlist_a         : observation only
  - watchlist_b         : observation only

Design pattern: Service Layer
  All database logic lives here, not in the router. The router only handles
  HTTP concerns (auth, request parsing, response formatting).
"""
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.watchlist import (
    AutomatedWatchlistAdd,
    AutomatedWatchlistItem,
    WatchlistItem,
)


# Collection name constants — avoid magic strings throughout the codebase
COLLECTION_AUTOMATED = "automated_watchlist"
COLLECTION_A = "watchlist_a"
COLLECTION_B = "watchlist_b"


class WatchlistService:
    """
    Encapsulates all watchlist operations for a single user.

    Args:
        db: The Motor async MongoDB database instance.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    # ── Automated Watchlist ────────────────────────────────────────────────────

    async def add_to_automated(
        self, user_id: str, payload: AutomatedWatchlistAdd
    ) -> dict:
        """
        Add a stock to the automated watchlist.
        Upserts — if ticker already exists for this user, update stop_loss_pct.

        Args:
            user_id: Authenticated user's ID.
            payload: Ticker + stop_loss_pct from request body.

        Returns:
            The inserted/updated document.
        """
        ticker = payload.ticker.upper().strip()
        now = datetime.now(timezone.utc)

        doc = {
            "user_id": user_id,
            "ticker": ticker,
            "stop_loss_pct": payload.stop_loss_pct,
            "stop_loss_price": None,   # Set later when a BUY executes
            "active": True,
            "added_at": now,
        }

        # Upsert: match on user_id + ticker, update entire doc if exists
        await self.db[COLLECTION_AUTOMATED].update_one(
            {"user_id": user_id, "ticker": ticker},
            {"$set": doc},
            upsert=True,
        )
        return doc

    async def remove_from_automated(self, user_id: str, ticker: str) -> bool:
        """
        Remove a stock from the automated watchlist.

        Returns:
            True if a document was deleted, False if it wasn't found.
        """
        ticker = ticker.upper().strip()
        result = await self.db[COLLECTION_AUTOMATED].delete_one(
            {"user_id": user_id, "ticker": ticker}
        )
        return result.deleted_count > 0

    async def get_automated(self, user_id: str) -> list[AutomatedWatchlistItem]:
        """
        Fetch all stocks in the user's automated watchlist.

        Returns:
            List of AutomatedWatchlistItem, sorted by added_at descending.
        """
        cursor = self.db[COLLECTION_AUTOMATED].find(
            {"user_id": user_id}
        ).sort("added_at", -1)

        items = []
        async for doc in cursor:
            items.append(
                AutomatedWatchlistItem(
                    ticker=doc["ticker"],
                    stop_loss_pct=doc["stop_loss_pct"],
                    stop_loss_price=doc.get("stop_loss_price"),
                    active=doc["active"],
                    added_at=doc["added_at"],
                )
            )
        return items

    async def get_automated_tickers(self, user_id: str) -> list[str]:
        """
        Lightweight helper — returns just the ticker symbols for a user.
        Used by the cron job to know which stocks to analyze.
        """
        cursor = self.db[COLLECTION_AUTOMATED].find(
            {"user_id": user_id, "active": True},
            {"ticker": 1}   # Project only the ticker field
        )
        return [doc["ticker"] async for doc in cursor]

    async def update_stop_loss_price(
        self, user_id: str, ticker: str, price: float
    ) -> None:
        """
        Update the absolute stop_loss_price for a position.
        Called by the portfolio service after a BUY executes.

        Example: buy_price=$200, stop_loss_pct=0.05 → stop_loss_price=$190.
        """
        ticker = ticker.upper().strip()
        await self.db[COLLECTION_AUTOMATED].update_one(
            {"user_id": user_id, "ticker": ticker},
            {"$set": {"stop_loss_price": price}},
        )

    # ── Watchlist A ────────────────────────────────────────────────────────────

    async def add_to_a(self, user_id: str, ticker: str) -> dict:
        """Add a stock to watchlist A (upsert — no duplicates)."""
        return await self._add_to_simple(user_id, ticker, COLLECTION_A)

    async def remove_from_a(self, user_id: str, ticker: str) -> bool:
        """Remove a stock from watchlist A."""
        return await self._remove_from_simple(user_id, ticker, COLLECTION_A)

    async def get_a(self, user_id: str) -> list[WatchlistItem]:
        """Get all stocks in watchlist A."""
        return await self._get_simple(user_id, COLLECTION_A)

    # ── Watchlist B ────────────────────────────────────────────────────────────

    async def add_to_b(self, user_id: str, ticker: str) -> dict:
        """Add a stock to watchlist B (upsert — no duplicates)."""
        return await self._add_to_simple(user_id, ticker, COLLECTION_B)

    async def remove_from_b(self, user_id: str, ticker: str) -> bool:
        """Remove a stock from watchlist B."""
        return await self._remove_from_simple(user_id, ticker, COLLECTION_B)

    async def get_b(self, user_id: str) -> list[WatchlistItem]:
        """Get all stocks in watchlist B."""
        return await self._get_simple(user_id, COLLECTION_B)

    # ── Private helpers (DRY — watchlist A and B are identical in structure) ──

    async def _add_to_simple(
        self, user_id: str, ticker: str, collection: str
    ) -> dict:
        """Shared upsert logic for watchlist A and B."""
        ticker = ticker.upper().strip()
        doc = {
            "user_id": user_id,
            "ticker": ticker,
            "added_at": datetime.now(timezone.utc),
        }
        await self.db[collection].update_one(
            {"user_id": user_id, "ticker": ticker},
            {"$set": doc},
            upsert=True,
        )
        return doc

    async def _remove_from_simple(
        self, user_id: str, ticker: str, collection: str
    ) -> bool:
        """Shared delete logic for watchlist A and B."""
        ticker = ticker.upper().strip()
        result = await self.db[collection].delete_one(
            {"user_id": user_id, "ticker": ticker}
        )
        return result.deleted_count > 0

    async def _get_simple(
        self, user_id: str, collection: str
    ) -> list[WatchlistItem]:
        """Shared fetch logic for watchlist A and B."""
        cursor = self.db[collection].find(
            {"user_id": user_id}
        ).sort("added_at", -1)

        items = []
        async for doc in cursor:
            items.append(
                WatchlistItem(
                    ticker=doc["ticker"],
                    added_at=doc["added_at"],
                )
            )
        return items


    async def update_stop_loss_pct(
        self, user_id: str, ticker: str, stop_loss_pct: float
    ) -> AutomatedWatchlistItem | None:
        """
        Update stop_loss_pct in place — preserves stop_loss_price.
        Returns the updated item, or None if ticker not found.
        """
        ticker = ticker.upper().strip()
        result = await self.db[COLLECTION_AUTOMATED].find_one_and_update(
            {"user_id": user_id, "ticker": ticker},
            {"$set": {"stop_loss_pct": stop_loss_pct}},
            return_document=True,   # returns the document AFTER update
        )
        if not result:
            return None
        return AutomatedWatchlistItem(
            ticker=result["ticker"],
            stop_loss_pct=result["stop_loss_pct"],
            stop_loss_price=result.get("stop_loss_price"),
            active=result["active"],
            added_at=result["added_at"],
        )