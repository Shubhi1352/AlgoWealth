"""
Health check endpoint.

Used by Docker Compose, load balancers, and CI pipelines to verify
the service is alive and responsive. A health endpoint is the first
thing a DevOps engineer looks for in any production service.
"""

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response schema for the health check endpoint."""
    status: str
    app_name: str
    version: str


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Returns service health status.

    This endpoint intentionally has no auth — monitoring tools
    and Docker health checks need to call it without credentials.
    """
    return HealthResponse(
        status="healthy",
        app_name="AlgoWealth",
        version="0.1.0",
    )