import { normalizeForSearch, fuzzyMatch } from '@/lib/search'
import { toArDateKey, fetchFixtureLineups } from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'
import type { WyscoutMatch } from './parseWyscoutTeamStats'

export function matchFixtureForRow(row: WyscoutMatch, fixtures: AgencyFixture[]): AgencyFixture | null {
  const rivalNormalized = normalizeForSearch(row.equipoRival)
  return (
    fixtures.find(f => {
      if (toArDateKey(f.date) !== row.fecha) return false
      const opponent = f.isHome ? f.awayTeam.name : f.homeTeam.name
      return normalizeForSearch(opponent) === rivalNormalized
    }) ?? null
  )
}

export async function verifyCoachForFixture(
  fixtureId: number,
  ownTeamId: number,
  coachFullName: string,
): Promise<{ verified: boolean; coachName: string | null }> {
  const lineups = await fetchFixtureLineups(fixtureId)
  const ownLineup = lineups.find(l => l.team.id === ownTeamId)
  const coachName = ownLineup?.coach?.name ?? null
  if (!coachName) return { verified: false, coachName: null }
  const verified = fuzzyMatch(coachName, coachFullName) || fuzzyMatch(coachFullName, coachName)
  return { verified, coachName }
}
