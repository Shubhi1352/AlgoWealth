import Link from 'next/link'
import type { Transaction } from '@/lib/api'
import s from './RecentTrades.module.css'

interface RecentTradesProps {
  transactions: Transaction[]
  loading?: boolean
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function RecentTrades({ transactions, loading = false }: RecentTradesProps) {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6)

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className={s.title}>Recent Trades</span>
        <Link href="/trades" className={s.viewAll}>View all →</Link>
      </div>

      <div className={s.list}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={s.skeletonRow}>
              <div className={`skeleton ${s.skeletonBadge}`} />
              <div className={s.skeletonMid}>
                <div className={`skeleton ${s.skeletonLine}`} />
                <div className={`skeleton ${s.skeletonLineSm}`} />
              </div>
              <div className={`skeleton ${s.skeletonAmt}`} />
            </div>
          ))
        ) : recent.length === 0 ? (
          <div className={s.empty}>
            <span className={s.emptyText}>No trades yet</span>
            <span className={s.emptySub}>Trades appear here after the agent executes</span>
          </div>
        ) : (
          recent.map((tx) => {
            const isBuy  = tx.action === 'BUY'
            const isSell = tx.action === 'SELL'
            return (
              <div key={tx.id} className={s.row}>
                {/* Action badge */}
                <span className={`${s.badge} ${isBuy ? s.buy : isSell ? s.sell : s.hold}`}>
                  {tx.action}
                </span>

                {/* Ticker + meta */}
                <div className={s.mid}>
                  <span className={s.ticker}>{tx.ticker}</span>
                  <span className={s.meta}>
                    {tx.quantity.toFixed(2)} shares · {timeAgo(tx.timestamp)}
                  </span>
                </div>

                {/* Value + confidence */}
                <div className={s.right}>
                  <span className={s.value}>{fmt(tx.total_value)}</span>
                  <span className={s.confidence}>{Math.round(tx.confidence_score * 100)}% conf</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}