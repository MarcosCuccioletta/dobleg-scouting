import type { ActionPhase } from '@/features/coaches/videoAnalysis/videoAnalysisTagging'

const PHASE_META: { key: ActionPhase; label: string; color: string }[] = [
  { key: 'ofensiva', label: 'Ofensiva', color: '#22c55e' },
  { key: 'defensiva', label: 'Defensiva', color: '#38bdf8' },
  { key: 'transicion', label: 'Transición', color: '#facc15' },
  { key: 'abp', label: 'ABP', color: '#f97316' },
  { key: 'otro', label: 'Otro', color: '#a3a3a3' },
]

export default function VideoAnalysisPhaseChart({ counts }: { counts: Record<ActionPhase, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) {
    return <p className="text-xs text-apple-gray-400">Sin cortes en este rango.</p>
  }

  let acc = 0
  const stops = PHASE_META.map(m => {
    const pct = (counts[m.key] / total) * 100
    const stop = `${m.color} ${acc}% ${acc + pct}%`
    acc += pct
    return stop
  }).join(', ')

  return (
    <div>
      <p className="text-2xs text-apple-gray-400 mb-2">Cuánto fue defensivo, ofensivo o transición.</p>
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex-shrink-0"
          style={{ background: `conic-gradient(${stops})` }}
        />
        <div className="flex flex-col gap-1">
          {PHASE_META.filter(m => counts[m.key] > 0).map(m => (
            <span key={m.key} className="text-2xs text-apple-gray-500 dark:text-apple-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              {m.label} {Math.round((counts[m.key] / total) * 100)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
