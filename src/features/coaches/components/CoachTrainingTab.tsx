import { useEffect, useState, type ReactNode } from 'react'
import {
  listTrainingSessions,
  upsertTrainingSession,
  deleteTrainingSession,
  type CoachTrainingSession,
  type TrainingSessionType,
} from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const TYPE_META: Record<TrainingSessionType, { label: string; badgeClass: string }> = {
  tactico: { label: 'Táctico', badgeClass: 'bg-blue-500/10 text-blue-500' },
  fisico: { label: 'Físico', badgeClass: 'bg-orange-500/10 text-orange-500' },
  recuperacion: { label: 'Recuperación', badgeClass: 'bg-teal-500/10 text-teal-500' },
  set_pieces: { label: 'Pelota parada', badgeClass: 'bg-purple-500/10 text-purple-500' },
  pre_rival: { label: 'Pre-rival', badgeClass: 'bg-red-500/10 text-red-500' },
  otro: { label: 'Otro', badgeClass: 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400' },
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6.75 6.75v10.5M17.25 6.75v10.5M3 9.75v4.5M21 9.75v4.5M6.75 12h10.5"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M6 7.5h12M9.75 7.5V6a1.5 1.5 0 011.5-1.5h1.5A1.5 1.5 0 0114.25 6v1.5m-7.5 0 .621 10.556A2.25 2.25 0 009.615 19.5h4.77a2.25 2.25 0 002.244-2.444L17.25 7.5m-9 3.75v5.25m4.5-5.25v5.25"
      />
    </svg>
  )
}

/** Etiqueta de fecha corta, evitando el corrimiento de huso horario que produce
 *  `new Date('YYYY-MM-DD')` (se interpreta como medianoche UTC). */
function formatSessionDate(sessionDate: string): string {
  const [y, m, d] = sessionDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full min-h-[44px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm text-apple-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition-colors'

export default function CoachTrainingTab({ coach }: { coach: AgencyCoach }) {
  const [sessions, setSessions] = useState<CoachTrainingSession[] | null>(null)
  const [date, setDate] = useState('')
  const [type, setType] = useState<TrainingSessionType>('tactico')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function reload() {
    setSessions(await listTrainingSessions(coach.key))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.key])

  async function handleAdd() {
    if (!date || !title.trim() || submitting) return
    setSubmitting(true)
    try {
      await upsertTrainingSession({ coach_key: coach.key, session_date: date, type, title: title.trim() })
      setDate('')
      setType('tactico')
      setTitle('')
      await reload()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(session: CoachTrainingSession) {
    const ok = window.confirm(`¿Borrar la sesión "${session.title}" del ${formatSessionDate(session.session_date)}?`)
    if (!ok) return
    setDeletingId(session.id)
    try {
      await deleteTrainingSession(session.id)
      await reload()
    } finally {
      setDeletingId(null)
    }
  }

  if (sessions === null) return <LoadingSpinner message="Cargando entrenamientos..." />

  const canSubmit = Boolean(date && title.trim()) && !submitting

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Nueva sesión</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,150px)_minmax(0,170px)_1fr_auto] gap-3">
          <Field label="Fecha" htmlFor="training-date">
            <input
              id="training-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Tipo" htmlFor="training-type">
            <select
              id="training-type"
              value={type}
              onChange={e => setType(e.target.value as TrainingSessionType)}
              className={inputClass}
            >
              {Object.entries(TYPE_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título" htmlFor="training-title" className="sm:col-span-2 lg:col-span-1">
            <input
              id="training-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Ej: Trabajo de definición"
              className={inputClass}
            />
          </Field>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              onClick={handleAdd}
              disabled={!canSubmit}
              className="w-full lg:w-auto min-h-[44px] px-5 rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold transition-transform duration-200 ease-apple hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
            >
              {submitting ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {sessions.map(s => {
          const meta = TYPE_META[s.type]
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.badgeClass}`}>
                  <DumbbellIcon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{s.title}</p>
                  <p className="text-xs text-apple-gray-400">
                    {formatSessionDate(s.session_date)} · {meta.label}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(s)}
                disabled={deletingId === s.id}
                aria-label={`Borrar sesión ${s.title}`}
                className="flex-shrink-0 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-apple-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          )
        })}
        {sessions.length === 0 && (
          <div className="flex items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-apple-gray-400 max-w-xs">
              Sin entrenamientos agendados. Sumá la primera sesión con el formulario de arriba.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
