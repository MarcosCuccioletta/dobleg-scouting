import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mapStandingsResponse, mapCoachProfileResponse, surnameOf, mapCompetitionsResponse, dedupeTransfers, type PlayerTransfer } from './footballApiService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'primera-nacional-standings-2026-08-08.json'), 'utf-8'),
)
const coachFixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'coach-profile-sample.json'), 'utf-8'),
)
const competitionsFixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'bhayangkara-fc-leagues-2026-08-17.json'), 'utf-8'),
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

describe('surnameOf', () => {
  it('devuelve la última palabra de un nombre compuesto', () => {
    expect(surnameOf('Leandro Stillitano')).toBe('Stillitano')
    expect(surnameOf('Gianluca Prestianni')).toBe('Prestianni')
  })

  it('devuelve null si el nombre es una sola palabra (no hay fallback distinto)', () => {
    expect(surnameOf('Guardiola')).toBeNull()
  })

  it('devuelve null para un nombre vacío o solo espacios', () => {
    expect(surnameOf('')).toBeNull()
    expect(surnameOf('   ')).toBeNull()
  })

  it('ignora espacios extra entre palabras', () => {
    expect(surnameOf('Leandro   Gabriel   Stillitano')).toBe('Stillitano')
  })
})

describe('mapCompetitionsResponse', () => {
  it('descarta competencias sin temporada vigente', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    expect(result.find(c => c.leagueId === 924)).toBeUndefined() // Piala Presiden, última temporada 2022, current: false
    expect(result.find(c => c.leagueId === 275)).toBeUndefined() // Liga 2, última temporada 2024, current: false
  })

  it('mapea la liga vigente con hasStandings true', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    const liga1 = result.find(c => c.leagueId === 274)
    expect(liga1).toMatchObject({
      leagueName: 'Liga 1',
      type: 'League',
      season: 2026,
      hasStandings: true,
      country: 'Indonesia',
    })
  })

  it('descarta una temporada current pero vieja (Piala Indonesia, current:true con temporada 2018-2019)', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    expect(result.find(c => c.leagueId === 718)).toBeUndefined()
  })

  it('descarta amistosos por nombre o país "World" (Friendlies Clubs, current:true pero no es una competencia real)', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    expect(result.find(c => c.leagueId === 667)).toBeUndefined()
  })

  it('devuelve sólo Liga 1 vigente para Bhayangkara FC tras descartar temporada stale y amistosos', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    expect(result).toHaveLength(1)
    expect(result[0].leagueName).toBe('Liga 1')
  })

  it('mapea una copa vigente (temporada current no vieja) con type Cup y hasStandings false', () => {
    const raw = {
      response: [
        {
          league: { id: 42, name: 'Copa Vigente', type: 'Cup', logo: '' },
          country: { name: 'Testland' },
          seasons: [{ year: 2026, current: true, end: '2099-01-01', coverage: { standings: false } }],
        },
      ],
    }
    const result = mapCompetitionsResponse(raw)
    expect(result[0]).toMatchObject({ leagueName: 'Copa Vigente', type: 'Cup', hasStandings: false })
  })

  it('ordena ligas antes que copas, preservando el orden relativo dentro de cada grupo', () => {
    const futureEnd = '2099-01-01'
    const raw = {
      response: [
        { league: { id: 1, name: 'Copa A', type: 'Cup', logo: '' }, country: { name: 'Testland' }, seasons: [{ year: 2026, current: true, end: futureEnd, coverage: {} }] },
        { league: { id: 2, name: 'Liga B', type: 'League', logo: '' }, country: { name: 'Testland' }, seasons: [{ year: 2026, current: true, end: futureEnd, coverage: {} }] },
        { league: { id: 3, name: 'Copa C', type: 'Cup', logo: '' }, country: { name: 'Testland' }, seasons: [{ year: 2026, current: true, end: futureEnd, coverage: {} }] },
        { league: { id: 4, name: 'Liga D', type: 'League', logo: '' }, country: { name: 'Testland' }, seasons: [{ year: 2026, current: true, end: futureEnd, coverage: {} }] },
      ],
    }
    const result = mapCompetitionsResponse(raw)
    expect(result.map(c => c.leagueId)).toEqual([2, 4, 1, 3])
  })

  it('usa "Cup" como default cuando el tipo de competencia no es "League" ni "Cup"', () => {
    const raw = {
      response: [
        { league: { id: 9, name: 'Torneo Raro', type: 'Weird', logo: '' }, country: { name: 'Testland' }, seasons: [{ year: 2026, current: true, end: '2099-01-01', coverage: {} }] },
      ],
    }
    const result = mapCompetitionsResponse(raw)
    expect(result[0].type).toBe('Cup')
  })
})

describe('dedupeTransfers', () => {
  const transfer = (over: Partial<PlayerTransfer> = {}): PlayerTransfer => ({
    date: '2026-01-15',
    type: 'Free',
    teams: { in: { id: 1, name: 'Club A', logo: '' }, out: { id: 2, name: 'Club B', logo: '' } },
    fee: null,
    ...over,
  })

  it('saca la fila repetida (caso real: la API-Football devuelve cada traspaso dos veces)', () => {
    const transfers = [transfer(), transfer()]
    const result = dedupeTransfers(transfers)
    expect(result).toHaveLength(1)
  })

  it('saca el duplicado aunque la fecha difiera un dia (caso real: N. Leguizamon Deportivo Cuenca -> Juan Pablo II College el 13 y el 14 de julio)', () => {
    const transfers = [
      transfer({ date: '2026-07-13' }),
      transfer({ date: '2026-07-14' }),
    ]
    const result = dedupeTransfers(transfers)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-07-13')
  })

  it('no fusiona dos movimientos legitimos entre los mismos clubes separados por meses (prestamo y despues compra)', () => {
    const transfers = [
      transfer({ date: '2025-08-01', type: 'Loan' }),
      transfer({ date: '2026-06-01', type: 'Loan' }),
    ]
    const result = dedupeTransfers(transfers)
    expect(result).toHaveLength(2)
  })

  it('deja pasar dos movimientos legitimos distintos (mismo dia, clubes distintos)', () => {
    const transfers = [
      transfer({ teams: { in: { id: 1, name: 'Club A', logo: '' }, out: { id: 2, name: 'Club B', logo: '' } } }),
      transfer({ teams: { in: { id: 3, name: 'Club C', logo: '' }, out: { id: 1, name: 'Club A', logo: '' } } }),
    ]
    const result = dedupeTransfers(transfers)
    expect(result).toHaveLength(2)
  })

  it('con la lista vacia, devuelve vacio', () => {
    expect(dedupeTransfers([])).toEqual([])
  })
})
