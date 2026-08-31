import type { SquadPlayer } from '@/services/footballApiService'

// Label singular (clave de traduccion), para el texto chico debajo del nombre
// de cada jugador. Se resuelve con t() en el componente, no aca.
export const POSITION_LABEL_KEY: Record<string, string> = {
  Goalkeeper: 'squadPosition.arquero',
  Defender: 'squadPosition.defensor',
  Midfielder: 'squadPosition.mediocampista',
  Attacker: 'squadPosition.delantero',
}

// Label plural (clave de traduccion), para el encabezado de cada seccion del plantel.
const SECTION_LABEL_KEY: Record<string, string> = {
  Goalkeeper: 'squadPosition.arqueros',
  Defender: 'squadPosition.defensores',
  Midfielder: 'squadPosition.mediocampistas',
  Attacker: 'squadPosition.delanteros',
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
const UNKNOWN_LABEL_KEY = 'squadPosition.otros'

export interface SquadPositionGroup {
  positionKey: string
  labelKey: string
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
      labelKey: SECTION_LABEL_KEY[key] ?? UNKNOWN_LABEL_KEY,
      players: sorted,
    })
  }

  groups.sort((a, b) => (POSITION_ORDER[a.positionKey] ?? UNKNOWN_ORDER) - (POSITION_ORDER[b.positionKey] ?? UNKNOWN_ORDER))
  return groups
}
