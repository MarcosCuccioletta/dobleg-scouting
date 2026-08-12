import { FORMATIONS } from '@/constants/formations'
import type { MarkerTeam } from '@/services/tacticalBoardService'

export function mirrorFormationForRival(formationType: string): { x: number; y: number }[] {
  const resolved = FORMATIONS[formationType] ? formationType : '4-3-3'
  return FORMATIONS[resolved].positions.map(p => ({ x: p.x, y: 100 - p.y }))
}

const CLOSE_ENOUGH_PCT = 3

export function nextMarkerPosition(
  existingMarkers: { team: MarkerTeam | null; x: number; y: number }[],
  team: MarkerTeam,
  formationType: string,
): { x: number; y: number } {
  const resolved = FORMATIONS[formationType] ? formationType : '4-3-3'
  const ownSlots = FORMATIONS[resolved].positions.map(p => ({ x: p.x, y: p.y }))
  const rivalSlots = mirrorFormationForRival(resolved)
  const slots = team === 'propio' ? ownSlots : rivalSlots

  const sameTeam = existingMarkers.filter(m => m.team === team)

  const isOccupied = (slot: { x: number; y: number }) =>
    sameTeam.some(m => Math.abs(m.x - slot.x) < CLOSE_ENOUGH_PCT && Math.abs(m.y - slot.y) < CLOSE_ENOUGH_PCT)

  const freeSlot = slots.find(slot => !isOccupied(slot))
  if (freeSlot) return freeSlot

  // Los 11 slots de la formacion ya estan ocupados por este equipo: cascada para
  // que nunca dos fichas nuevas caigan exactamente superpuestas (invisibles).
  const n = sameTeam.length - FORMATIONS[resolved].positions.length
  return { x: 50 + (n % 5) * 6, y: 50 + Math.floor(n / 5) * 6 }
}
