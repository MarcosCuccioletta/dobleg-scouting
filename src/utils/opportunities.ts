import type { PlayerWithScore, Position, RecentFormPlayer } from '@/types/scoring'

export type MarketTag = 'contract' | 'cheap'

export function marketTagsFor(
  p: RecentFormPlayer,
  opts: { cheapMaxValue: number; contractMaxMonths: number },
): MarketTag[] {
  const tags: MarketTag[] = []
  const months = monthsToContractEnd(p.contract_end_date)
  if (months !== null && months >= 0 && months <= opts.contractMaxMonths) tags.push('contract')
  if (p.market_value_eur != null && p.market_value_eur > 0 && p.market_value_eur <= opts.cheapMaxValue) tags.push('cheap')
  return tags
}

export function ageFromBirthDate(birth_date: string | null): number | null {
  if (!birth_date) return null
  const b = new Date(birth_date)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export function monthsToContractEnd(date: string | null): number | null {
  if (!date) return null
  const end = new Date(date)
  const now = new Date()
  return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
}

export const CONTRACT_BOOST_MAX = 1.5
export const CONTRACT_BOOST_MONTHS = 12

export function contractBoostFor(contractEndDate: string | null): number {
  const months = monthsToContractEnd(contractEndDate)
  if (months === null || months > CONTRACT_BOOST_MONTHS) return 0
  const proximity = 1 - months / CONTRACT_BOOST_MONTHS
  return CONTRACT_BOOST_MAX * Math.min(Math.max(proximity, 0), 1)
}

export function opportunityScoreFor(p: RecentFormPlayer): number {
  return p.recent_avg + contractBoostFor(p.contract_end_date)
}

export function detectOpportunities(players: PlayerWithScore[]) {
  const withScore = players.filter(p => p.primary_score != null)

  const undervalued = withScore
    .filter(p => (p.primary_score as number) >= 6.5 && (p.market_value_eur ?? 0) > 0)
    .sort((a, b) => (a.market_value_eur ?? 0) - (b.market_value_eur ?? 0))

  const youngTalent = withScore.filter(p => {
    const age = ageFromBirthDate(p.birth_date)
    return age != null && age <= 21 && (p.primary_score as number) >= 6.0
  })

  const expiringContract = players.filter(p => {
    const m = monthsToContractEnd(p.contract_end_date)
    return m != null && m >= 0 && m <= 12
  })

  const valueForMoney = withScore
    .filter(p => (p.market_value_eur ?? 0) > 0)
    .map(p => ({ p, ratio: (p.primary_score as number) / ((p.market_value_eur as number) / 1_000_000) }))
    .sort((a, b) => b.ratio - a.ratio)
    .map(x => x.p)

  return { undervalued, youngTalent, expiringContract, valueForMoney }
}

export const OPPORTUNITY_POSITIONS: Position[] = ['ARQ', 'LD', 'CB', 'LI', 'VC', 'VI', 'EXT', 'DEL']

export function topByPosition(
  players: RecentFormPlayer[],
  positions: Position[] = OPPORTUNITY_POSITIONS,
  n = 8,
): Record<string, RecentFormPlayer[]> {
  const result: Record<string, RecentFormPlayer[]> = {}
  for (const pos of positions) {
    result[pos] = players
      .filter(p => p.primary_position === pos)
      .sort((a, b) => opportunityScoreFor(b) - opportunityScoreFor(a))
      .slice(0, n)
  }
  return result
}
