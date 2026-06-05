'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  useWatchlist,
  usePositions,
  removeFromWatchlist,
  addToWatchlist,
  type WatchlistEntry,
  type Position,
  type StockDetail,
  fetchStockDetail,
  updateStopLoss,
} from '@/lib/api'
import FloatingElement from '@/components/elements/FloatingElement'
import { TreasureChest } from '@/components/elements/shapes'
import MetricCard from '@/components/ui/MetricCard'
import DataTable, { ColumnDef } from '@/components/ui/DataTable'
import styles from './automated.module.css'

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

// One enriched row = watchlist entry + live detail + position (nullable)
interface WatchlistRow {
  entry: WatchlistEntry
  detail: StockDetail | null
  position: Position | null
}

export default function AutomatedWatchlistPage() {
  const router = useRouter()
  const isAuthed = useIsAuthed()
  const isReady = useIsReady()
  const token = useToken()

  // ── all hooks before guard ────────────────────────────────────────────────
  const [rows, setRows] = useState<WatchlistRow[]>([])
  const [enriching, setEnriching] = useState(false)

  // inline stop loss edit state: tickerKey → draft string
  const [slEditing, setSlEditing] = useState<Record<string, string>>({})
  const [slLoading, setSlLoading] = useState<Record<string, boolean>>({})

  // remove state
  const [removing, setRemoving] = useState<Record<string, boolean>>({})

  // add ticker
  const [addTicker, setAddTicker] = useState('')
  const [addSl, setAddSl] = useState('5')
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [addMsg, setAddMsg] = useState('')

  const { data: watchlist, mutate: mutateWatchlist, isLoading: wlLoading } = useWatchlist('automated', { refreshInterval: 30_000 })
  const { data: positions, mutate: mutatePositions } = usePositions({ refreshInterval: 33_000 })

  // ── Enrich: fetch StockDetail for every ticker in parallel ───────────────
  useEffect(() => {
    if (!watchlist || !token) return
    if (watchlist.length === 0) { setRows([]); return }

    setEnriching(true)

    Promise.all(
      watchlist.map(entry =>
        fetchStockDetail(entry.ticker, token).catch(() => null)
      )
    ).then(details => {
      const posMap = Object.fromEntries(
        (positions ?? []).map(p => [p.ticker, p])
      )
      setRows(
        watchlist.map((entry, i) => ({
          entry,
          detail: details[i],
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

    // ── Optimistic update: patch just this row immediately ──────────────────
    setRows(prev => prev.map(r =>
      r.entry.ticker === ticker
        ? { ...r, entry: { ...r.entry, stop_loss_pct: pct / 100 } }
        : r
    ))
    // Close the edit input right away — no waiting
    setSlEditing(prev => { const n = { ...prev }; delete n[ticker]; return n })

    try {
      await updateStopLoss(ticker, pct / 100, token)
      // Success — rows already show correct value, nothing else needed
    } catch {
      // Rollback: re-fetch to restore server state
      mutateWatchlist()
    } finally {
      setSlLoading(prev => ({ ...prev, [ticker]: false }))
    }
  }, [token, mutateWatchlist])

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = useCallback(async (ticker: string) => {
    if (!token) return
    setRemoving(prev => ({ ...prev, [ticker]: true }))

    // ── Optimistic update: remove row immediately ───────────────────────────
    setRows(prev => prev.filter(r => r.entry.ticker !== ticker))

    try {
      await removeFromWatchlist(ticker, 'automated', token)
      mutateWatchlist()      // background sync to keep SWR cache consistent
      mutatePositions()
    } catch {
      // Rollback: re-fetch restores the row
      mutateWatchlist()
      setRemoving(prev => ({ ...prev, [ticker]: false }))
    }
  }, [token, mutateWatchlist, mutatePositions])

  // ── Add ticker ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    const t = addTicker.trim().toUpperCase()
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

  const columns = useMemo<ColumnDef<WatchlistRow>[]>(() => [
    {
      header: 'Ticker',
      cell: (row) => {
        const name = row.detail?.company.name ?? row.entry.ticker
        const logoUrl = row.detail?.company.logo_url ?? ''
        return (
          <Link href={`/stocks/${row.entry.ticker}`} className={styles.tickerCell}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className={styles.rowLogo}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div>
              <span className={styles.tickerSymbol}>{row.entry.ticker}</span>
              <span className={styles.tickerName}>{name}</span>
            </div>
          </Link>
        )
      }
    },
    {
      header: 'Price',
      align: 'right',
      className: styles.numCell,
      cell: (row) => row.detail ? `$${fmtPrice(row.detail.quote.current_price)}` : <span className="text-muted">—</span>
    },
    {
      header: 'Change',
      cell: (row) => {
        if (!row.detail) return <span className="text-muted">—</span>
        const changePct = row.detail.quote.change_pct
        const isUp = changePct >= 0
        return (
          <span className={`badge ${isUp ? 'badge-profit' : 'badge-loss'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
          </span>
        )
      }
    },
    {
      header: 'Shares',
      align: 'right',
      className: styles.numCell,
      cell: (row) => row.position ? row.position.quantity.toFixed(4) : <span className="text-muted">—</span>
    },
    {
      header: 'Invested',
      align: 'right',
      className: styles.numCell,
      cell: (row) => {
        if (!row.position) return <span className="text-muted">—</span>
        const invested = row.position.avg_buy_price * row.position.quantity
        return `$${fmtPrice(invested)}`
      }
    },
    {
      header: 'Value',
      align: 'right',
      className: styles.numCell,
      cell: (row) => row.position ? `$${fmtPrice(row.position.current_value)}` : <span className="text-muted">—</span>
    },
    {
      header: 'P&L',
      cell: (row) => {
        if (!row.position) return <span className="text-muted">—</span>
        const pnl = row.position.unrealized_pnl
        const pnlPct = row.position.unrealized_pnl_pct
        const pnlUp = pnl >= 0
        return (
          <div className={styles.pnlCell}>
            <span className={pnlUp ? 'text-profit' : 'text-loss'}>
              {pnlUp ? '+' : ''}${fmtPrice(Math.abs(pnl))}
            </span>
            <span className={`${styles.pnlPct} ${pnlUp ? 'text-profit' : 'text-loss'}`}>
              {fmtPct(pnlPct)}
            </span>
          </div>
        )
      }
    },
    {
      header: 'Stop Loss',
      cell: (row) => {
        const slPct = (row.entry.stop_loss_pct * 100).toFixed(1)
        const isDraftSl = slEditing[row.entry.ticker] !== undefined

        return isDraftSl ? (
          <div className={styles.slEditRow}>
            <input
              type="number"
              className={`aw-input ${styles.slEditInput}`}
              value={slEditing[row.entry.ticker]}
              min="0.1"
              max="100"
              step="0.1"
              autoFocus
              onChange={e => setSlEditing(prev => ({ ...prev, [row.entry.ticker]: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSlSave(row.entry.ticker, slEditing[row.entry.ticker])
                if (e.key === 'Escape') setSlEditing(prev => { const n = { ...prev }; delete n[row.entry.ticker]; return n })
              }}
            />
            <span className={styles.slPctSymbol}>%</span>
            <button
              className={styles.slBadge}
              onClick={() => setSlEditing(prev => ({ ...prev, [row.entry.ticker]: slPct }))}
              title="Click to edit stop loss"
            >
              {slPct}%
              {row.entry.stop_loss_price && (
                <span className={styles.slPrice}>
                  ${fmtPrice(row.entry.stop_loss_price)}
                </span>
              )}
            </button>
          </div>
        ) : (
          <button
            className={styles.slBadge}
            onClick={() => setSlEditing(prev => ({ ...prev, [row.entry.ticker]: slPct }))}
            title="Click to edit stop loss"
          >
            {slPct}%
          </button>
        )
      }
    },
    {
      header: '',
      cell: (row) => {
        const isRemoving = removing[row.entry.ticker] ?? false
        return (
          <button
            className={styles.removeBtn}
            onClick={() => handleRemove(row.entry.ticker)}
            disabled={isRemoving}
            aria-label={`Remove ${row.entry.ticker}`}
          >
            {isRemoving ? '…' : '✕'}
          </button>
        )
      }
    }
  ], [slEditing, removing, handleSlSave, handleRemove])

  if (!isReady || !isAuthed) return null

  const isLoading = (wlLoading && rows.length === 0) || (enriching && rows.length === 0)

  return (
    <>
      <FloatingElement bottom="2%" left="80px" animVariant="slow">
        <TreasureChest />
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
              className={`aw-input ${styles.addInput} border-blue-300`}
              placeholder="Ticker (e.g. AAPL)"
              value={addTicker}
              onChange={e => setAddTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              maxLength={8}
            />
            <input
              className={`aw-input ${styles.slInput} border-blue-300`}
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
          <MetricCard
            label="Watching"
            value={rows.length.toString()}
            sub="tickers"
            loading={isLoading}
          />
          <MetricCard
            label="Total Invested"
            value={`$${fmtPrice(totalInvested)}`}
            sub="across positions"
            loading={isLoading}
          />
          <MetricCard
            label="Current Value"
            value={`$${fmtPrice(totalCurrentValue)}`}
            sub="mark to market"
            loading={isLoading}
          />
          <MetricCard
            label="Unrealized P&L"
            value={`${totalPnl >= 0 ? '+' : ''}$${fmtPrice(Math.abs(totalPnl))}`}
            sub={fmtPct(totalPnlPct)}
            trend={totalPnl >= 0 ? 'up' : 'down'}
            loading={isLoading}
          />
        </div>

        {/* ── Table ── */}
        <div className={`${styles.tableWrap} glass`}>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyState={{
              icon: '🤖',
              title: 'No stocks on autopilot',
              subtitle: (
                <>
                  Add a ticker above or visit a{' '}
                  <Link href="/stocks" className={styles.emptyLink}>stock page</Link>
                  {' '}to add it to automated monitoring.
                </>
              ),
            }}
            rowKey={(r) => r.entry.ticker}
            tableClassName={styles.table}
            rowClassName={() => styles.row}
            loadingRowsCount={3}
          />
        </div>
      </div>
    </>
  )
}