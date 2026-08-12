import { describe, it, expect } from 'vitest'
import { clampPercent, pointsToPathD, arrowHeadPoints, toScreenPoint, fromScreenPoint } from './boardGeometry'

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

describe('toScreenPoint', () => {
  it('en vertical no transforma nada', () => {
    expect(toScreenPoint({ x: 15, y: 72 }, 'vertical')).toEqual({ x: 15, y: 72 })
  })

  it('en horizontal, el arco propio (y alto) queda del lado derecho de la pantalla', () => {
    // GK propio: x:50, y:92 (pegado al arco propio) -> pantalla x:92 (cerca del borde derecho)
    expect(toScreenPoint({ x: 50, y: 92 }, 'horizontal')).toEqual({ x: 92, y: 50 })
  })

  it('en horizontal, el arco rival (y bajo) queda del lado izquierdo de la pantalla', () => {
    // ST propio: x:50, y:20 (cerca del arco rival) -> pantalla x:20 (cerca del borde izquierdo)
    expect(toScreenPoint({ x: 50, y: 20 }, 'horizontal')).toEqual({ x: 20, y: 50 })
  })

  it('en horizontal, LB (x chico) y RB (x grande) no se mezclan entre si', () => {
    const lb = toScreenPoint({ x: 15, y: 72 }, 'horizontal')
    const rb = toScreenPoint({ x: 85, y: 72 }, 'horizontal')
    expect(lb).toEqual({ x: 72, y: 85 })
    expect(rb).toEqual({ x: 72, y: 15 })
  })
})

describe('fromScreenPoint', () => {
  it('es la inversa exacta de toScreenPoint en horizontal', () => {
    const original = { x: 32, y: 78 }
    const screen = toScreenPoint(original, 'horizontal')
    expect(fromScreenPoint(screen, 'horizontal')).toEqual(original)
  })

  it('en vertical no transforma nada', () => {
    expect(fromScreenPoint({ x: 15, y: 72 }, 'vertical')).toEqual({ x: 15, y: 72 })
  })
})
