import type { AgencyFixture } from '@/types/footballApi'
import type { CoachMatchTeamStats } from '@/services/coachService'
import { matchOutcome } from './matchResult'
import { isMatchFinished } from '@/utils/coachCalendar'

export interface SeasonStats {
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  possiblePoints: number
  goalsFor: number
  goalsAgainst: number
  avgPossession: number | null
  avgXgFor: number | null
  avgXgAgainst: number | null
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function computeSeasonStats(fixtures: AgencyFixture[], statsRows: CoachMatchTeamStats[]): SeasonStats {
  const statsByFixture = new Map(statsRows.map(s => [s.fixture_id, s]))
  const confirmed = fixtures.filter(f => statsByFixture.has(f.fixtureId) && isMatchFinished(f.statusShort))

  let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0
  const possessionValues: number[] = []
  const xgForValues: number[] = []
  const xgAgainstValues: number[] = []

  for (const fixture of confirmed) {
    const { result } = matchOutcome(fixture)
    if (result === 'G') won++
    else if (result === 'E') drawn++
    else if (result === 'P') lost++

    const teamGoals = fixture.isHome ? fixture.goalsHome : fixture.goalsAway
    const oppGoals = fixture.isHome ? fixture.goalsAway : fixture.goalsHome
    goalsFor += teamGoals ?? 0
    goalsAgainst += oppGoals ?? 0

    const stats = statsByFixture.get(fixture.fixtureId)!
    if (stats.possession_pct !== null) possessionValues.push(stats.possession_pct)
    if (stats.xg_for !== null) xgForValues.push(stats.xg_for)
    if (stats.xg_against !== null) xgAgainstValues.push(stats.xg_against)
  }

  const played = confirmed.length
  return {
    played, won, drawn, lost,
    points: won * 3 + drawn,
    possiblePoints: played * 3,
    goalsFor, goalsAgainst,
    avgPossession: average(possessionValues),
    avgXgFor: average(xgForValues),
    avgXgAgainst: average(xgAgainstValues),
  }
}
