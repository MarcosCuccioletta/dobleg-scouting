import { FORMATIONS } from '@/constants/formations'
import type { FutureSquadSlot } from '@/services/futureSquadService'

export interface LineupPlayerForPrefill {
  id: number
  name: string
  number: number | null
}

export function mapLineupToSlots(
  startXI: LineupPlayerForPrefill[],
  formationType: string,
): { formationType: string; slots: FutureSquadSlot[] } {
  const resolvedFormationType = FORMATIONS[formationType] ? formationType : '4-3-3'
  const positionKeys = FORMATIONS[resolvedFormationType].positions.map(p => p.key)

  const slots: FutureSquadSlot[] = positionKeys.map((slotKey, i) => {
    const player = startXI[i]
    if (!player) {
      return { slotKey, source: null, playerId: null, playerName: null, playerNumber: null, rating: null }
    }
    return {
      slotKey,
      source: 'squad',
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      rating: null,
    }
  })

  return { formationType: resolvedFormationType, slots }
}
