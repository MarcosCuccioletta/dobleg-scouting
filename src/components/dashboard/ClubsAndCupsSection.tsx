import { useEffect, useMemo, useState } from 'react'
import {
  fetchTeamCompetitions,
  fetchTeamCompetitionFixtures,
  fetchLeagueStandings,
  toArDateKey,
  type TeamCompetition,
  type StandingRow,
} from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'
import { getUniqueTeamIds, type AgencyPlayer } from '@/constants/agencyPlayers'
import { isMatchFinished } from '@/utils/coachCalendar'
import { useData } from '@/context/DataContext'
import StandingsTable from '@/components/shared/StandingsTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface TeamOption {
  teamId: number
  teamName: string
  playerNames: string[]
}

function buildTeamOptions(agencyPlayers: AgencyPlayer[]): TeamOption[] {
  return getUniqueTeamIds()
    .map(teamId => {
      // Sólo jugadores no-reserva: el dropdown de equipos ya sale de
      // getUniqueTeamIds (que también filtra isReserve) — mantener la leyenda
      // de "quién juega acá" consistente con eso, no getPlayersByTeamId crudo
      // (que sí incluye reservas, necesarias en otros consumidores como
      // footballApiService.mapFixture).
      const players = agencyPlayers.filter(p => p.apiTeamId === teamId && !p.isReserve)
      return { teamId, teamName: players[0]?.team ?? '', playerNames: players.map(p => p.shortName) }
    })
    .filter(t => t.teamName)
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
}

/** Formatea una fecha de fixture en hora de Argentina (dd/mm/yyyy), evitando
 *  el corrimiento de un día que da `new Date(isoString).toLocaleDateString()`
 *  en husos negativos (ver convención en CoachCalendarTab/toArDateKey). */
function formatFixtureDate(dateStr: string): string {
  const [y, m, d] = toArDateKey(dateStr).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR')
}

function CompetitionStandings({ teamId, leagueId, season }: { teamId: number; leagueId: number; season: number }) {
  const [groups, setGroups] = useState<StandingRow[][] | null>(null)

  useEffect(() => {
    let active = true
    setGroups(null)
    fetchLeagueStandings(leagueId, season)
      .then(g => {
        if (active) setGroups(g)
      })
      .catch(() => {
        if (active) setGroups([])
      })
    return () => {
      active = false
    }
  }, [leagueId, season])

  if (groups === null) return <LoadingSpinner message="Cargando tabla de posiciones..." />
  if (groups.length === 0) {
    return (
      <p className="text-sm text-apple-gray-500 text-center py-8">No se pudo cargar la tabla de posiciones.</p>
    )
  }
  return <StandingsTable groups={groups} highlightTeamId={teamId} />
}

function CompetitionFixtures({ teamId, leagueId, season }: { teamId: number; leagueId: number; season: number }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)

  useEffect(() => {
    let active = true
    setFixtures(null)
    fetchTeamCompetitionFixtures(teamId, leagueId, season)
      .then(f => {
        if (active) setFixtures(f)
      })
      .catch(() => {
        if (active) setFixtures([])
      })
    return () => {
      active = false
    }
  }, [teamId, leagueId, season])

  if (fixtures === null) return <LoadingSpinner message="Cargando partidos..." />
  if (fixtures.length === 0) {
    return (
      <p className="text-sm text-apple-gray-500 text-center py-8">
        No hay partidos disponibles para esta competencia.
      </p>
    )
  }

  const sorted = [...fixtures].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)

  return (
    <div className="space-y-1">
      {sorted.map(f => {
        const isFinished = isMatchFinished(f.statusShort)
        const opponent = f.isHome ? f.awayTeam : f.homeTeam
        return (
          <div
            key={f.fixtureId}
            className="flex items-center gap-3 p-3 rounded-lg bg-apple-gray-50 dark:bg-apple-gray-700/30"
          >
            <img src={opponent.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-apple-gray-800 dark:text-white truncate">
                {f.isHome ? 'vs' : '@'} {opponent.name}
              </p>
              <p className="text-xs text-apple-gray-500 truncate">{f.round}</p>
            </div>
            <span className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-200 tabular-nums flex-shrink-0">
              {isFinished ? `${f.goalsHome ?? '-'}-${f.goalsAway ?? '-'}` : formatFixtureDate(f.date)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function ClubsAndCupsSection() {
  const { agencyPlayers } = useData()
  const options = useMemo(() => buildTeamOptions(agencyPlayers), [agencyPlayers])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(options[0]?.teamId ?? null)
  const [competitions, setCompetitions] = useState<TeamCompetition[] | null>(null)
  const [activeCompetitionIdx, setActiveCompetitionIdx] = useState(0)

  // Si `options` cambia (roster recién cargado o refrescado a mitad de sesión)
  // y la selección actual ya no es válida, recaer en el primer equipo.
  useEffect(() => {
    if (selectedTeamId != null && options.some(o => o.teamId === selectedTeamId)) return
    setSelectedTeamId(options[0]?.teamId ?? null)
  }, [options, selectedTeamId])

  useEffect(() => {
    if (selectedTeamId == null) return
    let active = true
    setCompetitions(null)
    setActiveCompetitionIdx(0)
    fetchTeamCompetitions(selectedTeamId)
      .then(c => {
        if (active) setCompetitions(c)
      })
      .catch(() => {
        if (active) setCompetitions([])
      })
    return () => {
      active = false
    }
  }, [selectedTeamId])

  if (options.length === 0) return null

  const selected = options.find(o => o.teamId === selectedTeamId)
  const activeCompetition = competitions?.[activeCompetitionIdx] ?? null

  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-apple-gray-800 dark:text-white">Clubes y Copas</h2>
          <p className="text-sm text-apple-gray-500">
            Posición en la liga y progreso en copas de los clubes del roster
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={selectedTeamId ?? ''}
            onChange={e => setSelectedTeamId(Number(e.target.value))}
            className="min-h-[40px] text-sm font-medium rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-3 py-2 text-apple-gray-700 dark:text-apple-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
          >
            {options.map(o => (
              <option key={o.teamId} value={o.teamId}>
                {o.teamName}
              </option>
            ))}
          </select>
          {selected && (
            <span
              className="text-xs text-apple-gray-500 truncate"
              title={selected.playerNames.join(', ')}
            >
              {selected.playerNames.join(', ')}
            </span>
          )}
        </div>

        {competitions === null ? (
          <LoadingSpinner message="Cargando competencias..." />
        ) : competitions.length === 0 ? (
          <p className="text-sm text-apple-gray-500 text-center py-8">
            No se encontraron competencias vigentes para este equipo.
          </p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin mb-4">
              {competitions.map((c, i) => (
                <button
                  key={c.leagueId}
                  onClick={() => setActiveCompetitionIdx(i)}
                  className={`min-h-[40px] px-3 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-apple ${
                    i === activeCompetitionIdx
                      ? 'bg-brand-green text-apple-gray-900'
                      : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'
                  }`}
                >
                  {c.leagueName}
                </button>
              ))}
            </div>

            {activeCompetition && selectedTeamId != null && (
              activeCompetition.hasStandings ? (
                <CompetitionStandings
                  key={`${selectedTeamId}-${activeCompetition.leagueId}`}
                  teamId={selectedTeamId}
                  leagueId={activeCompetition.leagueId}
                  season={activeCompetition.season}
                />
              ) : (
                <CompetitionFixtures
                  key={`${selectedTeamId}-${activeCompetition.leagueId}`}
                  teamId={selectedTeamId}
                  leagueId={activeCompetition.leagueId}
                  season={activeCompetition.season}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
