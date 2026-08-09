import { describe, it, expect } from 'vitest'
import { computeSeasonStats } from './seasonStats'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachMatchTeamStats } from '@/services/coachService'

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-02T18:00:00+00:00', timestamp: 0,
    venue: '', city: '', status: 'Match Finished', statusShort: 'FT', elapsed: null,
    leagueName: '', leagueLogo: '', leagueCountry: '', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1, name: 'Rival', logo: '' },
    goalsHome: null, goalsAway: null, isHome: true, players: [], ...over,
  }
}

function mkStats(over: Partial<CoachMatchTeamStats> = {}): CoachMatchTeamStats {
  return {
    id: 1, coach_key: 'domingo', fixture_id: 1,
    possession_pct: 60, xg_for: 1.5, xg_against: 1.0,
    raw_metrics: {}, source_file: null, created_at: '', updated_at: '',
    ...over,
  }
}

describe('computeSeasonStats', () => {
  it('solo cuenta fixtures que tienen fila de stats (partidos confirmados)', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 2, goalsAway: 1 }),
      mkFixture({ fixtureId: 2, isHome: true, goalsHome: 0, goalsAway: 0 }), // sin stats, no cuenta
    ]
    const stats = [mkStats({ fixture_id: 1 })]
    const result = computeSeasonStats(fixtures, stats)
    expect(result.played).toBe(1)
  })

  it('calcula PG/PE/PP y puntos sobre posibles', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 2, goalsAway: 1 }),  // gana
      mkFixture({ fixtureId: 2, isHome: false, goalsHome: 1, goalsAway: 1 }), // empata
      mkFixture({ fixtureId: 3, isHome: true, goalsHome: 0, goalsAway: 2 }),  // pierde
    ]
    const stats = [mkStats({ fixture_id: 1 }), mkStats({ fixture_id: 2 }), mkStats({ fixture_id: 3 })]
    const result = computeSeasonStats(fixtures, stats)
    expect(result).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, points: 4, possiblePoints: 9 })
  })

  it('suma goles a favor y en contra', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 2, goalsAway: 1 }),
      mkFixture({ fixtureId: 2, isHome: false, goalsHome: 3, goalsAway: 0 }),
    ]
    const stats = [mkStats({ fixture_id: 1 }), mkStats({ fixture_id: 2 })]
    const result = computeSeasonStats(fixtures, stats)
    expect(result.goalsFor).toBe(2) // 2 (local) + 0 (visitante, le hicieron 3)
    expect(result.goalsAgainst).toBe(4) // 1 (local) + 3 (visitante)
  })

  it('promedia posesion y xG solo de los partidos con ese dato cargado', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 1, goalsAway: 0 }),
      mkFixture({ fixtureId: 2, isHome: true, goalsHome: 1, goalsAway: 0 }),
    ]
    const stats = [
      mkStats({ fixture_id: 1, possession_pct: 60, xg_for: 2, xg_against: 1 }),
      mkStats({ fixture_id: 2, possession_pct: 40, xg_for: 1, xg_against: 0.5 }),
    ]
    const result = computeSeasonStats(fixtures, stats)
    expect(result.avgPossession).toBe(50)
    expect(result.avgXgFor).toBe(1.5)
    expect(result.avgXgAgainst).toBe(0.75)
  })

  it('sin partidos con stats, devuelve todo en cero y promedios null', () => {
    const result = computeSeasonStats([], [])
    expect(result).toMatchObject({ played: 0, won: 0, drawn: 0, lost: 0, points: 0, possiblePoints: 0, goalsFor: 0, goalsAgainst: 0 })
    expect(result.avgPossession).toBeNull()
    expect(result.avgXgFor).toBeNull()
    expect(result.avgXgAgainst).toBeNull()
  })
})
