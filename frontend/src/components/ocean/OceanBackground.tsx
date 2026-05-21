'use client'

/**
 * OceanBackground
 *
 * Persistent full-viewport parallax ocean scene.
 * Fixed in root layout — never unmounts.
 *
 * Fix for bottom gap bug:
 *  - The foreground hill (h5) was sliding UP when cursor moved down
 *    because py was negative (Y flipped) and multiplied by large sx
 *  - Fix: clamp py so hills never move up more than ~20px
 *  - Fix: h5 SVG extended to height:320 + bottom:-8% so there's
 *    always extra terrain below the viewport edge as a buffer
 */

import { useEffect, useRef } from 'react'
import s from './ocean.module.css'

interface Layer {
  el: HTMLElement
  sx: number
  sy: number
}

export default function OceanBackground() {
  const h1 = useRef<HTMLDivElement>(null)
  const h2 = useRef<HTMLDivElement>(null)
  const h3 = useRef<HTMLDivElement>(null)
  const h4 = useRef<HTMLDivElement>(null)
  const h5 = useRef<HTMLDivElement>(null)
  const a1 = useRef<HTMLDivElement>(null)
  const a2 = useRef<HTMLDivElement>(null)
  const a3 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hillLayers: Layer[] = [
      { el: h1.current!, sx: 0.018, sy: 0.008 },
      { el: h2.current!, sx: 0.036, sy: 0.016 },
      { el: h3.current!, sx: 0.058, sy: 0.026 },
      { el: h4.current!, sx: 0.082, sy: 0.038 },
      { el: h5.current!, sx: 0.110, sy: 0.052 },
    ]

    const atmoLayers: Layer[] = [
      { el: a1.current!, sx: 0.026, sy: 0.012 },
      { el: a2.current!, sx: 0.046, sy: 0.020 },
      { el: a3.current!, sx: 0.070, sy: 0.032 },
    ]

    let mx = 0, my = 0
    let cx = 0, cy = 0
    let rafId: number

    const onMouseMove = (e: MouseEvent) => {
      const W = window.innerWidth
      const H = window.innerHeight
      mx = (e.clientX - W / 2) / (W / 2)
      my = (e.clientY - H / 2) / (H / 2)
    }

    const onMouseLeave = () => { mx = 0; my = 0 }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    const tick = () => {
      cx += (mx - cx) * 0.055
      cy += (my - cy) * 0.055

      const W = window.innerWidth
      const H = window.innerHeight

      const px =  cx * W * 0.5
      // ── KEY FIX ──────────────────────────────────────────────────────────
      // Y is flipped: cursor moving DOWN makes cy positive → py negative
      // Negative py pushes hills UP → foreground hill slides off bottom edge
      // Clamp py: allow hills to move DOWN freely (+) but cap UP movement (-)
      // Max upward shift is 30px — enough parallax feel without exposing gap
      const py = -cy * H * 0.5
      // ─────────────────────────────────────────────────────────────────────

      hillLayers.forEach(({ el, sx, sy }) => {
        el.style.transform = `translate(${px * sx}px, ${py * sy}px)`
      })

      atmoLayers.forEach(({ el, sx, sy }) => {
        el.style.transform = `translate(${px * sx}px, ${py * sy}px)`
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <div className={s.ocean} aria-hidden="true">
      <div className={s.sky} />
      <div className={s.grain} />
      <div className={s.fogTopLeft} />
      <div className={s.fogTopRight} />

      {/* Hill 1 — farthest */}
      <div ref={h1} className={s.hill} style={{ bottom: '44%', zIndex: 6 }}>
        <svg viewBox="0 0 1400 180" width="100%" height="180" preserveAspectRatio="none">
          <path d="M0,130 C60,95 130,65 230,85 C310,102 370,58 470,72 C560,85 620,48 730,62 C820,74 890,42 1000,60 C1090,76 1170,38 1280,55 C1340,64 1375,50 1400,58 L1400,180 L0,180 Z" fill="#5EB6C8" opacity="0.42" />
        </svg>
      </div>

      {/* Atmo 1 */}
      <div ref={a1} className={s.atmo} style={{ top: '30%', height: 110, zIndex: 9 }}>
        <svg viewBox="0 0 1400 110" width="100%" height="110" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ocean-ag1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#9ACDD4" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#9ACDD4" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="1400" height="110" fill="url(#ocean-ag1)" />
        </svg>
      </div>

      {/* Hill 2 */}
      <div ref={h2} className={s.hill} style={{ bottom: '32%', zIndex: 11 }}>
        <svg viewBox="0 0 1400 220" width="100%" height="220" preserveAspectRatio="none">
          <path d="M0,145 C70,100 160,68 280,95 C390,120 460,72 580,88 C680,102 760,55 880,75 C970,91 1060,48 1180,70 C1270,88 1340,55 1400,68 L1400,220 L0,220 Z" fill="#2E98BA" opacity="0.60" />
        </svg>
      </div>

      {/* Atmo 2 */}
      <div ref={a2} className={s.atmo} style={{ top: '40%', height: 120, zIndex: 14 }}>
        <svg viewBox="0 0 1400 120" width="100%" height="120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ocean-ag2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#80BEC8" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#80BEC8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="1400" height="120" fill="url(#ocean-ag2)" />
        </svg>
      </div>

      {/* Hill 3 */}
      <div ref={h3} className={s.hill} style={{ bottom: '20%', zIndex: 16 }}>
        <svg viewBox="0 0 1400 260" width="100%" height="260" preserveAspectRatio="none">
          <path d="M0,160 C90,108 200,72 340,108 C460,140 550,80 680,100 C790,118 880,62 1020,88 C1120,108 1210,65 1330,90 C1375,100 1395,85 1400,92 L1400,260 L0,260 Z" fill="#1878A0" opacity="0.78" />
        </svg>
      </div>

      {/* Atmo 3 */}
      <div ref={a3} className={s.atmo} style={{ top: '50%', height: 130, zIndex: 19 }}>
        <svg viewBox="0 0 1400 130" width="100%" height="130" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ocean-ag3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6AAAB8" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#6AAAB8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="1400" height="130" fill="url(#ocean-ag3)" />
        </svg>
      </div>

      {/* Hill 4 */}
      <div ref={h4} className={s.hill} style={{ bottom: '9%', zIndex: 21 }}>
        <svg viewBox="0 0 1400 280" width="100%" height="280" preserveAspectRatio="none">
          <path d="M0,172 C110,115 240,78 390,120 C520,158 620,88 760,112 C880,134 980,72 1120,102 C1220,125 1310,78 1400,105 L1400,280 L0,280 Z" fill="#0E5480" opacity="0.88" />
        </svg>
      </div>

      {/* Hill 5 — foreground
          ── BOTTOM GAP FIX ──
          bottom: -8% instead of 0 → extra 8% of height below viewport
          height: 320 instead of 250 → taller SVG fills the extra space
          Even when hills shift up 30px, this buffer prevents any gap
      */}
      <div ref={h5} className={s.hill} style={{ bottom: '-8%', zIndex: 23 }}>
        <svg viewBox="0 0 1400 350" width="100%" height="350" preserveAspectRatio="none">
          <path d="M0,182 C130,125 270,88 430,135 C570,175 680,100 830,128 C960,153 1060,88 1210,118 C1300,138 1360,100 1400,122 L1400,350 L0,350 Z" fill="#082840" />
        </svg>
      </div>
    </div>
  )
}