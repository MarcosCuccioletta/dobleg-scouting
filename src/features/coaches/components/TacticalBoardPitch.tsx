import { useRef, useState } from 'react'
import { clampPercent, pointsToPathD, arrowHeadPoints, toScreenPoint, fromScreenPoint, type PitchOrientation } from '@/features/coaches/boardGeometry'
import { COLOR_META } from '@/features/coaches/tacticalBoardConstants'
import type { BoardMarker, BoardAnnotation, AnnotationColor, ZoneShape } from '@/services/tacticalBoardService'

export type BoardTool = 'mover' | 'lapiz' | 'flecha' | 'zona'

interface Point {
  x: number
  y: number
}

function uid(): string {
  return crypto.randomUUID()
}

function BallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="white" stroke="#111827" strokeWidth="1.5" />
      <polygon points="12,7 15.5,9.5 14.2,13.5 9.8,13.5 8.5,9.5" fill="#111827" />
      <path d="M12 7V4.5M8.5 9.5 5.7 7.5M15.5 9.5l2.8-2M9.8 13.5l-1.6 3.8M14.2 13.5l1.6 3.8" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export default function TacticalBoardPitch({
  markers,
  annotations,
  tool,
  color,
  zoneShape,
  onMarkersChange,
  onAnnotationsChange,
  orientation = 'vertical',
  onChangePlayerClick,
}: {
  markers: BoardMarker[]
  annotations: BoardAnnotation[]
  tool: BoardTool
  color: AnnotationColor
  zoneShape: ZoneShape
  onMarkersChange: (markers: BoardMarker[]) => void
  onAnnotationsChange: (annotations: BoardAnnotation[]) => void
  orientation?: PitchOrientation
  onChangePlayerClick?: (markerId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<Point[] | null>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null)

  // Devuelve coordenadas en espacio de DATOS (el mismo sistema que markers/annotations,
  // invariante a la orientacion) -- convierte la posicion tocada en pantalla con
  // fromScreenPoint antes de devolverla.
  function pointFromEvent(e: React.PointerEvent): Point {
    const rect = containerRef.current!.getBoundingClientRect()
    const screen = {
      x: clampPercent(((e.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((e.clientY - rect.top) / rect.height) * 100),
    }
    return fromScreenPoint(screen, orientation)
  }

  function handleMarkerPointerDown(e: React.PointerEvent<HTMLDivElement>, marker: BoardMarker) {
    if (tool !== 'mover') return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingMarkerId(marker.id)
    setSelectedMarkerId(marker.id)
  }

  function handleMarkerPointerMove(e: React.PointerEvent<HTMLDivElement>, marker: BoardMarker) {
    if (draggingMarkerId !== marker.id) return
    const p = pointFromEvent(e)
    onMarkersChange(markers.map(m => (m.id === marker.id ? { ...m, x: p.x, y: p.y } : m)))
  }

  function handleMarkerPointerUp(e: React.PointerEvent<HTMLDivElement>, marker: BoardMarker) {
    if (draggingMarkerId !== marker.id) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
    setDraggingMarkerId(null)
  }

  function handleMarkerPointerCancel(e: React.PointerEvent<HTMLDivElement>, marker: BoardMarker) {
    if (draggingMarkerId !== marker.id) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
    setDraggingMarkerId(null)
  }

  function handleDeleteSelected() {
    if (!selectedMarkerId) return
    onMarkersChange(markers.filter(m => m.id !== selectedMarkerId))
    setSelectedMarkerId(null)
  }

  function handleContainerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === 'mover') {
      setSelectedMarkerId(null)
      return
    }
    const p = pointFromEvent(e)

    containerRef.current!.setPointerCapture(e.pointerId)

    if (tool === 'lapiz') {
      setFreehandPoints([p])
    } else if (tool === 'flecha' || tool === 'zona') {
      setDragStart(p)
      setDragCurrent(p)
    }
  }

  function handleContainerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === 'lapiz' && freehandPoints) {
      setFreehandPoints([...freehandPoints, pointFromEvent(e)])
    } else if ((tool === 'flecha' || tool === 'zona') && dragStart) {
      setDragCurrent(pointFromEvent(e))
    }
  }

  function handleContainerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === 'lapiz' && freehandPoints) {
      if (freehandPoints.length > 1) {
        onAnnotationsChange([...annotations, { id: uid(), kind: 'freehand', color, points: freehandPoints }])
      }
      setFreehandPoints(null)
    } else if (tool === 'flecha' && dragStart && dragCurrent) {
      // Guard: un toque suelto sin arrastre real no debe crear una flecha degenerada (largo ~0).
      if (Math.abs(dragCurrent.x - dragStart.x) > 1 || Math.abs(dragCurrent.y - dragStart.y) > 1) {
        onAnnotationsChange([
          ...annotations,
          { id: uid(), kind: 'arrow', color, x1: dragStart.x, y1: dragStart.y, x2: dragCurrent.x, y2: dragCurrent.y },
        ])
      }
      setDragStart(null)
      setDragCurrent(null)
    } else if (tool === 'zona' && dragStart && dragCurrent) {
      // Guard: idem flecha, evita zonas de radio ~0 en la pila de Deshacer.
      if (Math.abs(dragCurrent.x - dragStart.x) > 1 || Math.abs(dragCurrent.y - dragStart.y) > 1) {
        onAnnotationsChange([
          ...annotations,
          { id: uid(), kind: 'zone', color, x1: dragStart.x, y1: dragStart.y, x2: dragCurrent.x, y2: dragCurrent.y, shape: zoneShape },
        ])
      }
      setDragStart(null)
      setDragCurrent(null)
    }
    try {
      containerRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
  }

  function handleContainerPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    // Un cancel (multi-touch, gesto de "atras" del sistema, pull-to-refresh, etc.) descarta
    // el gesto en progreso -- no confirma ninguna anotacion ni mueve nada.
    // OJO: no tocar textInput/textValue aca. Este handler tambien esta cableado a
    // onLostPointerCapture, que en Chrome dispara DESPUES de pointerup apenas hubo un minimo
    // movimiento del puntero entre el down y el up -- practicamente cualquier toque real. El modo
    // texto ya no captura el puntero (ver handleContainerPointerDown), y su ciclo de vida lo maneja
    // commitText (via onBlur/Enter del input), no un gesto de puntero.
    setFreehandPoints(null)
    setDragStart(null)
    setDragCurrent(null)
    try {
      containerRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
  }

  return (
    <div
      className={`bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl p-4 sm:p-6 relative w-full shadow-2xl overflow-hidden select-none touch-none ${
        orientation === 'horizontal' ? 'aspect-[3/2]' : 'aspect-[3/4] max-w-xl mx-auto'
      }`}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        onLostPointerCapture={handleContainerPointerCancel}
      >
        {/* Lineas de campo. Vertical: mismo dibujo que /formacion (arco propio abajo, viewBox
            100x130). Horizontal: la misma cancha rotada 90° (arco propio a la derecha, viewBox
            150x100 -- 3:2 igual que el aspect-ratio del contenedor, para que no se deforme). */}
        {orientation === 'vertical' ? (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
            <rect x="2" y="2" width="96" height="126" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
            <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <circle cx="50" cy="65" r="1" fill="rgba(255,255,255,0.5)" />
            <line x1="2" y1="65" x2="98" y2="65" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="20" y="2" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="30" y="2" width="40" height="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="20" y="108" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="30" y="120" width="40" height="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <path d="M 2 6 Q 2 2 6 2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
            <path d="M 94 2 Q 98 2 98 6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
            <path d="M 2 124 Q 2 128 6 128" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
            <path d="M 94 128 Q 98 128 98 124" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          </svg>
        ) : (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 150 100" preserveAspectRatio="none">
            <rect x="2" y="2" width="146" height="96" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
            <circle cx="75" cy="50" r="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <circle cx="75" cy="50" r="1" fill="rgba(255,255,255,0.5)" />
            <line x1="75" y1="2" x2="75" y2="98" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="2" y="20" width="20" height="60" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="2" y="30" width="8" height="40" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="128" y="20" width="20" height="60" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <rect x="140" y="30" width="8" height="40" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
            <path d="M 2 6 Q 2 2 6 2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
            <path d="M 144 2 Q 148 2 148 6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
            <path d="M 2 94 Q 2 98 6 98" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
            <path d="M 144 98 Q 148 98 148 94" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          </svg>
        )}

        {/* Anotaciones: lapiz, flechas, zonas, texto -- viewBox 0-100 x 0-100 para que coincida
            con el sistema de coordenadas de pointFromEvent (porcentaje de ancho/alto real) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {annotations.map(a => {
            if (a.kind === 'freehand') {
              return (
                <path
                  key={a.id}
                  d={pointsToPathD(a.points.map(pt => toScreenPoint(pt, orientation)))}
                  fill="none"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            }
            if (a.kind === 'arrow') {
              const p1 = toScreenPoint({ x: a.x1, y: a.y1 }, orientation)
              const p2 = toScreenPoint({ x: a.x2, y: a.y2 }, orientation)
              const head = arrowHeadPoints(p1.x, p1.y, p2.x, p2.y, 3)
              return (
                <g key={a.id}>
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={COLOR_META[a.color].hex} strokeWidth="0.8" />
                  <polygon points={head.map(p => `${p.x},${p.y}`).join(' ')} fill={COLOR_META[a.color].hex} />
                </g>
              )
            }
            if (a.kind === 'zone') {
              const p1 = toScreenPoint({ x: a.x1, y: a.y1 }, orientation)
              const p2 = toScreenPoint({ x: a.x2, y: a.y2 }, orientation)
              return a.shape === 'cuadrado' ? (
                <rect
                  key={a.id}
                  x={Math.min(p1.x, p2.x)}
                  y={Math.min(p1.y, p2.y)}
                  width={Math.abs(p2.x - p1.x)}
                  height={Math.abs(p2.y - p1.y)}
                  fill={COLOR_META[a.color].hex}
                  fillOpacity="0.25"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="0.5"
                />
              ) : (
                <ellipse
                  key={a.id}
                  cx={(p1.x + p2.x) / 2}
                  cy={(p1.y + p2.y) / 2}
                  rx={Math.abs(p2.x - p1.x) / 2}
                  ry={Math.abs(p2.y - p1.y) / 2}
                  fill={COLOR_META[a.color].hex}
                  fillOpacity="0.25"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="0.5"
                />
              )
            }
            const p = toScreenPoint({ x: a.x, y: a.y }, orientation)
            return (
              <text key={a.id} x={p.x} y={p.y} fill={COLOR_META[a.color].hex} fontSize="4" fontWeight="700" dominantBaseline="middle">
                {a.text}
              </text>
            )
          })}

          {/* Trazo/figura en progreso (mientras se arrastra) */}
          {freehandPoints && (
            <path
              d={pointsToPathD(freehandPoints.map(pt => toScreenPoint(pt, orientation)))}
              fill="none"
              stroke={COLOR_META[color].hex}
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {dragStart && dragCurrent && tool === 'flecha' && (() => {
            const p1 = toScreenPoint(dragStart, orientation)
            const p2 = toScreenPoint(dragCurrent, orientation)
            return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={COLOR_META[color].hex} strokeWidth="0.8" strokeDasharray="1.5" />
          })()}
          {dragStart && dragCurrent && tool === 'zona' && (() => {
            const p1 = toScreenPoint(dragStart, orientation)
            const p2 = toScreenPoint(dragCurrent, orientation)
            return zoneShape === 'cuadrado' ? (
              <rect
                x={Math.min(p1.x, p2.x)}
                y={Math.min(p1.y, p2.y)}
                width={Math.abs(p2.x - p1.x)}
                height={Math.abs(p2.y - p1.y)}
                fill={COLOR_META[color].hex}
                fillOpacity="0.25"
                stroke={COLOR_META[color].hex}
                strokeWidth="0.5"
                strokeDasharray="1.5"
              />
            ) : (
              <ellipse
                cx={(p1.x + p2.x) / 2}
                cy={(p1.y + p2.y) / 2}
                rx={Math.abs(p2.x - p1.x) / 2}
                ry={Math.abs(p2.y - p1.y) / 2}
                fill={COLOR_META[color].hex}
                fillOpacity="0.25"
                stroke={COLOR_META[color].hex}
                strokeWidth="0.5"
                strokeDasharray="1.5"
              />
            )
          })()}
        </svg>

        {/* Fichas */}
        {markers.map(marker => {
          const isSelected = selectedMarkerId === marker.id
          const bg =
            marker.kind === 'ball'
              ? 'bg-white'
              : marker.team === 'rival'
                ? 'bg-red-500 text-white'
                : 'bg-white text-apple-gray-900'
          const screen = toScreenPoint(marker, orientation)
          return (
            <div
              key={marker.id}
              onPointerDown={e => handleMarkerPointerDown(e, marker)}
              onPointerMove={e => handleMarkerPointerMove(e, marker)}
              onPointerUp={e => handleMarkerPointerUp(e, marker)}
              onPointerCancel={e => handleMarkerPointerCancel(e, marker)}
              onLostPointerCapture={e => handleMarkerPointerCancel(e, marker)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg text-xs font-bold ${bg} ${
                isSelected ? 'ring-4 ring-brand-green' : ''
              } ${tool === 'mover' ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ left: `${screen.x}%`, top: `${screen.y}%` }}
            >
              {marker.kind === 'ball' ? <BallIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : marker.label}
            </div>
          )
        })}
      </div>

      {selectedMarkerId && tool === 'mover' && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          {onChangePlayerClick && markers.find(m => m.id === selectedMarkerId)?.team === 'propio' && markers.find(m => m.id === selectedMarkerId)?.kind !== 'ball' && (
            <button
              type="button"
              onClick={() => onChangePlayerClick(selectedMarkerId)}
              className="min-h-[36px] px-3 rounded-full bg-white text-apple-gray-900 text-xs font-semibold shadow-lg"
            >
              Cambiar jugador
            </button>
          )}
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="min-h-[36px] px-3 rounded-full bg-red-500 text-white text-xs font-semibold shadow-lg"
          >
            Eliminar ficha
          </button>
        </div>
      )}
    </div>
  )
}
