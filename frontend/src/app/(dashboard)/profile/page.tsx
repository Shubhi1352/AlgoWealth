'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import useSWR from 'swr'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import {
  useUser,
  useAuthStore,
} from '@/store/useAuthStore'
import {
  authorizedFetcher,
  fetchTransactions,
  fetchDocuments,
  deleteDocument,
  uploadDocument,
  resetPortfolio,
  type PortfolioSummary,
  type Transaction,
  type IngestDocument,
  type IngestListResponse,
  getMe,
  updatePreferences,
} from '@/lib/api'
import FloatingElement from '@/components/elements/FloatingElement'
import { Octopus } from '@/components/elements/shapes'
import styles from './profile.module.css'

const API = process.env.NEXT_PUBLIC_API_URL

// ── Constants ─────────────────────────────────────────────────────────────────
const RISK_OPTIONS = ['Conservative', 'Moderate', 'Aggressive'] as const
type RiskAppetite = typeof RISK_OPTIONS[number]
type Collection = 'trading_strategies' | 'financials'

const PREFS_KEY = 'algowealth-prefs'

interface UserPrefs {
  defaultStopLoss: number
  riskAppetite: RiskAppetite
}

const DEFAULT_PREFS: UserPrefs = { defaultStopLoss: 5, riskAppetite: 'Moderate' }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function loadPrefs(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
  } catch { return DEFAULT_PREFS }
}
function savePrefs(prefs: UserPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { token, isReady, isAuthed, router } = useAuthGuard()
  const user = useUser()
  const logout = useAuthStore(s => s.logout)

  // ── Preferences ────────────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)
  const [stopLossInput, setStopLossInput] = useState('5')
  const [prefsSaved, setPrefsSaved] = useState(false)

  // ── Reset modal ─────────────────────────────────────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // ── Upload form ─────────────────────────────────────────────────────────────
  const [uploadCollection, setUploadCollection] = useState<Collection>('trading_strategies')
  const [uploadTicker, setUploadTicker] = useState('')
  const [uploadDocType, setUploadDocType] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Doc list filters ────────────────────────────────────────────────────────
  const [docCollectionFilter, setDocCollectionFilter] = useState<'all' | Collection>('all')
  const [docTickerFilter, setDocTickerFilter] = useState('')

  // ── Deleting ────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: summary, mutate: mutateSummary } = useSWR<PortfolioSummary>(
    token ? [`${API}/api/v1/portfolio/`, token] : null,
    ([url, tok]: [string, string]) => authorizedFetcher<PortfolioSummary>(url, tok),
    { refreshInterval: 60_000 }
  )
  const { data: transactions, isLoading: txLoading } = useSWR<Transaction[]>(
    token ? ['transactions', token] : null,
    ([, tok]: [string, string]) => fetchTransactions(tok),
    { refreshInterval: 60_000 }
  )
  const { data: docsData, isLoading: docsLoading, mutate: mutateDocs } = useSWR<IngestListResponse>(
    token ? ['documents', token] : null,
    ([, tok]: [string, string]) => fetchDocuments(tok),
    { revalidateOnFocus: false }
  )

  // ── Load prefs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = loadPrefs()
    // If backend has a risk_appetite, it's the source of truth
    const serverRisk = (user as unknown as { risk_appetite?: RiskAppetite })?.risk_appetite
    if (serverRisk) p.riskAppetite = serverRisk
    setPrefs(p)
    setStopLossInput(String(p.defaultStopLoss))
  }, [user])   // re-run when user object updates from getMe()

  // Refresh user object from /portfolio/me on mount
  useEffect(() => {
    if (!token) return
    getMe().then(u => useAuthStore.getState().setUser(u)).catch(() => { })
  }, [token])

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!transactions?.length) return null
    const sells = transactions.filter(t => t.action === 'SELL')
    const byValue = [...sells].sort((a, b) => b.total_value - a.total_value)

    const totalAI = transactions.filter(t => t.confidence_score > 0).length
    const avgConf = totalAI
      ? transactions
        .filter(t => t.confidence_score > 0)
        .reduce((s, t) => s + t.confidence_score, 0) / totalAI
      : 0

    const aiSells = sells.filter(t => t.confidence_score > 0)
    const wins = aiSells.filter(t => t.confidence_score >= 0.6)
    const winRate = aiSells.length ? (wins.length / aiSells.length) * 100 : 0

    return {
      winRate,
      bestTrade: byValue[0] ?? null,
      worstTrade: byValue[byValue.length - 1] ?? null,
      avgConf,
    }
  }, [transactions])

  // ── Filtered docs ────────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    const all = docsData?.documents ?? []
    return all.filter(doc => {
      if (docCollectionFilter !== 'all' && doc.collection !== docCollectionFilter) return false
      if (docTickerFilter && !doc.ticker?.includes(docTickerFilter.toUpperCase())) return false
      return true
    })
  }, [docsData, docCollectionFilter, docTickerFilter])

  // ── Preferences handlers ────────────────────────────────────────────────────
  const handleSavePrefs = useCallback(() => {
    const parsed = parseFloat(stopLossInput)
    if (isNaN(parsed) || parsed < 1 || parsed > 50) return
    const next: UserPrefs = { ...prefs, defaultStopLoss: parsed }
    setPrefs(next)
    savePrefs(next)
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 2000)
  }, [prefs, stopLossInput])

  const handleRiskChange = useCallback(async (risk: RiskAppetite) => {
    const next: UserPrefs = { ...prefs, riskAppetite: risk }
    setPrefs(next)
    savePrefs(next)   // optimistic local update
    if (token) {
      try {
        await updatePreferences(risk, token)
      } catch {
        // silent — preference is saved locally, backend sync failed
      }
    }
  }, [prefs, token])

  // ── Reset handler ───────────────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!token) return
    setResetting(true)
    setResetError(null)
    try {
      await resetPortfolio(token)
      await mutateSummary()
      setShowResetModal(false)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }, [token, mutateSummary])

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!token || !uploadFile) return
    if (uploadCollection === 'financials' && !uploadTicker.trim()) {
      setUploadError('Ticker is required for financials')
      return
    }
    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)
    try {
      const result = await uploadDocument(
        uploadFile,
        uploadCollection,
        token,
        uploadTicker.trim() || undefined,
        uploadDocType.trim() || undefined,
      )
      setUploadSuccess(`✓ ${result.filename} — ${result.chunks_ingested} chunks ingested`)
      setUploadFile(null)
      setUploadTicker('')
      setUploadDocType('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await mutateDocs()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [token, uploadFile, uploadCollection, uploadTicker, uploadDocType, mutateDocs])

  // ── Delete handler ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (doc: IngestDocument) => {
    if (!token) return
    setDeletingId(doc.id)
    try {
      await deleteDocument(doc.id, token)
      // Optimistic: remove from local state immediately
      mutateDocs(
        prev => prev
          ? { ...prev, documents: prev.documents.filter(d => d.id !== doc.id), count: prev.count - 1 }
          : prev,
        false
      )
    } catch {
      // On error, revalidate to restore correct state
      await mutateDocs()
    } finally {
      setDeletingId(null)
    }
  }, [token, mutateDocs])

  if (!isReady || !isAuthed) return null

  const joinedDate = user?.created_at ? fmtDate(user.created_at) : '—'
  const totalPnlUp = (summary?.total_pnl ?? 0) >= 0

  return (
    <>
      <FloatingElement bottom="2%" left="80px" animVariant="slow">
        <Octopus />
      </FloatingElement>

      <div className={styles.page}>

        {/* ── Title row ── */}
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.pageTitle}>Profile</h1>
            <p className={styles.pageSubtitle}>Account info, trading preferences &amp; performance stats</p>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => { logout(); router.replace('/login') }}
          >
            Sign out
          </button>
        </div>

        {/* ── Two-column grid ── */}
        <div className={styles.grid}>

          {/* LEFT */}
          <div className={styles.leftCol}>

            {/* Account Info */}
            <div className={`${styles.card} glass`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>👤</span>
                <h2 className={styles.cardTitle}>Account</h2>
              </div>
              <div className={styles.infoRows}>
                {([
                  { label: 'Email', value: user?.email ?? '—', cls: '' },
                  { label: 'Member since', value: joinedDate, cls: '' },
                  { label: 'Starting balance', value: '$100,000.00', cls: '' },
                  { label: 'Cash available', value: `$${fmtPrice(summary?.cash_balance ?? 0)}`, cls: 'text-accent' },
                  {
                    label: 'Total P&L',
                    value: `${totalPnlUp ? '+' : ''}$${fmtPrice(Math.abs(summary?.total_pnl ?? 0))} (${totalPnlUp ? '+' : ''}${(summary?.total_pnl_pct ?? 0).toFixed(2)}%)`,
                    cls: totalPnlUp ? 'text-profit' : 'text-loss',
                  },
                ] as const).map(row => (
                  <div key={row.label} className={styles.infoRow}>
                    <span className={styles.infoLabel}>{row.label}</span>
                    <span className={`${styles.infoValue} ${row.cls}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div className={`${styles.card} glass`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>⚙️</span>
                <h2 className={styles.cardTitle}>Trading Preferences</h2>
              </div>
              <p className={styles.cardDesc}>Pre-fills the automated watchlist form. Stored locally.</p>

              <div className={styles.prefRow}>
                <label className={styles.prefLabel}>Risk Appetite</label>
                <div className={styles.riskToggle}>
                  {RISK_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      className={`${styles.riskBtn} ${prefs.riskAppetite === opt ? styles.riskActive : ''} ${styles[`risk${opt}` as keyof typeof styles]}`}
                      onClick={() => handleRiskChange(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p className={styles.prefHint}>
                  {prefs.riskAppetite === 'Conservative' && 'Prefers HOLD signals. Position sizing stays minimal.'}
                  {prefs.riskAppetite === 'Moderate' && 'Balanced approach. Standard confidence thresholds apply.'}
                  {prefs.riskAppetite === 'Aggressive' && 'Accepts lower confidence signals. Higher position sizing.'}
                </p>
              </div>
            </div>


          </div>

          {/* RIGHT */}
          <div className={styles.rightCol}>

            {/* Performance Stats */}
            <div className={`${styles.card} glass`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>📊</span>
                <h2 className={styles.cardTitle}>Performance Stats</h2>
              </div>
              {txLoading ? (
                <div className={styles.statsLoading}>
                  {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
                </div>
              ) : !stats ? (
                <div className={styles.statsEmpty}>
                  <span className={styles.emptyIcon}>📭</span>
                  <p>No completed trades yet.</p>
                </div>
              ) : (
                <div className={styles.statsGrid}>
                  {([
                    { label: 'Win Rate', value: `${stats.winRate.toFixed(0)}%`, sub: 'of AI sell trades', cls: stats.winRate >= 50 ? 'text-profit' : 'text-loss' },
                    { label: 'Total Trades', value: String(summary?.total_trades ?? 0), sub: 'all time', cls: '' },
                    { label: 'Avg AI Confidence', value: `${(stats.avgConf * 100).toFixed(0)}%`, sub: 'across AI trades', cls: '' },
                    { label: 'Open Positions', value: String(summary?.total_positions ?? 0), sub: 'active holdings', cls: '' },
                  ] as const).map(s => (
                    <div key={s.label} className={`${styles.statCard} glass-elevated`}>
                      <span className={styles.statLabel}>{s.label}</span>
                      <span className={`${styles.statValue} ${s.cls}`}>{s.value}</span>
                      <span className={styles.statSub}>{s.sub}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notable trades */}
            {stats?.bestTrade && (
              <div className={`${styles.card} glass`}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>🏆</span>
                  <h2 className={styles.cardTitle}>Notable Trades</h2>
                </div>
                <div className={styles.notableRows}>
                  <div className={styles.notableRow}>
                    <div className={styles.notableMeta}>
                      <span className={`${styles.notableBadge} ${styles.bestBadge}`}>Largest SELL</span>
                      <span className={styles.notableTicker}>{stats.bestTrade.ticker}</span>
                    </div>
                    <div className={styles.notableRight}>
                      <span className={`${styles.notableValue} text-profit`}>${fmtPrice(stats.bestTrade.total_value)}</span>
                      <span className={styles.notableDate}>{new Date(stats.bestTrade.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                  {stats.worstTrade && stats.worstTrade.id !== stats.bestTrade.id && (
                    <div className={styles.notableRow}>
                      <div className={styles.notableMeta}>
                        <span className={`${styles.notableBadge} ${styles.worstBadge}`}>Smallest SELL</span>
                        <span className={styles.notableTicker}>{stats.worstTrade.ticker}</span>
                      </div>
                      <div className={styles.notableRight}>
                        <span className={`${styles.notableValue} text-loss`}>${fmtPrice(stats.worstTrade.total_value)}</span>
                        <span className={styles.notableDate}>{new Date(stats.worstTrade.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Danger zone */}
            <div className={`${styles.card} ${styles.dangerCard} glass`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>⚠️</span>
                <h2 className={`${styles.cardTitle} ${styles.dangerTitle}`}>Danger Zone</h2>
              </div>
              <div className={styles.dangerRow}>
                <div>
                  <p className={styles.dangerLabel}>Reset Cash Balance</p>
                  <p className={styles.dangerDesc}>Restores cash to $100,000. Positions and history preserved.</p>
                </div>
                <button className={styles.resetBtn} onClick={() => setShowResetModal(true)}>
                  Reset
                </button>
              </div>
            </div>


          </div>
        </div>

        {/* ── Knowledge Base — full width ── */}
        <div className={`${styles.card} ${styles.kbCard} glass`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🧠</span>
            <h2 className={styles.cardTitle}>Knowledge Base</h2>
            <span className={styles.kbCount}>{docsData?.count ?? 0} docs</span>
          </div>

          {/* Upload form */}
          <div className={`${styles.uploadForm} glass-elevated`}>
            <p className={styles.uploadTitle}>Upload Document</p>

            <div className={styles.uploadRow}>
              {/* Collection toggle */}
              <div className={styles.collectionToggle}>
                {(['trading_strategies', 'financials'] as Collection[]).map(col => (
                  <button
                    key={col}
                    className={`${styles.colBtn} ${uploadCollection === col ? styles.colActive : ''}`}
                    onClick={() => { setUploadCollection(col); setUploadTicker('') }}
                  >
                    {col === 'trading_strategies' ? 'Trading Strategies' : 'Financials'}
                  </button>
                ))}
              </div>

              {/* Ticker — only for financials */}
              {uploadCollection === 'financials' && (
                <input
                  className={`aw-input ${styles.uploadTickerInput}`}
                  placeholder="Ticker (e.g. NVDA)"
                  value={uploadTicker}
                  maxLength={8}
                  onChange={e => setUploadTicker(e.target.value.toUpperCase())}
                />
              )}

              {/* Doc type */}
              <input
                className={`aw-input ${styles.uploadDocTypeInput}`}
                placeholder="Doc type (e.g. 10K, strategy)"
                value={uploadDocType}
                onChange={e => setUploadDocType(e.target.value)}
              />

              {/* File picker */}
              <label className={styles.fileLabel}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className={styles.fileInput}
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
                <span className={`${styles.filePicker} ${uploadFile ? styles.filePickerActive : ''}`}>
                  {uploadFile ? uploadFile.name : '📎 Choose PDF'}
                </span>
              </label>

              {/* Upload button */}
              <button
                className={styles.uploadBtn}
                onClick={handleUpload}
                disabled={uploading || !uploadFile}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>

            {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
            {uploadSuccess && <p className={styles.uploadSuccess}>{uploadSuccess}</p>}
          </div>

          {/* Filter bar */}
          <div className={styles.docFilterBar}>
            <div className={styles.docToggle}>
              {(['all', 'trading_strategies', 'financials'] as const).map(f => (
                <button
                  key={f}
                  className={`${styles.docFilterBtn} ${docCollectionFilter === f ? styles.docFilterActive : ''}`}
                  onClick={() => setDocCollectionFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'trading_strategies' ? 'Strategies' : 'Financials'}
                </button>
              ))}
            </div>
            {docCollectionFilter === 'financials' && (
              <input
                className={`aw-input ${styles.docTickerSearch}`}
                placeholder="Filter by ticker…"
                value={docTickerFilter}
                maxLength={8}
                onChange={e => setDocTickerFilter(e.target.value.toUpperCase())}
              />
            )}
          </div>

          {/* Document list */}
          {docsLoading ? (
            <div className={styles.docsLoading}>
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className={styles.docsEmpty}>
              <span>📭</span>
              <p>No documents found.</p>
            </div>
          ) : (
            <div className={styles.docList}>
              {filteredDocs.map(doc => (
                <div key={doc.id} className={`${styles.docRow} glass-elevated`}>
                  <div className={styles.docMeta}>
                    <span className={`${styles.docCollectionBadge} ${doc.collection === 'financials' ? styles.badgeFinancials : styles.badgeStrategies}`}>
                      {doc.collection === 'financials' ? 'Financials' : 'Strategies'}
                    </span>
                    {doc.ticker && (
                      <span className={styles.docTicker}>{doc.ticker}</span>
                    )}
                  </div>
                  <div className={styles.docInfo}>
                    <span className={styles.docFilename} title={doc.filename}>{doc.filename}</span>
                    <span className={styles.docSub}>
                      {doc.chunks_count} chunks · {doc.document_type} · {fmtDateShort(doc.ingested_at)}
                    </span>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    aria-label={`Delete ${doc.filename}`}
                  >
                    {deletingId === doc.id ? '…' : '✕'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Reset modal ── */}
      {showResetModal && (
        <div className={styles.modalOverlay} onClick={() => !resetting && setShowResetModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Reset Cash Balance?</h3>
            <p className={styles.modalDesc}>
              Your cash will be restored to <strong>$100,000</strong>.
              Open positions and trade history will not be affected.
            </p>
            {resetError && <p className={styles.modalError}>{resetError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowResetModal(false)} disabled={resetting}>
                Cancel
              </button>
              <button className={styles.modalConfirm} onClick={handleReset} disabled={resetting}>
                {resetting ? 'Resetting…' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}