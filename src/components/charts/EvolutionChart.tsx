import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import type { EvolutionEntry } from '@/types'

interface EvolutionChartProps {
  evolution: EvolutionEntry[]
  playerSK: string
}

const EXCLUDED_COLS = new Set([
  'JugadorNombre', 'JugadorSK', 'PosicionSK', 'PosicionGeneral', 'PosicionGeneralSK',
  'CompeticionSK', 'PartidoSK', 'Date', 'Partido', 'Competition', 'Posicion_Principal',
  'imagen',
])

const METRIC_LABELS: Record<string, string> = {
  'Minutos_jugados': 'Minutos jugados',
  'Goles': 'Goles',
  'Asistencias': 'Asistencias',
  'xG': 'xG',
  'xA': 'xA',
  'Pases': 'Pases totales',
  'Pases_logrados': 'Pases acertados',
  'Duelos': 'Duelos',
  'Duelos_ganados': 'Duelos ganados',
  'Duelos_aereos': 'Duelos aéreos',
  'Duelos_aereos_ganados': 'Duelos aéreos ganados',
  'Interceptaciones': 'Interceptaciones',
  'Tiros': 'Tiros',
  'Tiros_logrados': 'Tiros a puerta',
  'Regates': 'Regates intentados',
  'Regates_logrados': 'Regates exitosos',
  'Duelos_ofensivos': 'Duelos ofensivos',
  'Duelos_ofensivos_ganados': 'Duelos ofensivos ganados',
  'Duelos_defensivos': 'Duelos defensivos',
  'Duelos_defensivos_ganados': 'Duelos defensivos ganados',
  'Toques_area_penalti': 'Toques área penal',
  'Carreras_profundidad': 'Carreras profundidad',
  'Faltas_recibidas': 'Faltas recibidas',
  'Centros': 'Centros',
  'Centros_precisos': 'Centros precisos',
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo' },
  { value: '12', label: '1 año' },
  { value: '6', label: '6 meses' },
  { value: '3', label: '3 meses' },
  { value: '1', label: '1 mes' },
]

const CHART_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444']

interface SingleChartProps {
  playerData: EvolutionEntry[]
  metric: string
  color: string
  onRemove?: () => void
  availableMetrics: string[]
  onMetricChange: (m: string) => void
}

function SingleChart({ playerData, metric, color, onRemove, availableMetrics, onMetricChange }: SingleChartProps) {
  const chartData = useMemo(() => {
    return playerData.map(entry => ({
      date: entry.Date,
      partido: entry.Partido,
      value: parseFloat(String(entry[metric] ?? '').replace(',', '.')) || 0,
    }))
  }, [playerData, metric])

  const avgValue = useMemo(() => {
    if (chartData.length === 0) return 0
    return chartData.reduce((s, d) => s + d.value, 0) / chartData.length
  }, [chartData])

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <select
          value={metric}
          onChange={e => onMetricChange(e.target.value)}
          className="px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none dark:text-white"
        >
          {availableMetrics.map(m => (
            <option key={m} value={m}>{METRIC_LABELS[m] ?? m}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Prom: {avgValue.toFixed(2)}</span>
          {onRemove && (
            <button onClick={onRemove} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 25, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#6B7280' }}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            height={40}
            tickFormatter={v => v.slice(5)}
          />
          <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
            formatter={(value: number) => [value.toFixed(2), METRIC_LABELS[metric] ?? metric]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.partido ?? ''}
          />
          <ReferenceLine y={avgValue} stroke={color} strokeDasharray="5 3" strokeOpacity={0.5} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 2 }} activeDot={{ r: 4, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function EvolutionChart({ evolution, playerSK }: EvolutionChartProps) {
  const [period, setPeriod] = useState('all')
  const [charts, setCharts] = useState<string[]>(['Goles'])

  const allPlayerData = useMemo(() => {
    return evolution
      .filter(e => String(e.JugadorSK) === String(playerSK))
      .sort((a, b) => a.Date.localeCompare(b.Date))
  }, [evolution, playerSK])

  const playerData = useMemo(() => {
    if (period === 'all') return allPlayerData
    const months = parseInt(period)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return allPlayerData.filter(e => new Date(e.Date) >= cutoff)
  }, [allPlayerData, period])

  const availableMetrics = useMemo(() => {
    if (allPlayerData.length === 0) return []
    const firstRow = allPlayerData[0]
    return Object.keys(firstRow)
      .filter(k => !EXCLUDED_COLS.has(k) && firstRow[k] !== undefined)
      .filter(k => !isNaN(parseFloat(firstRow[k])))
  }, [allPlayerData])

  // Initialize with Goles if available
  useMemo(() => {
    if (charts[0] === 'Goles' && !availableMetrics.includes('Goles') && availableMetrics.length > 0) {
      setCharts([availableMetrics[0]])
    }
  }, [availableMetrics])

  const addChart = () => {
    if (charts.length < 4) {
      const unused = availableMetrics.find(m => !charts.includes(m))
      if (unused) setCharts([...charts, unused])
    }
  }

  const removeChart = (idx: number) => {
    if (charts.length > 1) setCharts(charts.filter((_, i) => i !== idx))
  }

  const updateChart = (idx: number, metric: string) => {
    setCharts(charts.map((c, i) => i === idx ? metric : c))
  }

  if (allPlayerData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No hay datos de evolución disponibles para este jugador.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Período:</span>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  period === opt.value
                    ? 'bg-brand-green text-black font-medium'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{playerData.length} partidos</span>
          {charts.length < 4 && (
            <button
              onClick={addChart}
              className="px-3 py-1 text-xs text-brand-green border border-brand-green rounded-lg hover:bg-brand-green/10"
            >
              + Agregar gráfico
            </button>
          )}
        </div>
      </div>

      {/* Charts grid */}
      <div className={`grid gap-4 ${charts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {charts.map((metric, idx) => (
          <SingleChart
            key={idx}
            playerData={playerData}
            metric={metric}
            color={CHART_COLORS[idx]}
            availableMetrics={availableMetrics}
            onMetricChange={(m) => updateChart(idx, m)}
            onRemove={charts.length > 1 ? () => removeChart(idx) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
