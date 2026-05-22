"""
Portfolio snapshot service.

Captures a point-in-time portfolio value for a user and persists it to
MongoDB. Called after every trade execution and by the daily 4:15 PM ET cron.

Unique index on (user_id, date) means one canonical snapshot per day —
the last write wins (upsert). The daily cron always fires after market close
so it overwrites any intraday trade-triggered snapshot with the true EOD value.
"""

import logging
from datetime import datetime, timezone, date

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.stock_service import get_stock_price

logger = logging.getLogger(__name__)

SNAPSHOTS_COLLECTION = "portfolio_snapshots"
POSITIONS_COLLECTION = "positions"
USERS_COLLECTION     = "users"


async def save_snapshot(user_id: str, db: AsyncIOMotorDatabase, trigger: str = "trade") -> None:
    """
    Compute and upsert a portfolio value snapshot for a user.

    Args:
        user_id: The user whose portfolio to snapshot.
        db:      Injected async MongoDB client.
        trigger: "trade" | "daily_cron" — stored for debugging.
    """
    try:
        # ── 1. Fetch user cash balance ─────────────────────────────────────
        user = await db[USERS_COLLECTION].find_one({"id": user_id})
        if not user:
            logger.warning("snapshot_service: user not found %s", user_id)
            return

        cash_balance = float(user.get("virtual_balance", 0))

        # ── 2. Fetch all open positions ────────────────────────────────────
        positions = await db[POSITIONS_COLLECTION].find(
            {"user_id": user_id}
        ).to_list(length=100)

        # ── 3. Value each position at current market price ─────────────────
        positions_value = 0.0
        for pos in positions:
            try:
                price = await get_stock_price(pos["ticker"])
                positions_value += float(pos["quantity"]) * price
            except Exception as e:
                logger.warning(
                    "snapshot_service: could not price %s for user %s: %s",
                    pos["ticker"], user_id, e
                )
                # Fall back to cost basis so we don't under-report
                positions_value += float(pos.get("total_invested", 0))

        total_value = cash_balance + positions_value

        # ── 4. Upsert — one document per user per calendar date ────────────
        today = date.today().isoformat()   # "2026-05-21"

        await db[SNAPSHOTS_COLLECTION].update_one(
            {"user_id": user_id, "date": today},
            {
                "$set": {
                    "user_id":          user_id,
                    "date":             today,
                    "total_value":      round(total_value, 2),
                    "cash_balance":     round(cash_balance, 2),
                    "positions_value":  round(positions_value, 2),
                    "trigger":          trigger,
                    "updated_at":       datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

        logger.info(
            "snapshot saved | user=%s date=%s total=%.2f trigger=%s",
            user_id, today, total_value, trigger
        )

    except Exception as e:
        # Snapshot failure must NEVER crash a trade execution
        logger.error("snapshot_service: failed for user %s: %s", user_id, e)


async def ensure_snapshot_indexes(db: AsyncIOMotorDatabase) -> None:
    try:
        await db[SNAPSHOTS_COLLECTION].create_index(
            [("user_id", 1), ("date", 1)],
            unique=True,
        )
        logger.info("snapshot_service: indexes ensured")
    except Exception as e:
        logger.info("snapshot_service: index already exists, skipping: %s", e)