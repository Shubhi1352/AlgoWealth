'use client'

import { useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MarketState {
  isOpen: boolean
  label: string          // "Markets live" | "Markets closed"
  nextEvent?: string     // "Opens in 2h 14m"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Client-side fallback: check NYSE hours (9:30–16:00 ET, Mon–Fri).
 * Not holiday-aware — that's handled server-side.
 */
function clientSideMarketCheck(): MarketState {
  const now = new Date()
  // Convert to ET (UTC-5 standard, UTC-4 daylight — approximate with offset)
  const etOffset = -5  // approximate, server handles DST properly
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60
  const etHours  = ((utcHours + etOffset) + 24) % 24
  const day      = now.getUTCDay()  // 0=Sun, 6=Sat

  const isWeekday    = day >= 1 && day <= 5
  const isDuringHours = etHours >= 9.5 && etHours < 16

  const isOpen = isWeekday && isDuringHours

  return {
    isOpen,
    label: isOpen ? 'Markets live' : 'Markets closed',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface MarketStatusProps {
  /** If true, renders inline (for homepage bottom bar). Default: fixed position */
  inline?: boolean
}

export default function MarketStatus({ inline = false }: MarketStatusProps) {
  const [market, setMarket] = useState<MarketState>({
    isOpen: false,
    label: 'Checking...',
  })
  const [mounted, setMounted] = useState(false)

  const fetchStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      const res    = await fetch(`${apiUrl}/api/v1/stocks/market/status`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('API unreachable')

      const data = await res.json()
      setMarket({
        isOpen: data.is_open,
        label:  data.is_open ? 'Markets live' : 'Markets closed',
        nextEvent: data.next_open_str,
      })
    } catch {
      // Fallback to client-side time check
      setMarket(clientSideMarketCheck())
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchStatus()

    // Poll every 60 seconds — market status rarely changes within a minute
    const interval = setInterval(fetchStatus, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Avoid hydration mismatch — don't render until mounted
  if (!mounted) return null

  const pill = (
    <div style={{
      display:        'inline-flex',
      alignItems:     'center',
      gap:            '6px',
      background:     'rgba(8, 28, 50, 0.42)',
      border:         `1px solid ${market.isOpen ? 'rgba(127,255,212,0.28)' : 'rgba(255,107,138,0.28)'}`,
      borderRadius:   '9999px',
      padding:        '5px 14px',
      backdropFilter: 'blur(12px)',
      cursor:         'default',
      userSelect:     'none',
    }}>
      {/* Pulsing dot */}
      <span style={{
        width:        '6px',
        height:       '6px',
        borderRadius: '50%',
        background:   market.isOpen ? '#7FFFD4' : '#FF6B8A',
        flexShrink:   0,
        animation:    'market-blink 2s ease-in-out infinite',
      }} />

      {/* Label */}
      <span style={{
        fontSize:      '10px',
        fontWeight:    600,
        color:         market.isOpen ? '#7FFFD4' : '#FF6B8A',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        whiteSpace:    'nowrap',
      }}>
        {market.label}
      </span>

      {/* Next open time — only shown when closed */}
      {!market.isOpen && market.nextEvent && (
        <span style={{
          fontSize:   '9px',
          color:      'rgba(255,255,255,0.35)',
          marginLeft: '2px',
        }}>
          · {market.nextEvent}
        </span>
      )}

      {/* Keyframe injected inline — tiny, no external CSS needed */}
      <style>{`
        @keyframes market-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )

  // Inline mode: just return the pill (homepage uses it in its own bottom bar)
  if (inline) return pill

  // Fixed mode: bottom-right corner of every dashboard page
  return (
    <div style={{
      position: 'fixed',
      bottom:   '24px',
      right:    '28px',
      zIndex:   80,
    }}>
      {pill}
    </div>
  )
}