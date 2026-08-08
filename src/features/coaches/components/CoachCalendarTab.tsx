import { useEffect, useMemo, useState } from 'react'
import { fetchTeamFixtures, toArDateKey } from '@/services/footballApiService'
import { listTrainingSessions } from '@/services/coachService'
import { isMatchFinished, mergeCalendarEvents } from '@/utils/coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const DAYS_AHEAD = 14

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 12 3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12Zm0 0h7.5"
      />
    </svg>
  )
}

/** `day.date` es una ArDateKey "YYYY-MM-DD" (huso de Argentina, ver toArDateKey en
 *  footballApiService). Parsearla directo con `new Date(string)` la interpreta como
 *  medianoche UTC: en un dispositivo con huso negativo (como AR, UTC-3) el posterior
 *  `toLocaleDateString` puede mostrar el día anterior. Se arma la fecha a partir de
 *  sus componentes locales para evitar ese corrimiento. */
function parseArDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export default function CoachCalendarTab({ coach }: { coach: AgencyCoach }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)
  const [sessions, setSessions] = useState<CoachTrainingSession[] | null>(null)

  useEffect(() => {
    if (!coach.apiTeamId) return
    let active = true
    Promise.all([fetchTeamFixtures(coach.apiTeamId), listTrainingSessions(coach.key)]).then(([f, s]) => {
      if (active) {
        setFixtures(f)
        setSessions(s)
      }
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId, coach.key])

  const todayKey = useMemo(() => toArDateKey(new Date()), [])

  const days = useMemo(() => {
    if (!fixtures || !sessions) return null
    const merged = mergeCalendarEvents(fixtures, sessions)
    const next: string[] = []
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      next.push(toArDateKey(d))
    }
    return next.map(key => merged.get(key) ?? { date: key, fixtures: [], sessions: [], isAbroad: false })
  }, [fixtures, sessions])

  if (!coach.apiTeamId) {
    return <EmptyState message="No hay datos de equipo disponibles para este entrenador todavía." />
  }

  if (days === null) return <LoadingSpinner message="Cargando calendario..." />

  return (
    <div className="space-y-2 animate-fade-in">
      {days.map(day => {
        const isToday = day.date === todayKey
        const parsed = parseArDateKey(day.date)
        const weekday = capitalize(parsed.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''))
        const dayNumber = parsed.getDate()
        const month = capitalize(parsed.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''))
        const isEmpty = day.fixtures.length === 0 && day.sessions.length === 0

        return (
          <div
            key={day.date}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-apple-lg border px-4 py-3 transition-colors duration-200 ease-apple ${
              isToday
                ? 'bg-brand-green/5 border-brand-green/30'
                : 'bg-white dark:bg-apple-gray-800/60 border-apple-gray-200/60 dark:border-apple-gray-700/40'
            }`}
          >
            {/* Chip de fecha: en mobile queda como fila corta arriba de las badges (nunca
                comparte ancho con ellas, así que no las comprime); desde sm+ pasa a columna
                angosta y fija a la izquierda, separada por un divisor sutil. */}
            <div className="flex items-center gap-1.5 sm:flex-col sm:items-center sm:justify-center sm:gap-0.5 sm:w-16 flex-shrink-0">
              <span className="text-2xs font-bold uppercase tracking-wide text-apple-gray-400">{weekday}</span>
              <span
                className={`text-base sm:text-lg font-bold tabular-nums ${
                  isToday ? 'text-brand-green' : 'text-apple-gray-800 dark:text-white'
                }`}
              >
                {dayNumber}
              </span>
              <span className="text-2xs text-apple-gray-400">{month}</span>
              {isToday && (
                <span className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse-soft flex-shrink-0" />
                  Hoy
                </span>
              )}
            </div>

            <div className="hidden sm:block w-px self-stretch bg-apple-gray-200/60 dark:bg-apple-gray-700/40" />

            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {day.fixtures.map(f => {
                const opponent = f.isHome ? f.awayTeam : f.homeTeam
                const finished = isMatchFinished(f.statusShort)
                const scoreLabel =
                  finished && f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome}-${f.goalsAway}` : null
                return (
                  <span
                    key={f.fixtureId}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-green/10 text-brand-green px-2.5 py-1.5 rounded-full max-w-full"
                  >
                    <img src={opponent.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                    <span className="truncate">
                      {f.isHome ? 'vs' : '@'} {opponent.name}
                    </span>
                    {scoreLabel && <span className="font-bold flex-shrink-0">{scoreLabel}</span>}
                  </span>
                )
              })}
              {day.sessions.map(s => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300 px-2.5 py-1.5 rounded-full max-w-full"
                >
                  <BoltIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{s.title}</span>
                </span>
              ))}
              {day.isAbroad && (
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-400 flex-shrink-0"
                  title="Viaje al exterior"
                >
                  <PlaneIcon className="w-3.5 h-3.5" />
                </span>
              )}
              {isEmpty && <span className="text-xs text-apple-gray-300 dark:text-apple-gray-600">Sin actividad</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
