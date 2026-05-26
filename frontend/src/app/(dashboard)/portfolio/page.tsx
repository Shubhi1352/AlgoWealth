'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  authorizedFetcher,
  type PortfolioSummary,
  type Position,
  type PortfolioHistory,
} from '@/lib/api'
import PortfolioChart from '@/components/ui/PortfolioChart'
import FloatingElement from '@/components/elements/FloatingElement'
import { Anchor } from '@/components/elements/shapes'
import styles from './portfolio.module.css'

const API = process.env.NEXT_PUBLIC_API_URL

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export default function PortfolioPage() {
  const router   = useRouter()
  const isAuthed = useIsAuthed()
  const isReady  = useIsReady()
  const token    = useToken()

  // ── all hooks before guard ────────────────────────────────────────────────
  const { data: summary, isLoading: summaryLoading } = useSWR<PortfolioSummary>(
    token ? [`${API}/api/v1/portfolio/`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<PortfolioSummary>(url, tok),
    { refreshInterval: 30_000 }
  )

  const { data: positions, isLoading: posLoading } = useSWR<Position[]>(
    token ? [`${API}/api/v1/portfolio/positions`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<Position[]>(url, tok),
    { refreshInterval: 30_000 }
  )

  const { data: history, isLoading: histLoading } = useSWR<PortfolioHistory>(
    token ? [`${API}/api/v1/portfolio/history`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<PortfolioHistory>(url, tok),
    { refreshInterval: 60_000 }
  )

  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

  if (!isReady || !isAuthed) return null

  const snapshots  = history?.history ?? []
  const totalValue = summary?.total_value ?? 0

  // Position size bar: position.current_value / total_value
  function sizeBarPct(pos: Position): number {
    if (!totalValue) return 0
    return Math.min((pos.current_value / totalValue) * 100, 100)
  }

  return (
    <>
      <FloatingElement bottom="2%" left="80px" animVariant="slow">
        <Anchor />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── KPI strip ── */}
        <div className={styles.kpiStrip}>
          {summaryLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`${styles.kpiCard} skeleton`} style={{ height: 80 }} />
            ))
          ) : ([
            {
              label: 'Total Value',
              value: `$${fmtPrice(summary?.total_value ?? 0)}`,
              sub:   'portfolio + cash',
            },
            {
              label: 'Cash Balance',
              value: `$${fmtPrice(summary?.cash_balance ?? 0)}`,
              sub:   'available to deploy',
            },
            {
              label: 'Invested',
              value: `$${fmtPrice(summary?.positions_value ?? 0)}`,
              sub:   'in open positions',
            },
            {
              label: 'Total P&L',
              value: `${(summary?.total_pnl ?? 0) >= 0 ? '+' : ''}$${fmtPrice(Math.abs(summary?.total_pnl ?? 0))}`,
              sub:   fmtPct(summary?.total_pnl_pct ?? 0),
              pnl:   summary?.total_pnl ?? 0,
            },
            {
              label: 'Total Trades',
              value: (summary?.total_trades ?? 0).toString(),
              sub:   'executed',
            },
          ] as const).map(k => (
            <div key={k.label} className={`${styles.kpiCard} glass`}>
              <span className={styles.kpiLabel}>{k.label}</span>
              <span className={`${styles.kpiValue} ${'pnl' in k ? ((k as {pnl:number}).pnl >= 0 ? 'text-profit' : 'text-loss') : ''}`}>
                {k.value}
              </span>
              <span className={styles.kpiSub}>{k.sub}</span>
            </div>
          ))}
        </div>

        {/* ── Chart ── */}
        <PortfolioChart snapshots={snapshots} loading={histLoading} />

        {/* ── Positions table ── */}
        <div className={`${styles.tableWrap} glass`}>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>
              Open Positions
              {positions && (
                <span className={styles.posCount}>{positions.length}</span>
              )}
            </span>
          </div>

          {posLoading ? (
            <div className={styles.loadingRows}>
              {[1,2,3].map(i => (
                <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
              ))}
            </div>
          ) : !positions?.length ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📭</span>
              <p className={styles.emptyTitle}>No open positions</p>
              <p className={styles.emptySub}>
                Browse <Link href="/stocks" className={styles.emptyLink}>stocks</Link> to make your first trade.
              </p>
            </div>
          ) : (
            <table className={`aw-table ${styles.table}`}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Shares</th>
                  <th>Avg Cost</th>
                  <th>Current Price</th>
                  <th>Value</th>
                  <th>Unrealized P&amp;L</th>
                  <th>Allocation</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => {
                  const pnlUp  = pos.unrealized_pnl >= 0
                  const barPct = sizeBarPct(pos)
                  return (
                    <tr key={pos.ticker} className={styles.row}>

                      {/* Ticker */}
                      <td>
                        <Link href={`/stocks/${pos.ticker}`} className={styles.tickerCell}>
                          <div className={styles.tickerBadge}>{pos.ticker}</div>
                        </Link>
                      </td>

                      {/* Shares */}
                      <td className={styles.numCell}>
                        {pos.quantity.toFixed(4)}
                      </td>

                      {/* Avg cost */}
                      <td className={styles.numCell}>
                        ${fmtPrice(pos.avg_buy_price)}
                      </td>

                      {/* Current price */}
                      <td className={styles.numCell}>
                        ${fmtPrice(pos.current_price)}
                      </td>

                      {/* Value */}
                      <td className={styles.numCell}>
                        ${fmtPrice(pos.current_value)}
                      </td>

                      {/* P&L */}
                      <td>
                        <div className={styles.pnlCell}>
                          <span className={pnlUp ? 'text-profit' : 'text-loss'}>
                            {pnlUp ? '+' : ''}${fmtPrice(Math.abs(pos.unrealized_pnl))}
                          </span>
                          <span className={`${styles.pnlPct} ${pnlUp ? 'text-profit' : 'text-loss'}`}>
                            {fmtPct(pos.unrealized_pnl_pct)}
                          </span>
                        </div>
                      </td>

                      {/* Allocation bar */}
                      <td>
                        <div className={styles.barCell}>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span className={styles.barPct}>{barPct.toFixed(1)}%</span>
                        </div>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </>
  )
}