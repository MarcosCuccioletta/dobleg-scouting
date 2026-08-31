import { describe, it, expect } from 'vitest'
import { dateToPercent, percentToDate } from './dateRangeSlider'

describe('dateToPercent', () => {
  it('la fecha minima es 0%, la maxima es 100%', () => {
    expect(dateToPercent('2026-08-02', '2026-08-02', '2026-08-30')).toBe(0)
    expect(dateToPercent('2026-08-30', '2026-08-02', '2026-08-30')).toBe(100)
  })
  it('una fecha a mitad de camino da ~50%', () => {
    expect(dateToPercent('2026-08-16', '2026-08-02', '2026-08-30')).toBeCloseTo(50, 0)
  })
  it('con min === max (un solo partido) siempre da 100% sin dividir por cero', () => {
    expect(dateToPercent('2026-08-16', '2026-08-16', '2026-08-16')).toBe(100)
  })
})

describe('percentToDate', () => {
  it('0% da la fecha minima, 100% da la maxima', () => {
    expect(percentToDate(0, '2026-08-02', '2026-08-30')).toBe('2026-08-02')
    expect(percentToDate(100, '2026-08-02', '2026-08-30')).toBe('2026-08-30')
  })
  it('con min === max siempre devuelve esa fecha', () => {
    expect(percentToDate(37, '2026-08-16', '2026-08-16')).toBe('2026-08-16')
  })
  it('es la inversa aproximada de dateToPercent', () => {
    const pct = dateToPercent('2026-08-16', '2026-08-02', '2026-08-30')
    expect(percentToDate(pct, '2026-08-02', '2026-08-30')).toBe('2026-08-16')
  })
})
