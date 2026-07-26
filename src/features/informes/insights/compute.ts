// Motor de conclusiones del informe. Entra lo que ya está en la base (partidos del
// jugador, partidos del plantel, fixtures del club, lesiones) y sale una lista de
// tarjetas y frases con sus valores. Acá no se arma texto: sólo números y tono.

import { inPeriod } from './period'
import { aggregateSquad, defaultMinMinutes } from './squad'
import type {
  InjuryWindow, InsightBlockId, InsightGroup, InsightItem, InsightTile, InsightWarning,
  InsightsResult, PlayerMatchRow, ResolvedPeriod, SquadMatchRow, TeamFixture,
} from './types'

export interface InsightsInput {
  playerId: number
  teamId: number
  period: ResolvedPeriod
  playerMatches: PlayerMatchRow[]
  squadRows: SquadMatchRow[]
  fixtures: TeamFixture[]
  injuries: InjuryWindow[]
  blocks: InsightBlockId[]
  minMinutes?: number
  overrides?: { teamMatches?: number; teamGoals?: number }
  percentile?: number | null
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** Un partido cuenta como perdido por lesión si cae dentro de una ventana de baja. */
function missedByInjury(fixtures: TeamFixture[], injuries: InjuryWindow[], playedIds: Set<number>): number {
  return fixtures.filter(f => {
    if (playedIds.has(f.id)) return false
    const d = f.date.slice(0, 10)
    return injuries.some(inj => d >= inj.start && d <= (inj.end ?? '9999-12-31'))
  }).length
}

export function computeInsights(input: InsightsInput): InsightsResult {
  const { period, teamId, playerId, blocks, overrides } = input
  const warnings: InsightWarning[] = []
  const tiles: InsightTile[] = []
  const groups: InsightGroup[] = []

  const has = (b: InsightBlockId) => blocks.includes(b)

  // ── Datos del período ──
  const fx = input.fixtures.filter(f => inPeriod(f.date, period) && f.score_home != null && f.score_away != null)
  const squadRows = input.squadRows.filter(r => inPeriod(r.date, period))
  const myMatches = input.playerMatches.filter(m => inPeriod(m.date, period))
  const played = myMatches.filter(m => m.minutes > 0)

  if (fx.length === 0) warnings.push('noTeamFixtures')
  const shortSample = played.length < 3
  if (shortSample) warnings.push('shortSample')

  const teamMatches = overrides?.teamMatches ?? fx.length
  const squad = aggregateSquad(squadRows)
  const minMinutes = input.minMinutes ?? defaultMinMinutes(squad)
  const qualifiedCount = squad.filter(s => s.minutes >= minMinutes && !s.isKeeper).length

  // ── Bloque: continuidad ──
  if (has('continuidad')) {
    const items: InsightItem[] = []
    const starts = played.filter(m => !m.is_substitute).length
    const minutes = played.reduce((s, m) => s + m.minutes, 0)
    const playedPct = teamMatches ? round1((played.length / teamMatches) * 100) : null

    if (teamMatches > 0 && playedPct != null) {
      items.push({
        id: 'cont.pj',
        values: { played: played.length, teamMatches, pct: playedPct },
        tone: playedPct >= 100 ? 'strong' : playedPct >= 70 ? 'neutral' : 'weak',
      })
      tiles.push({
        id: 'tile.pj',
        render: 'dots',
        values: { played: played.length, teamMatches, pct: playedPct },
        dots: { filled: played.length, total: teamMatches },
      })
    }

    if (played.length > 0) {
      items.push({
        id: 'cont.titulares',
        values: { starts, played: played.length, pct: round1((starts / played.length) * 100) },
        tone: starts / played.length >= 0.8 ? 'strong' : 'neutral',
      })
    }

    if (minutes > 0) {
      const possible = teamMatches * 90
      items.push({
        id: 'cont.minutos',
        values: { minutes, pct: possible ? round1((minutes / possible) * 100) : 0 },
        tone: possible && minutes / possible >= 0.8 ? 'strong' : 'neutral',
      })
    }

    const missed = missedByInjury(fx, input.injuries, new Set(played.map(m => m.fixture_id)))
    if (missed > 0) {
      items.push({ id: 'cont.lesiones', values: { missed }, tone: 'weak' })
    }

    if (items.length) groups.push({ id: 'continuidad', items })
  }

  // ── Bloque: peso ofensivo ──
  if (has('ofensivo')) {
    const items: InsightItem[] = []
    const goals = played.reduce((s, m) => s + (m.goals || 0), 0)
    const assists = played.reduce((s, m) => s + (m.assists || 0), 0)
    const ga = goals + assists

    const goalsFromFixtures = fx.reduce(
      (s, f) => s + ((f.home_team_id === teamId ? f.score_home : f.score_away) ?? 0),
      0,
    )
    const goalsFromSquad = squadRows.reduce((s, r) => s + (r.goals || 0), 0)
    if (overrides?.teamGoals == null && fx.length > 0 && goalsFromFixtures !== goalsFromSquad) {
      warnings.push('goalsMismatch')
    }
    const teamGoals = overrides?.teamGoals ?? Math.max(goalsFromFixtures, goalsFromSquad)

    if (ga > 0 || played.length > 0) {
      items.push({ id: 'ofe.participaciones', values: { goals, assists, ga }, tone: ga > 0 ? 'strong' : 'neutral' })
      tiles.push({ id: 'tile.ga', render: 'plain', values: { goals, assists, ga } })
    }

    if (teamGoals > 0 && fx.length > 0) {
      const sharePct = round1((ga / teamGoals) * 100)
      items.push({
        id: 'ofe.share',
        values: { ga, teamGoals, pct: sharePct },
        tone: sharePct >= 25 ? 'strong' : sharePct >= 15 ? 'neutral' : 'weak',
      })
      tiles.push({ id: 'tile.share', render: 'donut', values: { pct: sharePct, ga, teamGoals }, pct: sharePct })
    }

    if (!shortSample && ga > 0) {
      items.push({
        id: 'ofe.promedio',
        values: {
          perMatch: round2(ga / played.length),
          goalsPerMatch: round2(goals / played.length),
          assistsPerMatch: round2(assists / played.length),
        },
        tone: ga / played.length >= 0.5 ? 'strong' : 'neutral',
      })
      items.push({
        id: 'ofe.cada',
        values: { every: round2(played.length / ga) },
        tone: played.length / ga <= 2.5 ? 'strong' : 'neutral',
      })
    }

    if (items.length) groups.push({ id: 'ofensivo', items })
  }

  return { period, tiles, groups, warnings, minMinutes, qualifiedCount }
}
