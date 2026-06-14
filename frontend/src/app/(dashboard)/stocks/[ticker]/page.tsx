'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CandlestickSeries,
} from 'lightweight-charts'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'
import {
  authorizedFetcher,
  fetchPositions,
  fetchChart,
  executeTrade,
  analyzeStock,
  addToWatchlist,
  type StockDetail,
  type Position,
  type AnalyzeResponse,
  type WatchlistType,
  type PortfolioSummary,
} from '@/lib/api'
import FloatingElement from '@/components/elements/FloatingElement'
import styles from './stockdetail.module.css'
import { PirateSkull } from '@/components/elements/shapes'
import Image from 'next/image'

const API = process.env.NEXT_PUBLIC_API_URL

const RESOLUTIONS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
] as const
type ResLabel = typeof RESOLUTIONS[number]['label']

type BtnState = 'idle' | 'loading' | 'success' | 'error'
type TradeStatus = 'idle' | 'loading' | 'success' | 'error'

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMarketCap(millions: number): string {
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(2)}B`
  return `$${millions.toFixed(0)}M`
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function signalClass(signal: string): string {
  if (signal === 'BUY') return 'signal-buy'
  if (signal === 'SELL') return 'signal-sell'
  return 'signal-hold'
}

export default function StockDetailPage() {
  const params = useParams()
  const ticker = (params?.ticker as string ?? '').toUpperCase()
  const router = useRouter()
  const isAuthed = useIsAuthed()
  const isReady = useIsReady()
  const token = useToken()

  useEffect(() => {
    if (isReady && !isAuthed) router.replace('/login')
  }, [isReady, isAuthed, router])

  // ── Chart refs + ready flag
  const roRef = useRef<ResizeObserver | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const [resolution, setResolution] = useState<ResLabel>('3M')
  const [chartError, setChartError] = useState(false)

  // ── Watchlist states
  const [wlStates, setWlStates] = useState<Record<WatchlistType, BtnState>>({
    automated: 'idle', a: 'idle', b: 'idle',
  })

  // ── Trade states
  const [buyQty, setBuyQty] = useState('')
  const [buyStatus, setBuyStatus] = useState<TradeStatus>('idle')
  const [buyMsg, setBuyMsg] = useState('')
  const [sellQty, setSellQty] = useState('')
  const [sellStatus, setSellStatus] = useState<TradeStatus>('idle')
  const [sellMsg, setSellMsg] = useState('')

  // ── Analyze states
  const [showConfirm, setShowConfirm] = useState(false)
  const [analyzeStatus, setAnalyzeStatus] = useState<TradeStatus>('idle')
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null)
  const [showReasoning, setShowReasoning] = useState(false)

  // ── Data
  const { data: detail, error: detailError, isLoading: detailLoading } = useSWR<StockDetail>(
    token && ticker ? [`${API}/api/v1/stocks/${ticker}`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<StockDetail>(url, tok),
    { refreshInterval: 30_000, revalidateOnFocus: false }
  )

  const { data: positions, mutate: mutatePositions } = useSWR<Position[]>(
    token ? [`${API}/api/v1/portfolio/positions`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<Position[]>(url, tok),
    { refreshInterval: 30_000, revalidateOnFocus: false }
  )

  const { data: portfolio } = useSWR<PortfolioSummary>(
    token ? [`${API}/api/v1/portfolio/`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<PortfolioSummary>(url, tok),
    { refreshInterval: 30_000, revalidateOnFocus: false }
  )

  const position = positions?.find(p => p.ticker === ticker) ?? null
  const chartDays = RESOLUTIONS.find(r => r.label === resolution)?.days ?? 90
  const currentPrice = detail?.quote.current_price ?? 0

  const buyCost = buyQty && !isNaN(parseFloat(buyQty))
    ? parseFloat(buyQty) * currentPrice
    : null

  const sellValue = sellQty && !isNaN(parseFloat(sellQty))
    ? parseFloat(sellQty) * currentPrice
    : null

  // ── Step 1: Build chart once on mount
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current

    const timer = setTimeout(() => {
      if (!container) return

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255,255,255,0.6)',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.05)' },
          horzLines: { color: 'rgba(255,255,255,0.05)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(127,255,212,0.4)' },
          horzLine: { color: 'rgba(127,255,212,0.4)' },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
        width: container.clientWidth,
        height: 380,
      })

      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#7FFFD4',
        downColor: '#FF6B8A',
        borderVisible: false,
        wickUpColor: '#7FFFD4',
        wickDownColor: '#FF6B8A',
      })

      chartRef.current = chart
      seriesRef.current = series

      roRef.current = new ResizeObserver(entries => {
        const { width } = entries[0].contentRect
        chart.applyOptions({ width })
      })
      roRef.current.observe(container)

      setChartReady(true)
    }, 50)

    return () => {
      clearTimeout(timer)
      roRef.current?.disconnect()
      roRef.current = null
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
      setChartReady(false)
    }
  }, [])

  // ── Step 2: Load data only after chart is ready
  useEffect(() => {
    if (!chartReady || !token || !ticker) return

    setChartError(false)
    fetchChart(ticker, token, chartDays)
      .then(candles => {
        if (!seriesRef.current) return
        const sorted = [...candles].sort((a, b) => a.time - b.time)
        seriesRef.current.setData(sorted as never)
        chartRef.current?.timeScale().fitContent()
      })
      .catch(() => setChartError(true))
  }, [chartReady, ticker, token, chartDays])

  // ── Watchlist
  const handleWatchlist = useCallback(async (list: WatchlistType) => {
    if (!token) return
    setWlStates(prev => ({ ...prev, [list]: 'loading' }))
    try {
      await addToWatchlist(ticker, list, token)
      setWlStates(prev => ({ ...prev, [list]: 'success' }))
      setTimeout(() => setWlStates(prev => ({ ...prev, [list]: 'idle' })), 2000)
    } catch {
      setWlStates(prev => ({ ...prev, [list]: 'error' }))
      setTimeout(() => setWlStates(prev => ({ ...prev, [list]: 'idle' })), 2000)
    }
  }, [ticker, token])

  // ── BUY
  const handleBuy = useCallback(async () => {
    const qty = parseFloat(buyQty)
    if (!token || isNaN(qty) || qty <= 0) return
    setBuyStatus('loading')
    setBuyMsg('')
    try {
      const result = await executeTrade({ ticker, action: 'BUY', confidence: 1.0, quantity: Number(qty), trade_type: 'manual', }, token)
      setBuyStatus('success')
      setBuyMsg(`Bought ${result.quantity.toFixed(4)} shares @ $${fmtPrice(result.price)}`)
      setBuyQty('')
      mutatePositions()
    } catch (err) {
      setBuyStatus('error')
      setBuyMsg(err instanceof Error ? err.message : 'Trade failed')
    } finally {
      setTimeout(() => { setBuyStatus('idle'); setBuyMsg('') }, 4000)
    }
  }, [token, ticker, buyQty, mutatePositions])

  // ── SELL
  const handleSell = useCallback(async () => {
    const qty = parseFloat(sellQty)
    if (!token || isNaN(qty) || qty <= 0) return
    setSellStatus('loading')
    setSellMsg('')
    try {
      const result = await executeTrade({ ticker, action: 'SELL', confidence: 1.0, quantity: Number(qty), trade_type: 'manual' }, token)
      setSellStatus('success')
      setSellMsg(`Sold ${result.quantity.toFixed(4)} shares @ $${fmtPrice(result.price)}`)
      setSellQty('')
      mutatePositions()
    } catch (err) {
      setSellStatus('error')
      setSellMsg(err instanceof Error ? err.message : 'Trade failed')
    } finally {
      setTimeout(() => { setSellStatus('idle'); setSellMsg('') }, 4000)
    }
  }, [token, ticker, sellQty, mutatePositions])

  // ── Analyze
  const handleAnalyze = useCallback(async () => {
    if (!token) return
    setShowConfirm(false)
    setAnalyzeStatus('loading')
    setAnalyzeResult(null)
    setShowReasoning(false)
    try {
      const result = await analyzeStock(ticker, token)
      setAnalyzeResult(result)
      setAnalyzeStatus('success')
      setShowReasoning(true)
      mutatePositions()
    } catch (err) {
      setAnalyzeStatus('error')
      setTimeout(() => setAnalyzeStatus('idle'), 4000)
    }
  }, [token, ticker, mutatePositions])

  if (!isReady || !isAuthed) return null

  if (detailLoading) return (
    <div className={styles.page}>
      <div className={styles.loadingState}>
        <div className="skeleton" style={{ width: 220, height: 36, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 140, height: 52, borderRadius: 8, marginTop: 8 }} />
      </div>
    </div>
  )

  if (detailError || !detail) return (
    <div className={styles.page}>
      <div className={styles.errorState}>
        <p>Could not load {ticker}.</p>
        <button className="btn btn-ghost-white" onClick={() => router.back()}>← Go back</button>
      </div>
    </div>
  )

  const { quote, company } = detail
  const isProfit = quote.change >= 0

  return (
    <>
      <FloatingElement bottom="2%" left="80px" animVariant='bob'>
        <PirateSkull />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {company.logo_url && (
              <Image
                src={company.logo_url}
                alt={`${company.name} logo`}
                width={24}
                height={24}
                className={styles.companyLogo}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div>
              <div className={styles.headerTicker}>{ticker}</div>
              <div className={styles.headerName}>{company.name}</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.currentPrice}>${fmtPrice(quote.current_price)}</div>
            <div className={`${styles.changeBadge} ${isProfit ? styles.profit : styles.loss}`}>
              {isProfit ? '▲' : '▼'} {Math.abs(quote.change).toFixed(2)} ({fmtPct(quote.change_pct)})
            </div>
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className={styles.body}>

          {/* ══ LEFT COLUMN ══ */}
          <div className={styles.leftCol}>

            {/* Chart */}
            <div className={`${styles.section} glass`}>
              <div className={styles.chartHeader}>
                <span className={styles.sectionLabel}>Price Chart</span>
                <div className={styles.resTabs}>
                  {RESOLUTIONS.map(r => (
                    <button
                      key={r.label}
                      className={`${styles.resTab} ${resolution === r.label ? styles.resTabActive : ''}`}
                      onClick={() => setResolution(r.label)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {chartError && (
                <div className={styles.chartError}>Chart data unavailable</div>
              )}
              <div ref={chartContainerRef} className={styles.chartContainer} />
            </div>

            {/* Trade bar */}
            <div className={`${styles.section} glass`}>
              <div className={styles.tradeHeader}>
                <div className={styles.sectionLabel}>Trade</div>
                {portfolio && (
                  <div className={styles.cashBalance}>
                    <span className={styles.cashLabel}>Available Cash</span>
                    <span className={styles.cashValue}>${fmtPrice(portfolio.cash_balance)}</span>
                  </div>
                )}
              </div>

              {/* Watchlist row */}
              <div className={styles.watchlistRow}>
                <span className={styles.watchlistLabel}>Add to watchlist:</span>
                {(['automated', 'a', 'b'] as WatchlistType[]).map(list => {
                  const s = wlStates[list]
                  const labels: Record<WatchlistType, string> = {
                    automated: 'Automated', a: 'List A', b: 'List B',
                  }
                  return (
                    <button
                      key={list}
                      className={`${styles.wlBtn} ${s === 'success' ? styles.wlSuccess : ''} ${s === 'error' ? styles.wlError : ''}`}
                      onClick={() => handleWatchlist(list)}
                      disabled={s === 'loading' || s === 'success'}
                    >
                      {s === 'loading' ? '…' : s === 'success' ? '✓ Added' : s === 'error' ? '✕ Failed' : `+ ${labels[list]}`}
                    </button>
                  )
                })}
              </div>

              {/* Buy / Sell / Analyze */}
              <div className={styles.tradeControls}>
                {/* BUY */}
                <div className={styles.tradeGroup}>
                  <div className={styles.tradeInputRow}>
                    <input
                      type="number"
                      className={`${styles.tradeInput} aw-input`}
                      placeholder="Qty"
                      value={buyQty}
                      min="0.0001"
                      step="0.0001"
                      onChange={e => setBuyQty(e.target.value)}
                      aria-label="Buy quantity"
                    />
                    <button
                      className={styles.buyBtn}
                      onClick={handleBuy}
                      disabled={buyStatus === 'loading' || !buyQty}
                    >
                      {buyStatus === 'loading' ? '…' : 'BUY'}
                    </button>
                  </div>
                  {buyCost !== null && (
                    <div className={styles.tradePreview}>
                      Cost ≈ <span className={styles.tradePreviewValue}>${fmtPrice(buyCost)}</span>
                    </div>
                  )}
                  {buyMsg && (
                    <div className={`${styles.tradeMsg} ${buyStatus === 'success' ? styles.tradeMsgOk : styles.tradeMsgErr}`}>
                      {buyMsg}
                    </div>
                  )}
                </div>

                {/* SELL — only if position exists */}
                {position && (
                  <div className={styles.tradeGroup}>
                    <div className={styles.tradeInputRow}>
                      <input
                        type="number"
                        className={`${styles.tradeInput} aw-input`}
                        placeholder="Qty"
                        value={sellQty}
                        min="0.0001"
                        step="0.0001"
                        max={position.quantity}
                        onChange={e => setSellQty(e.target.value)}
                        aria-label="Sell quantity"
                      />
                      <button
                        className={styles.sellBtn}
                        onClick={handleSell}
                        disabled={sellStatus === 'loading' || !sellQty}
                      >
                        {sellStatus === 'loading' ? '…' : 'SELL'}
                      </button>
                    </div>
                    {sellValue !== null && (
                      <div className={styles.tradePreview}>
                        Value ≈ <span className={styles.tradePreviewValue}>${fmtPrice(sellValue)}</span>
                      </div>
                    )}
                    {sellMsg && (
                      <div className={`${styles.tradeMsg} ${sellStatus === 'success' ? styles.tradeMsgOk : styles.tradeMsgErr}`}>
                        {sellMsg}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Analyze */}
                <button
                  className={styles.analyzeBtn}
                  onClick={handleAnalyze}
                  disabled={analyzeStatus === 'loading'}
                >
                  {analyzeStatus === 'loading'
                    ? <><span className={styles.spinDot} /> Analyzing…</>
                    : '⚡ AI Analyze'}
                </button>
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className={styles.rightCol}>

            {/* Company */}
            <div className={`${styles.section} glass`}>
              <div className={styles.sectionLabel}>Company</div>
              <div className={styles.infoGrid}>
                {[
                  ['Sector', company.sector],
                  ['Market Cap', fmtMarketCap(company.market_cap)],
                  ['Exchange', company.exchange.split(',')[0]],
                  ['IPO Date', company.ipo_date],
                ].map(([label, value]) => (
                  <div key={label} className={styles.infoItem}>
                    <span className={styles.infoLabel}>{label}</span>
                    <span className={styles.infoValue}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's range */}
            <div className={`${styles.section} glass`}>
              <div className={styles.sectionLabel}>Today&apos;s Range</div>
              <div className={styles.infoGrid}>
                {[
                  ['Open', `$${fmtPrice(quote.open)}`],
                  ['High', `$${fmtPrice(quote.high)}`],
                  ['Low', `$${fmtPrice(quote.low)}`],
                  ['Prev Close', `$${fmtPrice(quote.prev_close)}`],
                ].map(([label, value]) => (
                  <div key={label} className={styles.infoItem}>
                    <span className={styles.infoLabel}>{label}</span>
                    <span className={styles.infoValue}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Position — conditional */}
            {position && (
              <div className={`${styles.section} ${styles.positionSection} glass`}>
                <div className={styles.sectionLabel}>Your Position</div>
                <div className={styles.infoGrid}>
                  {[
                    ['Shares', position.quantity.toFixed(4)],
                    ['Avg Cost', `$${fmtPrice(position.avg_buy_price)}`],
                    ['Current Value', `$${fmtPrice(position.current_value)}`],
                  ].map(([label, value]) => (
                    <div key={label} className={styles.infoItem}>
                      <span className={styles.infoLabel}>{label}</span>
                      <span className={styles.infoValue}>{value}</span>
                    </div>
                  ))}
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Unrealized P&amp;L</span>
                    <span className={`${styles.infoValue} ${position.unrealized_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {position.unrealized_pnl >= 0 ? '+' : ''}${fmtPrice(position.unrealized_pnl)} ({fmtPct(position.unrealized_pnl_pct)})
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Reasoning modal ── */}
      {showReasoning && analyzeResult && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowReasoning(false)}   // click backdrop to dismiss
        >
          <div
            className={styles.reasoningModal}
            onClick={e => e.stopPropagation()}       // prevent backdrop click inside
          >
            {/* Header */}
            <div className={styles.reasoningModalHeader}>
              <span className={styles.reasoningModalTitle}>AI Analysis — {ticker}</span>
              <button
                className={styles.closeReasoning}
                onClick={() => setShowReasoning(false)}
                aria-label="Close"
              >✕</button>
            </div>

            {/* Decision row */}
            <div className={styles.decisionRow}>
              <span className={`${styles.decisionBadge} ${signalClass(analyzeResult.decision)}`}>
                {analyzeResult.decision}
              </span>
              <span className={styles.confidenceLabel}>
                {(analyzeResult.confidence * 100).toFixed(0)}% confidence
              </span>
              {analyzeResult.trade_executed
                ? <span className="badge badge-live">Trade Executed</span>
                : <span className="badge badge-neutral">No Trade</span>}
            </div>

            {/* Agent cards */}
            <div className={styles.agentRow}>
              {[
                { label: 'News', signal: analyzeResult.news_signal.signal, summary: analyzeResult.news_signal.summary },
                { label: 'Technical', signal: analyzeResult.technical_signal.signal, summary: analyzeResult.technical_signal.summary },
                { label: 'Fundamental', signal: analyzeResult.fundamental_signal.signal, summary: analyzeResult.fundamental_signal.summary },
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
            {analyzeResult.news_signal.articles.length > 0 && (
              <div className={styles.articlesSection}>
                <span className={styles.articlesLabel}>Sources</span>
                <div className={styles.articlesList}>
                  {analyzeResult.news_signal.articles.map(a => (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.articleLink}
                    >
                      {a.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.reasoningModalFooter}>
              <button className="btn btn-ghost-white" onClick={() => setShowReasoning(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}