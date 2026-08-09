import { fuzzyMatch } from '@/lib/search'
import { toArDateKey, fetchFixtureLineups } from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'
import type { WyscoutMatch } from './parseWyscoutTeamStats'

function daysBetween(dateKeyA: string, dateKeyB: string): number {
  const a = new Date(`${dateKeyA}T00:00:00Z`).getTime()
  const b = new Date(`${dateKeyB}T00:00:00Z`).getTime()
  return Math.abs(a - b) / (1000 * 60 * 60 * 24)
}

// Tolerancia de +-1 dia: Wyscout a veces registra la fecha del partido corrida
// por un dia respecto al fixture de API-Football (visto con datos reales).
// El nombre del rival sigue siendo obligatorio, así que la tolerancia de fecha
// sola nunca genera un match falso.
const MAX_DATE_DIFF_DAYS = 1

export function matchFixtureForRow(row: WyscoutMatch, fixtures: AgencyFixture[]): AgencyFixture | null {
  const candidates = fixtures.filter(f => {
    if (daysBetween(toArDateKey(f.date), row.fecha) > MAX_DATE_DIFF_DAYS) return false
    const opponent = f.isHome ? f.awayTeam.name : f.homeTeam.name
    // fuzzyMatch en vez de igualdad estricta: nombres de club con variantes
    // ("Atlético Rafaela" en Wyscout vs "Atlético DE Rafaela" en la API) son
    // comunes en datos reales. La fecha (+-1 dia) ya acota mucho los candidatos,
    // así que el riesgo de un match cruzado por nombre queda bajo.
    return fuzzyMatch(row.equipoRival, opponent) || fuzzyMatch(opponent, row.equipoRival)
  })
  if (candidates.length === 0) return null
  candidates.sort((a, b) => daysBetween(toArDateKey(a.date), row.fecha) - daysBetween(toArDateKey(b.date), row.fecha))
  return candidates[0]
}

export async function verifyCoachForFixture(
  fixtureId: number,
  ownTeamId: number,
  coachFullName: string,
): Promise<{ verified: boolean; coachName: string | null }> {
  const lineups = await fetchFixtureLineups(fixtureId)
  const ownLineup = lineups.find(l => l.team.id === ownTeamId)
  const coachName = ownLineup?.coach?.name ?? null
  if (!coachName) return { verified: false, coachName: null }
  const verified = fuzzyMatch(coachName, coachFullName) || fuzzyMatch(coachFullName, coachName)
  return { verified, coachName }
}
