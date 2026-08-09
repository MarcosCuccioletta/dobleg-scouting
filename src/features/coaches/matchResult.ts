import type { AgencyFixture } from '@/types/footballApi'
import { isMatchFinished } from '@/utils/coachCalendar'

export type MatchResult = 'G' | 'E' | 'P'

export const RESULT_STYLES: Record<MatchResult, string> = {
  G: 'bg-brand-green/15 text-brand-green',
  E: 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400',
  P: 'bg-brand-red/10 text-brand-red',
}

export function matchOutcome(f: AgencyFixture): { result: MatchResult | null; scoreLabel: string } {
  const teamGoals = f.isHome ? f.goalsHome : f.goalsAway
  const oppGoals = f.isHome ? f.goalsAway : f.goalsHome
  if (teamGoals === null || oppGoals === null) return { result: null, scoreLabel: '-' }
  const result: MatchResult = teamGoals > oppGoals ? 'G' : teamGoals < oppGoals ? 'P' : 'E'
  return { result, scoreLabel: `${teamGoals} - ${oppGoals}` }
}

export function buildStreak(
  fixtures: AgencyFixture[],
  size = 10,
): { fixtureId: number; result: MatchResult | null }[] {
  return [...fixtures]
    .filter(f => isMatchFinished(f.statusShort))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-size)
    .map(f => ({ fixtureId: f.fixtureId, result: matchOutcome(f).result }))
}
