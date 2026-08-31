import { describe, it, expect } from 'vitest'
import { groupSquadByPosition } from './squadGrouping'
import type { SquadPlayer } from '@/services/footballApiService'

function mkPlayer(over: Partial<SquadPlayer> = {}): SquadPlayer {
  return { id: 1, name: 'Jugador', age: 25, number: 10, position: 'Midfielder', photo: null, ...over }
}

describe('groupSquadByPosition', () => {
  it('agrupa en el orden arquero -> defensor -> mediocampista -> delantero', () => {
    const squad = [
      mkPlayer({ id: 1, position: 'Attacker' }),
      mkPlayer({ id: 2, position: 'Goalkeeper' }),
      mkPlayer({ id: 3, position: 'Defender' }),
      mkPlayer({ id: 4, position: 'Midfielder' }),
    ]
    const groups = groupSquadByPosition(squad)
    expect(groups.map(g => g.positionKey)).toEqual(['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'])
  })

  it('omite posiciones sin jugadores en vez de mostrar una seccion vacia', () => {
    const squad = [mkPlayer({ id: 1, position: 'Goalkeeper' })]
    const groups = groupSquadByPosition(squad)
    expect(groups).toHaveLength(1)
    expect(groups[0].positionKey).toBe('Goalkeeper')
  })

  it('ordena los jugadores de cada grupo por dorsal', () => {
    const squad = [
      mkPlayer({ id: 1, position: 'Defender', number: 6 }),
      mkPlayer({ id: 2, position: 'Defender', number: 2 }),
      mkPlayer({ id: 3, position: 'Defender', number: null }),
    ]
    const groups = groupSquadByPosition(squad)
    expect(groups[0].players.map(p => p.id)).toEqual([2, 1, 3])
  })

  it('agrupa posiciones desconocidas o nulas al final bajo "Otros"', () => {
    const squad = [
      mkPlayer({ id: 1, position: 'Attacker' }),
      mkPlayer({ id: 2, position: null }),
    ]
    const groups = groupSquadByPosition(squad)
    expect(groups.map(g => g.positionKey)).toEqual(['Attacker', 'Unknown'])
    expect(groups[1].labelKey).toBe('squadPosition.otros')
  })
})
