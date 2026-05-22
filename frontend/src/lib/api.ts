import { useAuthStore } from '@/store/useAuthStore'

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Error type ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status:  number,
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
  token_type:   string
}

export interface UserResponse {
  id:              string
  email:           string
  virtual_balance: number
  created_at:      string
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request<T>(
  path:    string,
  options: RequestInit = {},
  auth     = false,        // whether to attach JWT
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
  email:    string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body:   JSON.stringify({ email, password }),
  })
}

/**
 * POST /api/v1/auth/login
 * Authenticates and returns a JWT.
 */
export async function loginUser(
  email:    string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body:   JSON.stringify({ email, password }),
  })
}

/**
 * GET /api/v1/auth/me
 * Returns the current user's profile. Requires auth.
 */
export async function getMe(): Promise<UserResponse> {
  return request<UserResponse>('/api/v1/auth/me', {}, true)
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

export interface Transaction {
  id: string
  ticker: string
  action: 'BUY' | 'SELL' | 'HOLD'
  quantity: number
  price: number
  total_value: number
  confidence_score: number
  agent_reasoning?: Record<string, unknown>
  timestamp: string
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