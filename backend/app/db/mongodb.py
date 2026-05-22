"""
MongoDB connection management using Motor (async MongoDB driver).

We use a module-level client so the connection pool is created once
at startup and reused across all requests — not recreated per request,
which would be extremely slow and exhaust connections quickly.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

# Module-level client — created once, shared across all requests
# This is the Connection Pool pattern
_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    """Return the shared Motor client, raising if not initialized."""
    if _client is None:
        raise RuntimeError("MongoDB client not initialized. Call connect_db() first.")
    return _client


def get_database() -> AsyncIOMotorDatabase:
    """Return the application database instance."""
    return get_client()[settings.MONGODB_DB_NAME]


async def create_indexes() -> None:
    """
    Create compound indexes on all watchlist collections.
    Called once at startup — MongoDB skips creation if index already exists,
    so this is safe to call every time the app boots.
    """
    db = get_database()
    for collection_name in ["automated_watchlist", "watchlist_a", "watchlist_b"]:
        await db[collection_name].create_index(
            [("user_id", 1), ("ticker", 1)],
            unique=True,
            background=True,
        )
        await db["trade_queue"].create_index(
            [("user_id", 1), ("ticker", 1), ("status", 1)],
            unique=True,
            partialFilterExpression={"status": "pending"},  # Only enforces uniqueness on pending trades
            background=True,
        )
        await db["trade_queue"].create_index(
            [("status", 1), ("queued_at", 1)],
            background=True,
        )
        await db["portfolio_snapshots"].create_index(
            [("user_id", 1), ("date", 1)],
            unique=True,
            background=True,
        )
    print("✅ MongoDB indexes created")


async def connect_db() -> None:
    """
    Initialize the MongoDB connection pool.
    Called once at application startup via FastAPI lifespan.
    """
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=5000,  # Fail fast if Mongo is unreachable
    )
    # Verify connection is actually alive
    await _client.admin.command("ping")
    print(f"✅ Connected to MongoDB: {settings.MONGODB_URL}")

    await create_indexes()


async def disconnect_db() -> None:
    """
    Close the MongoDB connection pool.
    Called once at application shutdown via FastAPI lifespan.
    """
    global _client
    if _client is not None:
        _client.close()
        _client = None
        print("🔌 Disconnected from MongoDB")