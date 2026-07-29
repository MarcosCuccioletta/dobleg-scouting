import { describe, it, expect } from 'vitest'
import { inferContext } from './inferContext'

const TODAY = new Date('2026-07-29T12:00:00Z')

describe('inferContext', () => {
  it('saca rival y fecha del preámbulo de Estudiantes', () => {
    const ctx = inferContext([
      'A.A. ESTUDIANTES',
      'Micro N 9, 25 de Julio, 14:45hs, 16°',
      'Fecha n1 vs Tigre (L)',
    ], TODAY)

    expect(ctx.rival).toBe('Tigre')
    expect(ctx.matchDate).toBe('2026-07-25')
    expect(ctx.teamText).toBe('A.A. ESTUDIANTES')
  })

  it('usa el año anterior si la fecha caería en el futuro', () => {
    const ctx = inferContext(['Fecha n1 vs Tigre (L)', '25 de Diciembre'], TODAY)
    expect(ctx.matchDate).toBe('2025-12-25')
  })

  it('entiende fechas numéricas', () => {
    expect(inferContext(['Partido del 03/05/2026'], TODAY).matchDate).toBe('2026-05-03')
    expect(inferContext(['2026-05-03 vs Ajax'], TODAY).matchDate).toBe('2026-05-03')
  })

  it('devuelve nulls cuando no hay nada que inferir', () => {
    expect(inferContext([], TODAY)).toEqual({ rival: null, matchDate: null, teamText: null })
  })
})
