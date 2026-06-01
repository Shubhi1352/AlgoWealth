"""
Document ingestion pipeline: PDF → chunks → embeddings → Qdrant.

This service is the entry point for all RAG knowledge.
It is called by the /ingest/document endpoint and runs
the full pipeline synchronously (suitable for background tasks later).
"""

import uuid
from typing import Literal

import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
from qdrant_client.models import PointStruct

from app.core.config import settings
from app.db.qdrant import get_qdrant_client
from sentence_transformers import SentenceTransformer
import uuid
from datetime import datetime, timezone
from app.db.mongodb import get_database

# Collection type alias for clarity
CollectionName = Literal["trading_strategies", "financials"]

# Chunking config — defined as constants, not magic numbers
CHUNK_SIZE = 500        # tokens per chunk (approximate)
CHUNK_OVERLAP = 50      # token overlap between chunks to preserve context

_embedding_model: SentenceTransformer | None = None

def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        print("📦 Loading embedding model...")
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


async def ingest_pdf(
    pdf_bytes: bytes,
    filename: str,
    collection: CollectionName,
    ticker: str | None = None,
    document_type: str = "unknown",
) -> dict:
    """
    Full ingestion pipeline for a PDF document.

    Steps:
    1. Extract text from PDF using PyMuPDF
    2. Split text into overlapping chunks
    3. Embed each chunk with OpenAI
    4. Upsert vectors into Qdrant with metadata

    Args:
        pdf_bytes:   Raw PDF file bytes from the HTTP upload.
        filename:    Original filename — stored as metadata for citations.
        collection:  Which Qdrant collection to store in.
        ticker:      Stock ticker if this is a financial filing (e.g. "NVDA").

    Returns:
        Dict with ingestion summary (chunk count, collection, filename).
    """
    # ── Step 1: Extract text ──────────────────────────────────────────────────
    pages = _extract_text_from_pdf(pdf_bytes, filename)
    if not pages:
        raise ValueError(f"No text could be extracted from {filename}")

    # ── Step 2: Chunk text ────────────────────────────────────────────────────
    chunks = _split_into_chunks(pages)
    if not chunks:
        raise ValueError(f"No chunks produced from {filename}")

    # ── Step 3: Embed chunks ──────────────────────────────────────────────────
    vectors = await _embed_chunks([c["text"] for c in chunks])

    # ── Step 4: Upsert to Qdrant ──────────────────────────────────────────────
    await _upsert_to_qdrant(
        collection=collection,
        chunks=chunks,
        vectors=vectors,
        filename=filename,
        ticker=ticker,
    )

    # ── Step 5: Save to document registry ────────────────────────────────────
    await _save_to_registry(
        filename=filename,
        collection=collection,
        ticker=ticker,
        document_type=document_type,
        chunks_count=len(chunks),
    )

    return {
        "filename": filename,
        "collection": collection,
        "chunks_ingested": len(chunks),
        "ticker": ticker,
    }


def _extract_text_from_pdf(pdf_bytes: bytes, filename: str) -> list[dict]:
    """
    Extract text from each page of a PDF using PyMuPDF.

    Returns:
        List of dicts: [{page: int, text: str}, ...]
    """
    pages = []
    # fitz.open with stream= reads from bytes (no disk write needed)
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text().strip()
            if text:  # Skip blank pages
                pages.append({"page": page_num, "text": text})

    print(f"  📄 Extracted {len(pages)} pages from {filename}")
    return pages


def _split_into_chunks(pages: list[dict]) -> list[dict]:
    """
    Split page text into overlapping chunks using LangChain's splitter.

    We use RecursiveCharacterTextSplitter which tries to split on
    paragraph breaks first, then sentences, then words — preserving
    semantic coherence as much as possible.

    Returns:
        List of dicts: [{text: str, page: int, chunk_index: int}, ...]
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,  # Character count (proxy for tokens)
    )

    all_chunks = []
    chunk_index = 0

    for page_data in pages:
        page_chunks = splitter.split_text(page_data["text"])
        for chunk_text in page_chunks:
            all_chunks.append({
                "text": chunk_text,
                "page": page_data["page"],
                "chunk_index": chunk_index,
            })
            chunk_index += 1

    print(f"  ✂️  Split into {len(all_chunks)} chunks")
    return all_chunks


async def _embed_chunks(texts: list[str]) -> list[list[float]]:
    """
    Embed text chunks using a local SentenceTransformer model.
    Runs locally — no API calls, no cost, no rate limits.
    Model: all-MiniLM-L6-v2 → 384-dimensional vectors.
    """
    # encode() is synchronous but fast for small batches
    vectors = get_embedding_model().encode(texts, show_progress_bar=False).tolist()
    print(f"  🔢 Embedded {len(vectors)} chunks")
    return vectors


async def _upsert_to_qdrant(
    collection: str,
    chunks: list[dict],
    vectors: list[list[float]],
    filename: str,
    ticker: str | None,
) -> None:
    """
    Upsert vector points into Qdrant with metadata payload.

    Each point has:
    - id:      Unique UUID (allows re-ingestion without duplicates)
    - vector:  The embedding (1536 floats)
    - payload: Metadata used for filtering and citations in the UI

    Upsert = insert if not exists, update if exists (idempotent).
    """
    client = get_qdrant_client()

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "text": chunk["text"],          # The actual chunk content
                "source": filename,              # For citations in the UI
                "page": chunk["page"],           # Page number for citations
                "chunk_index": chunk["chunk_index"],
                "ticker": ticker,                # None for strategy docs
                "collection": collection,
            },
        )
        for chunk, vector in zip(chunks, vectors)
    ]

    await client.upsert(collection_name=collection, points=points)
    print(f"  ✅ Upserted {len(points)} points into '{collection}'")  


async def _save_to_registry(
    filename: str,
    collection: str,
    ticker: str | None,
    document_type: str,
    chunks_count: int,
    supersedes: str | None = None,
) -> str:
    """
    Save ingestion record to the document_registry collection.
    Returns the generated document ID.
    """
    db = get_database()
    doc_id = str(uuid.uuid4())

    doc = {
        "id": doc_id,
        "collection": collection,
        "ticker": ticker,
        "document_type": document_type,
        "filename": filename,
        "chunks_count": chunks_count,
        "ingested_at": datetime.now(timezone.utc),
        "supersedes": supersedes,
    }

    await db["document_registry"].update_one(
        # Upsert on filename — re-ingesting same file updates the record
        {"filename": filename, "collection": collection},
        {"$set": doc},
        upsert=True,
    )
    print(f"  📋 Registry updated: {filename} ({chunks_count} chunks)")
    return doc_id