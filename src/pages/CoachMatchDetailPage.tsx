import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCoachByKey } from '@/constants/agencyCoaches'
import {
  fetchTeamFixtures,
  fetchFixtureLineups,
  fetchFixtureEvents,
  fetchSquadCached,
  type SquadPlayer,
} from '@/services/footballApiService'
import { getMatchNote } from '@/services/coachService'
import { groupLineupByPosition, LINEUP_GROUP_ORDER } from '@/features/coaches/lineupGrouping'
import { matchOutcome } from '@/features/coaches/matchResult'
import type { AgencyFixture, ApiFixtureLineup, ApiFixtureEvent } from '@/types/footballApi'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

const EVENT_ICON: Record<string, string> = {
  Goal: '⚽',
  subst: '🔁',
}

function eventIcon(e: ApiFixtureEvent): string {
  if (e.detail === 'Yellow Card') return '🟨'
  if (e.detail === 'Red Card') return '🟥'
  return EVENT_ICON[e.type] ?? ''
}

function LineupGroupList({ grouped }: { grouped: ReturnType<typeof groupLineupByPosition> }) {
  return (
    <div className="space-y-2">
      {LINEUP_GROUP_ORDER.filter(g => grouped[g].length > 0).map(group => (
        <div key={group}>
          <p className="text-[10px] font-bold text-apple-gray-300 dark:text-apple-gray-600 uppercase tracking-wide">
            {group}
          </p>
          <p className="text-xs text-apple-gray-700 dark:text-apple-gray-300 leading-relaxed">
            {grouped[group].map(p => (p.number ? `#${p.number} ${p.name}` : p.name)).join(' · ')}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function CoachMatchDetailPage() {
  const { coachKey, fixtureId } = useParams<{ coachKey: string; fixtureId: string }>()
  const coach = coachKey ? getCoachByKey(coachKey) : undefined
  const [fixture, setFixture] = useState<AgencyFixture | null | undefined>(undefined)
  const [lineups, setLineups] = useState<ApiFixtureLineup[] | null>(null)
  const [events, setEvents] = useState<ApiFixtureEvent[] | null>(null)
  const [squads, setSquads] = useState<Record<number, SquadPlayer[]>>({})
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!fixtureId) return
    if (!coach?.apiTeamId) {
      setFixture(null)
      return
    }
    let active = true
    fetchTeamFixtures(coach.apiTeamId).then(fixtures => {
      if (active) setFixture(fixtures.find(f => f.fixtureId === Number(fixtureId)) ?? null)
    })
    fetchFixtureLineups(Number(fixtureId)).then(l => { if (active) setLineups(l) })
    fetchFixtureEvents(Number(fixtureId)).then(e => { if (active) setEvents(e) })
    getMatchNote(coach.key, Number(fixtureId)).then(n => { if (active) setNote(n) })
    return () => { active = false }
  }, [coach, fixtureId])

  useEffect(() => {
    if (!lineups || lineups.length === 0) return
    let active = true
    Promise.all(lineups.map(l => fetchSquadCached(l.team.id).then(squad => [l.team.id, squad] as const))).then(
      pairs => {
        if (active) setSquads(Object.fromEntries(pairs))
      },
    )
    return () => { active = false }
  }, [lineups])

  if (!coach || !fixtureId) {
    return <EmptyState message="No pudimos encontrar este partido." />
  }

  if (fixture === undefined) return <LoadingSpinner message="Cargando partido..." />
  if (fixture === null) return <EmptyState message="No pudimos encontrar este partido." />

  const { scoreLabel } = matchOutcome(fixture)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <Link
        to={`/entrenadores/${coach.key}?tab=resumen`}
        className="inline-flex items-center gap-2 text-sm text-apple-gray-500 dark:text-apple-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a {coach.fullName}
      </Link>

      <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 shadow-apple dark:shadow-apple-dark p-5 sm:p-6 mb-6">
        <p className="text-2xs sm:text-xs font-medium text-apple-gray-400 text-center mb-3">
          {fixture.leagueName} ·{' '}
          {new Date(fixture.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center gap-2 min-w-0">
            <img src={fixture.homeTeam.logo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
            <span className="text-xs sm:text-sm font-semibold text-apple-gray-800 dark:text-white text-center truncate w-full">
              {fixture.homeTeam.name}
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-bold text-apple-gray-800 dark:text-white flex-shrink-0">
            {scoreLabel}
          </span>
          <div className="flex flex-col items-center gap-2 min-w-0">
            <img src={fixture.awayTeam.logo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
            <span className="text-xs sm:text-sm font-semibold text-apple-gray-800 dark:text-white text-center truncate w-full">
              {fixture.awayTeam.name}
            </span>
          </div>
        </div>
        {fixture.venue && <p className="text-2xs text-apple-gray-400 text-center mt-3">{fixture.venue}</p>}
      </div>

      {note && (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide">Nota del DT</p>
            <Link
              to={`/entrenadores/${coach.key}?tab=notas`}
              className="text-2xs font-semibold text-brand-green hover:underline"
            >
              Editar en Notas de partidos
            </Link>
          </div>
          <p className="text-sm text-apple-gray-700 dark:text-apple-gray-300 whitespace-pre-wrap">{note}</p>
        </div>
      )}

      <div className="mb-6">
        <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-3">Goles y hechos</p>
        {events === null ? (
          <LoadingSpinner message="Cargando hechos..." />
        ) : events.length === 0 ? (
          <EmptyState message="No hay eventos registrados para este partido." />
        ) : (
          <div className="space-y-2">
            {[...events]
              .sort((a, b) => a.time.elapsed - b.time.elapsed)
              .map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-3 sm:px-4 py-2.5"
                >
                  <span className="text-2xs font-bold text-apple-gray-400 w-8 flex-shrink-0">{e.time.elapsed}'</span>
                  <img src={e.team.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate">
                      {eventIcon(e)} {e.player.name ?? e.detail}
                    </p>
                    {e.assist.name && <p className="text-2xs text-apple-gray-400">Asistencia: {e.assist.name}</p>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-3">Alineaciones</p>
        {lineups === null ? (
          <LoadingSpinner message="Cargando alineaciones..." />
        ) : lineups.length === 0 ? (
          <EmptyState message="No hay alineaciones disponibles para este partido." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lineups.map(lineup => {
              const squad = squads[lineup.team.id] ?? []
              const startersGrouped = groupLineupByPosition(lineup.startXI, squad)
              const subsGrouped = groupLineupByPosition(lineup.substitutes, squad)
              return (
                <div
                  key={lineup.team.id}
                  className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <img src={lineup.team.logo} alt="" className="w-6 h-6 object-contain" />
                    <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">
                      {lineup.team.name}
                    </span>
                  </div>
                  {lineup.coach?.name && <p className="text-2xs text-apple-gray-400 mb-3">DT: {lineup.coach.name}</p>}
                  <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-1.5">
                    Titulares
                  </p>
                  <LineupGroupList grouped={startersGrouped} />
                  <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mt-3 mb-1.5">
                    Suplentes
                  </p>
                  <LineupGroupList grouped={subsGrouped} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
