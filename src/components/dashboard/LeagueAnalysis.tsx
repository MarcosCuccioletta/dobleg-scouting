import { useMemo } from 'react'
import { TIER_INFO, getLeagueInfo } from '@/constants/leagues'
import type { EnrichedPlayer } from '@/types'

interface LeagueAnalysisProps {
  players: EnrichedPlayer[]
}

export default function LeagueAnalysis({ players }: LeagueAnalysisProps) {
  // Analyze league distribution
  const leagueDistribution = useMemo(() => {
    const distribution: Record<number, { count: number; players: EnrichedPlayer[] }> = {
      1: { count: 0, players: [] },
      2: { count: 0, players: [] },
      3: { count: 0, players: [] },
      4: { count: 0, players: [] },
      5: { count: 0, players: [] },
      6: { count: 0, players: [] },
    }

    for (const player of players) {
      const leagueInfo = getLeagueInfo(player.Liga || '')
      const tier = leagueInfo?.tier || 6
      distribution[tier].count++
      distribution[tier].players.push(player)
    }

    return distribution
  }, [players])

  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-5">
      <h3 className="font-semibold text-apple-gray-800 dark:text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Distribucion por Nivel de Liga
      </h3>

      <div className="space-y-3">
        {Object.entries(TIER_INFO).map(([tier, info]) => {
          const tierNum = parseInt(tier)
          const data = leagueDistribution[tierNum]
          const percentage = players.length > 0 ? (data.count / players.length) * 100 : 0

          return (
            <div key={tier} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${info.bgColor} ${info.color}`}>
                    Tier {tier}
                  </span>
                  <span className="text-sm text-apple-gray-600 dark:text-apple-gray-400">
                    {info.name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">
                  {data.count}
                </span>
              </div>
              <div className="h-2 bg-apple-gray-100 dark:bg-apple-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tierNum === 1 ? 'bg-purple-500' :
                    tierNum === 2 ? 'bg-blue-500' :
                    tierNum === 3 ? 'bg-emerald-500' :
                    tierNum === 4 ? 'bg-amber-500' :
                    tierNum === 5 ? 'bg-orange-500' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-2xs text-apple-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {info.description}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
