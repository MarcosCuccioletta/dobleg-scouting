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
import type { AgencyFixture, ApiFixtureLineup, ApiFixtureEvent } from '@/types/footballApi'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

function GoalIcon() {
  return (
    <span className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center flex-shrink-0">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
        <circle cx="12" cy="12" r="8.5" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8.2l2.7 2-1 3.1H10.3l-1-3.1L12 8.2zM12 8.2V5.3M9.5 9.7L7 8M14.5 9.7L17 8M10.4 12.8l-2 2.7M13.6 12.8l2 2.7M11 15.3l-.6 3M13 15.3l.6 3"
        />
      </svg>
    </span>
  )
}

function CardIcon({ color }: { color: 'yellow' | 'red' }) {
  return (
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
        color === 'yellow' ? 'bg-amber-400' : 'bg-brand-red'
      }`}
    >
      <span className={`w-2 h-3 rounded-[1.5px] ${color === 'yellow' ? 'bg-amber-900/40' : 'bg-white/90'}`} />
    </span>
  )
}

function SubstIcon() {
  return (
    <span className="w-6 h-6 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 flex items-center justify-center flex-shrink-0">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand-green"
          d="M7 15V6m0 0L4 9m3-3l3 3"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand-red"
          d="M17 9v9m0 0l3-3m-3 3l-3-3"
        />
      </svg>
    </span>
  )
}

function EventIcon({ e }: { e: ApiFixtureEvent }) {
  if (e.detail === 'Yellow Card') return <CardIcon color="yellow" />
  if (e.detail === 'Red Card') return <CardIcon color="red" />
  if (e.type === 'subst') return <SubstIcon />
  if (e.type === 'Goal') return <GoalIcon />
  return <span className="w-6 h-6 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 flex-shrink-0" />
}

function EventContent({ e, align }: { e: ApiFixtureEvent; align: 'left' | 'right' }) {
  const alignClass = align === 'right' ? 'text-right items-end' : 'text-left items-start'
  if (e.type === 'subst') {
    return (
      <div className={`flex flex-col min-w-0 ${alignClass}`}>
        <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate w-full">
          <span className="text-brand-green">↑</span> {e.assist.name ?? 'Ingresa'}
        </p>
        <p className="text-2xs text-apple-gray-400 truncate w-full">
          <span className="text-brand-red">↓</span> {e.player.name ?? 'Sale'}
        </p>
      </div>
    )
  }
  return (
    <div className={`flex flex-col min-w-0 ${alignClass}`}>
      <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate w-full">
        {e.player.name ?? e.detail}
        {e.detail === 'Own Goal' && <span className="text-apple-gray-400 font-normal"> (en contra)</span>}
        {e.detail === 'Penalty' && <span className="text-apple-gray-400 font-normal"> (penal)</span>}
      </p>
      {e.assist.name && <p className="text-2xs text-apple-gray-400 truncate w-full">Asistencia: {e.assist.name}</p>}
    </div>
  )
}

function LineupGroupList({ grouped }: { grouped: ReturnType<typeof groupLineupByPosition> }) {
  return (
    <div className="space-y-3">
      {LINEUP_GROUP_ORDER.filter(g => grouped[g].length > 0).map(group => (
        <div key={group}>
          <p className="text-[10px] font-bold text-apple-gray-300 dark:text-apple-gray-600 uppercase tracking-wide mb-1">
            {group}
          </p>
          <div className="space-y-1">
            {grouped[group].map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-[10px] font-bold text-apple-gray-500 dark:text-apple-gray-400 flex items-center justify-center flex-shrink-0">
                  {p.number ?? '–'}
                </span>
                <span className="text-xs text-apple-gray-700 dark:text-apple-gray-300 truncate">{p.name}</span>
              </div>
            ))}
          </div>
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
            {fixture.goalsHome ?? '-'} - {fixture.goalsAway ?? '-'}
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
          <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 divide-y divide-apple-gray-100 dark:divide-apple-gray-700/40">
            {[...events]
              .sort((a, b) => a.time.elapsed - b.time.elapsed)
              .map((e, i) => {
                const isHome = e.team.id === fixture.homeTeam.id
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
                    <div className="min-w-0">{isHome && <EventContent e={e} align="right" />}</div>
                    <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                      <EventIcon e={e} />
                      <span className="text-2xs font-bold text-apple-gray-400">
                        {e.time.elapsed}
                        {e.time.extra ? `+${e.time.extra}` : ''}'
                      </span>
                    </div>
                    <div className="min-w-0">{!isHome && <EventContent e={e} align="left" />}</div>
                  </div>
                )
              })}
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
