import { describe, it, expect } from 'vitest'
import { normalizeLabel, slugify, parseNumber } from './normalize'

describe('normalizeLabel', () => {
  it('baja a minúsculas, saca acentos y colapsa espacios', () => {
    expect(normalizeLabel('  Vel   Máx ')).toBe('vel max')
    expect(normalizeLabel('Dist Rel x Min')).toBe('dist rel x min')
    expect(normalizeLabel('% Alta Intensidad')).toBe('% alta intensidad')
  })
})

describe('slugify', () => {
  it('arma una key estable', () => {
    expect(slugify('Dist Acele')).toBe('dist_acele')
    expect(slugify('Dist AI (16)')).toBe('dist_ai_16')
    expect(slugify('Vel Máx (km/h)')).toBe('vel_max_km_h')
  })
})

describe('parseNumber', () => {
  it('acepta enteros y coma decimal', () => {
    expect(parseNumber('10222')).toBe(10222)
    expect(parseNumber('30,8')).toBe(30.8)
    expect(parseNumber('117.5')).toBe(117.5)
  })

  it('resuelve separadores de miles', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5)
    expect(parseNumber('1,234')).toBe(1234)
  })

  it('devuelve null para lo que no es un número', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('Ojeda')).toBeNull()
    expect(parseNumber('DZ4')).toBeNull()
    expect(parseNumber('% EQUIPO')).toBeNull()
    expect(parseNumber('1 Tiempo')).toBeNull()
  })
})
