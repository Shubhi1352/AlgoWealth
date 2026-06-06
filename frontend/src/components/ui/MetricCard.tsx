import type { ReactNode } from 'react'
import s from './MetricCard.module.css'


interface MetricCardProps {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
  loading?: boolean
  refreshing?: boolean
}

export default function MetricCard({
  label,
  value,
  sub,
  trend = 'neutral',
  icon,
  loading = false,
  refreshing = false,
}: MetricCardProps) {
  return (
    <div className={`${s.card} ${loading ? s.loading : ''} ${refreshing ? s.refreshing : ''}`}>
      <div className={`${s.card} ${loading ? s.loading : ''}`}>
        <div className={s.top}>
          <span className={s.label}>{label}</span>
          {icon && <span className={s.icon}>{icon}</span>}
        </div>

        {loading ? (
          <>
            <div className={`skeleton ${s.skeletonValue}`} />
            <div className={`skeleton ${s.skeletonSub}`} />
          </>
        ) : (
          <>
            <span className={s.value}>{value}</span>
            {sub && (
              <span
                className={`${s.sub} ${trend === 'up'
                  ? s.up
                  : trend === 'down'
                    ? s.down
                    : s.neutral
                  }`}
              >
                {sub}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}