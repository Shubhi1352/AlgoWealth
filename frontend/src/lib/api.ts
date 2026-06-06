import { useAuthStore } from '@/store/useAuthStore'
import useSWR, { SWRConfiguration } from 'swr'

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Error type ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public detail?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Response types ────────────────────────────────────────────────────────────
export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface UserResponse {
  id: string
  email: string
  virtual_balance: number
  created_at: string
  risk_appetite: 'Conservative' | 'Moderate' | 'Aggressive'
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false,        // whether to attach JWT
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (auth) {
    const token = useAuthStore.getState().token
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  // Parse body regardless of status — FastAPI returns detail on errors
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const detail = (body as { detail?: string })?.detail ?? 'Something went wrong'
    throw new ApiError(res.status, detail as string, body)
  }

  return body as T
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new account and returns a JWT.
 */
export async function registerUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

/**
 * POST /api/v1/auth/login
 * Authenticates and returns a JWT.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

/**
 * GET /api/v1/portfolio/me
 * Returns the current user's profile. Requires auth.
 */
export async function getMe(): Promise<UserResponse> {
  return request<UserResponse>('/api/v1/portfolio/me', {}, true)
}

// ── Authorized fetcher for SWR ─────────────────────────────────────────────
export async function authorizedFetcher<T>(
  url: string,
  token: string
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json() as Promise<T>
}

// ── Portfolio summary types ────────────────────────────────────────────────
export interface PortfolioSummary {
  user_id: string
  total_value: number
  cash_balance: number
  positions_value: number
  total_pnl: number
  total_pnl_pct: number
  total_positions: number
  total_trades: number
}

// ── Agent reasoning shapes ────────────────────────────────────────────────────

export interface AgentSignalBase {
  signal: 'BUY' | 'SELL' | 'HOLD'
  summary: string
}

export interface NewsArticle {
  title: string
  url: string
}

export interface NewsSignal extends AgentSignalBase {
  sentiment: number
  articles: NewsArticle[]
}

export interface AIReasoning {
  decision: string
  confidence: number
  reasoning: string
  news_signal: NewsSignal
  technical_signal: TechnicalSignal
  fundamental_signal: FundamentalSignal
}

export interface ManualReasoning {
  manual: true
  note: string
}

export type AgentReasoning = AIReasoning | ManualReasoning

export function isManualTrade(r: AgentReasoning): r is ManualReasoning {
  return 'manual' in r && r.manual === true
}

// ── Transaction ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  ticker: string
  action: 'BUY' | 'SELL' | 'HOLD'
  quantity: number
  price: number
  total_value: number
  confidence_score: number
  agent_reasoning: AgentReasoning
  timestamp: string
}

export async function fetchTransactions(token: string): Promise<Transaction[]> {
  return authorizedFetcher<Transaction[]>(`${BASE_URL}/api/v1/portfolio/transactions`, token)
}

export interface RecommendedStock {
  ticker: string
  news_signal: 'BUY' | 'SELL' | 'HOLD'
  technical_signal: 'BUY' | 'SELL' | 'HOLD'
  news_summary: string
  technical_summary: string
  current_price: number
  price_change_pct: number
  market_score: number
  fit_score: number
  final_score: number
  reasoning: string
  articles: { title: string; url: string }[]
}

export interface RecommendationsResponse {
  recommendations: RecommendedStock[]
  generated_at: string | null
  user_context_snapshot?: {
    cash_balance: number
    total_pnl_pct: number
    open_positions: number
  }
}

export interface PortfolioSnapshot {
  date: string
  total_value: number
  cash_balance: number
  positions_value: number
}

export interface PortfolioHistory {
  history: PortfolioSnapshot[]
}

// ─── Stock Detail ────────────────────────────────────────────────────────────

export interface StockQuote {
  ticker: string
  current_price: number
  open: number
  high: number
  low: number
  prev_close: number
  change: number
  change_pct: number
  cached: boolean
}

export interface CompanyProfile {
  ticker: string
  name: string
  sector: string
  market_cap: number        // in millions USD
  logo_url: string
  exchange: string
  ipo_date: string
}

