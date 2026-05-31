'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import s from './sidebar.module.css'

// ── Nav items config ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.9"/>
        <rect x="11" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.6"/>
        <rect x="2" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.6"/>
        <rect x="11" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.9"/>
      </svg>
    ),
  },
  {
    href: '/stocks',
    label: 'Stocks',
    title: 'Search Stocks',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
        <line x1="12.5" y1="12.5" x2="17" y2="17"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/watchlists/automated',
    label: 'Automated',
    title: 'Automated',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        {/* Robot face */}
        <rect x="4" y="6" width="12" height="9" rx="3" stroke="currentColor"
          strokeWidth="1.6" fill="none"/>
        <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
        <line x1="10" y1="6" x2="10" y2="4" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="10" cy="3.5" r="1" fill="currentColor"/>
        <line x1="7" y1="14" x2="13" y2="14" stroke="currentColor"
          strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      </svg>
    ),
  },
  {
    href: '/watchlists/a',
    label: 'Watchlists',
    title: 'Watchlists',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon points="10,2 12.4,7.5 18.5,8.2 14,12.5 15.4,18.5 10,15.5 4.6,18.5 6,12.5 1.5,8.2 7.6,7.5"
          stroke="currentColor" strokeWidth="1.6"
          fill="currentColor" opacity="0.85"/>
      </svg>
    ),
  },
  {
    href: '/portfolio',
    label: 'Portfolio',
    title: 'Portfolio',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        {/* Briefcase */}
        <rect x="2" y="7" width="16" height="11" rx="2"
          stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <path d="M7,7 L7,5 Q7,3 10,3 Q13,3 13,5 L13,7"
          stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <line x1="2" y1="12" x2="18" y2="12"
          stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
      </svg>
    ),
  },
  {
    href: '/trades',
    label: 'Trades',
    title: 'Trades',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2,10 L7,5 L7,8 L13,8 L13,5 L18,10 L13,15 L13,12 L7,12 L7,15 Z"
          stroke="currentColor" strokeWidth="1.5" fill="none"
          strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    title: 'Profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <path d="M3,17 Q3,13 10,13 Q17,13 17,17"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
] as const

const EXACT_MATCH_ROUTES = ['/portfolio', '/stocks', 'trades', '/profile', '/dashboard', '/watchlists/automated', '/watchlists/a']

// ── Component ─────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className={s.sidebar}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Item list ── */}
      <div className={s.itemList}>
        {NAV_ITEMS.map((item) => {
          const basePath = '/' + item.href.split('/').slice(1, 3).join('/')
          const isActive = EXACT_MATCH_ROUTES.includes(item.href)
            ? pathname === item.href
            : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(basePath))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${s.item} ${isActive ? s.active : ''}`}
              title={item.title}
            >
              <div className={s.iconWrap} style={{
                color: isActive ? '#7FFFD4' : 'rgba(255,255,255,0.55)'
              }}>
                {item.icon}
              </div>
              <span className={s.label}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}