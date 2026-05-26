'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  authorizedFetcher,
  fetchWatchlist,
  fetchStockDetail,
  removeFromWatchlist,
  addToWatchlist,
  type WatchlistEntry,
  type Position,
  type StockDetail,
  type WatchlistType,
} from '@/lib/api'
import FloatingElement from '@/components/elements/FloatingElement'
import { Turtle } from '@/components/elements/shapes'
import styles from './watchlist.module.css'

const API = process.env.NEXT_PUBLIC_API_URL

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

interface WatchlistRow {
  entry:    WatchlistEntry
  detail:   StockDetail | null
  position: Position | null
}

type ActiveList = 'a' | 'b'

export default function WatchlistABPage() {
  const router   = useRouter()
  const isAuthed = useIsAuthed()
  const isReady  = useIsReady()
  const token    = useToken()

  // ── all hooks before guard ────────────────────────────────────────────────
  const [activeList, setActiveList] = useState<ActiveList>('a')
  const [rowsA,      setRowsA]      = useState<WatchlistRow[]>([])
  const [rowsB,      setRowsB]      = useState<WatchlistRow[]>([])
  const [enrichingA, setEnrichingA] = useState(false)
  const [enrichingB, setEnrichingB] = useState(false)
  const [removing,   setRemoving]   = useState<Record<string, boolean>>({})

  // add ticker
  const [addTicker,  setAddTicker]  = useState('')
  const [addStatus,  setAddStatus]  = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [addMsg,     setAddMsg]     = useState('')

  const { data: watchlistA, mutate: mutateA, isLoading: loadingA } = useSWR<WatchlistEntry[]>(
    token ? ['watchlist-a', token] : null,
    ([, tok]: [string, string]) => fetchWatchlist('a', tok),
    { refreshInterval: 60_000 }
  )

  const { data: watchlistB, mutate: mutateB, isLoading: loadingB } = useSWR<WatchlistEntry[]>(
    token ? ['watchlist-b', token] : null,
    ([, tok]: [string, string]) => fetchWatchlist('b', tok),
    { refreshInterval: 60_000 }
  )

  const { data: positions, mutate: mutatePositions } = useSWR<Position[]>(
    token ? [`${API}/api/v1/portfolio/positions`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<Position[]>(url, tok),
    { refreshInterval: 30_000 }
  )

  // ── Enrich list A ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!watchlistA || !token) return
    if (watchlistA.length === 0) { setRowsA([]); return }
    setEnrichingA(true)
    Promise.all(
      watchlistA.map(entry => fetchStockDetail(entry.ticker, token).catch(() => null))
    ).then(details => {
      const posMap = Object.fromEntries((positions ?? []).map(p => [p.ticker, p]))
      setRowsA(watchlistA.map((entry, i) => ({
        entry,
        detail:   details[i],
        position: posMap[entry.ticker] ?? null,
      })))
      setEnrichingA(false)
    })
  }, [watchlistA, positions, token])

  // ── Enrich list B ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!watchlistB || !token) return
    if (watchlistB.length === 0) { setRowsB([]); return }
    setEnrichingB(true)
    Promise.all(
      watchlistB.map(entry => fetchStockDetail(entry.ticker, token).catch(() => null))
    ).then(details => {
      const posMap = Object.fromEntries((positions ?? []).map(p => [p.ticker, p]))
      setRowsB(watchlistB.map((entry, i) => ({
        entry,
        detail:   details[i],
        position: posMap[entry.ticker] ?? null,
      })))
      setEnrichingB(false)
    })
  }, [watchlistB, positions, token])

  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

  // ── Active rows + mutate based on toggle ──────────────────────────────────
  const rows        = activeList === 'a' ? rowsA      : rowsB
  const mutateList  = activeList === 'a' ? mutateA    : mutateB
  const setRows     = activeList === 'a' ? setRowsA   : setRowsB
  const isEnriching = activeList === 'a' ? enrichingA : enrichingB
  const isWlLoading = activeList === 'a' ? loadingA   : loadingB

  // ── KPIs for active list ──────────────────────────────────────────────────
  const totalInvested = rows.reduce((sum, r) =>
    sum + (r.position ? r.position.avg_buy_price * r.position.quantity : 0), 0)
  const totalValue = rows.reduce((sum, r) =>
    sum + (r.position ? r.position.current_value : 0), 0)
  const totalPnl    = totalValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  // ── Remove — optimistic ───────────────────────────────────────────────────
  const handleRemove = useCallback(async (ticker: string) => {
    if (!token) return
    const list: WatchlistType = activeList

    setRemoving(prev => ({ ...prev, [`${list}-${ticker}`]: true }))

    // Optimistic: remove row immediately
    setRows(prev => prev.filter(r => r.entry.ticker !== ticker))

    try {
      await removeFromWatchlist(ticker, list, token)
      mutateList()
      mutatePositions()
    } catch {
      mutateList()   // rollback on error
      setRemoving(prev => ({ ...prev, [`${list}-${ticker}`]: false }))
    }
  }, [token, activeList, mutateList, mutatePositions, setRows])

  // ── Add ticker ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    const t = addTicker.trim().toUpperCase()
    if (!t || !token) return

    setAddStatus('loading')
    setAddMsg('')
    try {
      await addToWatchlist(t, activeList, token)
      setAddStatus('success')
      setAddMsg(`${t} added to List ${activeList.toUpperCase()}`)
      setAddTicker('')
      mutateList()
    } catch (err) {
      setAddStatus('error')
      setAddMsg(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setTimeout(() => { setAddStatus('idle'); setAddMsg('') }, 3000)
    }
  }, [addTicker, token, activeList, mutateList])

  if (!isReady || !isAuthed) return null

  const isLoading = isWlLoading || isEnriching

  return (
    <>
      <FloatingElement bottom="2%" left="80px" animVariant="swim">
        <Turtle />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── Title + toggle ── */}
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.pageTitle}>Watchlists</h1>
            <p className={styles.pageSubtitle}>
              Personal observation lists · no automated trading
            </p>
          </div>

          <div className={styles.titleRight}>
            {/* Toggle */}
            <div className={styles.toggle}>
              <button
                className={`${styles.toggleBtn} ${activeList === 'a' ? styles.toggleActive : ''}`}
                onClick={() => setActiveList('a')}
              >
                List A
                {rowsA.length > 0 && (
                  <span className={styles.toggleCount}>{rowsA.length}</span>
                )}
              </button>
              <button
                className={`${styles.toggleBtn} ${activeList === 'b' ? styles.toggleActive : ''}`}
                onClick={() => setActiveList('b')}
              >
                List B
                {rowsB.length > 0 && (
                  <span className={styles.toggleCount}>{rowsB.length}</span>
                )}
              </button>
            </div>

            {/* Add ticker */}
            <div className={styles.addRow}>
              <input
                className={`aw-input ${styles.addInput}`}
                placeholder={`Add to List ${activeList.toUpperCase()}`}
                value={addTicker}
                onChange={e => setAddTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                maxLength={8}
              />
              <button
                className="btn btn-accent"
                onClick={handleAdd}
                disabled={addStatus === 'loading' || !addTicker}
              >
                {addStatus === 'loading' ? '…' : '+ Add'}
              </button>
              {addMsg && (
                <span
                  className={addStatus === 'success' ? 'text-profit' : 'text-loss'}
                  style={{ fontSize: '0.78rem' }}
                >
                  {addMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className={styles.kpiStrip}>
          {[
            { label: `List ${activeList.toUpperCase()} Stocks`, value: rows.length.toString(),   sub: 'watching' },
            { label: 'Total Invested',  value: `$${fmtPrice(totalInvested)}`, sub: 'in positions' },
            { label: 'Current Value',   value: `$${fmtPrice(totalValue)}`,    sub: 'mark to market' },
            {
              label: 'Unrealized P&L',
              value: `${totalPnl >= 0 ? '+' : ''}$${fmtPrice(Math.abs(totalPnl))}`,
              sub: fmtPct(totalPnlPct),
              pnl: totalPnl,
            },
          ].map(k => (
            <div key={k.label} className={`${styles.kpiCard} glass`}>
              <span className={styles.kpiLabel}>{k.label}</span>
              <span className={`${styles.kpiValue} ${'pnl' in k ? (k.pnl! >= 0 ? 'text-profit' : 'text-loss') : ''}`}>
                {k.value}
              </span>
              <span className={styles.kpiSub}>{k.sub}</span>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className={`${styles.tableWrap} glass`}>
          {isLoading ? (
            <div className={styles.loadingRows}>
              {[1,2,3].map(i => (
                <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>⭐</span>
              <p className={styles.emptyTitle}>List {activeList.toUpperCase()} is empty</p>
              <p className={styles.emptySub}>
                Add a ticker above or visit a{' '}
                <Link href="/stocks" className={styles.emptyLink}>stock page</Link>
                {' '}to add it here.
              </p>
            </div>
          ) : (
            <table className={`aw-table ${styles.table}`}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Price</th>
                  <th>Change</th>
                  <th>Shares</th>
                  <th>Avg Cost</th>
                  <th>Value</th>
                  <th>P&amp;L</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, detail, position }) => {
                  const price     = detail?.quote.current_price ?? 0
                  const changePct = detail?.quote.change_pct    ?? 0
                  const name      = detail?.company.name        ?? entry.ticker
                  const logoUrl   = detail?.company.logo_url    ?? ''
                  const isUp      = changePct >= 0
                  const hasPos    = !!position
                  const pnl       = position?.unrealized_pnl     ?? 0
                  const pnlPct    = position?.unrealized_pnl_pct ?? 0
                  const removeKey = `${activeList}-${entry.ticker}`

                  return (
                    <tr key={entry.ticker} className={styles.row}>

                      {/* Ticker */}
                      <td>
                        <Link href={`/stocks/${entry.ticker}`} className={styles.tickerCell}>
                          {logoUrl && (
                            <img
                              src={logoUrl}
                              alt=""
                              className={styles.rowLogo}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <div>
                            <span className={styles.tickerSymbol}>{entry.ticker}</span>
                            <span className={styles.tickerName}>{name}</span>
                          </div>
                        </Link>
                      </td>

                      {/* Price */}
                      <td className={styles.numCell}>
                        {detail ? `$${fmtPrice(price)}` : <span className="text-muted">—</span>}
                      </td>

                      {/* Change */}
                      <td>
                        {detail ? (
                          <span className={`badge ${isUp ? 'badge-profit' : 'badge-loss'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>

                      {/* Shares */}
                      <td className={styles.numCell}>
                        {hasPos
                          ? position.quantity.toFixed(4)
                          : <span className="text-muted">—</span>}
                      </td>

                      {/* Avg cost */}
                      <td className={styles.numCell}>
                        {hasPos
                          ? `$${fmtPrice(position.avg_buy_price)}`
                          : <span className="text-muted">—</span>}
                      </td>

                      {/* Current value */}
                      <td className={styles.numCell}>
                        {hasPos
                          ? `$${fmtPrice(position.current_value)}`
                          : <span className="text-muted">—</span>}
                      </td>

                      {/* P&L */}
                      <td>
                        {hasPos ? (
                          <div className={styles.pnlCell}>
                            <span className={pnl >= 0 ? 'text-profit' : 'text-loss'}>
                              {pnl >= 0 ? '+' : ''}${fmtPrice(Math.abs(pnl))}
                            </span>
                            <span className={`${styles.pnlPct} ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {fmtPct(pnlPct)}
                            </span>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>

                      {/* Remove */}
                      <td>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleRemove(entry.ticker)}
                          disabled={removing[removeKey] ?? false}
                          aria-label={`Remove ${entry.ticker}`}
                        >
                          {removing[removeKey] ? '…' : '✕'}
                        </button>
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