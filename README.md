# AlgoWealth

> Autonomous multi-agent AI system for intelligent paper trading

AlgoWealth is a full-stack paper trading platform where a pipeline of specialized AI agents collaborates to research stocks and make autonomous BUY/SELL/HOLD decisions using virtual currency. Built as a production-grade portfolio project demonstrating real-time AI agent orchestration, RAG pipelines, WebSocket streaming, and a polished ocean-themed frontend.

---

## Architecture Overview

```
User Request / Cron Trigger
        │
        ▼
  LangGraph Pipeline
  ┌─────────────────────────────────────┐
  │  News Agent      → Tavily + Groq    │
  │  Fundamental Agent → Qdrant RAG     │
  │  Technical Agent   → Qdrant RAG     │
  │  Synthesis Agent   → Weighted Vote  │
  └─────────────────────────────────────┘
        │
        ▼
  Decision: BUY / SELL / HOLD + Confidence
        │
        ├── auto_execute=True  (cron)  → Execute Trade
        └── auto_execute=False (chat/manual) → Return Analysis Only
```

### Agent Pipeline

| Agent | Data Source | Output |
|-------|-------------|--------|
| News Agent | Tavily live search + Groq sentiment | `news_signal` |
| Fundamental Agent | Qdrant RAG over 10-K filings | `fundamental_signal` |
| Technical Agent | Qdrant RAG over trading strategy docs | `technical_signal` |
| Synthesis Agent | Weighted vote (news 35%, technical 35%, fundamental 30%) | `decision`, `confidence` |

Risk appetite (Conservative / Moderate / Aggressive) drives confidence thresholds and position sizing per user.

---

## Tech Stack

**Backend**
- FastAPI — async API + WebSocket server
- LangGraph — multi-agent orchestration (sequential pipeline)
- LangChain — text splitting, Groq LLM wrapper
- Groq LLaMA 3.3 70B — LLM inference
- Qdrant — vector store for RAG (financial filings + trading strategies)
- MongoDB — users, positions, transactions, watchlists, snapshots
- Redis (Upstash) — price cache (5min TTL), news cache (1hr TTL)
- APScheduler — trading cron (1hr), stop loss check (15min), discovery (8AM ET), snapshot (4:15PM ET)
- Tavily — live news search
- Finnhub — real-time stock quotes
- Twelve Data — OHLCV candlestick data

**Frontend**
- Next.js 15 (App Router, TypeScript)
- Zustand — auth state + chat state (persisted to localStorage)
- SWR — data fetching with background polling and keepPreviousData
- Recharts — P&L area charts
- lightweight-charts — TradingView-style candlestick charts
- CSS Modules — scoped per-component styles
- Ocean-themed design system with parallax background and floating creatures

**Infra**
- Docker Compose — MongoDB, Qdrant, Redis
- Render — FastAPI backend
- Vercel — Next.js frontend

---

## Features

### AI Agent System
- 4-node LangGraph pipeline runs sequentially per ticker
- Weighted consensus across news, technical, and fundamental signals
- Per-user risk appetite configuration drives position sizing and confidence thresholds
- `auto_execute` flag cleanly separates cron-triggered trades from chat/manual analysis

### Portfolio Engine
- Virtual $100,000 starting balance
- Automated position sizing: `confidence × position_size_pct × cash_balance`
- Manual trades with exact share quantity
- Stop loss monitoring every 15 minutes during market hours
- Daily portfolio snapshots at market close

### AI Chat Assistant
- Floating WebSocket chat widget on all dashboard pages
- Page-aware context injection — assistant knows what page you're on and loads relevant data
- Streams Groq responses token by token
- Intent routing: stock analysis triggers live agent pipeline (no auto-trade), document queries hit Qdrant RAG
- Hallucination guard — refuses to fabricate data not in context

### Watchlist System
- Automated watchlist — tickers the cron analyzes hourly
- Watchlist A / B — manual curated lists
- Configurable stop loss per ticker (% based)

