# Add to imports:
from app.services.snapshot_service import save_snapshot

# Add this new job function:
async def daily_snapshot_cron():
    """
    Fires at 4:15 PM ET (after NYSE close).
    Snapshots portfolio value for every user with at least one trade.
    """
    logger.info("daily_snapshot_cron: starting")
    db = get_database()

    # Get all distinct user_ids who have transactions
    user_ids = await db["transactions"].distinct("user_id")
    logger.info("daily_snapshot_cron: snapshotting %d users", len(user_ids))

    for user_id in user_ids:
        await save_snapshot(user_id=user_id, db=db, trigger="daily_cron")
        # Small delay to avoid hammering Finnhub
        await asyncio.sleep(1)

    logger.info("daily_snapshot_cron: complete")