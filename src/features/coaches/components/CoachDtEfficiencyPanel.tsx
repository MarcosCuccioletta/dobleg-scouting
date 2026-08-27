import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { EnrichedMatchRow } from './CoachMatchMetricsEvolution'
import type { SeasonStats } from '../seasonStats'
import { computeHomeAwaySplit, buildCumulativePoints } from '../dtEfficiency'
import { useLanguage } from '@/context/LanguageContext'

function fmtPct(v: number | null): string {
  return v === null ? '–' : `${v.toFixed(0)}%`
}

function EfficiencyHero({ stats }: { stats: SeasonStats }) {
  const { t } = useLanguage()
  const pointsPct = stats.possiblePoints > 0 ? (stats.points / stats.possiblePoints) * 100 : null
  const winPct = stats.played > 0 ? (stats.won / stats.played) * 100 : null
  const ppg = stats.played > 0 ? stats.points / stats.played : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
        <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-1">{t('coachDetail.eficaciaPuntos')}</p>
        <p className="text-2xl font-bold text-brand-green">{fmtPct(pointsPct)}</p>
        <p className="text-2xs text-apple-gray-400 mt-0.5">{t('coachDetail.puntosDePosibles').replace('{points}', String(stats.points)).replace('{possible}', String(stats.possiblePoints))}</p>
        <div className="w-full h-1.5 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 mt-2 overflow-hidden">
          <div className="h-full bg-brand-green rounded-full" style={{ width: `${pointsPct ?? 0}%` }} />
        </div>
      </div>
      <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
        <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-1">{t('coachDetail.pctVictorias')}</p>
        <p className="text-2xl font-bold text-apple-gray-800 dark:text-white">{fmtPct(winPct)}</p>
        <p className="text-2xs text-apple-gray-400 mt-0.5">{t('coachDetail.deDePartidos').replace('{won}', String(stats.won)).replace('{played}', String(stats.played))}</p>
        {stats.played > 0 && (
          <div className="flex w-full h-1.5 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-brand-green" style={{ width: `${(stats.won / stats.played) * 100}%` }} />
            <div className="h-full bg-apple-gray-400" style={{ width: `${(stats.drawn / stats.played) * 100}%` }} />
            <div className="h-full bg-brand-red" style={{ width: `${(stats.lost / stats.played) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4 col-span-2 sm:col-span-1">
        <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-1">{t('coachDetail.puntosPorPartido')}</p>
        <p className="text-2xl font-bold text-apple-gray-800 dark:text-white">{ppg === null ? '–' : ppg.toFixed(2)}</p>
        <p className="text-2xs text-apple-gray-400 mt-0.5">{t('coachDetail.promedioSobrePJ').replace('{count}', String(stats.played))}</p>
      </div>
    </div>
  )
}

function SplitBar({ label, home, away, isPct, digits }: { label: string; home: number | null; away: number | null; isPct?: boolean; digits: number }) {
  const { t } = useLanguage()
  const max = Math.max(home ?? 0, away ?? 0, isPct ? 100 : 0.01)
  const fmt = (v: number | null) => (v === null ? '–' : isPct ? `${v.toFixed(0)}%` : v.toFixed(digits))
  return (
    <div>
      <p className="text-2xs text-apple-gray-400 mb-1">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-14 text-2xs text-apple-gray-500 dark:text-apple-gray-400 flex-shrink-0">{t('coachDetail.local')}</span>
          <div className="flex-1 h-2.5 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 overflow-hidden">
            <div className="h-full bg-brand-green rounded-full" style={{ width: `${((home ?? 0) / max) * 100}%` }} />
          </div>
          <span className="w-10 text-right text-2xs font-semibold tabular-nums text-apple-gray-700 dark:text-apple-gray-300">{fmt(home)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 text-2xs text-apple-gray-500 dark:text-apple-gray-400 flex-shrink-0">{t('coachDetail.visitante')}</span>
          <div className="flex-1 h-2.5 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 overflow-hidden">
            <div className="h-full bg-apple-gray-400 rounded-full" style={{ width: `${((away ?? 0) / max) * 100}%` }} />
          </div>
          <span className="w-10 text-right text-2xs font-semibold tabular-nums text-apple-gray-700 dark:text-apple-gray-300">{fmt(away)}</span>
        </div>
      </div>
    </div>
  )
}

function HomeAwaySplit({ rows }: { rows: EnrichedMatchRow[] }) {
  const { t } = useLanguage()
  const { home, away } = computeHomeAwaySplit(rows)
  if (home.played === 0 && away.played === 0) return null
  return (
    <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
      <h4 className="text-xs font-semibold text-apple-gray-800 dark:text-white mb-3">{t('coachDetail.localVsVisitante')}</h4>
      <div className="space-y-3">
        <SplitBar label={t('coachDetail.puntosPorPartido')} home={home.ppg} away={away.ppg} digits={2} />
        <SplitBar label={t('coachDetail.pctVictorias')} home={home.winPct} away={away.winPct} isPct digits={0} />
      </div>
    </div>
  )
}

function CumulativePointsChart({ rows }: { rows: EnrichedMatchRow[] }) {
  const { t } = useLanguage()
  const data = buildCumulativePoints(rows)
  if (data.length === 0) return null
  return (
    <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
      <h4 className="text-xs font-semibold text-apple-gray-800 dark:text-white mb-2">{t('coachDetail.puntosAcumulados')}</h4>
      <div className="h-40">
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
            <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
              formatter={(value: unknown) => [String(value), t('coachDetail.statPuntos')]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.opponent ?? ''}
            />
            <Line type="stepAfter" dataKey="points" stroke="#22C55E" strokeWidth={2} dot={{ r: 2, fill: '#22C55E', strokeWidth: 0 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function CoachDtEfficiencyPanel({ rows, stats }: { rows: EnrichedMatchRow[]; stats: SeasonStats }) {
  const { t } = useLanguage()
  if (stats.played === 0) return null
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">{t('coachDetail.eficaciaDelDT')}</h3>
      <EfficiencyHero stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <HomeAwaySplit rows={rows} />
        <CumulativePointsChart rows={rows} />
      </div>
    </div>
  )
}
