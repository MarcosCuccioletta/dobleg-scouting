import { describe, it, expect } from 'vitest'
import { groupLineupByPosition } from './lineupGrouping'
import type { ApiFixtureLineupPlayer } from '@/types/footballApi'
import type { SquadPlayer } from '@/services/footballApiService'

function mkLineupPlayer(id: number, name: string, number: number | null = null): ApiFixtureLineupPlayer {
  return { player: { id, name, number, pos: null, grid: null } }
}

function mkSquadPlayer(id: number, position: string | null): SquadPlayer {
  return { id, name: '', age: null, number: null, position, photo: null }
}

describe('groupLineupByPosition', () => {
  it('agrupa jugadores segun la posicion del plantel', () => {
    const players = [mkLineupPlayer(1, 'Arquero'), mkLineupPlayer(2, 'Defensor')]
    const squad = [mkSquadPlayer(1, 'Goalkeeper'), mkSquadPlayer(2, 'Defender')]
    const grouped = groupLineupByPosition(players, squad)
    expect(grouped.Arqueros).toHaveLength(1)
    expect(grouped.Defensores).toHaveLength(1)
    expect(grouped.Mediocampistas).toHaveLength(0)
  })

  it('jugador sin match en el plantel cae en Otros', () => {
    const players = [mkLineupPlayer(99, 'Desconocido')]
    const grouped = groupLineupByPosition(players, [])
    expect(grouped.Otros).toHaveLength(1)
    expect(grouped.Otros[0].name).toBe('Desconocido')
  })

  it('jugador del plantel con position null cae en Otros', () => {
    const players = [mkLineupPlayer(1, 'Sin Posicion')]
    const squad = [mkSquadPlayer(1, null)]
    const grouped = groupLineupByPosition(players, squad)
    expect(grouped.Otros).toHaveLength(1)
  })

  it('conserva el numero de camiseta', () => {
    const players = [mkLineupPlayer(1, 'Con Numero', 7)]
    const squad = [mkSquadPlayer(1, 'Attacker')]
    const grouped = groupLineupByPosition(players, squad)
    expect(grouped.Delanteros[0].number).toBe(7)
  })
})
