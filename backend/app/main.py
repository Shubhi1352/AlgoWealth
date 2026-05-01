"""
AlgoWealth FastAPI application entry point.

This module creates the FastAPI app instance, registers routers,
and configures middleware. It is intentionally thin — business logic
lives in services/, agents/, and api/v1/.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


def create_app() -> FastAPI:
    """
    Application factory pattern.

    Returns a configured FastAPI instance. Using a factory function
    (rather than a module-level app variable) makes the app easier
    to test — each test can create a fresh app instance.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        description="Autonomous multi-agent RAG system for intelligent paper trading",
        docs_url="/docs",          # Swagger UI
        redoc_url="/redoc",        # ReDoc UI
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Allows the Next.js frontend (port 3000) to talk to this API (port 8000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # Tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    # We import routers here (not at module top-level) to avoid circular imports
    from app.api.v1.health import router as health_router
    app.include_router(health_router, prefix="/api/v1", tags=["health"])

    return app


# Create the app instance — Uvicorn imports this
app = create_app()