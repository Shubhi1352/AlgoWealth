"""
LangGraph agent state definition.

AgentState is the single shared object that flows through every node
in the graph. Each agent reads what it needs and writes its output
back to the state. LangGraph passes this between nodes automatically.

Think of it as a baton in a relay race — each runner (agent) picks
it up, does their job, and hands it to the next runner.
"""

from typing import Annotated, Literal, TypedDict
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    Shared state for the multi-agent trading analysis graph.

    All fields are optional except ticker and user_id — agents
    populate their respective signal fields as they run.
    """

    # ── Input ─────────────────────────────────────────────────────────────────
    ticker: str                          # Stock to analyze e.g. "NVDA"
    user_id: str                         # Who triggered the analysis

    # ── Conversation history (append-only via add_messages reducer) ───────────
    messages: Annotated[list, add_messages]

    # ── Sub-agent outputs (populated as each agent runs) ──────────────────────
    news_signal: dict        # {sentiment: float, articles: list, signal: str}
    fundamental_signal: dict # {summary: str, signal: str, sources: list}
    technical_signal: dict   # {indicators: dict, signal: str, sources: list}

    # ── Final decision (populated by Synthesis Agent) ─────────────────────────
    decision: Literal["BUY", "SELL", "HOLD"] | None
    confidence: float        # 0.0 – 1.0
    reasoning: str           # Human-readable explanation shown in the UI

    # ── Graph routing ─────────────────────────────────────────────────────────
    next: str                # Which node runs next (set by Supervisor)  