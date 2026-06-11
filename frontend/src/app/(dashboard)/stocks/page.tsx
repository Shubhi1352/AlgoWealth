'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { authorizedFetcher, type StockDetail } from '@/lib/api'
import { SEED_TICKERS, TOTAL_PAGES, PAGE_SIZE, getPage } from '@/lib/tickers'
import StockCard from '@/components/ui/StockCard'
import FloatingElement from '@/components/elements/FloatingElement'
import { Lighthouse } from '@/components/elements/shapes'
import styles from './stocks.module.css'
import { useAuthGuard } from '@/hooks/useAuthGuard'

const API = process.env.NEXT_PUBLIC_API_URL
const RECENT_KEY = 'aw_recent_searches'
const MAX_RECENT = 5

function loadRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecent(ticker: string): string[] {
  const prev = loadRecent()
  const updated = [ticker, ...prev.filter(t => t !== ticker)].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  return updated
}

// ─── Search result — single card fetched imperatively ────────────────────────
// We don't use SWR here because search is user-triggered, not auto-polled.
// The StockCard component handles its own SWR for the grid browse mode.

interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error'
  ticker: string
  message: string
}

export default function StocksPage() {
  const { token, isReady, isAuthed, router } = useAuthGuard()

  // ── Page state
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle', ticker: '', message: '',
  })
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recent searches from localStorage once on mount
  useEffect(() => {
    setRecentSearches(loadRecent())
  }, [])

  // ── Derived
  const mode = searchState.status !== 'idle' ? 'search' : 'browse'
  const currentTickers = getPage(currentPage)

  // ── Handlers
  const handleExpand = useCallback((ticker: string) => {
    setExpandedTicker(prev => prev === ticker ? null : ticker)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    setExpandedTicker(null)   // collapse any open card on page change
  }, [])

  const handleSearch = useCallback(async (rawQuery: string) => {
    const ticker = rawQuery.trim().toUpperCase()
    if (!ticker || !token) return

    setSearchState({ status: 'loading', ticker, message: '' })
    setExpandedTicker(null)

    try {
      const data = await authorizedFetcher<StockDetail>(
        `${API}/api/v1/stocks/${ticker}`,
        token,
      )
      if (!data) throw new Error('No data returned')

      setSearchState({ status: 'success', ticker, message: '' })
      setRecentSearches(saveRecent(ticker))
    } catch {
      setSearchState({
        status: 'error',
        ticker,
        message: `Could not find "${ticker}". Check the ticker and try again.`,
      })
    }
  }, [token])

  const handleClearSearch = useCallback(() => {
    setSearchState({ status: 'idle', ticker: '', message: '' })
    setQuery('')
    setExpandedTicker(null)
    inputRef.current?.focus()
  }, [])

  const handleRecentClick = useCallback((ticker: string) => {
    setQuery(ticker)
    handleSearch(ticker)
  }, [handleSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch(query)
    if (e.key === 'Escape') handleClearSearch()
  }, [query, handleSearch, handleClearSearch])

  if (!isReady || !isAuthed) return null

  return (
    <>
      <FloatingElement bottom="0%" left="70px" animVariant='slow'>
        <Lighthouse />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── Page header ── */}
        <div className={styles.pageHeader}>
          <div className={styles.pageTitleRow}>
            <h1 className={styles.pageTitle}>Markets</h1>
            {mode === 'search' && (
              <button className={styles.clearBtn} onClick={handleClearSearch}>
                ← Back to browse
              </button>
            )}
          </div>

          {/* ── Search bar ── */}
          <div className={styles.searchWrap}>
            <div className={styles.searchBar}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search ticker — e.g. NVDA, AAPL, TSLA"
                value={query}
                onChange={e => setQuery(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                aria-label="Stock ticker search"
                spellCheck={false}
                autoComplete="off"
              />
              {query && (
                <button
                  className={styles.clearInput}
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
              <button
                className={styles.searchBtn}
                onClick={() => handleSearch(query)}
                disabled={!query.trim() || searchState.status === 'loading'}
                aria-label="Search"
              >
                {searchState.status === 'loading' ? '...' : 'Search'}
              </button>
            </div>

            {/* ── Recent searches ── */}
            {recentSearches.length > 0 && mode === 'browse' && (
              <div className={styles.recentRow}>
                <span className={styles.recentLabel}>Recent:</span>
                {recentSearches.map(t => (
                  <button
                    key={t}
                    className={styles.recentChip}
                    onClick={() => handleRecentClick(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Search result ── */}
        {mode === 'search' && (
          <div className={styles.searchResult}>
            {searchState.status === 'error' ? (
              <div className={styles.errorMsg}>{searchState.message}</div>
            ) : (
              <div className={styles.singleCard}>
                <StockCard
                  ticker={searchState.ticker}
                  label={searchState.ticker}
                  sector=""
                  isExpanded={expandedTicker === searchState.ticker}
                  onExpand={handleExpand}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Browse grid ── */}
        {mode === 'browse' && (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Popular Stocks</span>
              <span className={styles.sectionSub}>
                {SEED_TICKERS.length} stocks · Page {currentPage} of {TOTAL_PAGES}
              </span>
            </div>

            <div className={styles.grid}>
              {currentTickers.map(({ ticker, label, sector }) => (
                <StockCard
                  key={ticker}
                  ticker={ticker}
                  label={label}
                  sector={sector}
                  isExpanded={expandedTicker === ticker}
                  onExpand={handleExpand}
                />
              ))}
            </div>

            {/* ── Pagination ── */}
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                ←
              </button>

              {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`${styles.pageBtn} ${page === currentPage ? styles.active : ''}`}
                  onClick={() => handlePageChange(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </button>
              ))}

              <button
                className={styles.pageBtn}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === TOTAL_PAGES}
                aria-label="Next page"
              >
                →
              </button>
            </div>
          </>
        )}

      </div>
    </>
  )
}