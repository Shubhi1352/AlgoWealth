'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import {
  isManualTrade,
  useTransactions,
  type Transaction,
  type AIReasoning,
} from '@/lib/api'
import FloatingElement from '@/components/elements/FloatingElement'
import { Submarine } from '@/components/elements/shapes'
import MetricCard from '@/components/ui/MetricCard'
import DataTable, { ColumnDef } from '@/components/ui/DataTable'
import styles from './trades.module.css'
import React from 'react'

type ActionFilter = 'ALL' | 'BUY' | 'SELL'
type Preset = '1W' | '1M' | '3M' | 'All'
const PRESETS: Preset[] = ['1W', '1M', '3M', 'All']
const PRESET_DAYS: Record<Preset, number> = { '1W': 7, '1M': 30, '3M': 90, 'All': 99999 }

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDateShort(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function fmtInput(d: Date) { return d.toISOString().slice(0, 10) }

function signalClass(signal: string) {
  if (signal === 'BUY') return styles.signalBuy
  if (signal === 'SELL') return styles.signalSell
  return styles.signalHold
}

export default function TradesPage() {
  const { token, isReady, isAuthed, router } = useAuthGuard()

  // ── Filter state ──────────────────────────────────────────────────────────
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL')
  const [tickerFilter, setTickerFilter] = useState('')
  const [preset, setPreset] = useState<Preset>('1M')
  const [lastPreset, setLastPreset] = useState<Preset>('1M')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // ── Expanded row ──────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: transactions, isLoading } = useTransactions({ refreshInterval: 60_000 })

  // ── Filter logic ──────────────────────────────────────────────────────────
  const isCustomActive = !!(customFrom || customTo)

  const filtered = useMemo(() => {
    if (!transactions) return []

    return transactions.filter(tx => {
      // Action filter
      if (actionFilter !== 'ALL' && tx.action !== actionFilter) return false

      // Ticker filter
      if (tickerFilter && !tx.ticker.includes(tickerFilter.toUpperCase())) return false

      // Date filter
      const ts = new Date(tx.timestamp)
      if (isCustomActive) {
        if (customFrom && ts < new Date(customFrom + 'T00:00:00')) return false
        if (customTo && ts > new Date(customTo + 'T23:59:59')) return false
      } else {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - PRESET_DAYS[preset])
        if (ts < cutoff) return false
      }

      return true
    })
  }, [transactions, actionFilter, tickerFilter, preset, isCustomActive, customFrom, customTo])

  // ── KPIs from filtered set ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtered.length
    const buyVol = filtered.filter(t => t.action === 'BUY').reduce((s, t) => s + t.total_value, 0)
    const sellVol = filtered.filter(t => t.action === 'SELL').reduce((s, t) => s + t.total_value, 0)
    const aiTrades = filtered.filter(t => !isManualTrade(t.agent_reasoning))
    const avgConf = aiTrades.length
      ? aiTrades.reduce((s, t) => s + t.confidence_score, 0) / aiTrades.length
      : 0
    return { total, buyVol, sellVol, avgConf }
  }, [filtered])

  function handlePreset(p: Preset) {
    setPreset(p)
    setLastPreset(p)
    setCustomFrom('')
    setCustomTo('')
  }

  function handleClear() {
    setCustomFrom('')
    setCustomTo('')
    setPreset(lastPreset)
  }

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      header: 'Date',
      cell: (tx) => (
        <div className={styles.dateCell}>
          <span className={styles.dateMain}>{fmtDateShort(tx.timestamp)}</span>
          <span className={styles.dateTime}>{fmtTime(tx.timestamp)}</span>
        </div>
      )
    },
    {
      header: 'Ticker',
      cell: (tx) => (
        <div onClick={e => e.stopPropagation()}>
          <Link href={`/stocks/${tx.ticker}`} className={styles.tickerLink}>
            {tx.ticker}
          </Link>
        </div>
      )
    },
    {
      header: 'Action',
      cell: (tx) => (
        <span className={`${styles.actionBadge} ${tx.action === 'BUY' ? styles.buyBadge : styles.sellBadge}`}>
          {tx.action}
        </span>
      )
    },
    {
      header: 'Quantity',
      align: 'right',
      className: styles.numCell,
      cell: (tx) => tx.quantity.toFixed(4)
    },
    {
      header: 'Price',
      align: 'right',
      className: styles.numCell,
      cell: (tx) => `$${fmtPrice(tx.price)}`
    },
    {
      header: 'Total',
      align: 'right',
      className: styles.numCell,
      cell: (tx) => `$${fmtPrice(tx.total_value)}`
    },
    {
      header: 'Confidence',
      cell: (tx) => {
        const isManual = isManualTrade(tx.agent_reasoning)
        return isManual ? (
          <span className="text-muted">—</span>
        ) : (
          <div className={styles.confCell}>
            <div className={styles.confTrack}>
              <div
                className={styles.confFill}
                style={{ width: `${tx.confidence_score * 100}%` }}
              />
            </div>
            <span className={styles.confPct}>
              {(tx.confidence_score * 100).toFixed(0)}%
            </span>
          </div>
        )
      }
    },
    {
      header: 'Type',
      cell: (tx) => {
        const isManual = isManualTrade(tx.agent_reasoning)
        return (
          <span className={`${styles.typeBadge} ${isManual ? styles.typeManual : styles.typeAI}`}>
            {isManual ? 'Manual' : 'AI'}
          </span>
        )
      }
    },
    {
      header: '',
      cell: (tx) => {
        const isExpanded = expandedId === tx.id
        return (
          <button
            className={`${styles.expandBtn} ${isExpanded ? styles.expandBtnOpen : ''}`}
            aria-label="Toggle reasoning"
          >
            ▾
          </button>
        )
      }
    }
  ], [expandedId])

  const renderRowDetails = useCallback((tx: Transaction) => {
    const isManual = isManualTrade(tx.agent_reasoning)
    const ai = isManual ? null : tx.agent_reasoning as AIReasoning
    return (
      <tr className={styles.reasoningRow}>
        <td colSpan={9} className={styles.reasoningCell}>
          {isManual ? (
            <div className={styles.manualNote}>
              <span className={styles.manualIcon}>✋</span>
              <span>Manually triggered trade — no AI reasoning available.</span>
            </div>
          ) : ai && (
            <div className={styles.reasoningContent}>
              {/* Decision row */}
              <div className={styles.decisionRow}>
                <span className={`${styles.decisionBadge} ${signalClass(ai.decision)}`}>
                  {ai.decision}
                </span>
                <span className={styles.confLabel}>
                  {(ai.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>

              {/* Agent cards */}
              <div className={styles.agentCards}>
                {[
                  { label: 'News', signal: ai.news_signal?.signal ?? 'N/A', summary: ai.news_signal?.summary ?? 'No data available' },
                  { label: 'Technical', signal: ai.technical_signal?.signal ?? 'N/A', summary: ai.technical_signal?.summary ?? 'No data available' },
                  { label: 'Fundamental', signal: ai.fundamental_signal?.signal ?? 'N/A', summary: ai.fundamental_signal?.summary ?? 'No data available' },
                ].map(agent => (
                  <div key={agent.label} className={`${styles.agentCard} glass-elevated`}>
                    <div className={styles.agentCardHeader}>
                      <span className={styles.agentLabel}>{agent.label}</span>
                      <span className={signalClass(agent.signal)}>{agent.signal}</span>
                    </div>
                    <p className={styles.agentSummary}>{agent.summary}</p>
                  </div>
                ))}
              </div>

              {/* News articles */}
              {ai.news_signal?.articles && ai.news_signal.articles.length > 0 && (
                <div className={styles.articles}>
                  <span className={styles.articlesLabel}>Sources</span>
                  <div className={styles.articlesList}>
                    {ai.news_signal.articles.map(a => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.articleLink}
                        onClick={e => e.stopPropagation()}
                      >
                        {a.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </td>
      </tr>
    )
  }, [])

  if (!isReady || !isAuthed) return null

  return (
    <>
      <FloatingElement bottom="2%" left="80px" animVariant="swim">
        <Submarine />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── Title ── */}
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.pageTitle}>Trade History</h1>
            <p className={styles.pageSubtitle}>Every executed trade with full AI reasoning</p>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className={styles.kpiStrip}>
          <MetricCard
            label="Trades"
            value={kpis.total.toString()}
            sub="in range"
            loading={isLoading}
          />
          <MetricCard
            label="BUY Volume"
            value={`$${fmtPrice(kpis.buyVol)}`}
            sub="total bought"
            loading={isLoading}
          />
          <MetricCard
            label="SELL Volume"
            value={`$${fmtPrice(kpis.sellVol)}`}
            sub="total sold"
            loading={isLoading}
          />
          <MetricCard
            label="Avg AI Conf"
            value={`${(kpis.avgConf * 100).toFixed(0)}%`}
            sub="AI trades only"
            loading={isLoading}
          />
        </div>

        {/* ── Filter bar ── */}
        <div className={`${styles.filterBar} glass`}>
          {/* Action toggle */}
          <div className={styles.actionToggle}>
            {(['ALL', 'BUY', 'SELL'] as ActionFilter[]).map(a => (
              <button
                key={a}
                className={`${styles.actionBtn} ${actionFilter === a ? styles.actionActive : ''} ${a === 'BUY' ? styles.actionBuy : a === 'SELL' ? styles.actionSell : ''}`}
                onClick={() => setActionFilter(a)}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Ticker search */}
          <input
            className={`aw-input ${styles.tickerSearch}`}
            placeholder="Filter ticker…"
            value={tickerFilter}
            onChange={e => setTickerFilter(e.target.value.toUpperCase())}
            maxLength={8}
          />

          {/* Preset buttons */}
          <div className={styles.presets}>
            {PRESETS.map(p => (
              <button
                key={p}
                className={`${styles.presetBtn} ${!isCustomActive && preset === p ? styles.presetActive : ''}`}
                onClick={() => handlePreset(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className={styles.dateInputs}>
            <input
              type="date"
              className={styles.dateInput}
              value={customFrom}
              max={customTo || fmtInput(new Date())}
              onChange={e => setCustomFrom(e.target.value)}
            />
            <span className={styles.dateSep}>→</span>
            <input
              type="date"
              className={styles.dateInput}
              value={customTo}
              min={customFrom || undefined}
              max={fmtInput(new Date())}
              onChange={e => setCustomTo(e.target.value)}
            />
            {isCustomActive && (
              <button className={styles.clearBtn} onClick={handleClear}>✕ Clear</button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className={`${styles.tableWrap} glass`}>
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            emptyState={{
              icon: '📭',
              title: 'No trades match your filters',
              subtitle: 'Try a different date range or clear the ticker filter.',
            }}
            rowKey={(tx) => tx.id}
            tableClassName={styles.table}
            rowClassName={(tx) => `${styles.row} ${expandedId === tx.id ? styles.rowExpanded : ''}`}
            onRowClick={(tx) => toggleExpand(tx.id)}
            isRowExpanded={(tx) => expandedId === tx.id}
            renderRowDetails={renderRowDetails}
            loadingRowsCount={4}
          />
        </div>

      </div>
    </>
  )
}