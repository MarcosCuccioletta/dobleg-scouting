import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot
} from 'recharts'
import type { MarketValueHistoryEntry } from '@/types'

interface MarketValueChartProps {
  data: MarketValueHistoryEntry[]
  playerName: string
}

function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`
  }
  return `${value}`
}

function formatFullValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `€${millions.toFixed(millions >= 10 ? 0 : 1)} millones`
  }
  if (value >= 1_000) {
    return `€${Math.round(value / 1_000).toLocaleString('es-AR')} mil`
  }
  return `€${value.toLocaleString('es-AR')}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    month: 'short',
    year: '2-digit'
  })
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

interface ChartDataPoint {
  date: number
  dateLabel: string
  valor: number
  equipo: string
  edad: number
}

interface TooltipPayloadItem {
  payload: ChartDataPoint
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  const date = new Date(data.date)

  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-xl shadow-lg border border-apple-gray-200 dark:border-apple-gray-700 p-4 min-w-[200px]">
      <p className="text-xs text-apple-gray-400 mb-1">{formatFullDate(date)}</p>
      <p className="text-lg font-bold text-apple-gray-800 dark:text-white">
        {formatFullValue(data.valor)}
      </p>
      <div className="mt-2 pt-2 border-t border-apple-gray-100 dark:border-apple-gray-700">
        <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400">
          <span className="font-medium">{data.equipo}</span>
        </p>
        <p className="text-xs text-apple-gray-400">
          {data.edad} años
        </p>
      </div>
    </div>
  )
}

export default function MarketValueChart({ data, playerName }: MarketValueChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return data.map(entry => ({
      date: entry.fecha.getTime(),
      dateLabel: formatDate(entry.fecha),
      valor: entry.valor,
      equipo: entry.equipo,
      edad: entry.edad,
    }))
  }, [data])

  const stats = useMemo(() => {
    if (data.length === 0) return null

    const values = data.map(d => d.valor)
    const current = data[data.length - 1]
    const peak = Math.max(...values)
    const peakEntry = data.find(d => d.valor === peak)!
    const initial = data[0]

    // Calculate trend (last 3 entries)
    const lastThree = data.slice(-3)
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (lastThree.length >= 2) {
      const change = lastThree[lastThree.length - 1].valor - lastThree[0].valor
      const pctChange = (change / lastThree[0].valor) * 100
      if (pctChange > 10) trend = 'up'
      else if (pctChange < -10) trend = 'down'
    }

    // Calculate total growth
    const totalGrowth = ((current.valor - initial.valor) / initial.valor) * 100

    // Calculate years tracked
    const yearsTracked = (current.fecha.getTime() - initial.fecha.getTime()) / (1000 * 60 * 60 * 24 * 365)

    return {
      current,
      peak,
      peakEntry,
      initial,
      trend,
      totalGrowth,
      yearsTracked,
      numEntries: data.length,
    }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-apple-gray-500 dark:text-apple-gray-400">
        <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <p className="text-sm font-medium">Sin datos de evolución</p>
        <p className="text-xs mt-1">No hay historial de valor de mercado para {playerName}</p>
      </div>
    )
  }

  if (!stats) return null

  const trendConfig = {
    up: { icon: '↑', label: 'En alza', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    down: { icon: '↓', label: 'En baja', color: 'text-red-500', bg: 'bg-red-500/10' },
    stable: { icon: '→', label: 'Estable', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  }

  const currentTrend = trendConfig[stats.trend]

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Current value */}
        <div className="bg-gradient-to-br from-brand-green/10 to-emerald-500/5 dark:from-brand-green/20 dark:to-emerald-500/10 rounded-xl p-4 border border-brand-green/20">
          <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mb-1">Valor actual</p>
          <p className="text-xl font-bold text-brand-green">
            €{formatValue(stats.current.valor)}
          </p>
          <p className="text-2xs text-apple-gray-400 mt-1">{stats.current.equipo}</p>
        </div>

        {/* Peak value */}
        <div className="bg-apple-gray-50 dark:bg-apple-gray-800/50 rounded-xl p-4 border border-apple-gray-200 dark:border-apple-gray-700">
          <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mb-1">Valor máximo</p>
          <p className="text-xl font-bold text-apple-gray-800 dark:text-white">
            €{formatValue(stats.peak)}
          </p>
          <p className="text-2xs text-apple-gray-400 mt-1">
            {formatDate(stats.peakEntry.fecha)} · {stats.peakEntry.equipo}
          </p>
        </div>

        {/* Trend */}
        <div className={`${currentTrend.bg} rounded-xl p-4 border border-transparent`}>
          <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mb-1">Tendencia</p>
          <p className={`text-xl font-bold ${currentTrend.color}`}>
            {currentTrend.icon} {currentTrend.label}
          </p>
          <p className="text-2xs text-apple-gray-400 mt-1">
            Últimas valuaciones
          </p>
        </div>

        {/* Growth */}
        <div className="bg-apple-gray-50 dark:bg-apple-gray-800/50 rounded-xl p-4 border border-apple-gray-200 dark:border-apple-gray-700">
          <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mb-1">Crecimiento total</p>
          <p className={`text-xl font-bold ${stats.totalGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {stats.totalGrowth >= 0 ? '+' : ''}{stats.totalGrowth.toFixed(0)}%
          </p>
          <p className="text-2xs text-apple-gray-400 mt-1">
            En {stats.yearsTracked.toFixed(1)} años
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-apple-gray-50/50 dark:bg-apple-gray-800/30 rounded-xl p-4 border border-apple-gray-200/50 dark:border-apple-gray-700/50">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-apple-gray-200 dark:text-apple-gray-700"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(val) => formatDate(new Date(val))}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-apple-gray-500"
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                tickFormatter={(val) => `€${formatValue(val)}`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-apple-gray-500"
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Peak line */}
              <ReferenceLine
                y={stats.peak}
                stroke="#94A3B8"
                strokeDasharray="5 5"
                strokeWidth={1}
              />
              {/* Current value dot */}
              <ReferenceDot
                x={chartData[chartData.length - 1].date}
                y={chartData[chartData.length - 1].valor}
                r={6}
                fill="#22C55E"
                stroke="white"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="#22C55E"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorValor)"
                dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#22C55E', stroke: 'white', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Timeline legend */}
      <div className="flex items-center justify-between text-xs text-apple-gray-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand-green" />
          <span>Primera valuación: €{formatValue(stats.initial.valor)} ({stats.initial.edad} años)</span>
        </div>
        <div>
          {stats.numEntries} valuaciones registradas
        </div>
      </div>

      {/* Team history */}
      <div>
        <h4 className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider mb-3">
          Historial de equipos
        </h4>
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set(data.map(d => d.equipo))).map((equipo, idx) => {
            const entries = data.filter(d => d.equipo === equipo)
            const lastEntry = entries[entries.length - 1]
            const isCurrentTeam = equipo === stats.current.equipo

            return (
              <div
                key={equipo}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                  isCurrentTeam
                    ? 'bg-brand-green/10 text-brand-green border border-brand-green/20'
                    : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-600 dark:text-apple-gray-300'
                }`}
              >
                <span className="font-medium">{equipo}</span>
                {isCurrentTeam && (
                  <span className="text-2xs px-1 py-0.5 bg-brand-green/20 rounded">Actual</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
