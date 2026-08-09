import type { ApiFixtureLineupPlayer } from '@/types/footballApi'
import type { SquadPlayer } from '@/services/footballApiService'

export type LineupPositionGroup = 'Arqueros' | 'Defensores' | 'Mediocampistas' | 'Delanteros' | 'Otros'

export const LINEUP_GROUP_ORDER: LineupPositionGroup[] = [
  'Arqueros', 'Defensores', 'Mediocampistas', 'Delanteros', 'Otros',
]

const API_POSITION_TO_GROUP: Record<string, LineupPositionGroup> = {
  Goalkeeper: 'Arqueros',
  Defender: 'Defensores',
  Midfielder: 'Mediocampistas',
  Attacker: 'Delanteros',
}

export interface GroupedLineupPlayer {
  id: number
  name: string
  number: number | null
}

export function groupLineupByPosition(
  players: ApiFixtureLineupPlayer[],
  squad: SquadPlayer[],
): Record<LineupPositionGroup, GroupedLineupPlayer[]> {
  const squadById = new Map(squad.map(s => [s.id, s]))
  const groups: Record<LineupPositionGroup, GroupedLineupPlayer[]> = {
    Arqueros: [], Defensores: [], Mediocampistas: [], Delanteros: [], Otros: [],
  }
  for (const { player } of players) {
    const squadPlayer = squadById.get(player.id)
    const group = (squadPlayer?.position && API_POSITION_TO_GROUP[squadPlayer.position]) || 'Otros'
    groups[group].push({ id: player.id, name: player.name, number: player.number })
  }
  return groups
}
