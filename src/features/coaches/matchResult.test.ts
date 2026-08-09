import { describe, it, expect } from 'vitest'
import { matchOutcome, buildStreak, RECENT_MATCHES_COUNT } from './matchResult'
import type { AgencyFixture } from '@/types/footballApi'

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-15T18:00:00+00:00', timestamp: 0,
    venue: 'Estadio', city: 'Temperley', status: 'Match Finished', statusShort: 'FT', elapsed: null,
    leagueName: 'Primera Nacional', leagueLogo: '', leagueCountry: 'Argentina', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1, name: 'Rival', logo: '' },
    goalsHome: null, goalsAway: null, isHome: true, players: [], ...over,
  }
}

describe('matchOutcome', () => {
  it('gana de local', () => {
    const f = mkFixture({ isHome: true, goalsHome: 2, goalsAway: 1 })
    expect(matchOutcome(f)).toEqual({ result: 'G', scoreLabel: '2 - 1' })
  })

  it('pierde de visitante', () => {
    const f = mkFixture({ isHome: false, goalsHome: 3, goalsAway: 1 })
    expect(matchOutcome(f)).toEqual({ result: 'P', scoreLabel: '1 - 3' })
  })

  it('empata', () => {
    const f = mkFixture({ isHome: true, goalsHome: 1, goalsAway: 1 })
    expect(matchOutcome(f)).toEqual({ result: 'E', scoreLabel: '1 - 1' })
  })

  it('partido sin jugar todavia da result null', () => {
    const f = mkFixture({ goalsHome: null, goalsAway: null })
    expect(matchOutcome(f)).toEqual({ result: null, scoreLabel: '-' })
  })
})

describe('buildStreak', () => {
  it('ordena de mas viejo a mas nuevo y corta en el tamano pedido', () => {
    const fixtures = [
      mkFixture({ fixtureId: 3, timestamp: 300, statusShort: 'FT', isHome: true, goalsHome: 1, goalsAway: 0 }),
      mkFixture({ fixtureId: 1, timestamp: 100, statusShort: 'FT', isHome: true, goalsHome: 0, goalsAway: 1 }),
      mkFixture({ fixtureId: 2, timestamp: 200, statusShort: 'FT', isHome: true, goalsHome: 1, goalsAway: 1 }),
    ]
    const streak = buildStreak(fixtures, 2)
    expect(streak.map(s => s.fixtureId)).toEqual([2, 3])
  })

  it('ignora partidos no finalizados', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, timestamp: 100, statusShort: 'FT', goalsHome: 1, goalsAway: 0 }),
      mkFixture({ fixtureId: 2, timestamp: 200, statusShort: 'NS', goalsHome: null, goalsAway: null }),
    ]
    const streak = buildStreak(fixtures, RECENT_MATCHES_COUNT)
    expect(streak.map(s => s.fixtureId)).toEqual([1])
  })

  it('devuelve racha parcial si hay menos partidos que el tamano pedido', () => {
    const fixtures = [mkFixture({ fixtureId: 1, timestamp: 100, statusShort: 'FT', goalsHome: 1, goalsAway: 0 })]
    const streak = buildStreak(fixtures, RECENT_MATCHES_COUNT)
    expect(streak).toHaveLength(1)
  })
})
