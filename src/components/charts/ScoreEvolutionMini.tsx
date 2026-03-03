import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { ScoreHistoryEntry } from '@/types'

interface ScoreEvolutionMiniProps {
  history: ScoreHistoryEntry[]
  width?: number
  height?: number
}

export default function ScoreEvolutionMini({ history, width = 80, height = 32 }: ScoreEvolutionMiniProps) {
  // Filter out entries with 0 or invalid scores
  const validHistory = useMemo(() => {
    return history.filter(entry => entry.ggScore > 0)
  }, [history])

  const chartData = useMemo(() => {
    return validHistory.map(entry => ({
      date: entry.date.split('T')[0],
      score: entry.ggScore,
    }))
  }, [validHistory])

  const trend = useMemo(() => {
    if (validHistory.length < 2) return null
    const first = validHistory[0].ggScore
    const last = validHistory[validHistory.length - 1].ggScore
    const diff = last - first
    // Only show trend if there's a meaningful change (at least 0.5 difference)
    if (Math.abs(diff) < 0.5) {
      return { value: 0, direction: 'stable' as const }
    }
    return {
      value: Math.round(diff * 10) / 10,
      direction: diff > 0 ? 'up' : 'down' as const
    }
  }, [validHistory])

  if (validHistory.length < 2) {
    return (
      <div className="flex items-center gap-1.5 text-2xs text-apple-gray-400">
        <span>—</span>
      </div>
    )
  }

  const lineColor = trend?.direction === 'up'
    ? '#22C55E'
    : trend?.direction === 'down'
    ? '#EF4444'
    : '#6B7280'

  return (
    <div className="flex items-center gap-2">
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                fontSize: '10px',
                padding: '4px 8px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)}`, 'Score']}
              labelFormatter={(label) => label}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 2, fill: lineColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 text-2xs font-medium ${
          trend.direction === 'up'
            ? 'text-green-500'
            : trend.direction === 'down'
            ? 'text-red-500'
            : 'text-gray-400'
        }`}>
          {trend.direction === 'up' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {trend.direction === 'down' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          {trend.direction === 'stable' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          )}
          <span>{trend.value > 0 ? '+' : ''}{trend.value}</span>
        </div>
      )}
    </div>
  )
}
