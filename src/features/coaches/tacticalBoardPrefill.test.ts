import { describe, expect, it } from 'vitest'
import { mirrorFormationForRival, nextMarkerPosition, formationSlotPositions, nearestFormationSlotKey } from './tacticalBoardPrefill'

describe('mirrorFormationForRival', () => {
  it('refleja el eje Y de cada posicion de la formacion, mismo orden', () => {
    const mirrored = mirrorFormationForRival('4-3-3')
    // 4-3-3 real: GK es la primera posicion, x:50 y:92 (cerca del arco propio, abajo)
    expect(mirrored[0]).toEqual({ x: 50, y: 8 })
    // ST (delantero) x:50 y:20 (cerca del arco rival, arriba) -> reflejado queda
    // cerca del arco PROPIO (abajo), como corresponde a un delantero rival que ataca.
    const stIndex = 9 // orden de FORMATIONS['4-3-3'].positions: GK,LB,CB1,CB2,RB,CM1,CM2,CM3,LW,ST,RW
    expect(mirrored[stIndex]).toEqual({ x: 50, y: 80 })
  })

  it('formacion desconocida cae a 4-3-3', () => {
    const mirrored = mirrorFormationForRival('4-1-4-1')
    expect(mirrored).toHaveLength(11)
  })
})

describe('nextMarkerPosition', () => {
  it('sin fichas propias, la primera va al primer slot de la formacion (GK)', () => {
    const pos = nextMarkerPosition([], 'propio', '4-3-3')
    expect(pos).toEqual({ x: 50, y: 92 })
  })

  it('con el slot de GK ya ocupado, la siguiente ficha propia va al segundo slot (LB)', () => {
    const existing = [{ team: 'propio' as const, x: 50, y: 92 }]
    const pos = nextMarkerPosition(existing, 'propio', '4-3-3')
    expect(pos).toEqual({ x: 15, y: 72 })
  })

  it('las fichas de rival no bloquean los slots de propio', () => {
    const existing = [{ team: 'rival' as const, x: 50, y: 92 }]
    const pos = nextMarkerPosition(existing, 'propio', '4-3-3')
    expect(pos).toEqual({ x: 50, y: 92 })
  })

  it('con los 11 slots propios ocupados, cae a cascada sin repetir la misma posicion', () => {
    const existing = FORMATIONS_4_3_3_POSITIONS.map(p => ({ team: 'propio' as const, x: p.x, y: p.y }))
    const pos = nextMarkerPosition(existing, 'propio', '4-3-3')
    expect(pos).toEqual({ x: 50, y: 50 })
  })
})

const FORMATIONS_4_3_3_POSITIONS = [
  { x: 50, y: 92 }, { x: 15, y: 72 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 72 },
  { x: 30, y: 50 }, { x: 50, y: 55 }, { x: 70, y: 50 }, { x: 18, y: 25 }, { x: 50, y: 20 }, { x: 82, y: 25 },
]

describe('formationSlotPositions', () => {
  it('propio devuelve las posiciones de FORMATIONS tal cual', () => {
    expect(formationSlotPositions('propio', '4-3-3')).toEqual(FORMATIONS_4_3_3_POSITIONS)
  })

  it('rival devuelve las posiciones espejadas', () => {
    expect(formationSlotPositions('rival', '4-3-3')).toEqual(mirrorFormationForRival('4-3-3'))
  })
})

describe('nearestFormationSlotKey', () => {
  it('un punto exactamente sobre un slot devuelve ese slot', () => {
    expect(nearestFormationSlotKey({ x: 50, y: 92 }, '4-3-3')).toBe('GK')
    expect(nearestFormationSlotKey({ x: 50, y: 20 }, '4-3-3')).toBe('ST')
  })

  it('un punto cercano a un slot (arrastrado un poco) devuelve el mas cercano', () => {
    expect(nearestFormationSlotKey({ x: 17, y: 70 }, '4-3-3')).toBe('LB')
  })

  it('formacion desconocida cae a 4-3-3', () => {
    expect(nearestFormationSlotKey({ x: 50, y: 92 }, '4-1-4-1')).toBe('GK')
  })
})
