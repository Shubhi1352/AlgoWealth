"""
Retrieval service — semantic search over Qdrant collections.

Used by agents to find relevant document chunks for a given query.
This is the RAG "retrieval" step — the "generation" step happens
inside each agent using the retrieved chunks as context.
"""

from qdrant_client.models import Filter, FieldCondition, MatchValue

from app.core.config import settings
from app.db.qdrant import get_qdrant_client
from sentence_transformers import SentenceTransformer

_embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


async def retrieve_chunks(
    query: str,
    collection: str,
    top_k: int = 4,
    ticker: str | None = None,
) -> list[dict]:
    """
    Semantic search: embed a query and retrieve the top-k matching chunks.

    Args:
        query:      Natural language query from an agent.
        collection: Which Qdrant collection to search.
        top_k:      Number of results to return.
        ticker:     If provided, filter results to this ticker only.

    Returns:
        List of chunk dicts with text, source, page, and score.
    """
    # Embed the query using the same model used during ingestion
    # (vectors must be in the same space to be comparable)
    query_vector = _embedding_model.encode(query).tolist()

    # Build optional ticker filter
    search_filter = None
    if ticker:
        search_filter = Filter(
            must=[
                FieldCondition(
                    key="ticker",
                    match=MatchValue(value=ticker.upper()),
                )
            ]
        )

    client = get_qdrant_client()
    results = await client.search(
        collection_name=collection,
        query_vector=query_vector,
        limit=top_k,
        query_filter=search_filter,
        with_payload=True,   # Return metadata alongside vectors
    )

    return [
        {
            "text": hit.payload["text"],
            "source": hit.payload["source"],
            "page": hit.payload["page"],
            "ticker": hit.payload.get("ticker"),
            "score": round(hit.score, 4),  # Cosine similarity score
        }
        for hit in results
    ]