"""
Recommendation Service — generates and stores personalized stock recommendations.

One recommendation per user per day. Stored in MongoDB recommended_stocks collection.
"""
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

COLLECTION = "recommended_stocks"


class RecommendationService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get_user_context(self, user_id: str) -> dict:
        """
        Collect what the user already holds and watches.
        Used to exclude these from recommendations.

        Returns:
            {
                exclude_tickers: list[str],  # All tickers to skip
                cash_balance: float,
            }
        """
        exclude = set()

        # Tickers in positions
        async for pos in self.db["positions"].find({"user_id": user_id}):
            exclude.add(pos["ticker"])

        # Tickers in all three watchlists
        for collection in ["automated_watchlist", "watchlist_a", "watchlist_b"]:
            async for doc in self.db[collection].find({"user_id": user_id}):
                exclude.add(doc["ticker"])

        # Cash balance
        user = await self.db["users"].find_one({"id": user_id})
        cash = float(user.get("virtual_balance", 0)) if user else 0.0

        return {
            "exclude_tickers": list(exclude),
            "cash_balance": cash,
        }

    async def save_recommendation(
        self,
        user_id: str,
        ticker: str,
        sentiment_score: float,
        summary: str,
        articles: list,
    ) -> None:
        """
        Save recommendation for a user — one per user (upsert).
        Replaces any previous recommendation.
        """
        doc = {
            "user_id": user_id,
            "ticker": ticker,
            "sentiment_score": sentiment_score,
            "summary": summary,
            "articles": articles,
            "generated_at": datetime.now(timezone.utc),
        }
        await self.db[COLLECTION].update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True,
        )

    async def get_recommendation(self, user_id: str) -> dict | None:
        """Get the current recommendation for a user."""
        return await self.db[COLLECTION].find_one(
            {"user_id": user_id},
            {"_id": 0},
        )