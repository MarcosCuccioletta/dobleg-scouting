import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@/context/DataContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { getScoreColorClass, getScoreBgClass } from '@/components/ui/ScoreBar'
import type { EnrichedPlayer } from '@/types'

interface Opportunity {
  player: EnrichedPlayer
  type: 'contract' | 'undervalued' | 'young_talent' | 'bargain'
  score: number
  reasons: string[]
}

function calculateOpportunities(players: EnrichedPlayer[]): Opportunity[] {
  const opportunities: Opportunity[] = []

  for (const player of players) {
    const score = player.ggScore ?? 0
    const age = player.ageNum
    const value = player.marketValueRaw
    const monthsRemaining = player.monthsRemaining
    const league = player.Liga || ''
    const isArgentina = league.toLowerCase().includes('argentina')
    const reasons: string[] = []
    let oppScore = 0

    // Strict minimum requirements
    if (score < 45) continue
    if (player.minutesPlayed < 400) continue

    // 1. Contract expiring soon (< 6 months) + good player
    if (monthsRemaining !== null && monthsRemaining <= 6 && monthsRemaining >= 0 && score >= 50) {
      oppScore += 50
      reasons.push(`Contrato vence en ${monthsRemaining} meses`)
    }

    // 2. Undervalued: HIGH score with LOW value
    // Argentina has higher values, so adjust thresholds
    const lowValueThresholdElite = isArgentina ? 1_500_000 : 500_000
    const lowValueThresholdGood = isArgentina ? 800_000 : 250_000

    if (score >= 65 && value > 0 && value <= lowValueThresholdElite) {
      oppScore += 50
      reasons.push(`Score ${score.toFixed(1)} a solo ${formatValue(value)}`)
    } else if (score >= 55 && value > 0 && value <= lowValueThresholdGood) {
      oppScore += 40
      reasons.push(`Rendimiento alto, valor bajo (${formatValue(value)})`)
    }

    // 3. Young talent: must be exceptional for age
    if (age <= 18 && score >= 48) {
      oppScore += 55
      reasons.push(`${age} años con score ${score.toFixed(1)}`)
    } else if (age <= 20 && score >= 50) {
      oppScore += 45
      reasons.push(`${age} años, rendimiento destacado`)
    } else if (age <= 21 && score >= 55) {
      oppScore += 40
      reasons.push(`Joven con nivel elite`)
    } else if (age <= 23 && score >= 60) {
      oppScore += 35
      reasons.push(`Sub-23 con score top`)
    }

    // 4. Exceptional value ratio (score per €100k)
    const maxValueForRatio = isArgentina ? 2_500_000 : 1_000_000
    if (value > 0 && value <= maxValueForRatio && score >= 55) {
      const valueRatio = score / (value / 100_000)
      const ratioThreshold = isArgentina ? 15 : 50 // Argentina has higher values
      if (valueRatio >= ratioThreshold) {
        oppScore += 35
        reasons.push(`Relación calidad/precio excepcional`)
      }
    }

    // 5. Young + Low value + Decent score = Hidden gem
    if (age <= 22 && score >= 48 && value > 0 && value <= 300_000) {
      oppScore += 30
      reasons.push(`Joya oculta: ${age} años, valor bajo`)
    }

    // Only include if meets threshold
    if (oppScore >= 35 && reasons.length >= 1) {
      let type: Opportunity['type'] = 'bargain'
      if (monthsRemaining !== null && monthsRemaining <= 6 && score >= 50) {
        type = 'contract'
      } else if (age <= 21 && score >= 48) {
        type = 'young_talent'
      } else if (score >= 55 && value > 0 && value <= lowValueThresholdElite) {
        type = 'undervalued'
      }

      opportunities.push({
        player,
        type,
        score: oppScore,
        reasons,
      })
    }
  }

  return opportunities.sort((a, b) => b.score - a.score).slice(0, 60)
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`
  return `€${value}`
}

const TYPE_LABELS: Record<string, string> = {
  contract: 'Contrato',
  undervalued: 'Subvalorado',
  young_talent: 'Joven promesa',
  bargain: 'Oportunidad',
}

type FilterType = 'all' | 'contract' | 'undervalued' | 'young_talent' | 'bargain'

export default function OpportunitiesPage() {
  const navigate = useNavigate()
  const { external, internal, loading } = useData()
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [leagueFilter, setLeagueFilter] = useState<string>('all')
  const [positionFilter, setPositionFilter] = useState<string>('all')

  const allPlayers = useMemo(() => [...external, ...internal], [external, internal])
  const opportunities = useMemo(() => calculateOpportunities(allPlayers), [allPlayers])

  // Get unique leagues from opportunities
  const leagues = useMemo(() => {
    const leagueSet = new Set<string>()
    opportunities.forEach(o => {
      if (o.player.Liga) leagueSet.add(o.player.Liga)
    })
    return Array.from(leagueSet).sort()
  }, [opportunities])

  // Get unique positions from opportunities
  const positions = useMemo(() => {
    const posSet = new Set<string>()
    opportunities.forEach(o => {
      const pos = o.player['Posición'] || o.player['Posición específica']
      if (pos) posSet.add(pos)
    })
    return Array.from(posSet).sort()
  }, [opportunities])

  const filteredOpportunities = useMemo(() => {
    let result = opportunities
    if (typeFilter !== 'all') {
      result = result.filter(o => o.type === typeFilter)
    }
    if (leagueFilter !== 'all') {
      result = result.filter(o => o.player.Liga === leagueFilter)
    }
    if (positionFilter !== 'all') {
      result = result.filter(o => {
        const pos = o.player['Posición'] || o.player['Posición específica'] || ''
        return pos === positionFilter
      })
    }
    return result
  }, [opportunities, typeFilter, leagueFilter, positionFilter])

  const counts = useMemo(() => ({
    all: opportunities.length,
    contract: opportunities.filter(o => o.type === 'contract').length,
    undervalued: opportunities.filter(o => o.type === 'undervalued').length,
    young_talent: opportunities.filter(o => o.type === 'young_talent').length,
    bargain: opportunities.filter(o => o.type === 'bargain').length,
  }), [opportunities])

  if (loading) return <LoadingSpinner fullScreen message="Analizando oportunidades..." />

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight">
          Oportunidades de Mercado
        </h1>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 mt-0.5">
          {filteredOpportunities.length} oportunidades detectadas
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              typeFilter === 'all'
                ? 'bg-apple-gray-800 dark:bg-white text-white dark:text-apple-gray-800'
                : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-600 dark:text-apple-gray-300 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700'
            }`}
          >
            Todas ({counts.all})
          </button>
          {(['young_talent', 'undervalued', 'contract', 'bargain'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                typeFilter === type
                  ? 'bg-apple-gray-800 dark:bg-white text-white dark:text-apple-gray-800'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-600 dark:text-apple-gray-300 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700'
              }`}
            >
              {TYPE_LABELS[type]} ({counts[type]})
            </button>
          ))}
        </div>

        {/* League filter */}
        <select
          value={leagueFilter}
          onChange={e => setLeagueFilter(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-700 dark:text-apple-gray-200 border-0 focus:ring-2 focus:ring-brand-green"
        >
          <option value="all">Todas las ligas</option>
          {leagues.map(league => (
            <option key={league} value={league}>{league}</option>
          ))}
        </select>

        {/* Position filter */}
        <select
          value={positionFilter}
          onChange={e => setPositionFilter(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-700 dark:text-apple-gray-200 border-0 focus:ring-2 focus:ring-brand-green"
        >
          <option value="all">Todas las posiciones</option>
          {positions.map(pos => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
      </div>

      {/* Opportunities grid */}
      {filteredOpportunities.length === 0 ? (
        <div className="text-center py-12 text-apple-gray-500">
          No se encontraron oportunidades con estos filtros
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOpportunities.map((opp, idx) => {
            const scoreColor = getScoreColorClass(opp.player.ggScore ?? null)
            const scoreBg = getScoreBgClass(opp.player.ggScore ?? null)

            return (
              <div
                key={`${opp.player.Jugador}-${idx}`}
                onClick={() => {
                  const encoded = encodeURIComponent(opp.player.Jugador)
                  navigate(`/jugador/${encoded}?source=${opp.player.source}`)
                }}
                className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-4 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  {opp.player.Imagen ? (
                    <img
                      src={opp.player.Imagen}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 flex items-center justify-center text-lg font-bold text-apple-gray-500">
                      {opp.player.Jugador.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-apple-gray-800 dark:text-white truncate">
                      {opp.player.Jugador}
                    </h3>
                    <p className="text-sm text-apple-gray-500 truncate">
                      {opp.player.Equipo}
                    </p>
                    <p className="text-xs text-apple-gray-400 truncate">
                      {opp.player.Liga}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300">
                    {TYPE_LABELS[opp.type]}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 mb-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${scoreBg} ${scoreColor}`}>
                    {opp.player.ggScore?.toFixed(1) ?? '—'}
                  </span>
                  <span className="text-apple-gray-600 dark:text-apple-gray-400">
                    {opp.player.ageNum} años
                  </span>
                  <span className="text-apple-gray-600 dark:text-apple-gray-400">
                    {opp.player['Posición']}
                  </span>
                </div>

                {/* Value and contract */}
                <div className="flex items-center justify-between mb-3 text-sm">
                  <div>
                    <span className="text-apple-gray-400">Valor: </span>
                    <span className="font-medium text-apple-gray-700 dark:text-apple-gray-200">
                      {opp.player.marketValueFormatted || '—'}
                    </span>
                  </div>
                  {opp.player.monthsRemaining !== null && (
                    <div>
                      <span className="text-apple-gray-400">Contrato: </span>
                      <span className="font-medium text-apple-gray-700 dark:text-apple-gray-200">
                        {opp.player.monthsRemaining} meses
                      </span>
                    </div>
                  )}
                </div>

                {/* Reasons */}
                <div className="space-y-1 mb-3">
                  {opp.reasons.map((reason, i) => (
                    <div
                      key={i}
                      className="text-xs text-apple-gray-600 dark:text-apple-gray-400 bg-apple-gray-50 dark:bg-apple-gray-700/50 px-2 py-1 rounded"
                    >
                      {reason}
                    </div>
                  ))}
                </div>

                {/* Opportunity score bar */}
                <div className="pt-3 border-t border-apple-gray-100 dark:border-apple-gray-700">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-apple-gray-400">Nivel de oportunidad</span>
                    <span className="font-semibold text-brand-green">{opp.score} pts</span>
                  </div>
                  <div className="h-1.5 bg-apple-gray-200 dark:bg-apple-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-green to-green-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, opp.score)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
