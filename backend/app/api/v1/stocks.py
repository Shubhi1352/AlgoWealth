"""
Stock analysis API endpoint.

Triggers the full multi-agent analysis pipeline for a given ticker
and returns the decision with full reasoning.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user_id
from app.agents.graph import trading_graph

router = APIRouter()


class AnalysisRequest(BaseModel):
    """Request body for stock analysis."""
    ticker: str


class AnalysisResponse(BaseModel):
    """Response with full agent decision and reasoning."""
    ticker: str
    decision: str
    confidence: float
    reasoning: str
    news_signal: dict
    fundamental_signal: dict
    technical_signal: dict


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_stock(
    request: AnalysisRequest,
    user_id: str = Depends(get_current_user_id),
) -> AnalysisResponse:
    """
    Trigger full multi-agent analysis for a stock ticker.
    Runs: News Agent → Fundamental Agent → Technical Agent → Synthesis Agent
    """
    ticker = request.ticker.upper().strip()
    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticker cannot be empty",
        )

    try:
        # Invoke the LangGraph pipeline with initial state
        result = await trading_graph.ainvoke({
            "ticker": ticker,
            "user_id": user_id,
            "messages": [],
            "news_signal": {},
            "fundamental_signal": {},
            "technical_signal": {},
            "decision": None,
            "confidence": 0.0,
            "reasoning": "",
            "next": "",
        })

        return AnalysisResponse(
            ticker=ticker,
            decision=result["decision"],
            confidence=result["confidence"],
            reasoning=result["reasoning"],
            news_signal=result["news_signal"],
            fundamental_signal=result["fundamental_signal"],
            technical_signal=result["technical_signal"],
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}",
        ) from e