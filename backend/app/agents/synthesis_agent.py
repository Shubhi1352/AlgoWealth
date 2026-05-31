"""
Synthesis Agent — combines all signals into a final trading decision.

Applies configurable weights to each agent's signal and produces
a final BUY/SELL/HOLD decision with confidence score and reasoning.

Weight config (must sum to 1.0):
- News Agent:        0.35
- Technical Agent:   0.35
- Fundamental Agent: 0.30

Confidence threshold and position sizing are driven by the user's
risk_appetite setting (Conservative / Moderate / Aggressive).
"""

from app.agents.state import AgentState
from app.models.user import RISK_CONFIG

# Signal weights — must sum to 1.0
NEWS_WEIGHT = 0.35
TECHNICAL_WEIGHT = 0.35
FUNDAMENTAL_WEIGHT = 0.30

# Signal → numeric score mapping for weighted calculation
SIGNAL_SCORES = {"BUY": 1.0, "HOLD": 0.0, "SELL": -1.0}


async def synthesis_agent_node(state: AgentState) -> dict:
    """
    LangGraph node function for the Synthesis Agent.

    Reads risk_appetite from state to apply per-user thresholds.
    """
    ticker        = state["ticker"]
    risk_appetite = state.get("risk_appetite", "Moderate")
    config        = RISK_CONFIG[risk_appetite]
    threshold     = config["confidence_threshold"]
    prompt_hint   = config["prompt_hint"]

    print(f"⚖️  Synthesis Agent | {ticker} | risk={risk_appetite} | threshold={threshold}")

    news        = state.get("news_signal", {})
    technical   = state.get("technical_signal", {})
    fundamental = state.get("fundamental_signal", {})

    # ── Weighted vote ─────────────────────────────────────────────────────────
    news_score = SIGNAL_SCORES.get(news.get("signal", "HOLD"), 0.0)
    tech_score = SIGNAL_SCORES.get(technical.get("signal", "HOLD"), 0.0)
    fund_score = SIGNAL_SCORES.get(fundamental.get("signal", "HOLD"), 0.0)

    weighted_score = (
        news_score  * NEWS_WEIGHT
        + tech_score  * TECHNICAL_WEIGHT
        + fund_score  * FUNDAMENTAL_WEIGHT
    )

    confidence = abs(weighted_score)

    if confidence < threshold:
        decision         = "HOLD"
        reasoning_prefix = f"Low confidence ({confidence:.0%}) below {threshold:.0%} threshold [{risk_appetite}] — holding"
    elif weighted_score > 0:
        decision         = "BUY"
        reasoning_prefix = f"Bullish consensus (confidence: {confidence:.0%}) [{risk_appetite}]"
    else:
        decision         = "SELL"
        reasoning_prefix = f"Bearish consensus (confidence: {confidence:.0%}) [{risk_appetite}]"

    reasoning = _build_reasoning(
        prefix=reasoning_prefix,
        prompt_hint=prompt_hint,
        news=news,
        technical=technical,
        fundamental=fundamental,
    )

    print(f"  ⚖️  Decision: {decision} | Confidence: {confidence:.0%}")

    return {
        "decision":   decision,
        "confidence": round(confidence, 4),
        "reasoning":  reasoning,
    }


def _build_reasoning(
    prefix:      str,
    prompt_hint: str,
    news:        dict,
    technical:   dict,
    fundamental: dict,
) -> str:
    return (
        f"{prefix}\n"
        f"Strategy: {prompt_hint}\n\n"
        f"News Agent (weight: {NEWS_WEIGHT}) → {news.get('signal', 'N/A')}\n"
        f"  {news.get('summary', 'No summary')}\n\n"
        f"Technical Agent (weight: {TECHNICAL_WEIGHT}) → {technical.get('signal', 'N/A')}\n"
        f"  {technical.get('summary', 'No summary')}\n\n"
        f"Fundamental Agent (weight: {FUNDAMENTAL_WEIGHT}) → {fundamental.get('signal', 'N/A')}\n"
        f"  {fundamental.get('summary', 'No summary')}"
    )