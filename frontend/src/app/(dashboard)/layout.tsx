import Link from 'next/link'
import Sidebar from '@/components/sidebar/Sidebar'
import MarketStatus from '@/components/MarketStatus'
import s from './layout.module.css'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Logo - top left */}
      <div className={s.homeNav}>
        <Link href="/" className={s.homeLogo}>
          <div className={s.homeLogoMark}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polyline
                points="1,11 4,6 8,9 13,2"
                stroke="white" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className={s.homeLogoName}>AlgoWealth</span>
        </Link>
      </div>

      {/* MarketStatus - bottom right */}
      <div className="fixed bottom-6 right-6 z-50">
        <MarketStatus />
      </div>

      <Sidebar />
      {children}
    </>
  )
}
