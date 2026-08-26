import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  agencyPlayerKey,
  fetchClassifications,
  setClassification,
  deleteClassification,
  type AgencyClass,
} from '@/services/agencyClassificationService'
import { CLASS_LABEL_KEY, CLASS_DOT_COLOR } from '@/constants/agencyClassification'
import type { AgencyPlayer } from '@/constants/agencyPlayers'

type ColumnKey = 'none' | AgencyClass

const COLUMNS: { key: ColumnKey; dot: string }[] = [
  { key: 'none', dot: 'bg-apple-gray-400' },
  { key: 'A', dot: CLASS_DOT_COLOR.A },
  { key: 'B', dot: CLASS_DOT_COLOR.B },
  { key: 'C', dot: CLASS_DOT_COLOR.C },
]

const DRAG_THRESHOLD = 6

interface DragPlayer { player: AgencyPlayer; from: ColumnKey }
interface PendingDrag extends DragPlayer { startX: number; startY: number }
interface ActiveDrag extends DragPlayer { x: number; y: number }

function PlayerCard({ player, from, isDragSource, onStartDrag }: {
  player: AgencyPlayer
  from: ColumnKey
  isDragSource: boolean
  onStartDrag: (e: React.PointerEvent, player: AgencyPlayer, from: ColumnKey) => void
}) {
  return (
    <div
      onPointerDown={e => onStartDrag(e, player, from)}
      style={{ touchAction: 'none' }}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white dark:bg-apple-gray-800 border border-apple-gray-200 dark:border-apple-gray-700 cursor-grab active:cursor-grabbing select-none transition-opacity hover:border-brand-green/50 hover:shadow-sm ${isDragSource ? 'opacity-30' : ''}`}
    >
      <PlayerPhoto src={player.image} name={player.fullName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate">{player.fullName}</p>
        <p className="text-2xs text-apple-gray-400 truncate">{player.team || '—'}</p>
      </div>
      <svg className="w-4 h-4 text-apple-gray-300 dark:text-apple-gray-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
      </svg>
    </div>
  )
}

export default function InternalClassificationPage() {
  const { t } = useLanguage()
  const { agencyPlayers, loading: rosterLoading } = useData()
  const { userDisplayName } = useAuth()
  const [classifications, setClassifications] = useState<Map<string, AgencyClass>>(new Map())
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingDrag | null>(null)
  const [dragging, setDragging] = useState<ActiveDrag | null>(null)
  const [savingError, setSavingError] = useState<string | null>(null)

  const zoneRefs = {
    none: useRef<HTMLDivElement>(null),
    A: useRef<HTMLDivElement>(null),
    B: useRef<HTMLDivElement>(null),
    C: useRef<HTMLDivElement>(null),
  }

  useEffect(() => {
    fetchClassifications()
      .then(setClassifications)
      .finally(() => setLoading(false))
  }, [])

  const columns = useMemo(() => {
    const map: Record<ColumnKey, AgencyPlayer[]> = { none: [], A: [], B: [], C: [] }
    for (const p of agencyPlayers) {
      const key = agencyPlayerKey(p.fullName)
      const cls = classifications.get(key)
      map[cls ?? 'none'].push(p)
    }
    return map
  }, [agencyPlayers, classifications])

  const handleStartDrag = (e: React.PointerEvent, player: AgencyPlayer, from: ColumnKey) => {
    e.preventDefault()
    setPending({ player, from, startX: e.clientX, startY: e.clientY })
  }

  const handleDrop = async (player: AgencyPlayer, target: ColumnKey) => {
    const key = agencyPlayerKey(player.fullName)
    const prev = classifications
    const next = new Map(prev)
    setSavingError(null)

    if (target === 'none') {
      next.delete(key)
      setClassifications(next)
      const ok = await deleteClassification(key)
      if (!ok) {
        setClassifications(prev)
        setSavingError(`No se pudo quitar la clasificación de ${player.fullName}. Probá de nuevo.`)
      }
      return
    }

    next.set(key, target)
    setClassifications(next)
    const ok = await setClassification(key, player.fullName, target, userDisplayName || null)
    if (!ok) {
      setClassifications(prev)
      setSavingError(`No se pudo guardar la clasificación de ${player.fullName}. Probá de nuevo.`)
    }
  }

  useEffect(() => {
    if (!pending && !dragging) return

    const hitTest = (x: number, y: number): ColumnKey | null => {
      for (const key of ['A', 'B', 'C', 'none'] as ColumnKey[]) {
        const el = zoneRefs[key].current
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return key
      }
      return null
    }

    const handleMove = (e: PointerEvent) => {
      if (dragging) {
        setDragging(d => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
        return
      }
      if (pending) {
        const dx = e.clientX - pending.startX
        const dy = e.clientY - pending.startY
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          setDragging({ player: pending.player, from: pending.from, x: e.clientX, y: e.clientY })
          setPending(null)
        }
      }
    }

    const handleUp = (e: PointerEvent) => {
      if (dragging) {
        const target = hitTest(e.clientX, e.clientY)
        if (target && target !== dragging.from) void handleDrop(dragging.player, target)
      }
      setDragging(null)
      setPending(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, dragging, classifications])

  if (rosterLoading || loading) return <LoadingSpinner fullScreen message="Cargando plantel..." />

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight">
          Clasificación Interna
        </h1>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 mt-0.5">
          Arrastrá a cada jugador de la agencia a su clase — se refleja en Scout Interno y en su ficha.
        </p>
      </div>

      {savingError && (
        <div className="mb-4 rounded-apple bg-red-500/10 text-red-500 px-4 py-3 text-sm">{savingError}</div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
        {COLUMNS.map(({ key, dot }) => {
          const players = columns[key]
          return (
            <div
              key={key}
              ref={zoneRefs[key]}
              className={`flex-shrink-0 w-[85vw] sm:w-auto snap-center bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-2xl border-2 p-3 flex flex-col transition-colors ${
                dragging && key !== dragging.from
                  ? 'border-brand-green/60 border-dashed'
                  : 'border-apple-gray-200 dark:border-apple-gray-700 border-solid'
              }`}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                <h3 className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-200">
                  {key === 'none' ? 'Sin clasificar' : t(CLASS_LABEL_KEY[key])}
                </h3>
                <span className="text-2xs text-apple-gray-400 ml-auto">{players.length}</span>
              </div>

              <div className="space-y-2 min-h-[120px] max-h-[60vh] overflow-y-auto pr-0.5">
                {players.length === 0 ? (
                  <p className="text-xs text-apple-gray-400 text-center py-6 px-2">
                    {key === 'none' ? 'Todos ya tienen clase asignada.' : 'Arrastrá jugadores acá.'}
                  </p>
                ) : (
                  players.map(p => (
                    <PlayerCard
                      key={p.fullName}
                      player={p}
                      from={key}
                      isDragSource={dragging?.player.fullName === p.fullName}
                      onStartDrag={handleStartDrag}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {dragging && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: dragging.x, top: dragging.y, transform: 'translate(-50%, -50%)' }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white dark:bg-apple-gray-800 shadow-2xl border-2 border-brand-green scale-105">
            <PlayerPhoto src={dragging.player.image} name={dragging.player.fullName} size="sm" />
            <span className="text-sm font-medium text-apple-gray-800 dark:text-white whitespace-nowrap">
              {dragging.player.fullName}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
