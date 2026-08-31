import { describe, it, expect } from 'vitest'
import { classifyPhase, inferZoneRect } from './videoAnalysisTagging'

describe('classifyPhase', () => {
  it('clasifica terminos ofensivos', () => {
    expect(classifyPhase('Salida en corto')).toBe('ofensiva')
    expect(classifyPhase('Ataque posicional')).toBe('ofensiva')
  })
  it('clasifica terminos defensivos', () => {
    expect(classifyPhase('Presión alta')).toBe('defensiva')
    expect(classifyPhase('Repliegue')).toBe('defensiva')
  })
  it('clasifica transiciones', () => {
    expect(classifyPhase('Transición defensiva')).toBe('transicion')
    expect(classifyPhase('TRANSICION OFENSIVA')).toBe('transicion')
  })
  it('clasifica ABP', () => {
    expect(classifyPhase('ABP a favor')).toBe('abp')
    expect(classifyPhase('Córner en contra')).toBe('abp')
    expect(classifyPhase('Tiro libre')).toBe('abp')
  })
  it('es insensible a mayusculas y tildes', () => {
    expect(classifyPhase('PRESION ALTA')).toBe('defensiva')
    expect(classifyPhase('presion alta')).toBe('defensiva')
  })
  it('sin match devuelve otro', () => {
    expect(classifyPhase('Categoría rara sin sentido futbolístico')).toBe('otro')
  })
})

describe('inferZoneRect', () => {
  it('reconoce banda izquierda', () => {
    expect(inferZoneRect('Ataque por izquierda')).toEqual({ x1: 0, y1: 0, x2: 33, y2: 100 })
  })
  it('reconoce banda derecha', () => {
    expect(inferZoneRect('Ataque por derecha')).toEqual({ x1: 67, y1: 0, x2: 100, y2: 100 })
  })
  it('reconoce centro', () => {
    expect(inferZoneRect('Ataque por el centro')).toEqual({ x1: 33, y1: 0, x2: 67, y2: 100 })
  })
  it('reconoce tercio propio (defensivo)', () => {
    expect(inferZoneRect('Salida en corto')).toEqual({ x1: 0, y1: 67, x2: 100, y2: 100 })
  })
  it('reconoce tercio rival (ofensivo)', () => {
    expect(inferZoneRect('Remate en zona ofensiva')).toEqual({ x1: 0, y1: 0, x2: 100, y2: 33 })
  })
  it('sin match devuelve null', () => {
    expect(inferZoneRect('Categoría sin ninguna pista de zona')).toBeNull()
  })
})