export interface StockDetail {
  quote: StockQuote
  company: CompanyProfile
}

// ─── Stock Detail Types ────────────────────────────────────────────────────

export interface Position {
  ticker: string
  quantity: number
  avg_buy_price: number
  current_price: number
  current_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

export interface TradeRequest {
  ticker: string
  action: 'BUY' | 'SELL'
  confidence: number
  quantity: number
  trade_type: 'manual' | 'automated'
}

export interface TradeResult {
  ticker: string
  action: 'BUY' | 'SELL'
  quantity: number
  price: number
  total_value: number
  message: string
}

export interface RagSource {
  text: string
  source: string
  page: number
  ticker: string | null
  score: number
}

export interface FundamentalSignal extends AgentSignalBase {
  sources: RagSource[]
}

export interface TechnicalSignal extends AgentSignalBase {
  sources: RagSource[]
}

export interface AnalyzeResponse {
  ticker: string
  decision: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  news_signal: NewsSignal
  fundamental_signal: FundamentalSignal
  technical_signal: TechnicalSignal
  trade_executed: boolean
}

export interface CandlePoint {
  time: number   // unix timestamp (seconds)
  open: number
  high: number
  low: number
  close: number
}

// ─── Stock Detail API Functions ────────────────────────────────────────────

export async function fetchPositions(token: string): Promise<Position[]> {
  return authorizedFetcher<Position[]>(`${BASE_URL}/api/v1/portfolio/positions`, token)
}

export async function fetchChart(
  ticker: string,
  token: string,
  days: number = 90
): Promise<CandlePoint[]> {
  const res = await fetch(
    `${BASE_URL}/api/v1/stocks/${ticker}/chart?resolution=D&days=${days}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error('Failed to fetch chart data')
  const data = await res.json()
  // Backend returns { candles: [...] } — adjust if your shape differs
  return (data.bars ?? []).map((b: {
    timestamp: number
    open: number
    high: number
    low: number
    close: number
  }) => ({
    time: b.timestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }))
}

export async function executeTrade(
  req: TradeRequest,
  token: string
): Promise<TradeResult> {
  const res = await fetch(`${BASE_URL}/api/v1/portfolio/trade`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Trade failed')
  }
  return res.json()
}

export async function analyzeStock(
  ticker: string,
  token: string
): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/stocks/analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ticker }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Analysis failed')
  }
  return res.json()
}

// ── Watchlist types ───────────────────────────────────────────────────────────

export interface WatchlistEntry {
  ticker: string
  stop_loss_pct: number
  stop_loss_price: number | null
  active: boolean
  added_at?: string
}

export type WatchlistType = 'automated' | 'a' | 'b'

// ── Watchlist fetchers ────────────────────────────────────────────────────────

export async function fetchWatchlist(
  list: WatchlistType,
  token: string
): Promise<WatchlistEntry[]> {
  const res = await fetch(`${BASE_URL}/api/v1/watchlists/watchlists/${list}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch watchlist')
  const data = await res.json()
  if (Array.isArray(data)) return data
  if (Array.isArray(data.items)) return data.items
  return data.watchlist ?? []
}

export async function addToWatchlist(
  ticker: string,
  list: WatchlistType,
  token: string,
  stopLossPct: number = 0.05
): Promise<void> {
  const body = list === 'automated'
    ? { ticker, stop_loss_pct: stopLossPct }
    : { ticker }

  const res = await fetch(`${BASE_URL}/api/v1/watchlists/watchlists/${list}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to add to watchlist')
}

export async function removeFromWatchlist(
  ticker: string,
  list: WatchlistType,
  token: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/v1/watchlists/watchlists/${list}/${ticker}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) throw new Error('Failed to remove from watchlist')
}

export async function fetchStockDetail(
  ticker: string,
  token: string
): Promise<StockDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/stocks/${ticker}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch ${ticker}`)
  return res.json()
}

export async function updateStopLoss(
  ticker: string,
  stopLossPct: number,   // decimal e.g. 0.05 for 5%
  token: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/v1/watchlists/watchlists/automated/${ticker}/stop-loss`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ stop_loss_pct: stopLossPct }),
    }
  )
  if (!res.ok) throw new Error('Failed to update stop loss')
}

// Reset portfolio

export async function resetPortfolio(token: string): Promise<{ message: string; cash_balance: number }> {
  const res = await fetch(`${BASE_URL}/api/v1/portfolio/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Reset failed')
  }
  return res.json()
}


// ── Ingest / Knowledge Base ───────────────────────────────────────────────

export interface IngestDocument {
  id: string
  filename: string
  collection: 'trading_strategies' | 'financials'
  chunks_count: number
  document_type: string
  ingested_at: string
  ticker: string | null
  supersedes: string | null
}

export interface IngestListResponse {
  documents: IngestDocument[]
  count: number
}

export interface IngestUploadResponse {
  message: string
  filename: string
  collection: string
  chunks_ingested: number
  ticker: string | null
}

export async function fetchDocuments(token: string): Promise<IngestListResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/ingest/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

export async function deleteDocument(docId: string, token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/ingest/documents/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to delete document')
}

export async function uploadDocument(
  file: File,
  collection: 'trading_strategies' | 'financials',
  token: string,
  ticker?: string,
  documentType?: string,
): Promise<IngestUploadResponse> {
  const params = new URLSearchParams({ collection })
  if (ticker) params.set('ticker', ticker.toUpperCase())
  if (documentType) params.set('document_type', documentType)

  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${BASE_URL}/api/v1/ingest/document?${params}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Upload failed')
  }
  return res.json()
}

