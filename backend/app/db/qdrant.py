"""
Qdrant vector database client and collection management.

Qdrant stores vector embeddings alongside metadata (payload).
We use two separate collections:
- trading_strategies: RSI, MACD, Bollinger Band strategy docs
- financials: 10-K filings, earnings reports per ticker

Separate collections let each agent tune retrieval independently
(different top-k, different filters) without interference.
"""

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams

from app.core.config import settings

# Module-level singleton — same pattern as MongoDB client
_client: AsyncQdrantClient | None = None

# Embedding dimension for all-MiniLM-L6-v2
EMBEDDING_DIMENSION = 384


def get_qdrant_client() -> AsyncQdrantClient:
    """Return the shared Qdrant client, raising if not initialized."""
    if _client is None:
        raise RuntimeError("Qdrant client not initialized. Call connect_qdrant() first.")
    return _client


async def connect_qdrant() -> None:
    """
    Initialize Qdrant client and ensure collections exist.
    Called once at application startup via lifespan.
    """
    global _client
    _client = AsyncQdrantClient(url=settings.QDRANT_URL)

    # Create collections if they don't already exist
    await _ensure_collection(settings.QDRANT_COLLECTION_STRATEGIES)
    await _ensure_collection(settings.QDRANT_COLLECTION_FINANCIALS)

    print(f"✅ Connected to Qdrant: {settings.QDRANT_URL}")


async def disconnect_qdrant() -> None:
    """Close Qdrant client on application shutdown."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
        print("🔌 Disconnected from Qdrant")


async def _ensure_collection(collection_name: str) -> None:
    """
    Create a Qdrant collection if it doesn't exist.
    Safe to call on every startup — idempotent.

    Args:
        collection_name: Name of the collection to create.
    """
    existing = await _client.collection_exists(collection_name)
    if not existing:
        await _client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=EMBEDDING_DIMENSION,
                distance=Distance.COSINE,  # Best for text similarity
            ),
        )
        print(f"  📦 Created Qdrant collection: {collection_name}")
    else:
        print(f"  📦 Qdrant collection exists: {collection_name}")