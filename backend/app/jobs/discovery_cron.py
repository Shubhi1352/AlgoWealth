"""
Discovery Cron — runs daily at 8AM ET.

For each user:
  1. Get user context (cash, P&L, existing tickers)
  2. Discover candidate tickers via Tavily
  3. Score each candidate: News Agent + Technical Agent + live quote + fit score
  4. Save top 3 by final_score to MongoDB
"""

import asyncio
import logging

from app.db.mongodb import get_database

logger = logging.getLogger(__name__)


async def run_discovery_cron() -> None:
    """
    Main entry point — called by APScheduler and the manual trigger endpoint.
    """
    logger.info("discovery_cron: started")
    db = get_database()

    from app.agents.discovery_agent import discover_candidates, score_candidate
    from app.services.recommendation_service import RecommendationService

    rec_service = RecommendationService(db)
    users = await db["users"].distinct("id")

    logger.info("discovery_cron: processing %d users", len(users))

    for user_id in users:
        try:
            await _process_user(
                user_id=user_id,
                rec_service=rec_service,
                discover_candidates=discover_candidates,
                score_candidate=score_candidate,
            )
        except Exception as e:
            # One user failing must never abort the rest
            logger.error(
                "discovery_cron: failed for user %s: %s",
                user_id[:8], e
            )
            continue

    logger.info("discovery_cron: complete")


async def _process_user(
    user_id: str,
    rec_service,
    discover_candidates,
    score_candidate,
) -> None:
    """
    Run the full discovery + scoring pipeline for one user.
    Separated from the loop so exceptions are isolated per user.
    """
    # ── 1. Get user context ────────────────────────────────────────────────
    context = await rec_service.get_user_context(user_id)
    exclude = context["exclude_tickers"]

    logger.info(
        "discovery_cron: user=%s cash=%.0f pnl_pct=%.2f%% excluding=%s",
        user_id[:8],
        context["cash_balance"],
        context["total_pnl_pct"] * 100,
        exclude,
    )

    # ── 2. Discover candidates ─────────────────────────────────────────────
    candidates = await discover_candidates(exclude_tickers=exclude)

    if not candidates:
        logger.warning("discovery_cron: no candidates found for user %s", user_id[:8])
        return

    logger.info(
        "discovery_cron: found %d candidates for user %s",
        len(candidates), user_id[:8]
    )

    # ── 3. Score candidates concurrently ──────────────────────────────────
    # Score up to 6 candidates — take best 3 after scoring
    # asyncio.gather runs all scoring calls concurrently
    # Each score_candidate call runs News + Technical + quote in parallel internally
    candidates_to_score = candidates[:6]

    scored_results = await asyncio.gather(
        *[
            _safe_score(
                score_candidate=score_candidate,
                ticker=c["ticker"],
                snippet=c["snippet"],
                user_context=context,
            )
            for c in candidates_to_score
        ],
        return_exceptions=False,
    )

    # ── 4. Filter + rank ───────────────────────────────────────────────────
    # Remove failed scores (fit_score == 0 means excluded ticker or scoring error)
    valid = [
        r for r in scored_results
        if r["final_score"] > 0.0 and r["fit_score"] > 0.0
    ]

    if not valid:
        logger.warning(
            "discovery_cron: no valid candidates after scoring for user %s",
            user_id[:8]
        )
        return

    # Sort by final_score descending — top 3
    ranked = sorted(valid, key=lambda x: x["final_score"], reverse=True)
    top3   = ranked[:3]

    logger.info(
        "discovery_cron: top picks for user %s: %s",
        user_id[:8],
        [(r["ticker"], round(r["final_score"], 2)) for r in top3],
    )

    # ── 5. Save ────────────────────────────────────────────────────────────
    await rec_service.save_recommendations(
        user_id=user_id,
        recommendations=top3,
        user_context=context,
    )

    # Polite delay between users — Finnhub + Groq rate limits
    await asyncio.sleep(2)


async def _safe_score(
    score_candidate,
    ticker: str,
    snippet: str,
    user_context: dict,
) -> dict:
    """
    Run score_candidate with a fallback — never raises.
    Returns a zeroed candidate on failure so gather() doesn't abort.
    """
    try:
        return await score_candidate(
            ticker=ticker,
            snippet=snippet,
            user_context=user_context,
        )
    except Exception as e:
        logger.warning("discovery_cron: scoring failed for %s: %s", ticker, e)
        return {
            "ticker":           ticker,
            "final_score":      0.0,
            "fit_score":        0.0,
            "market_score":     0.0,
            "news_signal":      "HOLD",
            "technical_signal": "HOLD",
            "news_summary":     "",
            "technical_summary": "",
            "current_price":    0.0,
            "price_change_pct": 0.0,
            "reasoning":        "Scoring failed",
            "articles":         [],
        }