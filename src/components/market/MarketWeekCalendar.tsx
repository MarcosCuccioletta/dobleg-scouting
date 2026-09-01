import { useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGE_LOCALES } from '@/constants/translations'

export interface CalendarEntry {
  id: number
  date: string
  title: string
  subtitle: string
}

/**
 * Semana de lunes a domingo, navegable, con las entradas de "volver a
 * hablar" de esa semana agrupadas por día. Vive debajo de cada lista
 * (Negociaciones / Búsquedas) mostrando solo lo de esa misma lista — así no
 * hace falta cambiar de pestaña al hacer click, `onSelect` solo scrollea
 * dentro de la lista que ya está en pantalla.
 *
 * Las fechas se arman con componentes locales (no `new Date(iso)` / getters
 * UTC), mismo motivo documentado en `marketAlerts.ts`: comparar contra un
 * string 'YYYY-MM-DD' vía UTC corre el calendario un día en Argentina.
 */
function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay() // 0=domingo..6=sábado
  const diff = day === 0 ? -6 : 1 - day
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
}

export default function MarketWeekCalendar({
  entries,
  weekOffset,
  onWeekOffsetChange,
  onSelect,
}: {
  entries: CalendarEntry[]
  weekOffset: number
  onWeekOffsetChange: (offset: number) => void
  onSelect: (id: number) => void
}) {
  const { t, language } = useLanguage()
  const locale = LANGUAGE_LOCALES[language]
  const [today] = useState(() => new Date())
  const todayISO = toLocalISODate(today)

  const monday = startOfWeekMonday(new Date(today.getFullYear(), today.getMonth(), today.getDate() + weekOffset * 7))
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))

  const entriesByDate = new Map<string, CalendarEntry[]>()
  for (const entry of entries) {
    const list = entriesByDate.get(entry.date) ?? []
    list.push(entry)
    entriesByDate.set(entry.date, list)
  }

  const rangeLabel = `${days[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`
  const hasAnyEntry = entries.some(e => days.some(d => toLocalISODate(d) === e.date))

  return (
    <div className="mt-6 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onWeekOffsetChange(weekOffset - 1)}
            aria-label={t('mercado.semanaAnterior')}
            className="p-1.5 rounded-lg text-apple-gray-400 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700/60 hover:text-apple-gray-700 dark:hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => onWeekOffsetChange(weekOffset + 1)}
            aria-label={t('mercado.semanaSiguiente')}
            className="p-1.5 rounded-lg text-apple-gray-400 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700/60 hover:text-apple-gray-700 dark:hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <span className="text-sm font-semibold text-apple-gray-700 dark:text-white ml-1 capitalize">{rangeLabel}</span>
        </div>
        {weekOffset !== 0 && (
          <button
            onClick={() => onWeekOffsetChange(0)}
            className="text-xs font-medium text-brand-green hover:text-emerald-600"
          >
            {t('mercado.hoy')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map(day => {
          const iso = toLocalISODate(day)
          const isToday = iso === todayISO
          const isPast = iso < todayISO
          const dayEntries = entriesByDate.get(iso) ?? []
          return (
            <div
              key={iso}
              className={`rounded-lg p-2 min-h-[7rem] sm:min-h-[9rem] ${isToday ? 'bg-brand-green/10 ring-1 ring-brand-green/40' : 'bg-apple-gray-50 dark:bg-apple-gray-800/50'}`}
            >
              <p className={`text-2xs font-semibold uppercase tracking-wide mb-1.5 ${isToday ? 'text-brand-green' : 'text-apple-gray-400'}`}>
                {day.toLocaleDateString(locale, { weekday: 'short' })} {day.getDate()}
              </p>
              <div className="space-y-1.5">
                {dayEntries.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => onSelect(entry.id)}
                    className="w-full flex items-start gap-1.5 px-1.5 py-1.5 rounded-md bg-white dark:bg-apple-gray-700/60 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 text-left transition-colors"
                  >
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPast ? 'bg-red-500' : isToday ? 'bg-brand-green' : 'bg-amber-500'}`} />
                    <span className="min-w-0">
                      <span className="block text-2xs font-medium text-apple-gray-700 dark:text-apple-gray-200 leading-snug break-words">{entry.title}</span>
                      {entry.subtitle && <span className="block text-2xs text-apple-gray-400 leading-snug break-words">{entry.subtitle}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {!hasAnyEntry && (
        <p className="text-xs text-apple-gray-400 text-center mt-3">{t('mercado.sinFechasSemana')}</p>
      )}
    </div>
  )
}
