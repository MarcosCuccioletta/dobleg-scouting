import { describe, it, expect } from 'vitest'
import { getMonthKey, formatMonthKey } from './ScoreEvolutionChart'

describe('getMonthKey', () => {
  it('separa el mismo mes de años distintos', () => {
    expect(getMonthKey('2025-05-10')).not.toBe(getMonthKey('2026-05-10'))
  })

  it('agrupa partidos del mismo mes y año', () => {
    expect(getMonthKey('2026-05-03')).toBe(getMonthKey('2026-05-28'))
  })

  it('ordena alfabéticamente igual que cronológicamente', () => {
    const keys = ['2026-03-01', '2025-11-01', '2026-01-01'].map(getMonthKey)
    expect([...keys].sort()).toEqual([getMonthKey('2025-11-01'), getMonthKey('2026-01-01'), getMonthKey('2026-03-01')])
  })
})

describe('formatMonthKey', () => {
  it('muestra sólo el mes cuando el historial es de un año', () => {
    expect(formatMonthKey(getMonthKey('2026-05-10'), false)).toBe('May')
  })

  it('agrega el año cuando el historial abarca varios', () => {
    expect(formatMonthKey(getMonthKey('2025-05-10'), true)).toBe('May 25')
    expect(formatMonthKey(getMonthKey('2026-05-10'), true)).toBe('May 26')
  })

  it('nombra bien el primer y el último mes', () => {
    expect(formatMonthKey(getMonthKey('2026-01-15'), false)).toBe('Ene')
    expect(formatMonthKey(getMonthKey('2026-12-15'), false)).toBe('Dic')
  })
})
