import { useEffect, useMemo, useState } from 'react'
import { fetchLeagueStandings, type StandingRow } from '@/services/footballApiService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type SortKey = 'points' | 'goalsFor' | 'goalsAgainst'

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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

/** Nombre de la zona a partir del campo `group` de la API (ej. "Primera Nacional - Zona A"),
 *  con fallback a Zona A/B/C... por índice si la API no trae ese detalle. */
function zoneLabel(rows: StandingRow[], index: number): string {
  const match = rows[0]?.group?.match(/zona\s+\S+/i)
  if (match) return match[0].replace(/^zona/i, 'Zona')
  return `Zona ${String.fromCharCode(65 + index)}`
}

export default function CoachLeagueTab({ coach }: { coach: AgencyCoach }) {
  const [groups, setGroups] = useState<StandingRow[][] | null>(null)
  const [activeGroup, setActiveGroup] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('points')

  useEffect(() => {
    if (!coach.leagueApiId || !coach.leagueSeason) return
    let active = true
    fetchLeagueStandings(coach.leagueApiId, coach.leagueSeason).then(g => {
      if (!active) return
      setGroups(g)
      const ownGroupIndex = g.findIndex(group => group.some(row => row.teamId === coach.apiTeamId))
      if (ownGroupIndex >= 0) setActiveGroup(ownGroupIndex)
    })
    return () => {
      active = false
    }
  }, [coach.leagueApiId, coach.leagueSeason, coach.apiTeamId])

  const sortedRows = useMemo(() => {
    if (!groups || !groups[activeGroup]) return []
    const rows = [...groups[activeGroup]]
    if (sortKey === 'points') return rows.sort((a, b) => b.points - a.points)
    if (sortKey === 'goalsFor') return rows.sort((a, b) => b.goalsFor - a.goalsFor)
    return rows.sort((a, b) => a.goalsAgainst - b.goalsAgainst)
  }, [groups, activeGroup, sortKey])

  if (!coach.leagueApiId || !coach.leagueSeason) {
    return <EmptyState message="No hay datos de liga disponibles para este entrenador todavía." />
  }

  if (groups === null) return <LoadingSpinner message="Cargando tabla de posiciones..." />
  if (groups.length === 0) return <EmptyState message="No se pudo cargar la tabla de posiciones." />

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {groups.map((group, i) => (
            <button
              key={i}
              onClick={() => setActiveGroup(i)}
              className={`min-h-[32px] px-3 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-apple ${
                i === activeGroup
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'
              }`}
            >
              {zoneLabel(group, i)}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="text-xs font-medium rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-2.5 py-1.5 text-apple-gray-700 dark:text-apple-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map(key => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla de 11 columnas: la más densa de toda la sección. En mobile/tablet se
          desplaza horizontalmente dentro de este contenedor en vez de comprimir
          columnas ilegibles o romper el layout de la página. */}
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
              const isOwnTeam = row.teamId === coach.apiTeamId
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
