// src/features/coaches/components/CoachTrainingTab.tsx
import { useEffect, useMemo, useState } from 'react'
import { fetchTeamFixtures, toArDateKey } from '@/services/footballApiService'
import { listTrainingSessions, type CoachTrainingSession } from '@/services/coachService'
import { getWeekDates, shiftWeeks } from '@/features/coaches/trainingWeek'
import { computeTrainingInsights } from '@/features/coaches/trainingInsights'
import { TYPE_META } from '@/features/coaches/trainingConstants'
import CoachTrainingInsightsBar from './CoachTrainingInsightsBar'
import CoachTrainingDayPanel from './CoachTrainingDayPanel'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import type { AgencyFixture } from '@/types/footballApi'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGE_LOCALES } from '@/constants/translations'

// Nombres de día vía Intl según el idioma activo, no un array fijo en español —
// 2 de enero de 2023 fue un lunes, se usa solo como semana de referencia.
function getDayLabels(locale: string): string[] {
  const base = new Date(2023, 0, 2)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d)
  })
}

function parseArDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function formatSessionDate(sessionDate: string, locale: string): string {
  const [y, m, d] = sessionDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export default function CoachTrainingTab({ coach }: { coach: AgencyCoach }) {
  const { t, language } = useLanguage()
  const locale = LANGUAGE_LOCALES[language]
  const dayLabels = useMemo(() => getDayLabels(locale), [locale])
  const [sessions, setSessions] = useState<CoachTrainingSession[] | null>(null)
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)
  const todayKey = useMemo(() => toArDateKey(new Date()), [])
  const [referenceDate, setReferenceDate] = useState(todayKey)
  const [selectedDate, setSelectedDate] = useState(todayKey)

  async function reload() {
    setSessions(await listTrainingSessions(coach.key))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.key])

  useEffect(() => {
    if (!coach.apiTeamId) {
      setFixtures([])
      return
    }
    let active = true
    fetchTeamFixtures(coach.apiTeamId).then(f => {
      if (active) setFixtures(f)
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId])

  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate])

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CoachTrainingSession[]>()
    if (!sessions) return map
    for (const s of sessions) {
      const arr = map.get(s.session_date) ?? []
      arr.push(s)
      map.set(s.session_date, arr)
    }
    return map
  }, [sessions])

  const fixtureDatesInWeek = useMemo(() => {
    const set = new Set<string>()
    if (!fixtures) return set
    for (const f of fixtures) {
      const key = toArDateKey(f.date)
      if (weekDates.includes(key)) set.add(key)
    }
    return set
  }, [fixtures, weekDates])

  const insights = useMemo(() => {
    if (!sessions) return null
    return computeTrainingInsights(sessions, todayKey)
  }, [sessions, todayKey])

  if (sessions === null || fixtures === null) return <LoadingSpinner message={t('trainingTab.cargando')} />

  const goPrevWeek = () => {
    const key = shiftWeeks(weekDates[0], -1)
    setReferenceDate(key)
    setSelectedDate(key)
  }

  const goNextWeek = () => {
    const key = shiftWeeks(weekDates[0], 1)
    setReferenceDate(key)
    setSelectedDate(key)
  }

  const goToday = () => {
    setReferenceDate(todayKey)
    setSelectedDate(todayKey)
  }

  const isCurrentWeek = weekDates.includes(todayKey)

  const weekLabel = (() => {
    const first = parseArDateKey(weekDates[0])
    const last = parseArDateKey(weekDates[6])
    const firstLabel = capitalize(first.toLocaleDateString(locale, { day: 'numeric', month: 'short' }))
    const lastLabel = capitalize(last.toLocaleDateString(locale, { day: 'numeric', month: 'short' }))
    return `${firstLabel} - ${lastLabel}`
  })()

  const historySessions = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date))

  return (
    <div className="space-y-5 animate-fade-in">
      {insights && <CoachTrainingInsightsBar insights={insights} />}

      <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goPrevWeek}
            aria-label={t('trainingTab.semanaAnterior')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{weekLabel}</span>
            {!isCurrentWeek && (
              <button type="button" onClick={goToday} className="text-2xs font-semibold text-brand-green hover:underline">
                {t('trainingTab.estaSemana')}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={goNextWeek}
            aria-label={t('trainingTab.semanaSiguiente')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map((dateKey, i) => {
            const isToday = dateKey === todayKey
            const isSelected = dateKey === selectedDate
            const daySessions = sessionsByDate.get(dateKey) ?? []
            const hasMatch = fixtureDatesInWeek.has(dateKey)
            const parsed = parseArDateKey(dateKey)

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDate(dateKey)}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-apple-lg transition-colors duration-150 ease-apple ${
                  isSelected
                    ? 'bg-brand-green text-apple-gray-900'
                    : isToday
                      ? 'bg-brand-green/10 text-brand-green'
                      : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800'
                }`}
              >
                <span className="text-2xs font-semibold uppercase">{dayLabels[i]}</span>
                <span className="text-sm font-bold">{parsed.getDate()}</span>
                <span className="flex items-center gap-0.5 h-2">
                  {daySessions.slice(0, 3).map(s => (
                    <span key={s.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_META[s.type].dotClass}`} />
                  ))}
                  {hasMatch && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900' : 'bg-apple-gray-400'}`} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <CoachTrainingDayPanel key={selectedDate} coachKey={coach.key} dateKey={selectedDate} sessions={sessionsByDate.get(selectedDate) ?? []} onChanged={reload} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-apple-gray-800 dark:text-white">{t('trainingTab.historial')}</h2>
        {historySessions.map(s => {
          const meta = TYPE_META[s.type]
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{s.title}</p>
                <p className="text-xs text-apple-gray-400">
                  {formatSessionDate(s.session_date, locale)} · {t(meta.labelKey)}
                  {s.duration_minutes && ` · ${s.duration_minutes}'`}
                  {s.intensity && ` · ${t('trainingTab.intAbrev').replace('{n}', String(s.intensity))}`}
                </p>
              </div>
              <span className={`text-2xs font-semibold px-2 py-1 rounded-full ${meta.badgeClass} flex-shrink-0`}>{t(meta.labelKey)}</span>
            </div>
          )
        })}
        {historySessions.length === 0 && (
          <div className="flex items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-apple-gray-400 max-w-xs">
              {t('trainingTab.sinEntrenamientos')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
