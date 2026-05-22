'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts'
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent'
import type { Transaction } from '@/lib/api'
import s from './PnLChart.module.css'
import type { PortfolioSnapshot } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────
interface ChartPoint {
  date: string
  value: number
}

interface PnLChartProps {
  snapshots: PortfolioSnapshot[]
  loading?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────
const STARTING_BALANCE = 100_000

function buildChartData(snapshots: PortfolioSnapshot[]): ChartPoint[] {
  const baseline: ChartPoint = {
    date: snapshots.length
      ? (() => {
          const d = new Date(snapshots[0].date)
          d.setDate(d.getDate() - 1)
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        })()
      : (() => {
          const d = new Date()
          d.setDate(d.getDate() - 1)
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        })(),
    value: STARTING_BALANCE,
  }

  if (!snapshots.length) {
    const now = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: STARTING_BALANCE,
      }
    })
  }

  const points = snapshots.map((s) => ({
    date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    value: s.total_value,
  }))

  return [baseline, ...points]
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

// ── Custom tooltip ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const val = (payload[0]?.value as number) ?? 0
  const diff = val - STARTING_BALANCE
  const isUp = diff >= 0
  return (
    <div className={s.tooltip}>
      <span className={s.tooltipDate}>{label}</span>
      <span className={s.tooltipValue}>{fmt(val)}</span>
      <span className={isUp ? s.tooltipUp : s.tooltipDown}>
        {isUp ? '+' : ''}{fmt(diff)}
      </span>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PnLChart({ snapshots, loading = false }: PnLChartProps) {
  const data = buildChartData(snapshots)
  const lastValue = data[data.length - 1]?.value ?? STARTING_BALANCE
  const diff = lastValue - STARTING_BALANCE
  const isUp = diff >= 0

  if (loading) {
    return (
      <div className={s.wrap}>
        <div className={s.header}>
          <div className={`skeleton ${s.skeletonTitle}`} />
          <div className={`skeleton ${s.skeletonSub}`} />
        </div>
        <div className={`skeleton ${s.skeletonChart}`} />
      </div>
    )
  }

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.title}>Portfolio Value</span>
          <span className={s.sub}>All-time performance</span>
        </div>
        <div className={s.headerRight}>
          <span className={s.bigValue}>{fmt(lastValue)}</span>
          <span className={isUp ? s.diffUp : s.diffDown}>
            {isUp ? '+' : ''}{fmt(diff)}
          </span>
        </div>
      </div>

      <div className={s.chartArea}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? '#7FFFD4' : '#FF6B8A'} stopOpacity={0.28} />
                <stop offset="100%" stopColor={isUp ? '#7FFFD4' : '#FF6B8A'} stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[
                (dataMin: number) => Math.floor((dataMin - Math.max(dataMin * 0.002, 500)) / 100) * 100,
                (dataMax: number) => Math.ceil((dataMax + Math.max(dataMax * 0.002, 500)) / 100) * 100,
              ]}
              tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isUp ? '#7FFFD4' : '#FF6B8A'}
              strokeWidth={2}
              fill="url(#pnlGradient)"
              dot={false}
              activeDot={{ r: 4, fill: isUp ? '#7FFFD4' : '#FF6B8A', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}