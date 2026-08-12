import { describe, expect, it } from 'vitest'
import { computeHomeAwaySplit, buildCumulativePoints } from './dtEfficiency'
import type { EnrichedMatchRow } from './components/CoachMatchMetricsEvolution'

const row = (over: Partial<EnrichedMatchRow> & Pick<EnrichedMatchRow, 'fixtureId' | 'date' | 'isHome' | 'result'>): EnrichedMatchRow => ({
  opponent: 'Rival', opponentLogo: '', scoreLabel: null,
  stats: { id: 1, coach_key: 'domingo', fixture_id: over.fixtureId, possession_pct: null, xg_for: null, xg_against: null, raw_metrics: {}, source_file: null, created_at: '', updated_at: '' },
  ...over,
})

describe('computeHomeAwaySplit', () => {
  it('separa puntos por partido y % victorias entre local y visitante', () => {
    const rows = [
      row({ fixtureId: 1, date: '2026-03-01', isHome: true, result: 'G' }),
      row({ fixtureId: 2, date: '2026-03-08', isHome: true, result: 'E' }),
      row({ fixtureId: 3, date: '2026-03-15', isHome: false, result: 'P' }),
      row({ fixtureId: 4, date: '2026-03-22', isHome: false, result: 'P' }),
    ]
    const { home, away } = computeHomeAwaySplit(rows)
    expect(home).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4, ppg: 2, winPct: 50 })
    expect(away).toMatchObject({ played: 2, won: 0, drawn: 0, lost: 2, points: 0, ppg: 0, winPct: 0 })
  })

  it('descarta partidos sin resultado cargado', () => {
    const rows = [row({ fixtureId: 1, date: '2026-03-01', isHome: true, result: null })]
    const { home } = computeHomeAwaySplit(rows)
    expect(home.played).toBe(0)
    expect(home.ppg).toBeNull()
  })
})

describe('buildCumulativePoints', () => {
  it('acumula puntos cronologicamente (G=3, E=1, P=0)', () => {
    const rows = [
      row({ fixtureId: 2, date: '2026-03-08', isHome: true, result: 'E' }),
      row({ fixtureId: 1, date: '2026-03-01', isHome: true, result: 'G' }),
      row({ fixtureId: 3, date: '2026-03-15', isHome: false, result: 'P' }),
    ]
    const points = buildCumulativePoints(rows)
    expect(points.map(p => p.points)).toEqual([3, 4, 4])
    expect(points.map(p => p.date)).toEqual(['2026-03-01', '2026-03-08', '2026-03-15'])
  })
})
