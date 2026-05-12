"""
AlgoWealth FastAPI application entry point.

This module creates the FastAPI app instance, registers routers,
and configures middleware. It is intentionally thin — business logic
lives in services/, agents/, and api/v1/.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongodb import connect_db, disconnect_db
from app.db.qdrant import connect_qdrant, disconnect_qdrant


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown events.

    Everything before `yield` runs on startup.
    Everything after `yield` runs on shutdown.
    This is the modern replacement for @app.on_event("startup").
    """
    # ── Startup ──────────────────────────────────────────────────
    print(f"🚀 Starting {settings.APP_NAME}...")
    await connect_db()
    await connect_qdrant()

    yield # App is running and serving requests here

    # ── Shutdown ─────────────────────────────────────────────────────────────
    print(f"🛑 Shutting down {settings.APP_NAME}...")
    await disconnect_db()
    await disconnect_qdrant()

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
        lifespan=lifespan,
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
    from app.api.v1.auth import router as auth_router
    from app.api.v1.ingest import router as ingest_router
    from app.api.v1.stocks import router as stocks_router
    
    app.include_router(health_router, prefix="/api/v1", tags=["health"])
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(ingest_router, prefix="/api/v1/ingest", tags=["ingest"])
    app.include_router(stocks_router, prefix="/api/v1/stocks", tags=["stocks"])

    return app


# Create the app instance — Uvicorn imports this
app = create_app()