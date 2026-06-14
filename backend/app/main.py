"""
AlgoWealth FastAPI application entry point.

Intentionally thin — business logic lives in services/, agents/, and api/v1/.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongodb import connect_db, disconnect_db, get_database
from app.core.scheduler import start_scheduler, stop_scheduler
from app.db.qdrant import connect_qdrant, disconnect_qdrant


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown.
    Everything before yield runs on startup.
    Everything after yield runs on shutdown.
    """
    # ── Startup ────────────────────────────────────────────────────────────
    print(f"🚀 Starting {settings.APP_NAME}...")

    await connect_db()
    await connect_qdrant()

    # ── One-time index creation ────────────────────────────────────────────
    # Safe to call every startup — MongoDB skips if index already exists
    from app.services.recommendation_service import RecommendationService
    from app.services.snapshot_service import ensure_snapshot_indexes

    db = get_database()
    await RecommendationService(db).ensure_indexes()
    await ensure_snapshot_indexes(db)

    start_scheduler()

    print(f"✅ {settings.APP_NAME} ready")

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    print(f"🛑 Shutting down {settings.APP_NAME}...")
    stop_scheduler()
    await disconnect_db()
    await disconnect_qdrant()
    print("👋 Shutdown complete")


def create_app() -> FastAPI:
    """
    Application factory — returns a configured FastAPI instance.
    Factory pattern makes testing easier: each test gets a fresh app.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        description="Autonomous multi-agent RAG system for intelligent paper trading",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ───────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ────────────────────────────────────────────────────────────
    # Imported here to avoid circular imports at module load time
    from app.api.v1.health import router as health_router
    from app.api.v1.auth import router as auth_router
    from app.api.v1.ingest import router as ingest_router
    from app.api.v1.stocks import router as stocks_router
    from app.api.v1.portfolio import router as portfolio_router
    from app.api.v1.watchlists import router as watchlists_router
    from app.api.v1.chat import router as chat_router

    app.include_router(health_router,     prefix="/api/v1",            tags=["health"])
    app.include_router(auth_router,       prefix="/api/v1/auth",       tags=["auth"])
    app.include_router(ingest_router,     prefix="/api/v1/ingest",     tags=["ingest"])
    app.include_router(stocks_router,     prefix="/api/v1/stocks",     tags=["stocks"])
    app.include_router(portfolio_router,  prefix="/api/v1/portfolio",  tags=["portfolio"])
    app.include_router(watchlists_router, prefix="/api/v1/watchlists", tags=["watchlists"])
    app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])

    return app


app = create_app()