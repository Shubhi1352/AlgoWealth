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