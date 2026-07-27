// El mismo jugador puede estar en la base dos veces: la fila de API-Football y la
// de Sofascore (y a veces la manual de la agencia). Se distinguen por la foto.
// Para el informe conviene siempre la de API-Football: tiene todos los partidos y
// su id es el que la API acepta para traspasos y lesiones — con el id de Sofascore
// la pestaña Carrera vuelve vacía y la continuidad cuenta de menos.

import { isApiFootballPlayer } from '@/services/playerStatsService'
import { normalizeForSearch } from '@/lib/search'
import type { PlayerWithScore } from '@/types/scoring'

/** Misma persona: transfermarkt_id si lo tiene; si no, nombre + fecha de nacimiento. */
function identityKey(p: PlayerWithScore): string {
  if (p.transfermarkt_id) return `tm:${p.transfermarkt_id}`
  if (p.birth_date) return `nb:${normalizeForSearch(p.name)}|${p.birth_date}`
  return `id:${p.id}`
}

/** Cuánto conviene esta fila: API-Football primero, después la que tenga partidos. */
function rank(p: PlayerWithScore): number {
  const matches = p.season_scores?.[0]?.matches_played ?? 0
  return (isApiFootballPlayer(p) ? 1_000_000 : 0) + matches
}

export function dedupePlayers(players: PlayerWithScore[]): PlayerWithScore[] {
  const best = new Map<string, PlayerWithScore>()
  const order: string[] = []

  for (const p of players) {
    const key = identityKey(p)
    const current = best.get(key)
    if (!current) {
      best.set(key, p)
      order.push(key)
    } else if (rank(p) > rank(current)) {
      best.set(key, p)
    }
  }

  return order.map(k => best.get(k)!)
}
