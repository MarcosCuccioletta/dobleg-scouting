import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { EnrichedMatchRow } from './CoachMatchMetricsEvolution'
import { metricValue } from './CoachMatchMetricsEvolution'
import { useLanguage } from '@/context/LanguageContext'

const OWN_COLOR = '#22C55E'
const RIVAL_COLOR = '#DC2626'

interface Comparison {
  titleKey: string
  ownKey: string
  rivalKey: string | ((row: EnrichedMatchRow) => number | null)
  digits: number
}

const COMPARISONS: Comparison[] = [
  { titleKey: 'coachDetail.vsRivalXg', ownKey: 'xg_for', rivalKey: 'xg_against', digits: 2 },
  {
    titleKey: 'coachDetail.vsRivalPosesion',
    ownKey: 'possession_pct',
    rivalKey: row => (row.stats.possession_pct === null ? null : 100 - row.stats.possession_pct),
    digits: 0,
  },
  { titleKey: 'coachDetail.vsRivalTiros', ownKey: 'tiros_/_a_la_porteria_2', rivalKey: 'tiros_en_contra_/_a_la_porteria_2', digits: 0 },
  {
    titleKey: 'coachDetail.vsRivalDuelos',
    ownKey: 'duelos_/_ganados_3',
    rivalKey: row => {
      const own = metricValue(row, 'duelos_/_ganados_3')
      return own === null ? null : 100 - own
    },
    digits: 0,
  },
  {
    titleKey: 'coachDetail.vsRivalDuelosAereos',
    ownKey: 'duelos_aereos_/_ganados_3',
    rivalKey: row => {
      const own = metricValue(row, 'duelos_aereos_/_ganados_3')
      return own === null ? null : 100 - own
    },
    digits: 0,
  },
]

function rivalValue(row: EnrichedMatchRow, rivalKey: Comparison['rivalKey']): number | null {
  return typeof rivalKey === 'function' ? rivalKey(row) : metricValue(row, rivalKey)
}

function ComparisonChart({ titleKey, ownKey, rivalKey, digits, rows }: Comparison & { rows: EnrichedMatchRow[] }) {
  const { t } = useLanguage()
  const data = rows.map(r => ({
    date: r.date,
    opponent: r.opponent,
    nosotros: metricValue(r, ownKey),
    rival: rivalValue(r, rivalKey),
  }))

  return (
    <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
      <h4 className="text-xs font-semibold text-apple-gray-800 dark:text-white mb-2">{t(titleKey)}</h4>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-apple-gray-200 dark:text-apple-gray-800" strokeDasharray="3 3" />
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
            <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
              formatter={(value: unknown, name: string) => [
                value === null || value === undefined ? '—' : Number(value).toFixed(digits),
                name,
              ] as [string, string]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.opponent ?? ''}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px' }}
              formatter={(value: string) => <span className="text-apple-gray-500 dark:text-apple-gray-400">{value}</span>}
            />
            <Line type="monotone" dataKey="nosotros" name={t('coachDetail.nosotros')} stroke={OWN_COLOR} strokeWidth={2} dot={{ r: 2.5, fill: OWN_COLOR, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="rival" name={t('evaluar.rival')} stroke={RIVAL_COLOR} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2.5, fill: RIVAL_COLOR, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function CoachTeamVsRivalCharts({ rows }: { rows: EnrichedMatchRow[] }) {
  const { t } = useLanguage()
  if (rows.length === 0) return null
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">{t('coachDetail.nosotrosVsRival')}</h3>
        <p className="text-2xs text-apple-gray-400 mt-0.5">{t('coachDetail.vsRivalDescripcion')}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {COMPARISONS.map(c => (
          <ComparisonChart key={c.titleKey} {...c} rows={rows} />
        ))}
      </div>
    </div>
  )
}
