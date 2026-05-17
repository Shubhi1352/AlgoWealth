"""
APScheduler setup for AlgoWealth background jobs.

Uses AsyncIOScheduler — runs jobs in the same event loop as FastAPI,
so async jobs work natively without threading complications.

Jobs registered here:
  - trading_cron    : every 1 hour — analyze automated watchlist, execute trades
  - stop_loss_check : every 15 min — check positions against stop loss prices
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Module-level scheduler instance — started once at app startup
# Same pattern as the MongoDB client: one instance, shared across the app
scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    """
    Register all jobs and start the scheduler.
    Called once during FastAPI lifespan startup, after DB connections are ready.
    """
    # ── Job 1: Automated trading cron ─────────────────────────────────────────
    # Imports are inside the function to avoid circular imports at module load time
    from app.jobs.trading_cron import run_trading_cron

    scheduler.add_job(
        run_trading_cron,
        trigger=IntervalTrigger(hours=1),
        id="trading_cron",
        name="Automated Trading Cron",
        replace_existing=True,      # Safe to call start_scheduler() multiple times
        max_instances=1,            # Never run two trading crons simultaneously
        misfire_grace_time=300,     # If job misfires, still run if within 5min
    )

    # ── Job 2: Stop loss checker ──────────────────────────────────────────────
    from app.jobs.stop_loss_checker import run_stop_loss_check

    scheduler.add_job(
        run_stop_loss_check,
        trigger=IntervalTrigger(minutes=15),
        id="stop_loss_check",
        name="Stop Loss Checker",
        replace_existing=True,
        max_instances=1,            # Never overlap — price checks must be sequential
        misfire_grace_time=60,
    )

    # ── Job 3: Discovery cron ─────────────────────────────────────────────────
    from app.jobs.discovery_cron import run_discovery_cron
    from apscheduler.triggers.cron import CronTrigger

    scheduler.add_job(
        run_discovery_cron,
        trigger=CronTrigger(hour=8, minute=0, timezone="America/New_York"),  # 8AM ET daily
        id="discovery_cron",
        name="Daily Stock Discovery",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    print("✅ Scheduler started — trading cron (1hr), stop loss check (15min), discovery cron (8AM ET)")


def stop_scheduler() -> None:
    """
    Gracefully shut down the scheduler.
    Called during FastAPI lifespan shutdown — waits for running jobs to finish.
    """
    if scheduler.running:
        scheduler.shutdown(wait=True)   # wait=True: finish current job before shutting down
        print("🔌 Scheduler stopped")