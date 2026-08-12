import { describe, expect, it } from 'vitest'
import { buildEnrichedMatchRows } from './CoachMatchMetricsEvolution'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachMatchTeamStats } from '@/services/coachService'

const fixture = (over: Partial<AgencyFixture> & Pick<AgencyFixture, 'fixtureId' | 'date'>): AgencyFixture => ({
  timestamp: 0, venue: '', city: '', status: '', statusShort: 'FT', elapsed: null,
  leagueName: 'Primera Nacional', leagueLogo: '', leagueCountry: '', leagueFlag: null, round: '',
  homeTeam: { id: 1, name: 'Temperley', logo: '' },
  awayTeam: { id: 2, name: 'Atlanta', logo: '' },
  goalsHome: 1, goalsAway: 0, isHome: true, players: [],
  ...over,
})

const stats = (over: Partial<CoachMatchTeamStats> & Pick<CoachMatchTeamStats, 'fixture_id'>): CoachMatchTeamStats => ({
  id: 1, coach_key: 'domingo', possession_pct: 55, xg_for: 1.2, xg_against: 0.8,
  raw_metrics: {}, source_file: null, created_at: '', updated_at: '',
  ...over,
})

describe('buildEnrichedMatchRows', () => {
  it('cruza stats con el fixture real (rival, fecha, resultado)', () => {
    const fixtures = [fixture({ fixtureId: 100, date: '2026-08-01', isHome: true, goalsHome: 2, goalsAway: 1 })]
    const rows = buildEnrichedMatchRows(fixtures, [stats({ fixture_id: 100 })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ fixtureId: 100, date: '2026-08-01', opponent: 'Atlanta', scoreLabel: '2-1' })
  })

  it('de visitante, el rival es el equipo local', () => {
    const fixtures = [fixture({ fixtureId: 100, date: '2026-08-01', isHome: false })]
    const rows = buildEnrichedMatchRows(fixtures, [stats({ fixture_id: 100 })])
    expect(rows[0].opponent).toBe('Temperley')
  })

  it('descarta stats sin fixture correspondiente', () => {
    const rows = buildEnrichedMatchRows([], [stats({ fixture_id: 999 })])
    expect(rows).toHaveLength(0)
  })

  it('ordena cronologicamente por fecha', () => {
    const fixtures = [
      fixture({ fixtureId: 1, date: '2026-08-10' }),
      fixture({ fixtureId: 2, date: '2026-07-01' }),
    ]
    const rows = buildEnrichedMatchRows(fixtures, [stats({ fixture_id: 1 }), stats({ fixture_id: 2 })])
    expect(rows.map(r => r.fixtureId)).toEqual([2, 1])
  })

  it('partido sin resultado cargado (goles null) da scoreLabel null', () => {
    const fixtures = [fixture({ fixtureId: 1, date: '2026-08-10', goalsHome: null, goalsAway: null })]
    const rows = buildEnrichedMatchRows(fixtures, [stats({ fixture_id: 1 })])
    expect(rows[0].scoreLabel).toBeNull()
  })
})
