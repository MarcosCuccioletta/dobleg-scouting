import { useEffect, useState } from 'react'
import { fetchTeamFixtures } from '@/services/footballApiService'
import { getMatchNote, upsertMatchNote } from '@/services/coachService'
import { isMatchFinished } from '@/utils/coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type SaveStatus = 'idle' | 'saving' | 'saved'

/** Etiqueta de fecha corta, evitando el corrimiento de huso horario de `new Date(iso)`
 *  (mismo criterio que CoachCalendarTab/CoachTrainingTab). */
function formatMatchDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

function NoteRow({ coach, fixture }: { coach: AgencyCoach; fixture: AgencyFixture }) {
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    let active = true
    getMatchNote(coach.key, fixture.fixtureId).then(n => {
      if (!active) return
      setNote(n ?? '')
      setSavedNote(n ?? '')
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [coach.key, fixture.fixtureId])

  const dirty = loaded && note !== savedNote
  const canSave = dirty && status !== 'saving'

  async function handleSave() {
    if (!canSave) return
    setStatus('saving')
    await upsertMatchNote(coach.key, fixture.fixtureId, note)
    setSavedNote(note)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 1500)
  }

  const opponent = fixture.isHome ? fixture.awayTeam : fixture.homeTeam
  const buttonLabel = status === 'saving' ? 'Guardando...' : status === 'saved' ? 'Guardado ✓' : 'Guardar nota'

  return (
    <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        {/* Encabezado del partido: fila corta en mobile, columna angosta y fija a la
            izquierda desde sm+ para no competir por ancho con el textarea. */}
        <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1 sm:w-40 lg:w-48 flex-shrink-0 min-w-0">
          <img src={opponent.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">
              {fixture.isHome ? 'vs' : '@'} {opponent.name}
            </p>
            <p className="text-xs text-apple-gray-400">
              {fixture.goalsHome} - {fixture.goalsAway} &middot; {formatMatchDate(fixture.date)}
            </p>
          </div>
        </div>

        <div className="hidden sm:block w-px self-stretch bg-apple-gray-200/60 dark:bg-apple-gray-700/40" />

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {!loaded ? (
            <div className="w-full min-h-[84px] rounded-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 bg-apple-gray-100/60 dark:bg-apple-gray-900/40 animate-pulse-soft" />
          ) : (
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Qué funcionó, qué no, conclusiones para el próximo partido..."
              rows={3}
              className="w-full min-h-[84px] resize-y rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 py-2 text-sm text-apple-gray-800 dark:text-white placeholder:text-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition-colors"
            />
          )}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="min-h-[40px] px-4 rounded-lg bg-brand-green text-apple-gray-900 text-xs font-semibold transition-all duration-200 ease-apple hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CoachNotesTab({ coach }: { coach: AgencyCoach }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)

  useEffect(() => {
    if (!coach.apiTeamId) return
    let active = true
    fetchTeamFixtures(coach.apiTeamId).then(f => {
      if (active) setFixtures(f)
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId])

  if (!coach.apiTeamId) {
    return (
      <div className="flex items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-apple-gray-400 max-w-xs">No hay datos de equipo disponibles para este entrenador todavía.</p>
      </div>
    )
  }

  if (fixtures === null) return <LoadingSpinner message="Cargando partidos..." />

  const played = [...fixtures].filter(f => isMatchFinished(f.statusShort)).sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="space-y-3 animate-fade-in">
      {played.map(f => (
        <NoteRow key={f.fixtureId} coach={coach} fixture={f} />
      ))}
      {played.length === 0 && (
        <div className="flex items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-apple-gray-400 max-w-xs">Sin partidos jugados todavía.</p>
        </div>
      )}
    </div>
  )
}
