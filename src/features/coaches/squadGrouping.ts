import type { SquadPlayer } from '@/services/footballApiService'

// Label singular, para el texto chico debajo del nombre de cada jugador.
export const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: 'Arquero',
  Defender: 'Defensor',
  Midfielder: 'Mediocampista',
  Attacker: 'Delantero',
}

// Label plural, para el encabezado de cada seccion del plantel.
const SECTION_LABEL: Record<string, string> = {
  Goalkeeper: 'Arqueros',
  Defender: 'Defensores',
  Midfielder: 'Mediocampistas',
  Attacker: 'Delanteros',
}

// Orden futbolistico habitual: arqueros, defensores, mediocampistas, delanteros.
const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Attacker: 3,
}

const UNKNOWN_KEY = 'Unknown'
const UNKNOWN_ORDER = 99
const UNKNOWN_LABEL = 'Otros'

export interface SquadPositionGroup {
  positionKey: string
  label: string
  players: SquadPlayer[]
}

export function groupSquadByPosition(squad: SquadPlayer[]): SquadPositionGroup[] {
  const buckets = new Map<string, SquadPlayer[]>()
  for (const player of squad) {
    const key = player.position ?? UNKNOWN_KEY
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(player)
  }

  const groups: SquadPositionGroup[] = []
  for (const [key, players] of buckets) {
    const sorted = [...players].sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
    groups.push({
      positionKey: key,
      label: SECTION_LABEL[key] ?? UNKNOWN_LABEL,
      players: sorted,
    })
  }

  groups.sort((a, b) => (POSITION_ORDER[a.positionKey] ?? UNKNOWN_ORDER) - (POSITION_ORDER[b.positionKey] ?? UNKNOWN_ORDER))
  return groups
}
