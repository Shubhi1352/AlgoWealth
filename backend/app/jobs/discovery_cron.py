"""
Discovery Cron — runs once daily to generate personalized recommendations.
Registered in scheduler.py as a daily job.
"""
from app.db.mongodb import get_database


async def run_discovery_cron() -> None:
    """
    For each user, find the best stock they aren't already watching.
    Saves one recommendation per user to MongoDB.
    """
    print("\n🔍 Discovery cron started")
    db = get_database()

    from app.agents.discovery_agent import discover_candidates, score_candidate
    from app.services.recommendation_service import RecommendationService

    rec_service = RecommendationService(db)

    # Get all users
    users = await db["users"].distinct("id")
    print(f"  👥 Generating recommendations for {len(users)} users")

    for user_id in users:
        try:
            # Get user context — what to exclude
            context = await rec_service.get_user_context(user_id)
            exclude = context["exclude_tickers"]

            print(f"  👤 User {user_id[:8]}... excluding: {exclude}")

            # Discover candidates
            candidates = await discover_candidates(exclude_tickers=exclude)

            if not candidates:
                print(f"  ⚠️ No candidates found for user {user_id[:8]}")
                continue

            # Score each candidate — take top 3 to limit API calls
            best = None
            best_score = -1.0

            for candidate in candidates[:3]:
                scored = await score_candidate(
                    ticker=candidate["ticker"],
                    snippet=candidate["snippet"],
                )
                if scored["sentiment"] > best_score:
                    best_score = scored["sentiment"]
                    best = {**candidate, **scored}

            if best and best_score > 0.5:   # Only recommend if genuinely positive
                await rec_service.save_recommendation(
                    user_id=user_id,
                    ticker=best["ticker"],
                    sentiment_score=best["sentiment"],
                    summary=best["summary"],
                    articles=best.get("articles", []),
                )
                print(f"  ✅ Recommended {best['ticker']} "
                      f"(sentiment: {best_score:.2f}) for user {user_id[:8]}")
            else:
                print(f"  ℹ️ No strong candidate found for user {user_id[:8]}")

        except Exception as e:
            print(f"  ❌ Discovery failed for user {user_id[:8]}: {e}")
            continue

    print("✅ Discovery cron complete\n")