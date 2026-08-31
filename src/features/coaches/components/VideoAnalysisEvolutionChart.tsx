import { useState, useEffect } from 'react'
import { countByCode, evolutionByMatch, type StatsMatch } from '@/features/coaches/videoAnalysis/videoAnalysisStats'

export default function VideoAnalysisEvolutionChart({ matches }: { matches: StatsMatch[] }) {
  const topCodes = countByCode(matches).map(c => c.code)
  const [selected, setSelected] = useState(topCodes[0] ?? '')

  useEffect(() => {
    if (!topCodes.includes(selected)) setSelected(topCodes[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  if (topCodes.length === 0) {
    return <p className="text-xs text-apple-gray-400">Sin cortes en este rango.</p>
  }

  const evolution = evolutionByMatch(matches, selected)
  const max = Math.max(1, ...evolution.map(e => e.count))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xs text-apple-gray-400">Evolución partido a partido.</p>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="text-2xs rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 py-1"
        >
          {topCodes.map(code => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {evolution.map((e, i) => (
          <div
            key={i}
            title={`${e.matchDate}: ${e.count}`}
            className="flex-1 bg-gradient-to-t from-green-600 to-brand-green rounded-t"
            style={{ height: `${(e.count / max) * 100}%`, minHeight: e.count > 0 ? '4px' : '0' }}
          />
        ))}
      </div>
    </div>
  )
}
