import { useRef, useState } from 'react'
import { dateToPercent, percentToDate } from '@/features/coaches/videoAnalysis/dateRangeSlider'
import { clampPercent } from '@/features/coaches/boardGeometry'

type Handle = 'from' | 'to'

export default function VideoAnalysisDateRangeSlider({
  minDate,
  maxDate,
  fromDate,
  toDate,
  onChange,
}: {
  minDate: string
  maxDate: string
  fromDate: string
  toDate: string
  onChange: (from: string, to: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<Handle | null>(null)

  const fromPct = dateToPercent(fromDate, minDate, maxDate)
  const toPct = dateToPercent(toDate, minDate, maxDate)

  function percentFromEvent(e: React.PointerEvent): number {
    const rect = trackRef.current!.getBoundingClientRect()
    return clampPercent(((e.clientX - rect.left) / rect.width) * 100)
  }

  function handleMove(e: React.PointerEvent) {
    if (!dragging) return
    const pct = percentFromEvent(e)
    const date = percentToDate(pct, minDate, maxDate)
    if (dragging === 'from') {
      onChange(date <= toDate ? date : toDate, toDate)
    } else {
      onChange(fromDate, date >= fromDate ? date : fromDate)
    }
  }

  function startDrag(handle: Handle) {
    return (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(handle)
    }
  }

  function endDrag(e: React.PointerEvent) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
    setDragging(null)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-2xs text-apple-gray-400 flex-shrink-0">{minDate}</span>
      <div
        ref={trackRef}
        className="relative flex-1 h-1 bg-apple-gray-200 dark:bg-apple-gray-700 rounded-full touch-none select-none"
        onPointerMove={handleMove}
      >
        <div
          className="absolute h-full bg-brand-green rounded-full"
          style={{ left: `${fromPct}%`, right: `${100 - toPct}%` }}
        />
        <div
          onPointerDown={startDrag('from')}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-green border-2 border-white dark:border-apple-gray-900 shadow cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ left: `${fromPct}%` }}
        />
        <div
          onPointerDown={startDrag('to')}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-green border-2 border-white dark:border-apple-gray-900 shadow cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ left: `${toPct}%` }}
        />
      </div>
      <span className="text-2xs text-apple-gray-400 flex-shrink-0">{maxDate}</span>
    </div>
  )
}
