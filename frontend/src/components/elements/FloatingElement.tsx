'use client'

/**
 * FloatingElement
 *
 * Exactly mirrors how the boat works on the homepage:
 *  - position: fixed, top/left set via props (CSS)
 *  - JS applies: transform: translate(calc(-50% + Xpx), calc(-50% + Ypx))
 *  - Same DEPTH_X/DEPTH_Y as homepage boat (0.055 / 0.028)
 *  - Inner div handles bob/swim animation independently via CSS
 *  - One instance per page — no duplicate elements
 *
 * Default position: bottom-left (bottom: 14%, left: 8%)
 * Homepage boat: top: 54%, left: 28% (set directly in page.tsx, not via this component)
 */

import { useEffect, useRef, CSSProperties } from 'react'
import s from './elements.module.css'

type AnimVariant = 'bob' | 'slow' | 'swim'

interface FloatingElementProps {
  bottom?: string
  top?:    string
  left?:   string
  right?:  string
  animVariant?: AnimVariant
  children: React.ReactNode
}

const variantClass: Record<AnimVariant, string> = {
  bob:  s.inner,
  slow: s.innerSlow,
  swim: s.innerSwim,
}

// Same depth constants as homepage boat
const DEPTH_X = 0.055
const DEPTH_Y = 0.028

export default function FloatingElement({
  bottom = '14%',
  top,
  left   = '8%',
  right,
  animVariant = 'bob',
  children,
}: FloatingElementProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    let mx = 0, my = 0
    let cx = 0, cy = 0
    let rafId: number

    const onMove = (e: MouseEvent) => {
      mx = (e.clientX - window.innerWidth  / 2) / (window.innerWidth  / 2)
      my = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)
    }

    const onLeave = () => { mx = 0; my = 0 }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)

    const tick = () => {
      cx += (mx - cx) * 0.055
      cy += (my - cy) * 0.055

      const px =  cx * window.innerWidth  * 0.5
      const py = -cy * window.innerHeight * 0.5   // Y flipped — matches ocean

      const tx = px * DEPTH_X
      const ty = py * DEPTH_Y

      // translate(-50%,-50%) centers the element on its anchor point
      // + parallax offset moves it with the scene
      el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  const wrapperStyle: CSSProperties = {
    bottom,
    top,
    left,
    right,
  }

  return (
    <div ref={wrapRef} className={s.wrapper} style={wrapperStyle}>
      <div className={variantClass[animVariant]}>
        {children}
      </div>
    </div>
  )
}