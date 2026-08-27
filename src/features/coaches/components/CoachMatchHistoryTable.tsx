import type { EnrichedMatchRow } from './CoachMatchMetricsEvolution'
import { metricValue } from './CoachMatchMetricsEvolution'
import { RESULT_STYLES } from '@/features/coaches/matchResult'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGE_LOCALES } from '@/constants/translations'

function fmt(v: number | null, digits = 1): string {
  return v === null ? '—' : v.toFixed(digits)
}

const COLUMNS: { key: string; labelKey: string; digits?: number }[] = [
  { key: 'tiros_/_a_la_porteria_2', labelKey: 'coachDetail.colTirosPuerta', digits: 0 },
  { key: 'corneres_/_con_remate', labelKey: 'coachDetail.colCorners', digits: 0 },
  { key: 'faltas', labelKey: 'coachDetail.colFaltas', digits: 0 },
  { key: 'tarjetas_amarillas', labelKey: 'coachDetail.colTA', digits: 0 },
]

/** Barra horizontal de posesion: verde si domina el partido (>50%), gris/rojizo
 *  si no -- reemplaza el numero pelado por algo que se lee de un vistazo. */
function PossessionBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-apple-gray-400">—</span>
  const dominant = value >= 50
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <span className={`text-xs font-semibold tabular-nums ${dominant ? 'text-brand-green' : 'text-apple-gray-500 dark:text-apple-gray-400'}`}>
        {value.toFixed(0)}%
      </span>
      <div className="w-12 h-1.5 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${dominant ? 'bg-brand-green' : 'bg-apple-gray-400'}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

/** xG a favor y en contra con el diferencial resaltado en verde/rojo -- de un
 *  vistazo dice si el equipo genero mas de lo que concedio. */
function XgCell({ own, against }: { own: number | null; against: number | null }) {
  if (own === null && against === null) return <span className="text-apple-gray-400">—</span>
  const diff = own !== null && against !== null ? own - against : null
  return (
    <div className="flex items-center justify-end gap-1.5 tabular-nums">
      <span className="text-apple-gray-700 dark:text-apple-gray-300">{fmt(own, 2)}</span>
      <span className="text-apple-gray-300 dark:text-apple-gray-600">–</span>
      <span className="text-apple-gray-500 dark:text-apple-gray-400">{fmt(against, 2)}</span>
      {diff !== null && (
        <span className={`ml-1 text-2xs font-semibold px-1.5 py-0.5 rounded ${diff >= 0 ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
        </span>
      )}
    </div>
  )
}

export default function CoachMatchHistoryTable({ rows }: { rows: EnrichedMatchRow[] }) {
  const { t, language } = useLanguage()
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">{t('coachDetail.partidoPorPartido')}</h3>
      <div className="overflow-x-auto rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-apple-gray-50 dark:bg-apple-gray-900/40 text-apple-gray-400 uppercase tracking-wide">
              <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">{t('coachDetail.colFecha')}</th>
              <th className="text-left font-semibold px-3 py-2">{t('evaluar.rival')}</th>
              <th className="text-center font-semibold px-3 py-2">{t('coachDetail.colRes')}</th>
              <th className="text-right font-semibold px-3 py-2">{t('coachDetail.colPosesion')}</th>
              <th className="text-right font-semibold px-3 py-2">xG</th>
              {COLUMNS.map(col => (
                <th key={col.key} className="text-right font-semibold px-3 py-2 whitespace-nowrap">{t(col.labelKey)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr
                key={row.fixtureId}
                className="border-t border-apple-gray-100 dark:border-apple-gray-800 hover:bg-apple-gray-50 dark:hover:bg-apple-gray-800/40"
              >
                <td className="px-3 py-2 text-apple-gray-500 dark:text-apple-gray-400 whitespace-nowrap">
                  {new Date(row.date).toLocaleDateString(LANGUAGE_LOCALES[language], { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {row.opponentLogo && <img src={row.opponentLogo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
                    <span className="font-medium text-apple-gray-800 dark:text-white truncate">
                      {row.isHome ? 'vs' : '@'} {row.opponent}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex items-center justify-center min-w-[2.75rem] px-1.5 py-0.5 rounded-full text-2xs font-bold ${row.result ? RESULT_STYLES[row.result] : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-400'}`}>
                    {row.scoreLabel ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <PossessionBar value={row.stats.possession_pct} />
                </td>
                <td className="px-3 py-2">
                  <XgCell own={row.stats.xg_for} against={row.stats.xg_against} />
                </td>
                {COLUMNS.map(col => (
                  <td key={col.key} className="px-3 py-2 text-right tabular-nums text-apple-gray-700 dark:text-apple-gray-300">
                    {fmt(metricValue(row, col.key), col.digits)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