export async function updatePreferences(
  riskAppetite: 'Conservative' | 'Moderate' | 'Aggressive',
  token: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/portfolio/preferences`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ risk_appetite: riskAppetite }),
  })
  if (!res.ok) throw new Error('Failed to update preferences')
}

// ── Custom SWR Hooks ─────────────────────────────────────────────────────────

const SWR_DEFAULTS: SWRConfiguration = {
  revalidateOnFocus: false,
  keepPreviousData: true,
}

export function usePositions(config?: SWRConfiguration) {
  const token = useAuthStore(s => s.token)
  return useSWR<Position[]>(
    token ? ['/api/v1/portfolio/positions', token] : null,
    ([, tok]) => fetchPositions(tok as string),
    { ...SWR_DEFAULTS, ...config }
  )
}

export function useTransactions(config?: SWRConfiguration) {
  const token = useAuthStore(s => s.token)
  return useSWR<Transaction[]>(
    token ? ['/api/v1/portfolio/transactions', token] : null,
    ([, tok]) => fetchTransactions(tok as string),
    { ...SWR_DEFAULTS, ...config }
  )
}

export function useWatchlist(list: WatchlistType, config?: SWRConfiguration) {
  const token = useAuthStore(s => s.token)
  return useSWR<WatchlistEntry[]>(
    token ? [`/api/v1/watchlists/watchlists/${list}`, token] : null,
    ([, tok]) => fetchWatchlist(list, tok as string),
    { ...SWR_DEFAULTS, ...config }
  )
}

export function usePortfolioSummary(config?: SWRConfiguration) {
  const token = useAuthStore(s => s.token)
  return useSWR<PortfolioSummary>(
    token ? ['/api/v1/portfolio/', token] : null,
    ([, tok]) => authorizedFetcher<PortfolioSummary>(`${BASE_URL}/api/v1/portfolio/`, tok as string),
    { ...SWR_DEFAULTS, ...config }
  )
}

export function usePortfolioHistory(config?: SWRConfiguration) {
  const token = useAuthStore(s => s.token)
  return useSWR<PortfolioHistory>(
    token ? ['/api/v1/portfolio/history', token] : null,
    ([, tok]) => authorizedFetcher<PortfolioHistory>(`${BASE_URL}/api/v1/portfolio/history`, tok as string),
    { ...SWR_DEFAULTS, ...config }
  )
}
