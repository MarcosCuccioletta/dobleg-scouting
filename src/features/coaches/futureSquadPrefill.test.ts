import { describe, expect, it } from 'vitest'
import { mapLineupToSlots, type LineupPlayerForPrefill } from './futureSquadPrefill'

function makePlayer(id: number, name: string): LineupPlayerForPrefill {
  return { id, name, number: id }
}

describe('mapLineupToSlots', () => {
  it('ubica los 11 titulares en orden sobre los slots de la formacion elegida', () => {
    const startXI = Array.from({ length: 11 }, (_, i) => makePlayer(i + 1, `Jugador ${i + 1}`))
    const { formationType, slots } = mapLineupToSlots(startXI, '4-3-3')

    expect(formationType).toBe('4-3-3')
    expect(slots).toHaveLength(11)
    expect(slots[0]).toEqual({
      slotKey: 'GK', source: 'squad', playerId: 1, playerName: 'Jugador 1', playerNumber: 1, rating: null,
    })
    expect(slots[10]).toEqual({
      slotKey: 'RW', source: 'squad', playerId: 11, playerName: 'Jugador 11', playerNumber: 11, rating: null,
    })
    expect(slots.every(s => s.source === 'squad')).toBe(true)
  })

  it('usa 4-3-3 por defecto si la formacion reportada no es conocida', () => {
    const startXI = Array.from({ length: 11 }, (_, i) => makePlayer(i + 1, `Jugador ${i + 1}`))
    const { formationType, slots } = mapLineupToSlots(startXI, '4-1-4-1')

    expect(formationType).toBe('4-3-3')
    expect(slots.map(s => s.slotKey)).toEqual(['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM1', 'CM2', 'CM3', 'LW', 'ST', 'RW'])
  })

  it('deja vacios los slots sin jugador correspondiente si el startXI trae menos de 11', () => {
    const startXI = Array.from({ length: 8 }, (_, i) => makePlayer(i + 1, `Jugador ${i + 1}`))
    const { slots } = mapLineupToSlots(startXI, '4-4-2')

    expect(slots).toHaveLength(11)
    expect(slots.slice(0, 8).every(s => s.source === 'squad')).toBe(true)
    expect(slots.slice(8).every(s => s.source === null && s.playerId === null)).toBe(true)
  })

  it('devuelve slots vacios para un startXI vacio', () => {
    const { slots } = mapLineupToSlots([], '4-2-3-1')
    expect(slots).toHaveLength(11)
    expect(slots.every(s => s.source === null)).toBe(true)
  })
})
