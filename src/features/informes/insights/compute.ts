// Motor de conclusiones del informe. Entra lo que ya está en la base (partidos del
// jugador, partidos del plantel, fixtures del club, lesiones) y sale una lista de
// tarjetas y frases con sus valores. Acá no se arma texto: sólo números y tono.

import { inPeriod } from './period'
import { aggregateSquad, defaultMinMinutes, isRankNoteworthy, rankInSquad, type RankMetric } from './squad'
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
  const squadRows = input.squadRows.filter(r => inPeriod(r.date, period))
  const fxAll = input.fixtures.filter(f => inPeriod(f.date, period) && f.score_home != null && f.score_away != null)
  // Sólo cuentan los partidos del club de los que la base tiene datos de jugadores.
  // Si una competencia no está cargada (típico: Champions, Copa Argentina), sumarla
  // al denominador diría "jugó 31 de 46" y mandaría esos partidos al lado "sin él".
  const covered = new Set(squadRows.map(r => r.fixture_id))
  const fx = covered.size > 0 ? fxAll.filter(f => covered.has(f.id)) : fxAll
  if (fx.length < fxAll.length) warnings.push('partialCoverage')
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

    if (played.length > 1) {
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

    // Sin participaciones no se enuncia el share: "participó en 0 de 25 goles" es
    // una afirmación negativa que nadie pidió, no una conclusión.
    if (teamGoals > 0 && fx.length > 0 && ga > 0) {
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

  // ── Bloque: su lugar en el plantel ──
  // Con menos de 3 partidos jugados no se rankea: un jugador con 90 minutos puede
  // salir "4º del plantel en pases clave" y eso no es una conclusión, es ruido.
  if (has('plantel') && squad.length > 1 && !shortSample) {
    const items: InsightItem[] = []
    const metrics: { metric: RankMetric; id: string }[] = [
      { metric: 'goals', id: 'plantel.goals' },
      { metric: 'assists', id: 'plantel.assists' },
      { metric: 'ga', id: 'plantel.ga' },
      { metric: 'keyPasses', id: 'plantel.keyPasses' },
      { metric: 'minutes', id: 'plantel.minutes' },
      { metric: 'duelPct', id: 'plantel.duelPct' },
      { metric: 'dribblePct', id: 'plantel.dribblePct' },
      { metric: 'scoreAvg', id: 'plantel.score' },
    ]

    for (const { metric, id } of metrics) {
      const r = rankInSquad(squad, playerId, metric, { minMinutes })
      if (!r || r.value === 0 || !isRankNoteworthy(r)) continue
      items.push({
        id,
        values: {
          rank: r.rank,
          pool: r.poolSize,
          value: r.value,
          teamTotal: r.teamTotal ?? 0,
          pct: r.sharePct ?? 0,
          minMinutes,
        },
        tone: r.rank === 1 ? 'strong' : r.rank <= 3 ? 'neutral' : 'weak',
      })
    }

    // Línea extra por posición, sólo si hay competencia real en ese puesto.
    const me = squad.find(s => s.playerId === playerId)
    if (me?.position) {
      const samePos = squad.filter(s => s.position === me.position)
      if (samePos.length >= 4) {
        const r = rankInSquad(samePos, playerId, 'scoreAvg', { minMinutes: 0 })
        if (r && r.rank <= 2) {
          items.push({
            id: 'plantel.position',
            values: { rank: r.rank, pool: samePos.length, position: me.position },
            tone: r.rank === 1 ? 'strong' : 'neutral',
          })
        }
      }
    }

    if (items.length) groups.push({ id: 'plantel', items })
  }

  // ── Bloque: rendimiento ──
  if (has('rendimiento')) {
    const items: InsightItem[] = []
    const scored = played.filter(m => m.rating != null)

    // Un "promedio" de un partido no es un promedio: con muestra corta sólo queda
    // el percentil, que no depende del período.
    if (scored.length > 0 && !shortSample) {
      const values = scored.map(m => m.rating as number)
      const avgScore = round1(values.reduce((a, b) => a + b, 0) / values.length)
      const best = Math.max(...values)

      items.push({
        id: 'rend.promedio',
        values: { avg: avgScore, matches: scored.length },
        tone: avgScore >= 6.8 ? 'strong' : avgScore >= 6.4 ? 'neutral' : 'weak',
      })
      tiles.push({ id: 'tile.score', render: 'plain', values: { avg: avgScore, matches: scored.length } })

      const bestMatch = scored.find(m => m.rating === best)
      items.push({
        id: 'rend.mejor',
        values: { best, date: bestMatch ? bestMatch.date.slice(0, 10) : '' },
        tone: 'neutral',
      })

      if (!shortSample && scored.length >= 6) {
        const recent = values.slice(-5)
        const previous = values.slice(0, -5)
        if (previous.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
          const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length
          const delta = round1(recentAvg - prevAvg)
          const direction = Math.abs(delta) < 0.3 ? 'flat' : delta > 0 ? 'up' : 'down'
          items.push({
            id: 'rend.tendencia',
            values: { delta: Math.abs(delta), direction, recent: round1(recentAvg), previous: round1(prevAvg) },
            tone: direction === 'up' ? 'strong' : direction === 'flat' ? 'neutral' : 'weak',
          })
        }
      } else if (scored.length >= 4) {
        // Muestra corta: se compara la última mitad contra la primera.
        const half = Math.floor(scored.length / 2)
        const prevAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half
        const recentAvg = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half)
        const delta = round1(recentAvg - prevAvg)
        const direction = Math.abs(delta) < 0.3 ? 'flat' : delta > 0 ? 'up' : 'down'
        items.push({
          id: 'rend.tendencia',
          values: { delta: Math.abs(delta), direction, recent: round1(recentAvg), previous: round1(prevAvg) },
          tone: direction === 'up' ? 'strong' : direction === 'flat' ? 'neutral' : 'weak',
        })
      }

      if (!shortSample) {
        const above = values.filter(v => v > avgScore).length
        items.push({
          id: 'rend.sobrePromedio',
          values: { above, matches: values.length, pct: round1((above / values.length) * 100) },
          tone: 'neutral',
        })
      }
    }

    if (input.percentile != null) {
      items.push({
        id: 'rend.percentil',
        values: { pct: Math.round(input.percentile) },
        tone: input.percentile >= 75 ? 'strong' : input.percentile >= 50 ? 'neutral' : 'weak',
      })
    }

    if (items.length) groups.push({ id: 'rendimiento', items })
  }

  // ── Bloque: impacto en resultados ──
  if (has('resultados') && fx.length > 0) {
    const items: InsightItem[] = []
    const playedIds = new Set(played.map(m => m.fixture_id))
    const outcome = (f: TeamFixture) => {
      const own = (f.home_team_id === teamId ? f.score_home : f.score_away) ?? 0
      const opp = (f.home_team_id === teamId ? f.score_away : f.score_home) ?? 0
      return own > opp ? 3 : own === opp ? 1 : 0
    }
    const withHim = fx.filter(f => playedIds.has(f.id))
    const withoutHim = fx.filter(f => !playedIds.has(f.id))

    if (withHim.length > 0) {
      items.push({
        id: 'res.record',
        values: {
          wins: withHim.filter(f => outcome(f) === 3).length,
          draws: withHim.filter(f => outcome(f) === 1).length,
          losses: withHim.filter(f => outcome(f) === 0).length,
          matches: withHim.length,
        },
        tone: 'neutral',
      })
    }

    // Comparar contra 1 o 2 partidos sin él no dice nada: hace falta muestra.
    if (withHim.length > 0 && withoutHim.length >= 3) {
      const ppg = (list: TeamFixture[]) => round2(list.reduce((s, f) => s + outcome(f), 0) / list.length)
      const withPpg = ppg(withHim)
      const withoutPpg = ppg(withoutHim)
      items.push({
        id: 'res.conSinEl',
        values: {
          withPpg,
          withoutPpg,
          diff: round2(withPpg - withoutPpg),
          withMatches: withHim.length,
          withoutMatches: withoutHim.length,
        },
        tone: withPpg - withoutPpg >= 0.3 ? 'strong' : withPpg - withoutPpg <= -0.3 ? 'weak' : 'neutral',
      })
    }

    if (items.length) groups.push({ id: 'resultados', items })
  }

  return { period, tiles, groups, warnings, minMinutes, qualifiedCount }
}
