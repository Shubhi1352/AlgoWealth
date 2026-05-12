"""
Synthesis Agent — combines all signals into a final trading decision.

Applies configurable weights to each agent's signal and produces
a final BUY/SELL/HOLD decision with confidence score and reasoning.

Weight config (must sum to 1.0):
- News Agent:        0.35
- Technical Agent:   0.35
- Fundamental Agent: 0.30

Confidence < 0.5 always overrides to HOLD — we don't trade on weak signals.
"""

from app.agents.state import AgentState

# Signal weights — must sum to 1.0
NEWS_WEIGHT = 0.35
TECHNICAL_WEIGHT = 0.35
FUNDAMENTAL_WEIGHT = 0.30

# Minimum confidence to place a trade — below this → HOLD
MIN_CONFIDENCE_THRESHOLD = 0.50

# Signal → numeric score mapping for weighted calculation
SIGNAL_SCORES = {"BUY": 1.0, "HOLD": 0.0, "SELL": -1.0}


async def synthesis_agent_node(state: AgentState) -> dict:
    """
    LangGraph node function for the Synthesis Agent.

    Reads all three signal dicts from state, applies weighted voting,
    and writes the final decision back to state.
    """
    ticker = state["ticker"]
    print(f"⚖️  Synthesis Agent deciding for: {ticker}")

    news = state.get("news_signal", {})
    technical = state.get("technical_signal", {})
    fundamental = state.get("fundamental_signal", {})

    # ── Weighted vote ─────────────────────────────────────────────────────────
    news_score = SIGNAL_SCORES.get(news.get("signal", "HOLD"), 0.0)
    tech_score = SIGNAL_SCORES.get(technical.get("signal", "HOLD"), 0.0)
    fund_score = SIGNAL_SCORES.get(fundamental.get("signal", "HOLD"), 0.0)

    weighted_score = (
        news_score * NEWS_WEIGHT
        + tech_score * TECHNICAL_WEIGHT
        + fund_score * FUNDAMENTAL_WEIGHT
    )

    # ── Convert score to decision ─────────────────────────────────────────────
    # weighted_score ranges from -1.0 (all SELL) to +1.0 (all BUY)
    # Confidence = how far from 0 (uncertainty) toward ±1 (certainty)
    confidence = abs(weighted_score)

    if confidence < MIN_CONFIDENCE_THRESHOLD:
        decision = "HOLD"
        reasoning_prefix = f"Low confidence ({confidence:.0%}) — insufficient signal agreement"
    elif weighted_score > 0:
        decision = "BUY"
        reasoning_prefix = f"Bullish consensus (confidence: {confidence:.0%})"
    else:
        decision = "SELL"
        reasoning_prefix = f"Bearish consensus (confidence: {confidence:.0%})"

    # ── Build human-readable reasoning for the UI ─────────────────────────────
    reasoning = _build_reasoning(
        prefix=reasoning_prefix,
        news=news,
        technical=technical,
        fundamental=fundamental,
        news_score=news_score,
        tech_score=tech_score,
        fund_score=fund_score,
    )

    print(f"  ⚖️  Decision: {decision} | Confidence: {confidence:.0%}")

    return {
        "decision": decision,
        "confidence": round(confidence, 4),
        "reasoning": reasoning,
    }


def _build_reasoning(
    prefix: str,
    news: dict,
    technical: dict,
    fundamental: dict,
    news_score: float,
    tech_score: float,
    fund_score: float,
) -> str:
    """Build the human-readable reasoning string shown in the trade log UI."""
    return (
        f"{prefix}\n\n"
        f"News Agent (weight: {NEWS_WEIGHT}) → {news.get('signal', 'N/A')}\n"
        f"  {news.get('summary', 'No summary')}\n\n"
        f"Technical Agent (weight: {TECHNICAL_WEIGHT}) → {technical.get('signal', 'N/A')}\n"
        f"  {technical.get('summary', 'No summary')}\n\n"
        f"Fundamental Agent (weight: {FUNDAMENTAL_WEIGHT}) → {fundamental.get('signal', 'N/A')}\n"
        f"  {fundamental.get('summary', 'No summary')}"
    )