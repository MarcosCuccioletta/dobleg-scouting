import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mapStandingsResponse, mapCoachProfileResponse } from './footballApiService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'primera-nacional-standings-2026-08-08.json'), 'utf-8'),
)
const coachFixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'coach-profile-sample.json'), 'utf-8'),
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

describe('mapCoachProfileResponse', () => {
  it('mapea edad, nacionalidad y lugar de nacimiento', () => {
    const profile = mapCoachProfileResponse(coachFixture)
    expect(profile).toMatchObject({
      age: 47,
      nationality: 'Argentina',
      birthPlace: 'Ramos Mejía',
      birthCountry: 'Argentina',
    })
  })

  it('ordena la trayectoria del club más reciente al más antiguo', () => {
    const profile = mapCoachProfileResponse(coachFixture)
    expect(profile?.career.map(c => c.start)).toEqual(['2022-06-01', '2019-01-01', '2016-07-01'])
  })

  it('mapea escudo y nombre de cada club de la trayectoria', () => {
    const profile = mapCoachProfileResponse(coachFixture)
    expect(profile?.career[0]).toMatchObject({
      teamId: 435,
      teamName: 'Vélez Sarsfield',
      teamLogo: 'https://media.api-sports.io/football/teams/435.png',
      start: '2022-06-01',
      end: '2023-05-01',
    })
  })

  it('un club actual sin fecha de fin queda con end: null', () => {
    const raw = {
      response: [{
        age: 40, nationality: 'Argentina', birth: { place: 'CABA', country: 'Argentina' },
        career: [{ team: { id: 1, name: 'Club Actual', logo: 'logo.png' }, start: '2025-01-01', end: null }],
      }],
    }
    const profile = mapCoachProfileResponse(raw)
    expect(profile?.career[0].end).toBeNull()
  })

  it('devuelve null si la respuesta no tiene resultados', () => {
    const raw = { response: [] }
    expect(mapCoachProfileResponse(raw)).toBeNull()
  })
})
