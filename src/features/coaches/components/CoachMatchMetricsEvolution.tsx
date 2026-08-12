import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { CoachMatchTeamStats } from '@/services/coachService'
import type { AgencyFixture } from '@/types/footballApi'
import { formatWyscoutMetricLabel, groupWyscoutMetricKeys } from '@/features/coaches/wyscoutTeamStats/metricLabels'

export interface EnrichedMatchRow {
  fixtureId: number
  date: string
  opponent: string
  isHome: boolean
  scoreLabel: string | null
  stats: CoachMatchTeamStats
}

/** Cruza los partidos con datos de Wyscout cargados contra el fixture real (fecha,
 *  rival, resultado), ordenados cronologicamente. Se reusa tanto para el grafico
 *  de evolucion como para la tabla de historial. */
export function buildEnrichedMatchRows(fixtures: AgencyFixture[], statsRows: CoachMatchTeamStats[]): EnrichedMatchRow[] {
  const fixtureById = new Map(fixtures.map(f => [f.fixtureId, f]))
  const rows: EnrichedMatchRow[] = []
  for (const stats of statsRows) {
    const fixture = fixtureById.get(stats.fixture_id)
    if (!fixture) continue
    const opponent = fixture.isHome ? fixture.awayTeam.name : fixture.homeTeam.name
    const scoreLabel = fixture.goalsHome !== null && fixture.goalsAway !== null
      ? `${fixture.goalsHome}-${fixture.goalsAway}`
      : null
    rows.push({
      fixtureId: fixture.fixtureId,
      date: fixture.date,
      opponent,
      isHome: fixture.isHome,
      scoreLabel,
      stats,
    })
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/** Valor numerico de una metrica para un partido: nivel superior (posesion/xG) o
 *  dentro de raw_metrics. */
function metricValue(row: EnrichedMatchRow, key: string): number | null {
  if (key === 'possession_pct') return row.stats.possession_pct
  if (key === 'xg_for') return row.stats.xg_for
  if (key === 'xg_against') return row.stats.xg_against
  const raw = row.stats.raw_metrics[key]
  return typeof raw === 'number' ? raw : null
}

const DEFAULT_METRICS = ['possession_pct', 'xg_for', 'xg_against', 'tiros_/_a_la_porteria_2']

function SingleMetricChart({
  rows,
  metricKey,
  onMetricChange,
  onRemove,
  metricGroups,
}: {
  rows: EnrichedMatchRow[]
  metricKey: string
  onMetricChange: (key: string) => void
  onRemove?: () => void
  metricGroups: { category: string; options: { key: string; label: string }[] }[]
}) {
  const { chartData, avg } = useMemo(() => {
    const data = rows.map(r => ({
      date: r.date,
      opponent: r.opponent,
      value: metricValue(r, metricKey),
    }))
    const values = data.map(d => d.value).filter((v): v is number => v !== null)
    const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
    return { chartData: data, avg: avgValue }
  }, [rows, metricKey])

  return (
    <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <select
          value={metricKey}
          onChange={e => onMetricChange(e.target.value)}
          className="min-h-[32px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-2 text-xs font-medium text-apple-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/40"
        >
          {metricGroups.map(group => (
            <optgroup key={group.category} label={group.category}>
              {group.options.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex items-center gap-3">
          {avg !== null && (
            <span className="text-2xs text-apple-gray-400 flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-brand-green" />
              Prom: <span className="font-semibold text-apple-gray-700 dark:text-apple-gray-300">{avg.toFixed(1)}</span>
            </span>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-apple-gray-400 hover:text-red-500 transition-colors text-lg leading-none">
              &times;
            </button>
          )}
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => {
                const d = new Date(v)
                return `${d.getDate()}/${d.getMonth() + 1}`
              }}
            />
            <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={30} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
              formatter={(value: unknown) => [
                value === null || value === undefined ? '—' : Number(value).toFixed(2),
                formatWyscoutMetricLabel(metricKey),
              ] as [string, string]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.opponent ?? ''}
            />
            {avg !== null && <ReferenceLine y={avg} stroke="#22C55E" strokeDasharray="4 4" strokeOpacity={0.4} />}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#22C55E"
              strokeWidth={2}
              dot={{ fill: '#22C55E', r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: '#22C55E' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function CoachMatchMetricsEvolution({ rows }: { rows: EnrichedMatchRow[] }) {
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_METRICS)

  const metricGroups = useMemo(() => {
    if (rows.length === 0) return []
    const allKeys = new Set<string>(['possession_pct', 'xg_for', 'xg_against'])
    for (const key of Object.keys(rows[0].stats.raw_metrics)) allKeys.add(key)
    return groupWyscoutMetricKeys([...allKeys])
  }, [rows])

  const allKeysFlat = useMemo(() => metricGroups.flatMap(g => g.options.map(o => o.key)), [metricGroups])

  if (rows.length === 0) return null

  const addChart = () => {
    if (metrics.length >= 8) return
    const unused = allKeysFlat.find(k => !metrics.includes(k))
    if (unused) setMetrics([...metrics, unused])
  }

  const removeChart = (idx: number) => {
    if (metrics.length > 1) setMetrics(metrics.filter((_, i) => i !== idx))
  }

  const updateChart = (idx: number, key: string) => {
    setMetrics(metrics.map((m, i) => (i === idx ? key : m)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Evolución de métricas</h3>
        {metrics.length < 8 && (
          <button
            type="button"
            onClick={addChart}
            className="text-2xs font-semibold text-brand-green hover:underline"
          >
            + Agregar métrica ({metrics.length}/8)
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {metrics.map((metricKey, idx) => (
          <SingleMetricChart
            key={`${metricKey}-${idx}`}
            rows={rows}
            metricKey={metricKey}
            metricGroups={metricGroups}
            onMetricChange={key => updateChart(idx, key)}
            onRemove={metrics.length > 1 ? () => removeChart(idx) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
