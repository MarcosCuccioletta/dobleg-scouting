import { describe, it, expect } from 'vitest'
import { formatMarketValueInCurrency } from './scoring'

describe('formatMarketValueInCurrency', () => {
  it('formatea en EUR sin convertir', () => {
    expect(formatMarketValueInCurrency(600_000, 'EUR', 1.08)).toBe('€600K')
    expect(formatMarketValueInCurrency(12_000_000, 'EUR', 1.08)).toBe('€12.0M')
  })

  it('convierte a USD multiplicando por la tasa', () => {
    expect(formatMarketValueInCurrency(1_000_000, 'USD', 1.08)).toBe('$1.1M')
    expect(formatMarketValueInCurrency(500_000, 'USD', 1.08)).toBe('$540K')
  })

  it('devuelve "-" para 0 o vacío en cualquier moneda', () => {
    expect(formatMarketValueInCurrency(0, 'USD', 1.08)).toBe('-')
    expect(formatMarketValueInCurrency(0, 'EUR', 1.08)).toBe('-')
  })

  it('redondea K sin decimales y M con 1 decimal, igual que el formateador EUR existente', () => {
    expect(formatMarketValueInCurrency(750_000, 'EUR', 1.08)).toBe('€750K')
    expect(formatMarketValueInCurrency(2_800_000, 'EUR', 1.08)).toBe('€2.8M')
  })
})
