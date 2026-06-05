'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  useWatchlist,
  usePositions,
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
import MetricCard from '@/components/ui/MetricCard'
import DataTable, { ColumnDef } from '@/components/ui/DataTable'
import styles from './watchlist.module.css'

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

interface WatchlistRow {
  entry: WatchlistEntry
  detail: StockDetail | null
  position: Position | null
}

type ActiveList = 'a' | 'b'

export default function WatchlistABPage() {
  const router = useRouter()
  const isAuthed = useIsAuthed()
  const isReady = useIsReady()
  const token = useToken()

  // ── all hooks before guard ────────────────────────────────────────────────
  const [activeList, setActiveList] = useState<ActiveList>('a')
  const [rowsA, setRowsA] = useState<WatchlistRow[]>([])
  const [rowsB, setRowsB] = useState<WatchlistRow[]>([])
  const [enrichingA, setEnrichingA] = useState(false)
  const [enrichingB, setEnrichingB] = useState(false)
  const [removing, setRemoving] = useState<Record<string, boolean>>({})

  // add ticker
  const [addTicker, setAddTicker] = useState('')
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [addMsg, setAddMsg] = useState('')

  const { data: watchlistA, mutate: mutateA, isLoading: loadingA } = useWatchlist('a', { refreshInterval: 60_000 })
  const { data: watchlistB, mutate: mutateB, isLoading: loadingB } = useWatchlist('b', { refreshInterval: 63_000 })
  const { data: positions, mutate: mutatePositions } = usePositions({ refreshInterval: 35_000 })

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
        detail: details[i],
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
        detail: details[i],
        position: posMap[entry.ticker] ?? null,
      })))
      setEnrichingB(false)
    })
  }, [watchlistB, positions, token])

  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

  // ── Active rows + mutate based on toggle ──────────────────────────────────
  const rows = activeList === 'a' ? rowsA : rowsB
  const mutateList = activeList === 'a' ? mutateA : mutateB
  const setRows = activeList === 'a' ? setRowsA : setRowsB
  const isEnriching = activeList === 'a' ? enrichingA : enrichingB
  const isWlLoading = activeList === 'a' ? loadingA : loadingB

  // ── KPIs for active list ──────────────────────────────────────────────────
  const totalInvested = rows.reduce((sum, r) =>
    sum + (r.position ? r.position.avg_buy_price * r.position.quantity : 0), 0)
  const totalValue = rows.reduce((sum, r) =>
    sum + (r.position ? r.position.current_value : 0), 0)
  const totalPnl = totalValue - totalInvested
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
      header: 'Avg Cost',
      align: 'right',
      className: styles.numCell,
      cell: (row) => row.position ? `$${fmtPrice(row.position.avg_buy_price)}` : <span className="text-muted">—</span>
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
      header: '',
      cell: (row) => {
        const removeKey = `${activeList}-${row.entry.ticker}`
        const isRemoving = removing[removeKey] ?? false
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
  ], [activeList, removing, handleRemove])

  if (!isReady || !isAuthed) return null

  const isLoading = (isWlLoading && rows.length === 0) || (isEnriching && rows.length === 0)

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
          <MetricCard
            label={`List ${activeList.toUpperCase()} Stocks`}
            value={rows.length.toString()}
            sub="watching"
            loading={isLoading}
          />
          <MetricCard
            label="Total Invested"
            value={`$${fmtPrice(totalInvested)}`}
            sub="in positions"
            loading={isLoading}
          />
          <MetricCard
            label="Current Value"
            value={`$${fmtPrice(totalValue)}`}
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
              icon: '⭐',
              title: `List ${activeList.toUpperCase()} is empty`,
              subtitle: (
                <>
                  Add a ticker above or visit a{' '}
                  <Link href="/stocks" className={styles.emptyLink}>stock page</Link>
                  {' '}to add it here.
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