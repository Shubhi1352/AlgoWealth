# AlgoWealth

> Autonomous multi-agent RAG system for intelligent paper trading

An AI-powered platform where specialized agents collaborate to research stocks and make autonomous BUY/SELL/HOLD decisions using virtual currency.

## Stack

**Backend:** FastAPI · LangGraph · LangChain · OpenAI GPT-4o · Qdrant · MongoDB · Redis · LangSmith  
**Frontend:** Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Recharts  
**Infra:** Docker Compose · GitHub Actions

## Agent Architecture
Supervisor Agent
├── News Agent       → Tavily live news + sentiment
├── Fundamental Agent → RAG over financial filings
├── Technical Agent  → RAG over trading strategies
├── Synthesis Agent  → BUY/SELL/HOLD + confidence score
├── Portfolio Agent  → Execute trades in MongoDB
└── Reflection Agent → Periodic trade review

## Setup

Coming soon — project is under active development.

## License

MIT