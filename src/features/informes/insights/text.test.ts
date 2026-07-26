import { describe, it, expect } from 'vitest'
import { renderItem, renderTile, formatNum } from './text'
import type { InsightItem, InsightTile } from './types'

const item = (id: string, values: InsightItem['values'], tone: InsightItem['tone'] = 'neutral'): InsightItem =>
  ({ id, values, tone })

describe('formatNum', () => {
  it('usa coma decimal en español', () => {
    expect(formatNum(0.46, 'es')).toBe('0,46')
  })
  it('usa punto decimal en inglés', () => {
    expect(formatNum(0.46, 'en')).toBe('0.46')
  })
  it('no agrega decimales a los enteros', () => {
    expect(formatNum(21, 'es')).toBe('21')
  })
})

describe('renderItem — continuidad', () => {
  it('disponibilidad total en español', () => {
    const text = renderItem(item('cont.pj', { played: 46, teamMatches: 46, pct: 100 }, 'strong'), 'es')
    expect(text).toBe('Jugó los 46 partidos oficiales del equipo: disponibilidad total.')
  })

  it('disponibilidad parcial', () => {
    const text = renderItem(item('cont.pj', { played: 30, teamMatches: 46, pct: 65.2 }, 'weak'), 'es')
    expect(text).toBe('Disputó 30 de los 46 partidos oficiales del equipo (65,2%).')
  })

  it('traduce al inglés', () => {
    const text = renderItem(item('cont.pj', { played: 46, teamMatches: 46, pct: 100 }, 'strong'), 'en')
    expect(text).toBe('Played all 46 official matches: fully available.')
  })
})

describe('renderItem — peso ofensivo', () => {
  it('share alto usa la redacción de "uno de cada cuatro"', () => {
    const text = renderItem(item('ofe.share', { ga: 21, teamGoals: 76, pct: 27.6 }, 'strong'), 'es')
    expect(text).toBe('Participó en 21 de los 76 goles del equipo: más de uno de cada cuatro (27,6%).')
  })

  it('share bajo enuncia el porcentaje sin adorno', () => {
    const text = renderItem(item('ofe.share', { ga: 3, teamGoals: 40, pct: 7.5 }, 'weak'), 'es')
    expect(text).toBe('Participó en 3 de los 40 goles del equipo (7,5%).')
  })

  it('promedio por partido', () => {
    const text = renderItem(item('ofe.promedio', { perMatch: 0.46, goalsPerMatch: 0.22, assistsPerMatch: 0.24 }), 'es')
    expect(text).toBe('Promedia 0,46 participaciones de gol por partido (0,22 goles y 0,24 asistencias).')
  })
})

describe('renderItem — plantel', () => {
  it('primer puesto en una acumulada', () => {
    const text = renderItem(item('plantel.assists', { rank: 1, pool: 22, value: 11, teamTotal: 40, pct: 27.5, minMinutes: 400 }, 'strong'), 'es')
    expect(text).toBe('Es el que más asistencias dio del plantel: 11 de 40 (27,5% del total).')
  })

  it('segundo puesto', () => {
    const text = renderItem(item('plantel.keyPasses', { rank: 2, pool: 22, value: 25, teamTotal: 218, pct: 11.5, minMinutes: 400 }), 'es')
    expect(text).toBe('2º del plantel en pases clave: 25 de 218 (11,5% del total).')
  })

  it('métrica de eficacia enuncia el umbral', () => {
    const text = renderItem(item('plantel.duelPct', { rank: 1, pool: 14, value: 61.5, teamTotal: 0, pct: 0, minMinutes: 400 }, 'strong'), 'es')
    expect(text).toBe('Gana el 61,5% de sus duelos: el mejor entre los 14 jugadores con más de 400 minutos.')
  })
})

describe('renderItem — rendimiento y resultados', () => {
  it('tendencia en alza', () => {
    const text = renderItem(item('rend.tendencia', { delta: 0.6, direction: 'up', recent: 7.4, previous: 6.8 }, 'strong'), 'es')
    expect(text).toBe('Viene en alza: 7,4 de promedio en los últimos partidos contra 6,8 antes.')
  })

  it('tendencia sostenida', () => {
    const text = renderItem(item('rend.tendencia', { delta: 0.1, direction: 'flat', recent: 7, previous: 6.9 }), 'es')
    expect(text).toBe('Rendimiento sostenido: 7 de promedio en los últimos partidos contra 6,9 antes.')
  })

  it('impacto en resultados', () => {
    const text = renderItem(item('res.conSinEl', { withPpg: 1.9, withoutPpg: 1.1, diff: 0.8, withMatches: 20, withoutMatches: 8 }, 'strong'), 'es')
    expect(text).toBe('Con él en cancha el equipo saca 1,9 puntos por partido; sin él, 1,1.')
  })
})

describe('renderItem — desconocido', () => {
  it('devuelve cadena vacía en vez de romper', () => {
    expect(renderItem(item('nope.nada', {}), 'es')).toBe('')
  })
})

describe('renderTile', () => {
  const tile = (id: string, values: InsightTile['values'], extra: Partial<InsightTile> = {}): InsightTile =>
    ({ id, render: 'plain', values, ...extra })

  it('tarjeta de partidos', () => {
    expect(renderTile(tile('tile.pj', { played: 46, teamMatches: 46, pct: 100 }), 'es')).toEqual({
      value: '46/46', sub: 'Partidos jugados',
    })
  })

  it('tarjeta de participaciones', () => {
    expect(renderTile(tile('tile.ga', { goals: 10, assists: 11, ga: 21 }), 'es')).toEqual({
      value: '21', sub: '10 goles · 11 asistencias',
    })
  })

  it('tarjeta de share', () => {
    expect(renderTile(tile('tile.share', { pct: 27.6, ga: 21, teamGoals: 76 }), 'es')).toEqual({
      value: '27,6%', sub: 'De los goles del equipo',
    })
  })
})
