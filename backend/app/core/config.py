"""
Application configuration using pydantic-settings.

All environment variables are read from .env and validated at startup.
If a required variable is missing, the app refuses to start — fail fast,
fail loudly, rather than silently failing at 2AM in production.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Typed configuration class.

    pydantic-settings reads values from environment variables (or .env file)
    and validates types at startup. No more scattered os.environ.get() calls.
    """

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "AlgoWealth"
    DEBUG: bool = False

    # ── Authentication ────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str                           # Required — no default
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24            # 24 hours

    # ── MongoDB ───────────────────────────────────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "algowealth"

    # ── Qdrant ────────────────────────────────────────────────────────────────
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION_STRATEGIES: str = "trading_strategies"
    QDRANT_COLLECTION_FINANCIALS: str = "financials"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PRICE_TTL: int = 300    # 5 minutes
    REDIS_NEWS_TTL: int = 3600    # 1 hour

    # ── GROQ ────────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_EMBEDDING_MODEL: str = "llama-3.2-3b-preview"

    # ── Tavily ────────────────────────────────────────────────────────────────
    TAVILY_API_KEY: str = ""

    # ── FinnHub ─────────────────────────────────────────────────────────
    FINNHUB_API_KEY: str = ""

    # ── TwelveData ─────────────────────────────────────────────────────────
    TWELVE_DATA_API_KEY: str = ""

    # ── LangSmith ────────────────────────────────────────────────────────────
    LANGCHAIN_TRACING_V2: bool = True
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = "algowealth"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",         # Silently ignore unknown env vars
    }


# Module-level singleton — import this everywhere instead of instantiating again
settings = Settings()