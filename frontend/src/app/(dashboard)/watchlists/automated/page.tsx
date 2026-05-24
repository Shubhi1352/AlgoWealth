'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import Link             from 'next/link'
import useSWR           from 'swr'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  authorizedFetcher,
  fetchWatchlist,
  removeFromWatchlist,
  addToWatchlist,
  type WatchlistEntry,
  type Position,
  type StockDetail,
} from '@/lib/api'
import FloatingElement  from '@/components/elements/FloatingElement'
import { Lighthouse }   from '@/components/elements/shapes'
import styles           from './automated.module.css'

const API = process.env.NEXT_PUBLIC_API_URL

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

// One enriched row = watchlist entry + live detail + position (nullable)
interface WatchlistRow {
  entry:    WatchlistEntry
  detail:   StockDetail | null
  position: Position | null
}

export default function AutomatedWatchlistPage() {
  const router   = useRouter()
  const isAuthed = useIsAuthed()
  const isReady  = useIsReady()
  const token    = useToken()

  // ── all hooks before guard ────────────────────────────────────────────────
  const [rows,       setRows]       = useState<WatchlistRow[]>([])
  const [enriching,  setEnriching]  = useState(false)

  // inline stop loss edit state: tickerKey → draft string
  const [slEditing,  setSlEditing]  = useState<Record<string, string>>({})
  const [slLoading,  setSlLoading]  = useState<Record<string, boolean>>({})

  // remove state
  const [removing,   setRemoving]   = useState<Record<string, boolean>>({})

  // add ticker
  const [addTicker,  setAddTicker]  = useState('')
  const [addSl,      setAddSl]      = useState('5')
  const [addStatus,  setAddStatus]  = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [addMsg,     setAddMsg]      = useState('')

  const { data: watchlist, mutate: mutateWatchlist, isLoading: wlLoading } = useSWR<WatchlistEntry[]>(
    token ? ['watchlist-automated', token] : null,
    ([, tok]: [string, string]) => fetchWatchlist('automated', tok),
    { refreshInterval: 30_000 }
  )

  const { data: positions, mutate: mutatePositions } = useSWR<Position[]>(
    token ? [`${API}/api/v1/portfolio/positions`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<Position[]>(url, tok),
    { refreshInterval: 30_000 }
  )

  // ── Enrich: fetch StockDetail for every ticker in parallel ───────────────
  useEffect(() => {
    if (!watchlist || !token) return
    if (watchlist.length === 0) { setRows([]); return }

    setEnriching(true)

    Promise.all(
      watchlist.map(entry =>
        fetch(`${API}/api/v1/watchlists/watchlists/automated`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.ok ? r.json() as Promise<StockDetail> : null)
          .catch(() => null)
      )
    ).then(details => {
      const posMap = Object.fromEntries(
        (positions ?? []).map(p => [p.ticker, p])
      )
      setRows(
        watchlist.map((entry, i) => ({
          entry,
          detail:   details[i],
          position: posMap[entry.ticker] ?? null,
        }))
      )
      setEnriching(false)
    })
  }, [watchlist, positions, token])

  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalInvested = rows.reduce((sum, r) =>
    sum + (r.position ? r.position.avg_buy_price * r.position.quantity : 0), 0)

  const totalCurrentValue = rows.reduce((sum, r) =>
    sum + (r.position ? r.position.current_value : 0), 0)

  const totalPnl = totalCurrentValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  // ── Stop loss save: DELETE then re-POST with new pct ─────────────────────
  const handleSlSave = useCallback(async (ticker: string, draft: string) => {
    const pct = parseFloat(draft)
    if (isNaN(pct) || pct <= 0 || pct > 100 || !token) return

    setSlLoading(prev => ({ ...prev, [ticker]: true }))
    try {
      await removeFromWatchlist(ticker, 'automated', token)
      await addToWatchlist(ticker, 'automated', token, pct / 100)
      setSlEditing(prev => { const n = { ...prev }; delete n[ticker]; return n })
      mutateWatchlist()
    } catch {
      // keep edit open on error
    } finally {
      setSlLoading(prev => ({ ...prev, [ticker]: false }))
    }
  }, [token, mutateWatchlist])

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = useCallback(async (ticker: string) => {
    if (!token) return
    setRemoving(prev => ({ ...prev, [ticker]: true }))
    try {
      await removeFromWatchlist(ticker, 'automated', token)
      mutateWatchlist()
      mutatePositions()
    } catch {
      setRemoving(prev => ({ ...prev, [ticker]: false }))
    }
  }, [token, mutateWatchlist, mutatePositions])

  // ── Add ticker ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    const t   = addTicker.trim().toUpperCase()
    const pct = parseFloat(addSl)
    if (!t || isNaN(pct) || pct <= 0 || !token) return

    setAddStatus('loading')
    setAddMsg('')
    try {
      await addToWatchlist(t, 'automated', token, pct / 100)
      setAddStatus('success')
      setAddMsg(`${t} added to automated watchlist`)
      setAddTicker('')
      setAddSl('5')
      mutateWatchlist()
    } catch (err) {
      setAddStatus('error')
      setAddMsg(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setTimeout(() => { setAddStatus('idle'); setAddMsg('') }, 3000)
    }
  }, [addTicker, addSl, token, mutateWatchlist])

  if (!isReady || !isAuthed) return null

  const isLoading = wlLoading || enriching

  return (
    <>
      <FloatingElement bottom="8%" right="60px" animVariant="slow">
        <Lighthouse />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── Page title ── */}
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.pageTitle}>Automated Watchlist</h1>
            <p className={styles.pageSubtitle}>
              Stocks monitored by the AI agent · stop losses enforced every 15 min
            </p>
          </div>

          {/* Add ticker */}
          <div className={styles.addRow}>
            <input
              className={`aw-input ${styles.addInput}`}
              placeholder="Ticker (e.g. AAPL)"
              value={addTicker}
              onChange={e => setAddTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              maxLength={8}
            />
            <input
              className={`aw-input ${styles.slInput}`}
              placeholder="SL %"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={addSl}
              onChange={e => setAddSl(e.target.value)}
              title="Stop loss percentage"
            />
            <button
              className={`btn btn-accent ${styles.addBtn}`}
              onClick={handleAdd}
              disabled={addStatus === 'loading' || !addTicker}
            >
              {addStatus === 'loading' ? '…' : '+ Watch'}
            </button>
            {addMsg && (
              <span className={addStatus === 'success' ? 'text-profit' : 'text-loss'} style={{ fontSize: '0.78rem' }}>
                {addMsg}
              </span>
            )}
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className={styles.kpiStrip}>
          {[
            { label: 'Watching',       value: rows.length.toString(),                                              sub: 'tickers' },
            { label: 'Total Invested', value: `$${fmtPrice(totalInvested)}`,                                       sub: 'across positions' },
            { label: 'Current Value',  value: `$${fmtPrice(totalCurrentValue)}`,                                   sub: 'mark to market' },
            { label: 'Unrealized P&L', value: `${totalPnl >= 0 ? '+' : ''}$${fmtPrice(Math.abs(totalPnl))}`,
              sub: fmtPct(totalPnlPct), pnl: totalPnl },
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
              <span className={styles.emptyIcon}>🤖</span>
              <p className={styles.emptyTitle}>No stocks on autopilot</p>
              <p className={styles.emptySub}>
                Add a ticker above or visit a{' '}
                <Link href="/stocks" className={styles.emptyLink}>stock page</Link>
                {' '}to add it to automated monitoring.
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
                  <th>Invested</th>
                  <th>Value</th>
                  <th>P&amp;L</th>
                  <th>Stop Loss</th>
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

                  const shares    = position?.quantity         ?? 0
                  const invested  = position
                    ? position.avg_buy_price * position.quantity : 0
                  const value     = position?.current_value    ?? 0
                  const pnl       = position?.unrealized_pnl   ?? 0
                  const pnlPct    = position?.unrealized_pnl_pct ?? 0
                  const hasPos    = !!position

                  const slPct     = (entry.stop_loss_pct * 100).toFixed(1)
                  const isDraftSl = slEditing[entry.ticker] !== undefined
                  const isSlLoad  = slLoading[entry.ticker] ?? false
                  const isRemoving = removing[entry.ticker] ?? false

                  return (
                    <tr key={entry.ticker} className={styles.row}>

                      {/* Ticker + name */}
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

                      {/* Change % */}
                      <td>
                        {detail ? (
                          <span className={`badge ${isUp ? 'badge-profit' : 'badge-loss'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>

                      {/* Shares */}
                      <td className={styles.numCell}>
                        {hasPos ? shares.toFixed(4) : <span className="text-muted">—</span>}
                      </td>

                      {/* Invested */}
                      <td className={styles.numCell}>
                        {hasPos ? `$${fmtPrice(invested)}` : <span className="text-muted">—</span>}
                      </td>

                      {/* Current value */}
                      <td className={styles.numCell}>
                        {hasPos ? `$${fmtPrice(value)}` : <span className="text-muted">—</span>}
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

                      {/* Stop loss — inline edit */}
                      <td>
                        {isDraftSl ? (
                          <div className={styles.slEditRow}>
                            <input
                              type="number"
                              className={`aw-input ${styles.slEditInput}`}
                              value={slEditing[entry.ticker]}
                              min="0.1"
                              max="100"
                              step="0.1"
                              autoFocus
                              onChange={e => setSlEditing(prev => ({ ...prev, [entry.ticker]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  handleSlSave(entry.ticker, slEditing[entry.ticker])
                                if (e.key === 'Escape') setSlEditing(prev => { const n = { ...prev }; delete n[entry.ticker]; return n })
                              }}
                            />
                            <span className={styles.slPctSymbol}>%</span>
                            <button
                              className={styles.slSaveBtn}
                              onClick={() => handleSlSave(entry.ticker, slEditing[entry.ticker])}
                              disabled={isSlLoad}
                            >
                              {isSlLoad ? '…' : '✓'}
                            </button>
                            <button
                              className={styles.slCancelBtn}
                              onClick={() => setSlEditing(prev => { const n = { ...prev }; delete n[entry.ticker]; return n })}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            className={styles.slBadge}
                            onClick={() => setSlEditing(prev => ({ ...prev, [entry.ticker]: slPct }))}
                            title="Click to edit stop loss"
                          >
                            {slPct}%
                          </button>
                        )}
                      </td>

                      {/* Remove */}
                      <td>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleRemove(entry.ticker)}
                          disabled={isRemoving}
                          aria-label={`Remove ${entry.ticker}`}
                        >
                          {isRemoving ? '…' : '✕'}
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