import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mapStandingsResponse } from './footballApiService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'primera-nacional-standings-2026-08-08.json'), 'utf-8'),
)

describe('mapStandingsResponse', () => {
  it('devuelve un array por zona', () => {
    const groups = mapStandingsResponse(fixture)
    expect(groups).toHaveLength(2)
  })

  it('cada zona tiene 18 equipos', () => {
    const groups = mapStandingsResponse(fixture)
    expect(groups[0]).toHaveLength(18)
    expect(groups[1]).toHaveLength(18)
  })

  it('mapea Temperley correctamente en la zona 2', () => {
    const groups = mapStandingsResponse(fixture)
    const temperley = groups[1].find(t => t.teamName === 'Temperley')
    expect(temperley).toBeDefined()
    expect(temperley?.rank).toBe(4)
    expect(temperley?.points).toBe(37)
    expect(temperley?.form).toBe('LWWDW')
    expect(temperley?.goalsFor).toBe(24)
    expect(temperley?.goalsAgainst).toBe(20)
    expect(temperley?.played).toBe(23)
  })

  it('el líder de la zona 1 es Ferro Carril Oeste con 43 puntos', () => {
    const groups = mapStandingsResponse(fixture)
    expect(groups[0][0].teamName).toBe('Ferro Carril Oeste')
    expect(groups[0][0].points).toBe(43)
    expect(groups[0][0].rank).toBe(1)
  })
})
