import { describe, it, expect } from 'vitest'
import { applyScoreGG, type ScoreGGEntry } from './scoring'
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

const lookup = new Map<string, ScoreGGEntry>([
  ['gonzalo gonzalez', { score: 2.9, percentile: 2.03 }],
  ['matias espindola', { score: 7.9, percentile: 88.1 }],
])

describe('applyScoreGG', () => {
  it('pega el Score GG de la API en la escala 1-10', () => {
    const [p] = applyScoreGG([raw('Matías Espíndola')], 'interno', lookup)
    expect(p.ggScore).toBe(7.9)
    expect(p.ggScorePercentile).toBe(88.1)
  })

  it('matchea ignorando acentos y mayúsculas', () => {
    const [p] = applyScoreGG([raw('GONZALO GONZÁLEZ')], 'externo', lookup)
    expect(p.ggScore).toBe(2.9)
  })

  it('deja sin score al jugador que la API no tiene, en vez de inventar uno', () => {
    const [p] = applyScoreGG([raw('Jugador Inexistente')], 'externo', lookup)
    expect(p.ggScore).toBeNull()
    expect(p.ggScorePercentile).toBeNull()
  })

  it('nunca devuelve un score fuera de 1-10', () => {
    const players = applyScoreGG(
      [raw('Matías Espíndola'), raw('Gonzalo González')],
      'interno',
      lookup,
    )
    for (const p of players) {
      expect(p.ggScore).not.toBeNull()
      expect(p.ggScore!).toBeGreaterThanOrEqual(1)
      expect(p.ggScore!).toBeLessThanOrEqual(10)
    }
  })

  it('conserva la fuente que se le pasa', () => {
    const [p] = applyScoreGG([raw('Matías Espíndola')], 'interno', lookup)
    expect(p.source).toBe('interno')
  })
})
