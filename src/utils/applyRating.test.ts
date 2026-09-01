import { describe, it, expect } from 'vitest'
import { applyRating, type RatingEntry } from './scoring'
import type { RawExternalPlayer } from '@/types'

function raw(nombre: string): RawExternalPlayer {
  return {
    Jugador: nombre,
    Equipo: 'Club',
    Liga: 'Liga Argentina',
    'Posición': 'Defensor Central',
    Edad: '22',
  } as unknown as RawExternalPlayer
}

const lookup = new Map<string, RatingEntry>([
  ['gonzalo gonzalez', { score: 2.9, percentile: 2.03 }],
  ['matias espindola', { score: 7.9, percentile: 88.1 }],
])

describe('applyRating', () => {
  it('pega el Rating de la API en la escala 1-10', () => {
    const [p] = applyRating([raw('Matías Espíndola')], 'interno', lookup)
    expect(p.rating).toBe(7.9)
    expect(p.ratingPercentile).toBe(88.1)
  })

  it('matchea ignorando acentos y mayúsculas', () => {
    const [p] = applyRating([raw('GONZALO GONZÁLEZ')], 'externo', lookup)
    expect(p.rating).toBe(2.9)
  })

  it('deja sin score al jugador que la API no tiene, en vez de inventar uno', () => {
    const [p] = applyRating([raw('Jugador Inexistente')], 'externo', lookup)
    expect(p.rating).toBeNull()
    expect(p.ratingPercentile).toBeNull()
  })

  it('nunca devuelve un score fuera de 1-10', () => {
    const players = applyRating(
      [raw('Matías Espíndola'), raw('Gonzalo González')],
      'interno',
      lookup,
    )
    for (const p of players) {
      expect(p.rating).not.toBeNull()
      expect(p.rating!).toBeGreaterThanOrEqual(1)
      expect(p.rating!).toBeLessThanOrEqual(10)
    }
  })

  it('conserva la fuente que se le pasa', () => {
    const [p] = applyRating([raw('Matías Espíndola')], 'interno', lookup)
    expect(p.source).toBe('interno')
  })
})
