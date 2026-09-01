import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '@/context/LanguageContext'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import ClubTransferBadge from './ClubTransferBadge'
import { NEGOTIATION_STATUS_ORDER, NEGOTIATION_STATUS_LABEL_KEY, NEGOTIATION_STATUS_COLOR, NEGOTIATION_STATUS_ACCENT_TOP } from './marketLabels'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
import { useLinkedPlayerAge } from '@/hooks/useLinkedPlayerAge'
import { updateNegotiationStatus } from '@/services/marketService'
import type { Negotiation, NegotiationStatus } from '@/types/market'

const DRAG_THRESHOLD_PX = 6

interface DragState {
  id: number
  startX: number
  startY: number
  x: number
  y: number
  offsetX: number
  offsetY: number
  width: number
  moved: boolean
}

function CardContent({ n, overdue }: { n: Negotiation; overdue: boolean }) {
  const { t } = useLanguage()
  const age = useLinkedPlayerAge(n.player_api_id)
  return (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        <ClubTransferBadge
          currentLogo={n.current_team_logo}
          currentName={n.current_team_name}
          targetLogo={n.team_logo}
          targetName={n.team_name}
          size="w-5 h-5"
        />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <PlayerPhoto src={buildPlayerPhotoUrl(n.player_api_id)} name={n.player_name} size="xs" />
        <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate min-w-0">
          {n.player_name}
          {age != null && <span className="font-normal text-apple-gray-400">, {age} {t('externo.anios')}</span>}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="text-2xs text-apple-gray-400 truncate min-w-0">{n.assigned_to_name || t('mercado.sinAsignar')}</span>
        {n.next_followup_date && (
          <span className={`text-2xs tabular-nums flex-shrink-0 ${overdue ? 'text-red-500 font-semibold' : 'text-apple-gray-400'}`}>
            {n.next_followup_date}
          </span>
        )}
      </div>
    </>
  )
}

/**
 * Vista alternativa a la lista, para ver el embudo completo de un vistazo.
 * Misma info que ya se ve en la fila de la lista (foto, jugador, club actual
 * → destino, responsable, seguimiento) — el tablero no reemplaza a la lista,
 * la reordena por estado.
 *
 * El arrastre es con Pointer Events (no HTML5 drag-and-drop nativo) a
 * propósito: el `draggable` nativo no dispara nada por touch, así que en
 * mobile el tablero hubiera quedado de solo lectura. Pointer Events unifica
 * mouse/touch/lápiz en el mismo código — con `setPointerCapture` la tarjeta
 * sigue recibiendo los eventos del dedo aunque se mueva fuera de sus límites,
 * y un "fantasma" (portal, fixed) sigue al dedo mientras se arrastra.
 *
 * Un movimiento menor a `DRAG_THRESHOLD_PX` se toma como tap (abre la fila
 * en la Lista), no como arrastre — si no, tocar una tarjeta sin querer
 * moverla nunca podría "solo mirarla".
 */
export default function NegotiationBoard({
  negotiations,
  overdueIds,
  onUpdated,
  onNeedMightHaveChanged,
  onSelect,
}: {
  negotiations: Negotiation[]
  overdueIds: Set<number>
  onUpdated: (n: Negotiation) => void
  onNeedMightHaveChanged?: () => void
  onSelect: (id: number) => void
}) {
  const { t } = useLanguage()
  const [dragOverStatus, setDragOverStatus] = useState<NegotiationStatus | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const draggingNegotiation = drag ? negotiations.find(n => n.id === drag.id) ?? null : null

  const handleDrop = async (status: NegotiationStatus, id: number) => {
    const negotiation = negotiations.find(n => n.id === id)
    if (!negotiation || negotiation.status === status) return
    const ok = await updateNegotiationStatus(id, status)
    if (ok) {
      onUpdated({ ...negotiation, status })
      if (negotiation.need_id) onNeedMightHaveChanged?.()
    }
  }

  const statusAtPoint = (x: number, y: number): NegotiationStatus | null => {
    const el = document.elementFromPoint(x, y)
    const col = el?.closest<HTMLElement>('[data-status]')
    return (col?.dataset.status as NegotiationStatus | undefined) ?? null
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: number) => {
    if (e.button != null && e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({
      id,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      moved: false,
    })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD_PX
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved })
    if (moved) setDragOverStatus(statusAtPoint(e.clientX, e.clientY))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    if (drag.moved) {
      const status = statusAtPoint(e.clientX, e.clientY)
      if (status) handleDrop(status, drag.id)
    } else {
      onSelect(drag.id)
    }
    setDrag(null)
    setDragOverStatus(null)
  }

  const handlePointerCancel = () => {
    setDrag(null)
    setDragOverStatus(null)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {NEGOTIATION_STATUS_ORDER.map(status => {
        const columnNegotiations = negotiations.filter(n => n.status === status)
        const dot = NEGOTIATION_STATUS_COLOR[status].match(/bg-\S+/)?.[0] ?? ''
        return (
          <div
            key={status}
            data-status={status}
            className={`rounded-2xl border p-3 transition-colors ${
              dragOverStatus === status
                ? 'border-brand-green bg-brand-green/5 ring-1 ring-brand-green/30'
                : `border-apple-gray-200 dark:border-apple-gray-700 ${NEGOTIATION_STATUS_ACCENT_TOP[status]}`
            }`}
          >
            <div className="flex items-center gap-1.5 px-0.5 mb-3">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
              <p className="text-xs font-semibold text-apple-gray-700 dark:text-white truncate">{t(NEGOTIATION_STATUS_LABEL_KEY[status])}</p>
              <span className="ml-auto text-2xs font-semibold text-apple-gray-400 bg-white dark:bg-apple-gray-800 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {columnNegotiations.length}
              </span>
            </div>

            <div className="space-y-2 min-h-[4rem]">
              {columnNegotiations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-apple-gray-200 dark:border-apple-gray-700 py-4 text-center">
                  <p className="text-2xs text-apple-gray-300 dark:text-apple-gray-600">{t('mercado.soltarAca')}</p>
                </div>
              ) : columnNegotiations.map(n => (
                <div
                  key={n.id}
                  onPointerDown={e => handlePointerDown(e, n.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  className={`bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-2.5 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing select-none touch-none transition-[opacity,box-shadow] ${drag?.id === n.id && drag.moved ? 'opacity-40' : 'opacity-100'}`}
                >
                  <CardContent n={n} overdue={overdueIds.has(n.id)} />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {drag?.moved && draggingNegotiation && createPortal(
        <div
          style={{ position: 'fixed', left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.width }}
          className="z-50 pointer-events-none rotate-2 bg-white dark:bg-apple-gray-800 rounded-xl border border-brand-green shadow-apple-lg dark:shadow-apple-dark-md p-2.5"
        >
          <CardContent n={draggingNegotiation} overdue={overdueIds.has(draggingNegotiation.id)} />
        </div>,
        document.body,
      )}
    </div>
  )
}
