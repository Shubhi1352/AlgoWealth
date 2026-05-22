'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  authorizedFetcher,
  type PortfolioSummary,
  type Transaction,
  type RecommendationsResponse,
} from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import PnLChart from '@/components/ui/PnLChart'
import RecommendedCard from '@/components/ui/RecommendedCard'
import s from './dashboard.module.css'
import RecentTrades from '@/components/ui/RecentTrades'
import FloatingElement from '@/components/elements/FloatingElement'
import { Shark } from '@/components/elements/shapes'
import { PortfolioHistory } from '@/lib/api'

// ── Icons ──────────────────────────────────────────────────────────────────
function IconWallet() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  )
}
function IconCash() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
function IconPnL() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="1,12 5,7 9,10 15,3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="11,3 15,3 15,7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconPositions() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router   = useRouter()
  const isAuthed = useIsAuthed()
  const isReady  = useIsReady()
  const token    = useToken()

  const API = process.env.NEXT_PUBLIC_API_URL

  // ── ALL hooks before any conditional return ────────────────────────────
  const { data: portfolio, isLoading: portLoading } = useSWR<PortfolioSummary>(
    token ? [`${API}/api/v1/portfolio/`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<PortfolioSummary>(url, tok),
    { refreshInterval: 30_000, revalidateOnFocus: true }
  )

  const { data: transactions, isLoading: txLoading } = useSWR<Transaction[]>(
    token ? [`${API}/api/v1/portfolio/transactions`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<Transaction[]>(url, tok),
    { refreshInterval: 60_000 }
  )

  const { data: historyData, isLoading: histLoading } = useSWR<PortfolioHistory>(
    token ? [`${API}/api/v1/portfolio/history`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<PortfolioHistory>(url, tok),
    { refreshInterval: 60_000 }
  )

  const { data: recData, isLoading: recLoading } = useSWR<RecommendationsResponse>(
    token ? [`${API}/api/v1/stocks/recommended`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<RecommendationsResponse>(url, tok),
    { refreshInterval: 300_000 }
  )

  // ── Auth redirect — after all hooks ───────────────────────────────────
  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

  // ── Guard — after all hooks ────────────────────────────────────────────
  if (!isReady || !isAuthed) return null

  // ── Derived values ─────────────────────────────────────────────────────
  const pnl    = portfolio?.total_pnl ?? 0
  const pnlPct = portfolio?.total_pnl_pct ?? 0
  const trend  = pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'neutral'

  return (
    <div className={s.page}>
      {/* ── KPI row ── */}
      <div className={s.metricsGrid}>
        <MetricCard
          label="Total Value"
          value={portLoading ? '—' : fmt(portfolio?.total_value ?? 0)}
          sub="Portfolio + cash"
          trend="neutral"
          icon={<IconWallet />}
          loading={portLoading}
        />
        <MetricCard
          label="Cash Balance"
          value={portLoading ? '—' : fmt(portfolio?.cash_balance ?? 0)}
          sub="Available to trade"
          trend="neutral"
          icon={<IconCash />}
          loading={portLoading}
        />
        <MetricCard
          label="Total P&L"
          value={portLoading ? '—' : fmt(pnl)}
          sub={portLoading ? undefined : `${fmtPct(pnlPct)} all time`}
          trend={trend}
          icon={<IconPnL />}
          loading={portLoading}
        />
        <MetricCard
          label="Open Positions"
          value={portLoading ? '—' : String(portfolio?.total_positions ?? 0)}
          sub={portLoading ? undefined : `${portfolio?.total_trades ?? 0} total trades`}
          trend="neutral"
          icon={<IconPositions />}
          loading={portLoading}
        />
      </div>

      {/* ── Bottom row ── */}
      <div className={s.bottomRow}>
        <RecentTrades
          transactions={transactions ?? []}
          loading={txLoading}
        />
        <PnLChart
          snapshots={historyData?.history ?? []}
          loading={histLoading}
        />
        <RecommendedCard
          recommendations={recData?.recommendations ?? []}
          generatedAt={recData?.generated_at}
          loading={recLoading}
          onAddToWatchlist={async (ticker, type) => {
            if (!token) return
            const endpoint = type === 'automated'
            ? `${API}/api/v1/watchlists/automated`
            : `${API}/api/v1/watchlists/a`
            await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ ticker, stop_loss_pct: 0.05 }),
            })
          }}
        />
      </div>
      {/* ── Shark creature — bottom left, below sidebar ── */}
      <FloatingElement bottom="3%" left="70px" animVariant="swim">
        <Shark />
      </FloatingElement>
    </div>
  )
}