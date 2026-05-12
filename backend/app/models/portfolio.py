"""
Portfolio data models.

Three core concepts:
- Position:    An open holding (ticker, quantity, avg buy price)
- Transaction: A completed trade with full agent reasoning attached
- PortfolioSummary: Aggregated view for the dashboard
"""

from datetime import datetime, timezone
from typing import Literal
import uuid
from pydantic import BaseModel, Field


class Position(BaseModel):
    """A current open position in the portfolio."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    ticker: str
    quantity: float
    avg_buy_price: float
    current_price: float = 0.0
    current_value: float = 0.0
    unrealized_pnl: float = 0.0       # current_value - (quantity * avg_buy_price)
    unrealized_pnl_pct: float = 0.0   # unrealized_pnl / cost_basis
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class Transaction(BaseModel):
    """A completed trade with full agent reasoning."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    ticker: str
    action: Literal["BUY", "SELL"]
    quantity: float
    price: float                      # Price per share at execution
    total_value: float                # quantity * price
    confidence_score: float
    agent_reasoning: dict             # Full reasoning from Synthesis Agent
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class PortfolioSummary(BaseModel):
    """Aggregated portfolio metrics for the dashboard."""
    user_id: str
    total_value: float         # cash + positions value
    cash_balance: float
    positions_value: float     # sum of all open position values
    total_pnl: float           # total_value - 100_000 (starting balance)
    total_pnl_pct: float       # total_pnl / 100_000
    total_positions: int
    total_trades: int