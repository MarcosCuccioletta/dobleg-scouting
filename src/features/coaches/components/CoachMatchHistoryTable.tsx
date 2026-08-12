import type { EnrichedMatchRow } from './CoachMatchMetricsEvolution'

function num(row: EnrichedMatchRow, key: string): number | null {
  if (key === 'possession_pct') return row.stats.possession_pct
  if (key === 'xg_for') return row.stats.xg_for
  if (key === 'xg_against') return row.stats.xg_against
  const v = row.stats.raw_metrics[key]
  return typeof v === 'number' ? v : null
}

function fmt(v: number | null, digits = 1): string {
  return v === null ? '—' : v.toFixed(digits)
}

const COLUMNS: { key: string; label: string; digits?: number }[] = [
  { key: 'possession_pct', label: 'Pos. %', digits: 0 },
  { key: 'xg_for', label: 'xG', digits: 2 },
  { key: 'xg_against', label: 'xG rival', digits: 2 },
  { key: 'tiros_/_a_la_porteria_2', label: 'Tiros a puerta', digits: 0 },
  { key: 'corneres_/_con_remate', label: 'Córners', digits: 0 },
  { key: 'duelos_/_ganados_3', label: 'Duelos %', digits: 0 },
  { key: 'faltas', label: 'Faltas', digits: 0 },
  { key: 'tarjetas_amarillas', label: 'TA', digits: 0 },
]

export default function CoachMatchHistoryTable({ rows }: { rows: EnrichedMatchRow[] }) {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Partido por partido</h3>
      <div className="overflow-x-auto rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-apple-gray-50 dark:bg-apple-gray-900/40 text-apple-gray-400 uppercase tracking-wide">
              <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Fecha</th>
              <th className="text-left font-semibold px-3 py-2">Rival</th>
              <th className="text-center font-semibold px-3 py-2">Res.</th>
              {COLUMNS.map(col => (
                <th key={col.key} className="text-right font-semibold px-3 py-2 whitespace-nowrap">{col.label}</th>
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
                  {new Date(row.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-3 py-2 font-medium text-apple-gray-800 dark:text-white">
                  {row.isHome ? 'vs' : '@'} {row.opponent}
                </td>
                <td className="px-3 py-2 text-center font-semibold text-apple-gray-800 dark:text-white">
                  {row.scoreLabel ?? '—'}
                </td>
                {COLUMNS.map(col => (
                  <td key={col.key} className="px-3 py-2 text-right tabular-nums text-apple-gray-700 dark:text-apple-gray-300">
                    {fmt(num(row, col.key), col.digits)}
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
