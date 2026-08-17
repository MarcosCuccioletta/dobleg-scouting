import { useMemo, useState } from 'react'
import type { StandingRow } from '@/services/footballApiService'

export type SortKey = 'points' | 'goalsFor' | 'goalsAgainst'

const SORT_LABEL: Record<SortKey, string> = {
  points: 'Ordenar por puntos',
  goalsFor: 'Ordenar por goles a favor',
  goalsAgainst: 'Ordenar por goles en contra',
}

// Paleta alineada con Task 11 (RESULT_STYLES): verde = ganado, gris = empate, rojo = perdido.
const FORM_COLOR: Record<string, string> = {
  W: 'bg-brand-green text-apple-gray-900',
  D: 'bg-apple-gray-300 dark:bg-apple-gray-600 text-apple-gray-800 dark:text-white',
  L: 'bg-brand-red text-white',
}

/** La API de Primera Nacional devuelve `group` como "Group 1" / "Group 2" (sin
 *  traducir), así que el label mostrado se arma directamente por posición en el
 *  array: Zona A, Zona B, Zona C... */
function zoneLabel(index: number): string {
  return `Zona ${String.fromCharCode(65 + index)}`
}

export function sortStandingRows(rows: StandingRow[], sortKey: SortKey): StandingRow[] {
  const sorted = [...rows]
  if (sortKey === 'points') return sorted.sort((a, b) => b.points - a.points)
  if (sortKey === 'goalsFor') return sorted.sort((a, b) => b.goalsFor - a.goalsFor)
  return sorted.sort((a, b) => a.goalsAgainst - b.goalsAgainst)
}

export interface StandingsTableProps {
  groups: StandingRow[][]
  highlightTeamId?: number | null
}

export default function StandingsTable({ groups, highlightTeamId = null }: StandingsTableProps) {
  const [activeGroup, setActiveGroup] = useState(() => {
    if (highlightTeamId == null) return 0
    const idx = groups.findIndex(group => group.some(row => row.teamId === highlightTeamId))
    return idx >= 0 ? idx : 0
  })
  const [sortKey, setSortKey] = useState<SortKey>('points')

  const sortedRows = useMemo(() => {
    if (!groups[activeGroup]) return []
    return sortStandingRows(groups[activeGroup], sortKey)
  }, [groups, activeGroup, sortKey])

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {groups.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveGroup(i)}
              className={`min-h-[40px] px-3 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-apple ${
                i === activeGroup
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'
              }`}
            >
              {zoneLabel(i)}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="min-h-[40px] text-xs font-medium rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-2.5 py-2 text-apple-gray-700 dark:text-apple-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map(key => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-wide text-apple-gray-400 bg-apple-gray-50 dark:bg-apple-gray-800/50 border-b border-apple-gray-200 dark:border-apple-gray-700">
              <th className="py-2.5 pl-3 pr-2 font-semibold">#</th>
              <th className="py-2.5 pr-2 font-semibold">Equipo</th>
              <th className="py-2.5 px-1 text-center font-semibold">PJ</th>
              <th className="py-2.5 px-1 text-center font-semibold">PG</th>
              <th className="py-2.5 px-1 text-center font-semibold">PE</th>
              <th className="py-2.5 px-1 text-center font-semibold">PP</th>
              <th className="py-2.5 px-1 text-center font-semibold">GF</th>
              <th className="py-2.5 px-1 text-center font-semibold">GC</th>
              <th className="py-2.5 px-1 text-center font-semibold">DG</th>
              <th className="py-2.5 px-1 text-center font-semibold">Pts</th>
              <th className="py-2.5 pl-2 pr-3 font-semibold">Racha</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => {
              const isOwnTeam = row.teamId === highlightTeamId
              return (
                <tr
                  key={row.teamId}
                  className={`border-b border-apple-gray-100 dark:border-apple-gray-800 last:border-b-0 ${
                    isOwnTeam
                      ? 'bg-brand-green/10 font-semibold'
                      : 'hover:bg-apple-gray-50 dark:hover:bg-apple-gray-800/40'
                  }`}
                >
                  <td className="py-2.5 pl-3 pr-2 text-apple-gray-400">{row.rank}</td>
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2 min-w-[9rem]">
                      {isOwnTeam && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-green flex-shrink-0" aria-hidden="true" />
                      )}
                      <img src={row.teamLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                      <span className="text-apple-gray-800 dark:text-white truncate">{row.teamName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.played}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.win}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.draw}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.lose}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.goalsFor}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.goalsAgainst}</td>
                  <td
                    className={`py-2.5 px-1 text-center ${
                      row.goalsDiff > 0
                        ? 'text-brand-green'
                        : row.goalsDiff < 0
                          ? 'text-brand-red'
                          : 'text-apple-gray-500 dark:text-apple-gray-400'
                    }`}
                  >
                    {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                  </td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-800 dark:text-white">{row.points}</td>
                  <td className="py-2.5 pl-2 pr-3">
                    <div className="flex gap-0.5">
                      {row.form
                        .split('')
                        .filter(Boolean)
                        .map((r, i) => (
                          <span
                            key={i}
                            className={`w-4 h-4 rounded-sm text-2xs font-bold flex items-center justify-center flex-shrink-0 ${FORM_COLOR[r] ?? 'bg-apple-gray-200 dark:bg-apple-gray-700 text-apple-gray-500'}`}
                          >
                            {r}
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
