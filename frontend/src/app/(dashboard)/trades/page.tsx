'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  fetchTransactions,
  isManualTrade,
  type Transaction,
  type AIReasoning,
} from '@/lib/api'
import FloatingElement from '@/components/elements/FloatingElement'
import { Submarine } from '@/components/elements/shapes'
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
  if (signal === 'BUY')  return styles.signalBuy
  if (signal === 'SELL') return styles.signalSell
  return styles.signalHold
}

export default function TradesPage() {
  const router   = useRouter()
  const isAuthed = useIsAuthed()
  const isReady  = useIsReady()
  const token    = useToken()

  // ── Filter state ──────────────────────────────────────────────────────────
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL')
  const [tickerFilter, setTickerFilter] = useState('')
  const [preset,       setPreset]       = useState<Preset>('1M')
  const [lastPreset,   setLastPreset]   = useState<Preset>('1M')
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')

  // ── Expanded row ──────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: transactions, isLoading } = useSWR<Transaction[]>(
    token ? ['transactions', token] : null,
    ([, tok]: [string, string]) => fetchTransactions(tok),
    { refreshInterval: 60_000 }
  )

  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

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
        if (customTo   && ts > new Date(customTo   + 'T23:59:59')) return false
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
    const total    = filtered.length
    const buyVol   = filtered.filter(t => t.action === 'BUY').reduce((s, t) => s + t.total_value, 0)
    const sellVol  = filtered.filter(t => t.action === 'SELL').reduce((s, t) => s + t.total_value, 0)
    const aiTrades = filtered.filter(t => !isManualTrade(t.agent_reasoning))
    const avgConf  = aiTrades.length
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
          {[
            { label: 'Trades',        value: kpis.total.toString(),          sub: 'in range' },
            { label: 'BUY Volume',    value: `$${fmtPrice(kpis.buyVol)}`,    sub: 'total bought' },
            { label: 'SELL Volume',   value: `$${fmtPrice(kpis.sellVol)}`,   sub: 'total sold' },
            { label: 'Avg AI Conf',   value: `${(kpis.avgConf * 100).toFixed(0)}%`, sub: 'AI trades only' },
          ].map(k => (
            <div key={k.label} className={`${styles.kpiCard} glass`}>
              <span className={styles.kpiLabel}>{k.label}</span>
              <span className={styles.kpiValue}>{k.value}</span>
              <span className={styles.kpiSub}>{k.sub}</span>
            </div>
          ))}
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
          {isLoading ? (
            <div className={styles.loadingRows}>
              {[1,2,3,4].map(i => (
                <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📭</span>
              <p className={styles.emptyTitle}>No trades match your filters</p>
              <p className={styles.emptySub}>Try a different date range or clear the ticker filter.</p>
            </div>
          ) : (
            <table className={`aw-table ${styles.table}`}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticker</th>
                  <th>Action</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Confidence</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const isManual   = isManualTrade(tx.agent_reasoning)
                  const isExpanded = expandedId === tx.id
                  const ai         = isManual ? null : tx.agent_reasoning as AIReasoning

                  return (
                    <React.Fragment key={tx.id}>
                      {/* ── Main row ── */}
                      <tr
                        className={`${styles.row} ${isExpanded ? styles.rowExpanded : ''}`}
                        onClick={() => toggleExpand(tx.id)}
                      >
                        {/* Date + time */}
                        <td>
                          <div className={styles.dateCell}>
                            <span className={styles.dateMain}>{fmtDateShort(tx.timestamp)}</span>
                            <span className={styles.dateTime}>{fmtTime(tx.timestamp)}</span>
                          </div>
                        </td>

                        {/* Ticker */}
                        <td onClick={e => e.stopPropagation()}>
                          <Link href={`/stocks/${tx.ticker}`} className={styles.tickerLink}>
                            {tx.ticker}
                          </Link>
                        </td>

                        {/* Action */}
                        <td>
                          <span className={`${styles.actionBadge} ${tx.action === 'BUY' ? styles.buyBadge : styles.sellBadge}`}>
                            {tx.action}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className={styles.numCell}>{tx.quantity.toFixed(4)}</td>

                        {/* Price */}
                        <td className={styles.numCell}>${fmtPrice(tx.price)}</td>

                        {/* Total */}
                        <td className={styles.numCell}>${fmtPrice(tx.total_value)}</td>

                        {/* Confidence bar */}
                        <td>
                          {isManual ? (
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
                          )}
                        </td>

                        {/* Type badge */}
                        <td>
                          <span className={`${styles.typeBadge} ${isManual ? styles.typeManual : styles.typeAI}`}>
                            {isManual ? 'Manual' : 'AI'}
                          </span>
                        </td>

                        {/* Expand toggle */}
                        <td>
                          <button
                            className={`${styles.expandBtn} ${isExpanded ? styles.expandBtnOpen : ''}`}
                            aria-label="Toggle reasoning"
                          >
                            ▾
                          </button>
                        </td>
                      </tr>

                      {/* ── Expanded reasoning row ── */}
                      {isExpanded && (
                        <tr key={`${tx.id}-expanded`} className={styles.reasoningRow}>
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
                                    { label: 'News',        signal: ai.news_signal.signal,        summary: ai.news_signal.summary },
                                    { label: 'Technical',   signal: ai.technical_signal.signal,   summary: ai.technical_signal.summary },
                                    { label: 'Fundamental', signal: ai.fundamental_signal.signal, summary: ai.fundamental_signal.summary },
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
                                {ai.news_signal.articles.length > 0 && (
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
                      )}
                    </React.Fragment>
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