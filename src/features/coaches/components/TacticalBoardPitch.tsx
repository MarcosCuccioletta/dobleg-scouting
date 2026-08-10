import { useRef, useState } from 'react'
import { clampPercent, pointsToPathD, arrowHeadPoints } from '@/features/coaches/boardGeometry'
import { COLOR_META } from '@/features/coaches/tacticalBoardConstants'
import type { BoardMarker, BoardAnnotation, AnnotationColor } from '@/services/tacticalBoardService'

export type BoardTool = 'mover' | 'lapiz' | 'flecha' | 'zona' | 'texto'

interface Point {
  x: number
  y: number
}

function uid(): string {
  return crypto.randomUUID()
}

function BallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth={2}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.2l2.7 2-1 3.1H10.3l-1-3.1L12 8.2zM12 8.2V5.3M9.5 9.7L7 8M14.5 9.7L17 8M10.4 12.8l-2 2.7M13.6 12.8l2 2.7M11 15.3l-.6 3M13 15.3l.6 3" />
    </svg>
  )
}

export default function TacticalBoardPitch({
  markers,
  annotations,
  tool,
  color,
  onMarkersChange,
  onAnnotationsChange,
}: {
  markers: BoardMarker[]
  annotations: BoardAnnotation[]
  tool: BoardTool
  color: AnnotationColor
  onMarkersChange: (markers: BoardMarker[]) => void
  onAnnotationsChange: (annotations: BoardAnnotation[]) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<Point[] | null>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null)
  const [textInput, setTextInput] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')

  function pointFromEvent(e: React.PointerEvent): Point {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: clampPercent(((e.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((e.clientY - rect.top) / rect.height) * 100),
    }
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
    e.currentTarget.releasePointerCapture(e.pointerId)
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
    } else if (tool === 'texto') {
      setTextInput(p)
      setTextValue('')
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
      onAnnotationsChange([
        ...annotations,
        { id: uid(), kind: 'arrow', color, x1: dragStart.x, y1: dragStart.y, x2: dragCurrent.x, y2: dragCurrent.y },
      ])
      setDragStart(null)
      setDragCurrent(null)
    } else if (tool === 'zona' && dragStart && dragCurrent) {
      onAnnotationsChange([
        ...annotations,
        { id: uid(), kind: 'zone', color, x1: dragStart.x, y1: dragStart.y, x2: dragCurrent.x, y2: dragCurrent.y },
      ])
      setDragStart(null)
      setDragCurrent(null)
    }
    try {
      containerRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
  }

  function commitText() {
    if (textInput && textValue.trim()) {
      onAnnotationsChange([
        ...annotations,
        { id: uid(), kind: 'text', color, x: textInput.x, y: textInput.y, text: textValue.trim() },
      ])
    }
    setTextInput(null)
    setTextValue('')
  }

  return (
    <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl p-4 sm:p-6 relative aspect-[3/4] w-full max-w-xl mx-auto shadow-2xl overflow-hidden select-none touch-none">
      <div
        ref={containerRef}
        className="absolute inset-0"
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
      >
        {/* Lineas de campo -- mismo dibujo que /formacion */}
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

        {/* Anotaciones: lapiz, flechas, zonas, texto */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
          {annotations.map(a => {
            if (a.kind === 'freehand') {
              return (
                <path
                  key={a.id}
                  d={pointsToPathD(a.points)}
                  fill="none"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            }
            if (a.kind === 'arrow') {
              const head = arrowHeadPoints(a.x1, a.y1, a.x2, a.y2, 3)
              return (
                <g key={a.id}>
                  <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={COLOR_META[a.color].hex} strokeWidth="0.8" />
                  <polygon points={head.map(p => `${p.x},${p.y}`).join(' ')} fill={COLOR_META[a.color].hex} />
                </g>
              )
            }
            if (a.kind === 'zone') {
              const cx = (a.x1 + a.x2) / 2
              const cy = (a.y1 + a.y2) / 2
              const rx = Math.abs(a.x2 - a.x1) / 2
              const ry = Math.abs(a.y2 - a.y1) / 2
              return (
                <ellipse
                  key={a.id}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill={COLOR_META[a.color].hex}
                  fillOpacity="0.25"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="0.5"
                />
              )
            }
            return (
              <text key={a.id} x={a.x} y={a.y} fill={COLOR_META[a.color].hex} fontSize="4" fontWeight="700" dominantBaseline="middle">
                {a.text}
              </text>
            )
          })}

          {/* Trazo/figura en progreso (mientras se arrastra) */}
          {freehandPoints && (
            <path d={pointsToPathD(freehandPoints)} fill="none" stroke={COLOR_META[color].hex} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {dragStart && dragCurrent && tool === 'flecha' && (
            <line x1={dragStart.x} y1={dragStart.y} x2={dragCurrent.x} y2={dragCurrent.y} stroke={COLOR_META[color].hex} strokeWidth="0.8" strokeDasharray="1.5" />
          )}
          {dragStart && dragCurrent && tool === 'zona' && (
            <ellipse
              cx={(dragStart.x + dragCurrent.x) / 2}
              cy={(dragStart.y + dragCurrent.y) / 2}
              rx={Math.abs(dragCurrent.x - dragStart.x) / 2}
              ry={Math.abs(dragCurrent.y - dragStart.y) / 2}
              fill={COLOR_META[color].hex}
              fillOpacity="0.25"
              stroke={COLOR_META[color].hex}
              strokeWidth="0.5"
              strokeDasharray="1.5"
            />
          )}
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
          return (
            <div
              key={marker.id}
              onPointerDown={e => handleMarkerPointerDown(e, marker)}
              onPointerMove={e => handleMarkerPointerMove(e, marker)}
              onPointerUp={e => handleMarkerPointerUp(e, marker)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg text-xs font-bold ${bg} ${
                isSelected ? 'ring-4 ring-brand-green' : ''
              } ${tool === 'mover' ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            >
              {marker.kind === 'ball' ? <BallIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : marker.label}
            </div>
          )
        })}

        {/* Input de texto en progreso */}
        {textInput && (
          <input
            autoFocus
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={e => e.key === 'Enter' && commitText()}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-bold bg-white/90 rounded px-1.5 py-0.5 outline-none"
            style={{ left: `${textInput.x}%`, top: `${textInput.y}%`, width: '80px' }}
            placeholder="Texto..."
          />
        )}
      </div>

      {selectedMarkerId && tool === 'mover' && (
        <button
          type="button"
          onClick={handleDeleteSelected}
          className="absolute top-2 right-2 min-h-[36px] px-3 rounded-full bg-red-500 text-white text-xs font-semibold shadow-lg"
        >
          Eliminar ficha
        </button>
      )}
    </div>
  )
}
