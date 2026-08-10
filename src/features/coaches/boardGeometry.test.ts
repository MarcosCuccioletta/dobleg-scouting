import { describe, it, expect } from 'vitest'
import { clampPercent, pointsToPathD, arrowHeadPoints } from './boardGeometry'

describe('clampPercent', () => {
  it('deja pasar valores dentro de 0-100', () => {
    expect(clampPercent(50)).toBe(50)
    expect(clampPercent(0)).toBe(0)
    expect(clampPercent(100)).toBe(100)
  })

  it('satura valores negativos a 0', () => {
    expect(clampPercent(-10)).toBe(0)
  })

  it('satura valores mayores a 100', () => {
    expect(clampPercent(150)).toBe(100)
  })
})

describe('pointsToPathD', () => {
  it('sin puntos devuelve string vacio', () => {
    expect(pointsToPathD([])).toBe('')
  })

  it('con un punto arma un M seguido de L al mismo punto', () => {
    expect(pointsToPathD([{ x: 10, y: 20 }])).toBe('M 10 20 L 10 20')
  })

  it('con varios puntos arma M seguido de L por cada uno', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }]
    expect(pointsToPathD(points)).toBe('M 0 0 L 10 10 L 20 5')
  })
})

describe('arrowHeadPoints', () => {
  it('para una flecha horizontal, los puntos laterales quedan simetricos arriba y abajo del final', () => {
    const [left, tip, right] = arrowHeadPoints(0, 0, 10, 0, 3)
    expect(tip).toEqual({ x: 10, y: 0 })
    expect(left.y).toBeCloseTo(-right.y, 5)
    expect(left.x).toBeCloseTo(right.x, 5)
    expect(left.x).toBeLessThan(10)
  })

  it('para una flecha vertical hacia abajo, los puntos laterales quedan simetricos a izquierda y derecha', () => {
    const [left, tip, right] = arrowHeadPoints(0, 0, 0, 10, 3)
    expect(tip).toEqual({ x: 0, y: 10 })
    expect(left.x).toBeCloseTo(-right.x, 5)
    expect(left.y).toBeCloseTo(right.y, 5)
    expect(left.y).toBeLessThan(10)
  })
})
