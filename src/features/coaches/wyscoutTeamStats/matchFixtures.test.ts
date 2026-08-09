import { describe, it, expect } from 'vitest'
import { matchFixtureForRow } from './matchFixtures'
import type { WyscoutMatch } from './parseWyscoutTeamStats'
import type { AgencyFixture } from '@/types/footballApi'

function mkWyscoutMatch(over: Partial<WyscoutMatch> = {}): WyscoutMatch {
  return {
    fecha: '2026-08-02', partido: 'Temperley - Gimnasia y Tiro 1:2', competencia: 'Primera Nacional',
    equipoPropio: 'Temperley', equipoRival: 'Gimnasia y Tiro',
    xgFor: 1.15, xgAgainst: 1.18, possessionPct: 64.09, rawMetrics: {},
    ...over,
  }
}

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-02T18:00:00+00:00', timestamp: 0,
    venue: 'Estadio', city: 'Temperley', status: 'Match Finished', statusShort: 'FT', elapsed: null,
    leagueName: 'Primera Nacional', leagueLogo: '', leagueCountry: 'Argentina', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1928, name: 'Gimnasia Y Tiro', logo: '' },
    goalsHome: 1, goalsAway: 2, isHome: true, players: [], ...over,
  }
}

describe('matchFixtureForRow', () => {
  it('matchea por fecha exacta y nombre de rival normalizado', () => {
    const row = mkWyscoutMatch()
    const fixture = mkFixture()
    const result = matchFixtureForRow(row, [fixture])
    expect(result?.fixtureId).toBe(1)
  })

  it('no matchea si la fecha no coincide', () => {
    const row = mkWyscoutMatch({ fecha: '2026-08-03' })
    const fixture = mkFixture()
    expect(matchFixtureForRow(row, [fixture])).toBeNull()
  })

  it('no matchea si el rival no coincide aunque la fecha si', () => {
    const row = mkWyscoutMatch({ equipoRival: 'Otro Equipo' })
    const fixture = mkFixture()
    expect(matchFixtureForRow(row, [fixture])).toBeNull()
  })

  it('devuelve null si no hay ningun fixture', () => {
    expect(matchFixtureForRow(mkWyscoutMatch(), [])).toBeNull()
  })
})
