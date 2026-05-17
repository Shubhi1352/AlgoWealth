"""
Document ingestion API endpoint.

Accepts PDF uploads and runs them through the RAG pipeline.
Protected — only authenticated users can upload documents.
"""

from typing import Literal
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user_id
from app.services.ingest_service import ingest_pdf
from app.core.dependencies import get_db
from app.db.qdrant import get_qdrant_client
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()

# Max file size: 20MB (in bytes)
MAX_FILE_SIZE = 20 * 1024 * 1024


class IngestResponse(BaseModel):
    """Response schema for successful ingestion."""
    message: str
    filename: str
    collection: str
    chunks_ingested: int
    ticker: str | None


@router.post("/document", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    collection: Literal["trading_strategies", "financials"] = Query(...),
    ticker: str | None = Query(None, description="Stock ticker, e.g. NVDA"),
    document_type: str = Query(default="unknown", description="e.g. 10K, earnings, strategy"),
    user_id: str = Depends(get_current_user_id),
) -> IngestResponse:
    """
    Upload and ingest a PDF into the RAG knowledge base.

    - collection: 'trading_strategies' for strategy docs, 'financials' for filings
    - ticker: required when collection is 'financials'
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted",
        )

    # Read file bytes and check size
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of 20MB",
        )

    # Validate ticker is provided for financials
    if collection == "financials" and not ticker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ticker is required when collection is 'financials'",
        )

    try:
        result = await ingest_pdf(
            pdf_bytes=pdf_bytes,
            filename=file.filename,
            collection=collection,
            ticker=ticker.upper() if ticker else None,
            document_type=document_type,
        )
        return IngestResponse(
            message="Document ingested successfully",
            **result,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        ) from e


@router.get("/documents")
async def list_documents(
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    List all documents in the knowledge base.
    Shows what the agents are reading from.
    """
    cursor = db["document_registry"].find(
        {}, {"_id": 0}
    ).sort("ingested_at", -1)

    docs = [doc async for doc in cursor]
    return {"documents": docs, "count": len(docs)}


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Delete a document from the registry and remove its chunks from Qdrant.
    """
    # Find the document first
    doc = await db["document_registry"].find_one({"id": doc_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {doc_id} not found",
        )

    # Delete chunks from Qdrant by filtering on source filename
    qdrant = get_qdrant_client()
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    await qdrant.delete(
        collection_name=doc["collection"],
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="source",
                    match=MatchValue(value=doc["filename"]),
                )
            ]
        ),
    )

    # Remove from registry
    await db["document_registry"].delete_one({"id": doc_id})

    print(f"  🗑️ Deleted {doc['filename']} from {doc['collection']}")
    return {
        "message": f"Document '{doc['filename']}' deleted successfully",
        "collection": doc["collection"],
        "ticker": doc.get("ticker"),
    }