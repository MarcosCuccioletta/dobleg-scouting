import { useMemo, useState } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Area, AreaChart,
} from 'recharts'
import type { GpsEntryRow, GpsMetric } from '@/features/gps/types'

interface GPSTabProps {
  entries: GpsEntryRow[]
  metrics: GpsMetric[]
  playerName: string
}

const GREEN = '#22C55E'

const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

const formatNumber = (val: number, decimals = 0): string => {
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`
  return val.toFixed(decimals)
}

export default function GPSTab({ entries, metrics, playerName }: GPSTabProps) {
  const [viewMode, setViewMode] = useState<'evolution' | 'comparison' | 'summary'>('evolution')

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.match_date.localeCompare(b.match_date)),
    [entries],
  )

  /** Sólo las métricas del catálogo que este jugador tiene cargadas. */
  const available = useMemo(() => {
    const present = new Set<string>()
    for (const e of entries) for (const key of Object.keys(e.metrics ?? {})) present.add(key)
    return metrics.filter(m => present.has(m.key)).sort((a, b) => a.sort_order - b.sort_order)
  }, [entries, metrics])

  const [selectedKeys, setSelectedKeys] = useState<string[] | null>(null)
  const selected = selectedKeys ?? available.slice(0, 3).map(m => m.key)

  const chartData = useMemo(() =>
    sorted.map(e => ({
      date: formatDate(e.match_date),
      fullDate: new Date(`${e.match_date}T00:00:00`).toLocaleDateString('es-AR'),
      rival: e.rival ?? '',
      minutos: e.minutos ?? 0,
      ...e.metrics,
    })),
    [sorted],
  )

  const stats = useMemo(() => {
    const out: Record<string, { avg: number; max: number; min: number; last: number }> = {}
    for (const m of available) {
      const values = sorted.map(e => e.metrics?.[m.key]).filter((v): v is number => typeof v === 'number')
      if (values.length === 0) continue
      out[m.key] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        max: Math.max(...values),
        min: Math.min(...values),
        last: values[values.length - 1],
      }
    }
    return out
  }, [available, sorted])

  const radarData = useMemo(() =>
    available.slice(0, 8).map(m => {
      const s = stats[m.key]
      if (!s) return { metric: m.label, value: 0, fullMark: 100 }
      const range = s.max - s.min
      return {
        metric: m.label,
        value: Math.round(range > 0 ? ((s.last - s.min) / range) * 100 : 50),
        fullMark: 100,
      }
    }),
    [available, stats],
  )

  /** Últimos 5 partidos, cada métrica como % de su máximo: comparable sin trucos de escala. */
  const comparisonData = useMemo(() =>
    sorted.slice(-5).map(e => {
      const row: Record<string, string | number> = { name: `vs ${(e.rival || 'N/A').substring(0, 12)}` }
      for (const key of selected) {
        const max = stats[key]?.max ?? 0
        const value = e.metrics?.[key]
        row[key] = max > 0 && typeof value === 'number' ? Math.round((value / max) * 100) : 0
      }
      return row
    }),
    [sorted, selected, stats],
  )

  const toggleMetric = (key: string) => {
    const next = selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]
    setSelectedKeys(next)
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-8 text-center shadow-apple dark:shadow-apple-dark">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 flex items-center justify-center">
          <svg className="w-8 h-8 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-apple-gray-800 dark:text-white mb-2">Sin datos GPS</h3>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 max-w-sm mx-auto">
          No hay datos físicos de {playerName}. Se cargan desde Inicio → Carga de GPS.
        </p>
      </div>
    )
  }

  const headline = available.slice(0, 3)

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-apple-gray-800 rounded-apple p-4 shadow-apple dark:shadow-apple-dark">
          <div className="text-2xl font-bold text-apple-gray-800 dark:text-white">{entries.length}</div>
          <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mt-1">Partidos</div>
        </div>
        {headline.map(m => (
          <div key={m.key} className="bg-white dark:bg-apple-gray-800 rounded-apple p-4 shadow-apple dark:shadow-apple-dark">
            <div className="text-2xl font-bold text-apple-gray-800 dark:text-white">
              {formatNumber(stats[m.key]?.avg ?? 0, m.decimals)}
              {m.unit && <span className="text-sm font-normal text-apple-gray-400 ml-1">{m.unit}</span>}
            </div>
            <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mt-1">{m.label} prom.</div>
          </div>
        ))}
      </div>

      {/* Vistas */}
      <div className="flex gap-1 bg-apple-gray-100 dark:bg-apple-gray-700/50 p-1 rounded-apple w-full sm:w-fit">
        {([['evolution', 'Evolución'], ['comparison', 'Comparación'], ['summary', 'Resumen']] as const).map(([id, text]) => (
          <button key={id} onClick={() => setViewMode(id)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === id
                ? 'bg-white dark:bg-apple-gray-800 text-apple-gray-800 dark:text-white shadow-apple dark:shadow-apple-dark'
                : 'text-apple-gray-500 dark:text-apple-gray-400'
            }`}>
            {text}
          </button>
        ))}
      </div>

      {/* Selector de métricas */}
      {viewMode !== 'summary' && (
        <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Métricas cargadas</h3>
          <p className="text-xs text-apple-gray-400 mt-0.5 mb-3">Seleccioná cuáles ver.</p>
          <div className="flex flex-wrap gap-2">
            {available.map(m => (
              <button key={m.key} onClick={() => toggleMetric(m.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selected.includes(m.key)
                    ? 'bg-brand-green text-white border-transparent shadow-sm'
                    : 'bg-white dark:bg-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300 border-apple-gray-200 dark:border-apple-gray-600'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Evolución: un gráfico por métrica */}
      {viewMode === 'evolution' && (
        <div className="grid gap-4">
          {selected.length === 0 && (
            <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-8 text-center text-sm text-apple-gray-500">
              Seleccioná al menos una métrica.
            </div>
          )}
          {selected.map(key => {
            const m = available.find(x => x.key === key)
            if (!m) return null
            const s = stats[key]
            return (
              <div key={key} className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-brand-green" />
                    <h4 className="text-sm font-semibold text-apple-gray-800 dark:text-white">{m.label}</h4>
                  </div>
                  {s && (
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-xs text-apple-gray-400">Promedio</div>
                        <div className="text-sm font-semibold text-apple-gray-800 dark:text-white tabular-nums">
                          {formatNumber(s.avg, m.decimals)} {m.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-apple-gray-400">Máximo</div>
                        <div className="text-sm font-semibold text-apple-gray-800 dark:text-white tabular-nums">
                          {formatNumber(s.max, m.decimals)} {m.unit}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`gps-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GREEN} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.3} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#86868B', fontSize: 10 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                      <YAxis tick={{ fill: '#86868B', fontSize: 10 }} axisLine={false} tickLine={false} width={45}
                        tickFormatter={(v: number) => formatNumber(v)} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1D1D1F', border: 'none', borderRadius: '10px', padding: '10px 14px' }}
                        labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4, fontSize: 12 }}
                        itemStyle={{ color: '#fff', fontSize: 12 }}
                        formatter={(value: number) => [`${formatNumber(value, m.decimals)} ${m.unit}`, m.label]}
                        labelFormatter={(labelValue, payload) => {
                          const row = payload?.[0]?.payload
                          return row ? `${row.fullDate}${row.rival ? ` vs ${row.rival}` : ''}` : labelValue
                        }}
                      />
                      <Area type="monotone" dataKey={key} name={m.label} stroke={GREEN} strokeWidth={2}
                        fill={`url(#gps-grad-${key})`} dot={{ fill: GREEN, r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Comparación: últimos 5, normalizado al máximo del jugador */}
      {viewMode === 'comparison' && (
        <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Últimos 5 partidos</h3>
          <p className="text-xs text-apple-gray-400 mt-0.5 mb-4">
            Cada barra es el % del máximo del jugador en esa métrica.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fill: '#86868B', fontSize: 10 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#86868B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1D1D1F', border: 'none', borderRadius: '12px' }}
                  formatter={(value: number, name: string) => [`${value}% del máx.`, available.find(m => m.key === name)?.label ?? name]} />
                <Legend wrapperStyle={{ fontSize: 11 }}
                  formatter={(value: string) => available.find(m => m.key === value)?.label ?? value} />
                {selected.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={['#22C55E', '#16a34a', '#15803d', '#4ade80'][i % 4]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Resumen */}
      {viewMode === 'summary' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
            <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Perfil físico</h3>
            <p className="text-xs text-apple-gray-400 mt-0.5 mb-3">Último partido vs. su propio rango</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" strokeOpacity={0.5} />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#86868B', fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#86868B', fontSize: 9 }} tickCount={4} />
                  <Radar name="Rendimiento" dataKey="value" stroke={GREEN} fill={GREEN} fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
            <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Estadísticas</h3>
            <p className="text-xs text-apple-gray-400 mt-0.5 mb-3">Promedios y máximos</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {available.map(m => {
                const s = stats[m.key]
                if (!s) return null
                return (
                  <div key={m.key} className="flex items-center justify-between py-2.5 border-b border-apple-gray-100 dark:border-apple-gray-700/50 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-brand-green shrink-0" />
                      <span className="text-sm text-apple-gray-700 dark:text-apple-gray-300 truncate">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-apple-gray-800 dark:text-white tabular-nums">{formatNumber(s.avg, m.decimals)}</div>
                        <div className="text-2xs text-apple-gray-400">prom.</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-brand-green tabular-nums">{formatNumber(s.max, m.decimals)}</div>
                        <div className="text-2xs text-apple-gray-400">máx.</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Historial de partidos</h3>
        <p className="text-xs text-apple-gray-400 mt-0.5 mb-4">Datos físicos por encuentro</p>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-apple-gray-500 dark:text-apple-gray-400 border-b border-apple-gray-100 dark:border-apple-gray-700">
                <th className="text-left py-2.5 px-2 font-medium text-xs">Fecha</th>
                <th className="text-left py-2.5 px-2 font-medium text-xs">Rival</th>
                <th className="text-right py-2.5 px-2 font-medium text-xs">Min</th>
                {available.map(m => (
                  <th key={m.key} className="text-right py-2.5 px-2 font-medium text-xs whitespace-nowrap">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map(e => (
                <tr key={e.id} className="border-b border-apple-gray-50 dark:border-apple-gray-700/30">
                  <td className="py-2.5 px-2 text-apple-gray-600 dark:text-apple-gray-400 text-xs whitespace-nowrap">
                    {new Date(`${e.match_date}T00:00:00`).toLocaleDateString('es-AR')}
                  </td>
                  <td className="py-2.5 px-2 text-apple-gray-800 dark:text-white font-medium">{e.rival || '-'}</td>
                  <td className="py-2.5 px-2 text-right text-apple-gray-600 dark:text-apple-gray-400 tabular-nums">
                    {e.minutos !== null ? `${e.minutos}'` : '-'}
                  </td>
                  {available.map(m => {
                    const v = e.metrics?.[m.key]
                    return (
                      <td key={m.key} className="py-2.5 px-2 text-right text-apple-gray-700 dark:text-apple-gray-300 tabular-nums">
                        {typeof v === 'number' ? formatNumber(v, m.decimals) : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
