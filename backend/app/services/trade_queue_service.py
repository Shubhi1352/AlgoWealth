"""
Trade Queue Service — manages after-hours trade queuing and processing.

Design pattern: Outbox Pattern (simplified)
  Trades that can't execute immediately are stored in a persistent queue
  (MongoDB). A processor runs at market open to drain the queue.
  This ensures no trade is silently dropped if the market is closed.

Why MongoDB and not Redis for the queue?
  Redis queues (lists/streams) are fast but volatile — a Redis restart
  loses the queue. Trades are financial operations; they must survive
  server restarts. MongoDB gives us persistence + queryability.
"""
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.market_hours import is_market_open
from app.models.portfolio import QueuedTrade

COLLECTION = "trade_queue"


class TradeQueueService:
    """Handles queuing and processing of after-hours trades."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def queue_trade(
        self,
        user_id: str,
        ticker: str,
        action: str,
        confidence: float,
        agent_reasoning: dict,
        source: str = "automated",
        risk_appetite: str = "Moderate",
    ) -> dict:
        """
        Add a trade to the pending queue.
        Called when the market is closed and a trade signal arrives.

        Args:
            user_id:        The user this trade belongs to.
            ticker:         Stock symbol e.g. "NVDA"
            action:         "BUY" or "SELL"
            confidence:     Synthesis agent confidence score (0.0–1.0)
            agent_reasoning: Full reasoning dict from all sub-agents.
            source:         "automated" (cron) or "manual" (user-triggered)

        Returns:
            The queued trade document.
        """
        doc = {
            "user_id": user_id,
            "ticker": ticker.upper(),
            "action": action,
            "confidence": confidence,
            "agent_reasoning": agent_reasoning,
            "queued_at": datetime.now(timezone.utc),
            "status": "pending",
            "source": source,
            "risk_appetite": risk_appetite,
            "executed_at": None,
            "error": None,
        }
        await self.db[COLLECTION].update_one(
            {"user_id": user_id, "ticker": ticker.upper(), "status": "pending"},
            {"$set": doc},
            upsert=True,
        )
        return doc

    async def get_pending_trades(self, user_id: str) -> list[dict]:
        """
        Get all pending trades for a user.
        Used by the portfolio queue endpoint.

        Args:
            user_id: The authenticated user's ID.

        Returns:
            List of pending trade documents, oldest first.
        """
        cursor = self.db[COLLECTION].find(
            {"user_id": user_id, "status": "pending"}
        ).sort("queued_at", 1)   # Oldest first — FIFO execution order

        return [doc async for doc in cursor]

    async def get_all_pending(self) -> list[dict]:
        """
        Get ALL pending trades across all users.
        Called by the cron job at market open to drain the queue.

        Returns:
            All pending trades, oldest first.
        """
        cursor = self.db[COLLECTION].find(
            {"status": "pending"}
        ).sort("queued_at", 1)

        return [doc async for doc in cursor]

    async def mark_executed(self, trade_id: str) -> None:
        """
        Mark a queued trade as successfully executed.

        Args:
            trade_id: MongoDB ObjectId string of the queued trade.
        """
        from bson import ObjectId
        await self.db[COLLECTION].update_one(
            {"_id": ObjectId(trade_id)},
            {
                "$set": {
                    "status": "executed",
                    "executed_at": datetime.now(timezone.utc),
                }
            },
        )

    async def mark_failed(self, trade_id: str, error: str) -> None:
        """
        Mark a queued trade as failed with an error message.
        Trade stays visible in history for debugging — not silently deleted.

        Args:
            trade_id: MongoDB ObjectId string of the queued trade.
            error:    Human-readable error message.
        """
        from bson import ObjectId
        await self.db[COLLECTION].update_one(
            {"_id": ObjectId(trade_id)},
            {
                "$set": {
                    "status": "cancelled",
                    "error": error,
                    "executed_at": datetime.now(timezone.utc),
                }
            },
        )

    async def process_pending_trades(self) -> dict:
        """
        Process all pending trades — called at market open by the cron job.

        For each pending trade:
          1. Re-fetch current price (market may have gapped overnight)
          2. Execute via portfolio service
          3. Mark as executed or failed

        Returns:
            Summary: { processed: int, succeeded: int, failed: int }
        """
        from app.services.portfolio_service import execute_trade

        pending = await self.get_all_pending()

        if not pending:
            return {"processed": 0, "succeeded": 0, "failed": 0}

        succeeded = 0
        failed = 0

        for trade in pending:
            trade_id = str(trade["_id"])
            try:
                await execute_trade(
                    user_id=trade["user_id"],
                    ticker=trade["ticker"],
                    action=trade["action"],
                    confidence=trade["confidence"],
                    agent_reasoning=trade["agent_reasoning"],
                    risk_appetite=trade.get("risk_appetite", "Moderate"),
                    db=self.db,
                )
                await self.mark_executed(trade_id)
                succeeded += 1
                print(f"  ✅ Executed queued trade: {trade['action']} {trade['ticker']} for user {trade['user_id']}")

            except Exception as e:
                await self.mark_failed(trade_id, str(e))
                failed += 1
                print(f"  ❌ Failed queued trade {trade_id}: {e}")

        return {
            "processed": len(pending),
            "succeeded": succeeded,
            "failed": failed,
        }