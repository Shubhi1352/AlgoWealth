'use client'

import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
  type TooltipProps,
} from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { useState, useMemo } from 'react'
import type { PortfolioSnapshot } from '@/lib/api'
import s from './PortfolioChart.module.css'

const STARTING_BALANCE = 100_000

type Preset = '1W' | '1M' | '3M' | 'All'
const PRESETS: Preset[] = ['1W', '1M', '3M', 'All']
const PRESET_DAYS: Record<Preset, number> = {
  '1W': 7, '1M': 30, '3M': 90, 'All': 99999,
}

interface ChartPoint { date: string; value: number; raw: Date }

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function fmtInput(d: Date) {
  return d.toISOString().slice(0, 10)   // yyyy-mm-dd for <input type="date">
}

function buildPoints(snapshots: PortfolioSnapshot[]): ChartPoint[] {
  if (!snapshots.length) return []
  return snapshots.map(snap => {
    const raw = new Date(snap.date + 'T00:00:00')
    return {
      raw,
      date:  raw.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: snap.total_value,
    }
  })
}

function CustomTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const val  = (payload[0]?.value as number) ?? 0
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

interface PortfolioChartProps {
  snapshots: PortfolioSnapshot[]
  loading?:  boolean
}

export default function PortfolioChart({ snapshots, loading = false }: PortfolioChartProps) {
  const [preset,    setPreset]    = useState<Preset>('1M')
  const [lastPreset, setLastPreset] = useState<Preset>('1M')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const isCustomActive = !!(customFrom || customTo)

  // ── Filter snapshots based on active filter ───────────────────────────────
  const allPoints = useMemo(() => buildPoints(snapshots), [snapshots])

  const filtered = useMemo(() => {
    if (!allPoints.length) return []

    if (isCustomActive) {
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : null
      const to   = customTo   ? new Date(customTo   + 'T23:59:59') : null
      return allPoints.filter(p =>
        (!from || p.raw >= from) && (!to || p.raw <= to)
      )
    }

    const days  = PRESET_DAYS[preset]
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return allPoints.filter(p => p.raw >= cutoff)
  }, [allPoints, preset, isCustomActive, customFrom, customTo])

  // Prepend baseline point
  const data = useMemo(() => {
    if (!filtered.length) return [{ date: 'Start', value: STARTING_BALANCE }]
    const first = filtered[0].raw
    const baseline = new Date(first)
    baseline.setDate(baseline.getDate() - 1)
    return [
      {
        date:  baseline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: STARTING_BALANCE,
      },
      ...filtered,
    ]
  }, [filtered])

  const lastValue = data[data.length - 1]?.value ?? STARTING_BALANCE
  const firstValue = data[0]?.value ?? STARTING_BALANCE
  const diff = lastValue - firstValue
  const isUp = diff >= 0

  function handlePreset(p: Preset) {
    setPreset(p)
    setLastPreset(p)
    setCustomFrom('')
    setCustomTo('')
  }

  function handleClear() {
    setCustomFrom('')
    setCustomTo('')
    setPreset(lastPreset)
  }

  if (loading) {
    return (
      <div className={s.wrap}>
        <div className={s.skeletonHeader} />
        <div className={s.skeletonChart} />
      </div>
    )
  }

  return (
    <div className={s.wrap}>
      {/* ── Header ── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.title}>Portfolio Value</span>
          <div className={s.valueLine}>
            <span className={s.bigValue}>{fmt(lastValue)}</span>
            <span className={isUp ? s.diffUp : s.diffDown}>
              {isUp ? '+' : ''}{fmt(diff)}
            </span>
            {isCustomActive && (
              <span className={s.rangeNote}>in selected range</span>
            )}
          </div>
        </div>

        {/* ── Filter controls ── */}
        <div className={s.controls}>
          {/* Preset tabs */}
          <div className={s.presets}>
            {PRESETS.map(p => (
              <button
                key={p}
                className={`${s.presetBtn} ${!isCustomActive && preset === p ? s.presetActive : ''}`}
                onClick={() => handlePreset(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          <div className={s.dateInputs}>
            <input
              type="date"
              className={s.dateInput}
              value={customFrom}
              max={customTo || fmtInput(new Date())}
              onChange={e => setCustomFrom(e.target.value)}
              aria-label="From date"
            />
            <span className={s.dateSep}>→</span>
            <input
              type="date"
              className={s.dateInput}
              value={customTo}
              min={customFrom || undefined}
              max={fmtInput(new Date())}
              onChange={e => setCustomTo(e.target.value)}
              aria-label="To date"
            />
            {isCustomActive && (
              <button className={s.clearBtn} onClick={handleClear} title="Clear custom filter">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      {data.length < 2 ? (
        <div className={s.noData}>No snapshot data for this range</div>
      ) : (
        <div className={s.chartArea} style={{height: 260, minHeight: 260, overflow: 'hidden' }}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={isUp ? '#7FFFD4' : '#FF6B8A'} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={isUp ? '#7FFFD4' : '#FF6B8A'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[
                  (min: number) => Math.floor((min - Math.max(min * 0.002, 500)) / 100) * 100,
                  (max: number) => Math.ceil((max  + Math.max(max  * 0.002, 500)) / 100) * 100,
                ]}
                tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                width={42}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isUp ? '#7FFFD4' : '#FF6B8A'}
                strokeWidth={2}
                fill="url(#portfolioGradient)"
                dot={false}
                activeDot={{ r: 4, fill: isUp ? '#7FFFD4' : '#FF6B8A', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}