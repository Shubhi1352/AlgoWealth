'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useToken } from '@/store/useAuthStore'
import {
  authorizedFetcher,
  addToWatchlist,
  type StockDetail,
  type WatchlistType,
} from '@/lib/api'
import styles from './StockCard.module.css'

const API = process.env.NEXT_PUBLIC_API_URL

// ─── Watchlist button states ──────────────────────────────────────────────────

type BtnState = 'idle' | 'loading' | 'success' | 'error'

interface WatchlistBtnProps {
  label: string
  list:  WatchlistType
  ticker: string
  token:  string
}

function WatchlistBtn({ label, list, ticker, token }: WatchlistBtnProps) {
  const [state, setState] = useState<BtnState>('idle')

  const handleClick = useCallback(async () => {
    if (state === 'loading' || state === 'success') return
    setState('loading')
    try {
      await addToWatchlist(ticker, list, token)
      setState('success')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }, [state, ticker, list, token])

  const content: Record<BtnState, string> = {
    idle:    label,
    loading: '...',
    success: '✓ Added',
    error:   '✗ Failed',
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading' || state === 'success'}
      className={`${styles.watchlistBtn} ${styles[state]}`}
      aria-label={`Add ${ticker} to ${label}`}
    >
      {content[state]}
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={`${styles.card} ${styles.skeletonCard}`} aria-hidden="true">
      <div className={styles.header}>
        <div className={styles.skeletonLogo} />
        <div className={styles.skeletonBody}>
          <div className={`${styles.skeletonLine} ${styles.short}`} />
          <div className={`${styles.skeletonLine} ${styles.long}`} />
        </div>
        <div className={styles.skeletonPriceBlock}>
          <div className={`${styles.skeletonLine} ${styles.price}`} />
          <div className={`${styles.skeletonLine} ${styles.change}`} />
        </div>
      </div>
      <div className={styles.meta}>
        <div className={`${styles.skeletonLine} ${styles.medium}`} />
      </div>
    </div>
  )
}

// ─── Unavailable ──────────────────────────────────────────────────────────────

function UnavailableCard({ ticker }: { ticker: string }) {
  return (
    <div className={`${styles.card} ${styles.unavailable}`}>
      <span className={styles.unavailableTicker}>{ticker}</span>
      <span className={styles.unavailableMsg}>Unavailable</span>
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface StockCardProps {
  ticker:   string
  label:    string   // fallback display name
  sector:   string
  isExpanded:  boolean
  onExpand: (ticker: string) => void
}

export default function StockCard({
  ticker,
  label,
  sector,
  isExpanded,
  onExpand,
}: StockCardProps) {
  const token = useToken()

  const { data, error, isLoading } = useSWR<StockDetail>(
    token ? [`${API}/api/v1/stocks/${ticker}`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<StockDetail>(url, tok),
    {
      revalidateOnFocus: false,    // price is cached 5min on backend anyway
      dedupingInterval:  300_000,  // match backend Redis TTL — no redundant calls
    }
  )

  if (isLoading) return (
    <div className={styles.cardWrap}>
      <SkeletonCard />
    </div>
  )
  if (error || !data) return (
    <div className={styles.cardWrap}>
      <UnavailableCard ticker={ticker} />
    </div>
  )

  const { quote, company } = data
  const isPositive = quote.change_pct >= 0
  const changeClass = isPositive ? styles.positive : styles.negative
  const changePrefix = isPositive ? '+' : ''

  const formatMarketCap = (mc: number): string => {
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}T`
    return `$${mc.toFixed(0)}B`
  }

  return (
    <div className={styles.cardWrap}>
      <div
        className={`${styles.card} ${isExpanded ? styles.expanded : ''}`}
        onClick={() => onExpand(ticker)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => e.key === 'Enter' && onExpand(ticker)}
      >
        {/* ── Header row ── */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={`${company.name} logo`}
                className={styles.logo}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove(styles.hidden)
                }}
              />
            ) : null}
            <span className={`${styles.logoFallback} ${company.logo_url ? styles.hidden : ''}`}>
              {ticker.slice(0, 2)}
            </span>
          </div>

          <div className={styles.identity}>
            <span className={styles.ticker}>{ticker}</span>
            <span className={styles.name}>{company.name}</span>
          </div>

          <div className={styles.priceBlock}>
            <span className={styles.price}>
              ${quote.current_price.toFixed(2)}
            </span>
            <span className={`${styles.change} ${changeClass}`}>
              {changePrefix}{quote.change_pct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* ── Meta row ── */}
        <div className={styles.meta}>
          <span className={styles.metaItem}>{company.sector || sector}</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaItem}>{formatMarketCap(company.market_cap)}</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaItem}>{company.exchange.split(',')[0]}</span>
        </div>

        {/* ── Expanded panel ── */}
        {isExpanded && (
          <div
            className={styles.panel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.panelDivider} />
            <p className={styles.panelLabel}>Add to watchlist</p>
            <div className={styles.watchlistRow}>
              {token && (
                <>
                  <WatchlistBtn label="Automated" list="automated" ticker={ticker} token={token} />
                  <WatchlistBtn label="List A"     list="a"         ticker={ticker} token={token} />
                  <WatchlistBtn label="List B"     list="b"         ticker={ticker} token={token} />
                </>
              )}
              <Link
                href={`/stocks/${ticker}`}
                className={styles.viewMore}
                onClick={(e) => e.stopPropagation()}
              >
                View More →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}