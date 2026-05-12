"""
LangGraph agent graph — wires all agents into an executable pipeline.

Graph structure:
  START → news_agent → fundamental_agent → technical_agent → synthesis_agent → END

We run the three research agents sequentially (simpler to debug) rather
than in parallel. In production you'd use async parallel execution
to cut latency by ~3x.
"""

from langgraph.graph import END, START, StateGraph

from app.agents.state import AgentState
from app.agents.news_agent import news_agent_node
from app.agents.fundamental_agent import fundamental_agent_node
from app.agents.technical_agent import technical_agent_node
from app.agents.synthesis_agent import synthesis_agent_node


def build_trading_graph() -> StateGraph:
    """
    Build and compile the multi-agent trading analysis graph.

    Returns a compiled graph ready to invoke with an initial state.
    """
    graph = StateGraph(AgentState)

    # ── Register nodes ────────────────────────────────────────────────────────
    graph.add_node("news_agent", news_agent_node)
    graph.add_node("fundamental_agent", fundamental_agent_node)
    graph.add_node("technical_agent", technical_agent_node)
    graph.add_node("synthesis_agent", synthesis_agent_node)

    # ── Define edges (execution order) ────────────────────────────────────────
    graph.add_edge(START, "news_agent")
    graph.add_edge("news_agent", "fundamental_agent")
    graph.add_edge("fundamental_agent", "technical_agent")
    graph.add_edge("technical_agent", "synthesis_agent")
    graph.add_edge("synthesis_agent", END)

    return graph.compile()


# Module-level compiled graph — built once, invoked many times
trading_graph = build_trading_graph()