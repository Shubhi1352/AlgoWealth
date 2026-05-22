"""
Recommendation Service — stores and retrieves personalized stock recommendations.

Schema: one document per user containing top-3 ranked recommendations.
Upsert pattern — each discovery cron run overwrites the previous result.

Document structure:
{
    "user_id": str,
    "recommendations": [
        {
            "ticker": str,
            "news_signal": "BUY"|"SELL"|"HOLD",
            "technical_signal": "BUY"|"SELL"|"HOLD",
            "news_summary": str,
            "technical_summary": str,
            "current_price": float,
            "price_change_pct": float,
            "market_score": float,
            "fit_score": float,
            "final_score": float,
            "reasoning": str,
            "articles": list,
        },
        ...  # up to 3 items, sorted by final_score desc
    ],
    "generated_at": datetime,
    "user_context_snapshot": {
        "cash_balance": float,
        "total_pnl_pct": float,
        "open_positions": int,
    }
}
"""

import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

COLLECTION       = "recommended_stocks"
USERS_COLLECTION = "users"


class RecommendationService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    # ── Indexes ────────────────────────────────────────────────────────────
    async def ensure_indexes(self) -> None:
        try:
            await self.db[COLLECTION].create_index(
                [("user_id", 1)],
                unique=True,
            )
            logger.info("RecommendationService: indexes ensured")
        except Exception as e:
            # Index already exists — safe to continue
            logger.info("RecommendationService: index already exists, skipping: %s", e)

    # ── User Context ───────────────────────────────────────────────────────
    async def get_user_context(self, user_id: str) -> dict:
        """
        Collect the user's current portfolio state for personalization.

        Returns:
            {
                exclude_tickers: list[str],
                cash_balance:    float,
                total_pnl_pct:   float,   ← NEW
                open_positions:  int,     ← NEW
            }
        """
        exclude: set[str] = set()

        # Tickers already in positions
        async for pos in self.db["positions"].find({"user_id": user_id}):
            exclude.add(pos["ticker"])

        # Tickers across all three watchlists
        for col in ["automated_watchlist", "watchlist_a", "watchlist_b"]:
            async for doc in self.db[col].find({"user_id": user_id}):
                exclude.add(doc["ticker"])

        # User financial state
        user = await self.db[USERS_COLLECTION].find_one({"id": user_id})
        cash_balance = float(user.get("virtual_balance", 0)) if user else 0.0

        # P&L from portfolio summary
        # total_pnl_pct stored in portfolio or computed from transactions
        total_pnl_pct  = 0.0
        open_positions = 0
        try:
            positions = await self.db["positions"].find(
                {"user_id": user_id}
            ).to_list(length=100)

            open_positions = len(positions)

            total_invested = sum(
                float(p.get("total_invested", 0)) for p in positions
            )
            # Rough P&L pct from most recent portfolio snapshot
            snapshot = await self.db["portfolio_snapshots"].find_one(
                {"user_id": user_id},
                sort=[("date", -1)],   # most recent
            )
            if snapshot:
                total_value    = float(snapshot.get("total_value", cash_balance))
                starting       = 100_000.0
                total_pnl_pct  = (total_value - starting) / starting

        except Exception as e:
            logger.warning(
                "get_user_context: could not compute P&L for %s: %s",
                user_id, e
            )

        return {
            "exclude_tickers": list(exclude),
            "cash_balance":    cash_balance,
            "total_pnl_pct":   total_pnl_pct,
            "open_positions":  open_positions,
        }

    # ── Save ───────────────────────────────────────────────────────────────
    async def save_recommendations(
        self,
        user_id: str,
        recommendations: list[dict],
        user_context: dict,
    ) -> None:
        """
        Upsert top-3 recommendations for a user.
        Overwrites any previous recommendation document.

        Args:
            user_id:         Target user.
            recommendations: List of scored candidate dicts (max 3),
                             sorted by final_score descending.
            user_context:    Snapshot of user state at generation time.
        """
        doc = {
            "user_id":         user_id,
            "recommendations": recommendations[:3],   # hard cap at 3
            "generated_at":    datetime.now(timezone.utc),
            "user_context_snapshot": {
                "cash_balance":   round(user_context.get("cash_balance", 0), 2),
                "total_pnl_pct":  round(user_context.get("total_pnl_pct", 0), 4),
                "open_positions": user_context.get("open_positions", 0),
            },
        }

        await self.db[COLLECTION].update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True,
        )

        tickers = [r["ticker"] for r in recommendations[:3]]
        logger.info(
            "recommendations saved | user=%s tickers=%s",
            user_id[:8], tickers
        )

    # ── Fetch ──────────────────────────────────────────────────────────────
    async def get_recommendations(self, user_id: str) -> dict | None:
        """
        Get the current top-3 recommendations for a user.

        Returns the full document or None if no recommendations exist yet.
        """
        return await self.db[COLLECTION].find_one(
            {"user_id": user_id},
            {"_id": 0},
        )