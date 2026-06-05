'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useIsAuthed, useIsReady } from '@/store/useAuthStore'
import {
  usePositions,
  usePortfolioSummary,
  usePortfolioHistory,
  type Position,
} from '@/lib/api'
import PortfolioChart from '@/components/ui/PortfolioChart'
import FloatingElement from '@/components/elements/FloatingElement'
import { Anchor } from '@/components/elements/shapes'
import MetricCard from '@/components/ui/MetricCard'
import DataTable, { ColumnDef } from '@/components/ui/DataTable'
import styles from './portfolio.module.css'

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

  // ── all hooks before guard ────────────────────────────────────────────────
  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary({ refreshInterval: 30_000 })
  const { data: positions, isLoading: posLoading } = usePositions({ refreshInterval: 30_000 })
  const { data: history, isLoading: histLoading } = usePortfolioHistory({ refreshInterval: 60_000 })

  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

  const snapshots  = history?.history ?? []
  const totalValue = summary?.total_value ?? 0

  // Position size bar: position.current_value / total_value
  function sizeBarPct(pos: Position): number {
    if (!totalValue) return 0
    return Math.min((pos.current_value / totalValue) * 100, 100)
  }

  const columns = useMemo<ColumnDef<Position>[]>(() => [
    {
      header: 'Ticker',
      cell: (pos) => (
        <Link href={`/stocks/${pos.ticker}`} className={styles.tickerCell}>
          <div className={styles.tickerBadge}>{pos.ticker}</div>
        </Link>
      )
    },
    {
      header: 'Shares',
      align: 'right',
      className: styles.numCell,
      cell: (pos) => pos.quantity.toFixed(4)
    },
    {
      header: 'Avg Cost',
      align: 'right',
      className: styles.numCell,
      cell: (pos) => `$${fmtPrice(pos.avg_buy_price)}`
    },
    {
      header: 'Current Price',
      align: 'right',
      className: styles.numCell,
      cell: (pos) => `$${fmtPrice(pos.current_price)}`
    },
    {
      header: 'Value',
      align: 'right',
      className: styles.numCell,
      cell: (pos) => `$${fmtPrice(pos.current_value)}`
    },
    {
      header: 'Unrealized P&L',
      cell: (pos) => {
        const pnlUp = pos.unrealized_pnl >= 0
        return (
          <div className={styles.pnlCell}>
            <span className={pnlUp ? 'text-profit' : 'text-loss'}>
              {pnlUp ? '+' : ''}${fmtPrice(Math.abs(pos.unrealized_pnl))}
            </span>
            <span className={`${styles.pnlPct} ${pnlUp ? 'text-profit' : 'text-loss'}`}>
              {fmtPct(pos.unrealized_pnl_pct)}
            </span>
          </div>
        )
      }
    },
    {
      header: 'Allocation',
      cell: (pos) => {
        const barPct = sizeBarPct(pos)
        return (
          <div className={styles.barCell}>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span className={styles.barPct}>{barPct.toFixed(1)}%</span>
          </div>
        )
      }
    }
  ], [totalValue])

  if (!isReady || !isAuthed) return null

  return (
    <>
      <FloatingElement bottom="2%" left="80px" animVariant="slow">
        <Anchor />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── KPI strip ── */}
        <div className={styles.kpiStrip}>
          <MetricCard
            label="Total Value"
            value={`$${fmtPrice(summary?.total_value ?? 0)}`}
            sub="portfolio + cash"
            loading={summaryLoading}
          />
          <MetricCard
            label="Cash Balance"
            value={`$${fmtPrice(summary?.cash_balance ?? 0)}`}
            sub="available to deploy"
            loading={summaryLoading}
          />
          <MetricCard
            label="Invested"
            value={`$${fmtPrice(summary?.positions_value ?? 0)}`}
            sub="in open positions"
            loading={summaryLoading}
          />
          <MetricCard
            label="Total P&L"
            value={`${(summary?.total_pnl ?? 0) >= 0 ? '+' : ''}$${fmtPrice(Math.abs(summary?.total_pnl ?? 0))}`}
            sub={fmtPct(summary?.total_pnl_pct ?? 0)}
            trend={(summary?.total_pnl ?? 0) >= 0 ? 'up' : 'down'}
            loading={summaryLoading}
          />
          <MetricCard
            label="Total Trades"
            value={(summary?.total_trades ?? 0).toString()}
            sub="executed"
            loading={summaryLoading}
          />
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

          <DataTable
            columns={columns}
            data={positions ?? []}
            isLoading={posLoading}
            emptyState={{
              icon: '📭',
              title: 'No open positions',
              subtitle: (
                <>
                  Browse <Link href="/stocks" className={styles.emptyLink}>stocks</Link> to make your first trade.
                </>
              ),
            }}
            rowKey={(pos) => pos.ticker}
            tableClassName={styles.table}
            rowClassName={() => styles.row}
            loadingRowsCount={3}
          />
        </div>

      </div>
    </>
  )
}