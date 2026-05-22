'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import OceanBackground from '@/components/ocean/OceanBackground'
import FloatingElement from '@/components/elements/FloatingElement'
import { Boat } from '@/components/elements/shapes'
import s from './page.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParallaxLayer {
  el: HTMLElement
  sx: number   // horizontal depth multiplier
  sy: number   // vertical depth multiplier
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  // Refs for elements that move in the parallax loop
  const ghostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Ghost text parallax — matches OceanBackground depth
    const DEPTH_X = 0.055
    const DEPTH_Y = 0.028

    let mx = 0, my = 0
    let cx = 0, cy = 0
    let rafId: number

    const onMouseMove = (e: MouseEvent) => {
      mx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2)
      my = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)
    }

    const onMouseLeave = () => { mx = 0; my = 0 }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    const tick = () => {
      cx += (mx - cx) * 0.055
      cy += (my - cy) * 0.055

      const px = cx * window.innerWidth * 0.5
      const py = -cy * window.innerHeight * 0.5

      const tw = px * DEPTH_X
      const th = py * DEPTH_Y

      if (ghostRef.current) {
        ghostRef.current.style.transform =
          `translate(calc(-50% + ${tw}px), calc(-50% + ${th}px))`
      }

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
    <>
      {/* ── Ocean Background ──────────────────────────────────────────────── */}
      <OceanBackground />

      {/* ── Page Content Container ─────────────────────────────────────────── */}
      <div className={s.pageContent}>
        {/* ── Ghost Text ──────────────────────────────────────────────────── */}
        <div ref={ghostRef} className={s.ghostText}>
          <span className={s.ghostLine}>algo</span>
          <span className={s.ghostLine}>wealth</span>
        </div>

        {/* ── Boat ────────────────────────────────────────────────────────── */}
        <FloatingElement top="54%" left="28%" animVariant="bob">
          <Boat />
        </FloatingElement>

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <nav className={s.homeNav}>
          <div className={s.homeLogo}>
            <div className={s.homeLogoMark}>
              {/* Trending line icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <polyline
                  points="1,11 4,6 8,9 13,2"
                  stroke="white" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className={s.homeLogoName}>AlgoWealth</span>
          </div>

          <div className={s.homeNavRight}>
            <Link href="/login" className={s.homeBtnGhost}>Sign in</Link>
            <Link href="/register" className={s.homeBtnSolid}>Get started</Link>
          </div>
        </nav>

        {/* ── Bottom Bar ──────────────────────────────────────────────────── */}
        <div className={s.homeBottomBar}>
          <p className={s.homeTagline}>
            Autonomous multi-agent AI<br />
            for intelligent paper trading
          </p>

          <div className={s.homeActions}>
            {/* Live market indicator */}
            <div className={s.homeLivePill}>
              <div className={s.liveDot} />
              <span className={s.homeLiveLabel}>Markets live</span>
            </div>

            <Link href="/register" className={s.homeCtaBtn}>
              Start trading free →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
