import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSeasonFixtures, toArDateKey } from '@/services/footballApiService'
import { listTrainingSessions } from '@/services/coachService'
import { isMatchFinished, mergeCalendarEvents } from '@/utils/coachCalendar'
import { buildMonthGrid, pickDefaultSelectedDate, type MonthGridCell } from '@/features/coaches/calendarMonthGrid'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

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

/** `key` es una ArDateKey "YYYY-MM-DD". Parsearla directo con `new Date(string)` la
 *  interpreta como medianoche UTC: en un dispositivo con huso negativo (como AR,
 *  UTC-3) el posterior `toLocaleDateString` puede mostrar el día anterior. Se arma
 *  la fecha a partir de sus componentes locales para evitar ese corrimiento. */
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
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    if (!coach.apiTeamId || !coach.leagueSeason) return
    let active = true
    Promise.all([
      fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason),
      listTrainingSessions(coach.key),
    ]).then(([f, s]) => {
      if (active) {
        setFixtures(f)
        setSessions(s)
      }
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId, coach.leagueSeason, coach.key])

  const todayKey = useMemo(() => toArDateKey(new Date()), [])

  const eventsByDate = useMemo(() => {
    if (!fixtures || !sessions) return null
    return mergeCalendarEvents(fixtures, sessions)
  }, [fixtures, sessions])

  const grid = useMemo(() => buildMonthGrid(visibleMonth.year, visibleMonth.month), [visibleMonth])

  // Selecciona un dia por defecto una sola vez, apenas los datos terminan de cargar.
  // Despues de eso, la seleccion la maneja siempre una accion explicita del usuario
  // (flechas de mes, boton Hoy, tocar una celda) - ver goToMonthWithSelection.
  useEffect(() => {
    if (!eventsByDate || selectedDate !== null) return
    setSelectedDate(pickDefaultSelectedDate(grid, todayKey, eventsByDate))
  }, [eventsByDate, selectedDate, grid, todayKey])

  if (!coach.apiTeamId || !coach.leagueSeason) {
    return <EmptyState message="No hay datos de equipo disponibles para este entrenador todavía." />
  }

  if (eventsByDate === null || selectedDate === null) return <LoadingSpinner message="Cargando calendario..." />

  const goToMonthWithSelection = (year: number, month: number, dateToSelect?: string) => {
    const newGrid = buildMonthGrid(year, month)
    setVisibleMonth({ year, month })
    setSelectedDate(dateToSelect ?? pickDefaultSelectedDate(newGrid, todayKey, eventsByDate))
  }

  const goPrevMonth = () => {
    const d = new Date(visibleMonth.year, visibleMonth.month - 1, 1)
    goToMonthWithSelection(d.getFullYear(), d.getMonth())
  }

  const goNextMonth = () => {
    const d = new Date(visibleMonth.year, visibleMonth.month + 1, 1)
    goToMonthWithSelection(d.getFullYear(), d.getMonth())
  }

  const goToday = () => {
    const now = new Date()
    goToMonthWithSelection(now.getFullYear(), now.getMonth(), todayKey)
  }

  const handleCellClick = (cell: MonthGridCell) => {
    if (cell.isCurrentMonth) {
      setSelectedDate(cell.date)
      return
    }
    const d = parseArDateKey(cell.date)
    goToMonthWithSelection(d.getFullYear(), d.getMonth(), cell.date)
  }

  const monthLabel = capitalize(
    new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
  )
  const isCurrentMonthVisible = (() => {
    const now = new Date()
    return visibleMonth.year === now.getFullYear() && visibleMonth.month === now.getMonth()
  })()

  const selectedDay = eventsByDate.get(selectedDate) ?? {
    date: selectedDate,
    fixtures: [] as AgencyFixture[],
    sessions: [] as CoachTrainingSession[],
    isAbroad: false,
  }
  const selectedParsed = parseArDateKey(selectedDate)
  const selectedWeekday = capitalize(selectedParsed.toLocaleDateString('es-AR', { weekday: 'long' }))
  const selectedMonthLabel = capitalize(selectedParsed.toLocaleDateString('es-AR', { month: 'long' }))

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Mes anterior"
          className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{monthLabel}</span>
          {!isCurrentMonthVisible && (
            <button type="button" onClick={goToday} className="text-2xs font-semibold text-brand-green hover:underline">
              Hoy
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Mes siguiente"
          className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-2xs font-semibold text-apple-gray-400 uppercase py-1">
            {label}
          </div>
        ))}
        {grid.flat().map(cell => {
          const isToday = cell.date === todayKey
          const isSelected = cell.date === selectedDate
          const day = eventsByDate.get(cell.date)
          const hasFixture = !!day && day.fixtures.length > 0
          const hasSession = !!day && day.sessions.length > 0
          const isAbroad = !!day && day.isAbroad

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => handleCellClick(cell)}
              className={`flex flex-col items-center justify-center gap-0.5 aspect-square rounded-apple-lg text-sm transition-colors duration-150 ease-apple ${
                !cell.isCurrentMonth
                  ? 'text-apple-gray-300 dark:text-apple-gray-600'
                  : isSelected
                    ? 'bg-brand-green text-apple-gray-900 font-bold'
                    : isToday
                      ? 'bg-brand-green/10 text-brand-green font-bold'
                      : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800'
              }`}
            >
              <span>{cell.dayNumber}</span>
              {cell.isCurrentMonth && (hasFixture || hasSession) && (
                <span className="flex items-center gap-0.5">
                  {hasFixture &&
                    (isAbroad ? (
                      <PlaneIcon className={`w-2.5 h-2.5 ${isSelected ? 'text-apple-gray-900' : 'text-brand-green'}`} />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900' : 'bg-brand-green'}`} />
                    ))}
                  {hasSession && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900/60' : 'bg-apple-gray-400'}`} />
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 bg-white dark:bg-apple-gray-800/60 px-4 py-3">
        <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">
          {selectedWeekday} {selectedParsed.getDate()} de {selectedMonthLabel}
        </p>
        {selectedDay.fixtures.length === 0 && selectedDay.sessions.length === 0 ? (
          <p className="text-sm text-apple-gray-300 dark:text-apple-gray-600">Sin actividad este día</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {selectedDay.fixtures.map(f => {
              const opponent = f.isHome ? f.awayTeam : f.homeTeam
              const finished = isMatchFinished(f.statusShort)
              const scoreLabel =
                finished && f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome}-${f.goalsAway}` : null
              const pill = (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-green/10 text-brand-green px-2.5 py-1.5 rounded-full max-w-full">
                  <img src={opponent.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                  <span className="truncate">
                    {f.isHome ? 'vs' : '@'} {opponent.name}
                  </span>
                  {scoreLabel && <span className="font-bold flex-shrink-0">{scoreLabel}</span>}
                </span>
              )
              return finished ? (
                <Link
                  key={f.fixtureId}
                  to={`/entrenadores/${coach.key}/partido/${f.fixtureId}`}
                  className="hover:opacity-80 transition-opacity"
                >
                  {pill}
                </Link>
              ) : (
                <span key={f.fixtureId}>{pill}</span>
              )
            })}
            {selectedDay.sessions.map(s => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300 px-2.5 py-1.5 rounded-full max-w-full"
              >
                <BoltIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{s.title}</span>
              </span>
            ))}
            {selectedDay.isAbroad && (
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-400 flex-shrink-0"
                title="Viaje al exterior"
              >
                <PlaneIcon className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
