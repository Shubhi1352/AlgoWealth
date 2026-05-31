import Link from 'next/link'
import type { RecommendedStock } from '@/lib/api'
import s from './RecommendedCard.module.css'
import { useState } from 'react'

interface RecommendedCardProps {
  recommendations: RecommendedStock[]
  generatedAt?: string | null
  loading?: boolean
  onAddToWatchlist?: (ticker: string, type: 'automated' | 'a' | 'b') => Promise<void>
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: 'BUY' | 'SELL' | 'HOLD' }) {
  return (
    <span className={`${s.signal} ${
      signal === 'BUY' ? s.buy : signal === 'SELL' ? s.sell : s.hold
    }`}>
      {signal}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100)
  const color = pct >= 80
    ? 'var(--color-accent)'
    : pct >= 60
    ? 'var(--color-warning)'
    : 'var(--color-loss)'
  return (
    <div className={s.barTrack}>
      <div className={s.barFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

type BtnState = 'idle' | 'ok' | 'err'

function RecommendationRow({
  rec,
  rank,
  onAddToWatchlist,
}: {
  rec: RecommendedStock
  rank: number
  onAddToWatchlist?: (ticker: string, type: 'automated' | 'a' | 'b') => Promise<void>
}) {
  const [autoState,  setAutoState]  = useState<BtnState>('idle')
  const [watchAState, setWatchAState] = useState<BtnState>('idle')
  const [watchBState, setWatchBState] = useState<BtnState>('idle')

  async function handleClick(
    type: 'automated' | 'a' | 'b',
    setState: (s: BtnState) => void
  ) {
    if (!onAddToWatchlist) return
    try {
      await onAddToWatchlist(rec.ticker, type)
      setState('ok')
    } catch {
      setState('err')
    } finally {
      setTimeout(() => setState('idle'), 2000)
    }
  }

  const pct       = Math.round(rec.final_score * 100)
  const priceStr  = rec.current_price > 0 ? `$${rec.current_price.toFixed(2)}` : null
  const changeStr = rec.price_change_pct !== 0
    ? `${rec.price_change_pct >= 0 ? '+' : ''}${rec.price_change_pct.toFixed(1)}%`
    : null
  const isUp = rec.price_change_pct >= 0

  return (
    <div className={s.row}>
      {/* Rank + ticker */}
      <div className={s.rowLeft}>
        <span className={s.rank}>#{rank}</span>
        <div className={s.tickerBlock}>
          <div className={s.tickerTop}>
            <Link href={`/stocks/${rec.ticker}`} className={s.ticker}>
              {rec.ticker}
            </Link>
            <SignalBadge signal={rec.news_signal} />
          </div>
          <div className={s.scoreRow}>
            <ScoreBar score={rec.final_score} />
            <span className={s.scorePct}>{pct}%</span>
          </div>
        </div>
      </div>

      {/* Price + actions */}
      <div className={s.rowRight}>
        {priceStr && (
          <div className={s.priceBlock}>
            <span className={s.price}>{priceStr}</span>
            {changeStr && (
              <span className={isUp ? s.changeUp : s.changeDown}>{changeStr}</span>
            )}
          </div>
        )}
        <div className={s.actions}>
          <button
            className={`${s.btnAuto} ${autoState === 'ok' ? s.btnOk : autoState === 'err' ? s.btnErr : ''}`}
            onClick={() => handleClick('automated', setAutoState)}
            title="Add to Automated Watchlist"
            disabled={autoState !== 'idle'}
          >
            {autoState === 'ok' ? '✓' : autoState === 'err' ? '✕' : 'Auto'}
          </button>
          <button
            className={`${s.btnWatch} ${watchAState === 'ok' ? s.btnOk : watchAState === 'err' ? s.btnErr : ''}`}
            onClick={() => handleClick('a', setWatchAState)}
            title="Add to Watchlist A"
            disabled={watchAState !== 'idle'}
          >
            {watchAState === 'ok' ? '✓' : watchAState === 'err' ? '✕' : 'A'}
          </button>
          <button
            className={`${s.btnWatch} ${watchBState === 'ok' ? s.btnOk : watchBState === 'err' ? s.btnErr : ''}`}
            onClick={() => handleClick('b', setWatchBState)}
            title="Add to Watchlist B"
            disabled={watchBState !== 'idle'}
          >
            {watchBState === 'ok' ? '✓' : watchBState === 'err' ? '✕' : 'B'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function RecommendedCard({
  recommendations,
  generatedAt,
  loading = false,
  onAddToWatchlist,
}: RecommendedCardProps) {

  const genDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  if (loading) {
    return (
      <div className={s.card}>
        <div className={s.header}>
          <div className={`skeleton ${s.skLabel}`} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={s.skRow}>
            <div className={`skeleton ${s.skTicker}`} />
            <div className={`skeleton ${s.skBar}`} />
          </div>
        ))}
      </div>
    )
  }

  if (!recommendations.length) {
    return (
      <div className={s.card}>
        <span className={s.sectionLabel}>AI Picks</span>
        <div className={s.empty}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <path d="M14 9v6M14 18v1" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className={s.emptyText}>No picks yet</span>
          <span className={s.emptySub}>Runs daily at 8AM ET</span>
        </div>
      </div>
    )
  }

  return (
    <div className={s.card}>
      {/* Header */}
      <div className={s.header}>
        <span className={s.sectionLabel}>AI Picks</span>
        {genDate && <span className={s.genDate}>Updated {genDate}</span>}
      </div>

      {/* Ranked list */}
      <div className={s.list}>
        {recommendations.map((rec, i) => (
          <RecommendationRow
            key={rec.ticker}
            rec={rec}
            rank={i + 1}
            onAddToWatchlist={onAddToWatchlist}
          />
        ))}
      </div>
    </div>
  )
}