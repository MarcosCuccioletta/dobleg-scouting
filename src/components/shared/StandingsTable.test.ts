import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mapStandingsResponse } from '@/services/footballApiService'
import { sortStandingRows } from './StandingsTable'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', 'services', '__fixtures__', 'primera-nacional-standings-2026-08-08.json'),
    'utf-8',
  ),
)

describe('sortStandingRows', () => {
  const zoneOne = mapStandingsResponse(fixture)[0]

  it('ordena por puntos descendente', () => {
    const sorted = sortStandingRows(zoneOne, 'points')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].points).toBeGreaterThanOrEqual(sorted[i].points)
    }
    expect(sorted[0].teamName).toBe('Ferro Carril Oeste')
  })

  it('ordena por goles a favor descendente', () => {
    const sorted = sortStandingRows(zoneOne, 'goalsFor')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].goalsFor).toBeGreaterThanOrEqual(sorted[i].goalsFor)
    }
  })

  it('ordena por goles en contra ascendente', () => {
    const sorted = sortStandingRows(zoneOne, 'goalsAgainst')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].goalsAgainst).toBeLessThanOrEqual(sorted[i].goalsAgainst)
    }
  })

  it('no muta el array original', () => {
    const original = [...zoneOne]
    sortStandingRows(zoneOne, 'points')
    expect(zoneOne).toEqual(original)
  })
})