### Document Knowledge Base
- Upload PDFs (10-K filings, trading strategy documents)
- PyMuPDF extraction → LangChain chunking → Qdrant embedding
- Filtered retrieval by ticker for fundamental analysis

### Dashboard Pages
- Dashboard — KPIs, P&L chart, recent trades, AI recommendations
- Stocks — browse grid, search, watchlist management
- Stock Detail — candlestick chart, trade execution, AI analysis modal
- Portfolio — positions table, allocation bars, history chart
- Trades — expandable AI reasoning per trade
- Watchlists — automated + A/B management
- Profile — preferences, knowledge base management, account reset
- AI Chat — floating assistant across all pages

---

## Project Structure

```
algowealth/
├── backend/
│   └── app/
│       ├── api/v1/          # Routers (auth, stocks, portfolio, watchlists, ingest, chat)
│       ├── agents/          # LangGraph nodes (news, fundamental, technical, synthesis)
│       ├── core/            # Config, dependencies, security, market hours
│       ├── db/              # MongoDB + Qdrant connection management
│       ├── jobs/            # APScheduler cron jobs
│       ├── models/          # Pydantic models (user, portfolio, stock)
│       └── services/        # Business logic (portfolio, stock, watchlist, chat, RAG)
└── frontend/
    └── src/
        ├── app/             # Next.js App Router pages
        ├── components/      # UI components (chat, sidebar, ocean, ui primitives)
        ├── hooks/           # useAuthGuard, useChat
        ├── lib/             # api.ts (all API calls), tickers.ts
        └── store/           # Zustand stores (auth, chat)
```

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop

### Backend

```bash
cd algowealth/backend
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```env
JWT_SECRET_KEY=your-32-char-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=algowealth
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
FINNHUB_API_KEY=...
TWELVE_DATA_API_KEY=...
TAVILY_API_KEY=tvly-...
```

### Frontend

```bash
cd algowealth/frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Run

```bash
# Terminal 1 — infrastructure
docker compose up -d

# Terminal 2 — backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Reference

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me
GET    /api/v1/stocks/{ticker}
GET    /api/v1/stocks/{ticker}/chart
POST   /api/v1/stocks/analyze
GET    /api/v1/stocks/recommended
GET    /api/v1/portfolio/
GET    /api/v1/portfolio/positions
GET    /api/v1/portfolio/transactions
GET    /api/v1/portfolio/history
POST   /api/v1/portfolio/trade
POST   /api/v1/portfolio/reset
PATCH  /api/v1/portfolio/preferences
GET/POST/DELETE /api/v1/watchlists/watchlists/automated
GET/POST/DELETE /api/v1/watchlists/watchlists/a
GET/POST/DELETE /api/v1/watchlists/watchlists/b
POST   /api/v1/ingest/document
GET    /api/v1/ingest/documents
DELETE /api/v1/ingest/documents/{doc_id}
WS     /api/v1/chat/ws
```

Full interactive docs at `http://localhost:8000/docs`

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Agent orchestration | LangGraph sequential | Simpler to debug than parallel at MVP scale |
| LLM provider | Groq LLaMA 3.3 70B | Fast inference, generous free tier for development |
| Vector store | Qdrant | Supports filtered retrieval by ticker metadata |
| Auto-execute boundary | `auto_execute` flag per call site | Clean separation: cron trades, chat never does |
| Position sizing | `confidence × risk_pct × cash` | Risk appetite drives trade size, not just threshold |
| Chat context | Page-aware system prompt | Assistant answers are grounded in what user sees |
| Token storage | Zustand + localStorage | Acceptable for paper trading demo; noted in security section |

---

## Security Notes

- JWT tokens stored in localStorage via Zustand persist — acceptable for a paper trading demo, not for production financial systems
- No real money, no real brokerage integration
- All trading is simulated with virtual currency

---

## License

MIT