# Tab "Impacto" en Informes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al informe una pestaña "Impacto" con conclusiones calculadas desde la API (continuidad, peso ofensivo, lugar en el plantel, rendimiento e impacto en resultados), donde cada tarjeta y cada frase se agrega o se saca del informe y cualquier texto se puede reescribir a mano.

**Architecture:** Todo el cálculo vive en módulos puros sin React ni fetching bajo `src/features/informes/insights/`, testeados con vitest. Los textos se generan aparte, en `insights/text.ts`, apoyados en el diccionario `i18n.ts` que ya traduce el informe a seis idiomas. Un hook (`useInformeInsights`) hace los tres fetches a Supabase y llama al módulo puro. La UI de configuración vive en el paso 3 del wizard y el render en el paso 4 + el export HTML, siguiendo el mismo patrón que ya usan las métricas evolutivas (el llamador resuelve la data y se la pasa a `buildInformeHtml` por `opts`).

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind, Supabase (PostgREST), vitest.

Spec: `docs/superpowers/specs/2026-07-26-informes-impacto-design.md`

## Global Constraints

- Los módulos bajo `insights/` no importan React, ni `supabase`, ni nada de `@/services`. Sólo tipos y funciones puras. Es lo que los hace testeables.
- Los cálculos nunca producen strings de idioma. Producen `values` numéricos + un `tone`; el texto sale de `insights/text.ts`.
- El informe persiste **configuración**, nunca números calculados. Los informes se guardan comprimidos en localStorage y el espacio es escaso.
- Los ids de tarjetas y frases (`ofe.share`, `plantel.assists`, …) son estables: son la clave de `hiddenItems` y `overrides`. No renombrarlos una vez creados.
- Idiomas del informe: `es | en | pt | ar | it | fr`, en ese orden dentro de cada tupla `Six` de `i18n.ts`. Toda clave nueva lleva las seis.
- El export HTML es estático y sin red: cualquier gráfico va como SVG inline (`chartSvg.ts`).
- Umbral de minutos por defecto: 400, o el 40% de los minutos del jugador más usado del plantel si ese 40% es menor, redondeado a múltiplos de 45.
- Una línea de ranking del plantel entra sólo si el puesto es ≤ 5 **o** el share es ≥ 10%.
- Los arqueros se excluyen de los rankings salvo que el protagonista sea arquero.
- Tests: `npx vitest run <archivo>` para uno solo, `npx vitest run` para la suite. Build: `npm run build`.

## File Structure

**Nuevos:**
- `src/features/informes/insights/types.ts` — tipos compartidos del módulo (sin lógica).
- `src/features/informes/insights/period.ts` — resolución del período (llegada / temporada / últimos 10 / rango).
- `src/features/informes/insights/period.test.ts`
- `src/features/informes/insights/squad.ts` — agregación del plantel, umbral de minutos y rankings.
- `src/features/informes/insights/squad.test.ts`
- `src/features/informes/insights/compute.ts` — `computeInsights`: arma tarjetas y frases de los cinco bloques.
- `src/features/informes/insights/compute.test.ts`
- `src/features/informes/insights/text.ts` — `renderItem` / `renderTile`: de `values` + `tone` a frase traducida.
- `src/features/informes/insights/text.test.ts`
- `src/features/informes/useInformeInsights.ts` — hook: fetches + memo del cálculo.
- `src/features/informes/components/Step3Impacto.tsx` — UI de configuración (período, bloques, slider, checkboxes, edición de texto).
- `src/features/informes/components/InformeImpacto.tsx` — render del panel para el preview del paso 4.

**Modificados:**
- `src/services/playerStatsService.ts` — tres funciones de fetch nuevas al final del archivo.
- `src/features/informes/types.ts` — campo `insights` en `Informe`.
- `src/features/informes/i18n.ts` — clave `tab_impacto` + plantillas de frases.
- `src/features/informes/chartSvg.ts` — `donutSvg` y `dotsSvg`.
- `src/features/informes/exportInformeHTML.ts` — panel `impacto` + `opts.insights`.
- `src/features/informes/components/Step3Contenido.tsx` — monta `Step3Impacto`.
- `src/features/informes/components/Step4Preview.tsx` — tab `impacto` + pasa `insights` al export.
- `src/pages/InformesPage.tsx` — pasa `informe` y `onChange` completos al paso 3 (hoy sólo pasa `content`).

---

### Task 1: Tipos y resolución del período

**Files:**
- Create: `src/features/informes/insights/types.ts`
- Create: `src/features/informes/insights/period.ts`
- Test: `src/features/informes/insights/period.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: todos los tipos de `types.ts` (los usan las tareas 2 a 9), más `toISODate(d)`, `seasonStart(fixtures)`, `resolvePeriod(config, ctx)`, `inPeriod(dateISO, period)`.

- [ ] **Step 1: Crear el archivo de tipos**

`src/features/informes/insights/types.ts`:

```ts
// Tipos del motor de conclusiones ("Impacto"). Sin lógica y sin dependencias:
// los importan tanto los módulos puros como la UI y el export.

export type InsightBlockId = 'continuidad' | 'ofensivo' | 'plantel' | 'rendimiento' | 'resultados'

export const BLOCK_IDS: InsightBlockId[] = ['continuidad', 'ofensivo', 'plantel', 'rendimiento', 'resultados']

export type PeriodMode = 'signing' | 'season' | 'last10' | 'custom'

/** Lo que se guarda en el informe. */
export interface PeriodConfig {
  mode: PeriodMode
  from?: string   // 'YYYY-MM-DD', sólo cuando mode === 'custom'
  to?: string
}

/** Lo que sale de resolver la config contra los datos reales. */
export interface ResolvedPeriod {
  mode: PeriodMode
  from: string            // 'YYYY-MM-DD'
  to: string | null       // null = hasta hoy
  anchorDate: string | null  // fecha de llegada al club; sólo en mode 'signing'
}

export interface TeamFixture {
  id: number
  date: string            // ISO completo
  league_id: number
  home_team_id: number
  away_team_id: number
  score_home: number | null
  score_away: number | null
}

/** Fila de un jugador del plantel en un partido. */
export interface SquadMatchRow {
  player_id: number
  player_name: string
  fixture_id: number
  date: string
  minutes: number
  goals: number
  assists: number
  passes_key: number
  duels_won: number
  duels_total: number
  dribbles_success: number
  dribbles_attempted: number
  match_score: number | null
  detected_position: string | null
}

/** Fila del protagonista: agrega lo que hace falta para continuidad y resultados. */
export interface PlayerMatchRow extends SquadMatchRow {
  is_substitute: boolean
  team_id: number
  home_team_id: number
  away_team_id: number
  score_home: number | null
  score_away: number | null
}

export interface InjuryWindow {
  type: string
  start: string           // 'YYYY-MM-DD'
  end: string | null      // null = sigue lesionado
}

/** Una conclusión calculada. El texto se genera aparte, en text.ts. */
export interface InsightItem {
  id: string                                  // estable: 'ofe.share', 'plantel.assists', …
  values: Record<string, number | string>
  tone: 'strong' | 'neutral' | 'weak'
}

export interface InsightTile {
  id: string                                  // 'tile.pj', 'tile.ga', 'tile.share', 'tile.score'
  render: 'dots' | 'donut' | 'plain'
  values: Record<string, number | string>
  pct?: number                                // donut
  dots?: { filled: number; total: number }    // dots
}

export interface InsightGroup {
  id: InsightBlockId
  items: InsightItem[]
}

export type InsightWarning = 'goalsMismatch' | 'shortSample' | 'noTeamFixtures'

export interface InsightsResult {
  period: ResolvedPeriod
  tiles: InsightTile[]
  groups: InsightGroup[]
  warnings: InsightWarning[]
  minMinutes: number
  qualifiedCount: number   // jugadores del plantel que pasan el umbral
}

/** Config persistida en el informe. */
export interface InsightsConfig {
  enabled: boolean
  period: PeriodConfig
  blocks: InsightBlockId[]
  hiddenItems: string[]
  overrides: Record<string, string>
  minMinutes?: number
  teamMatchesOverride?: number
  teamGoalsOverride?: number
}
```

- [ ] **Step 2: Escribir el test que falla**

`src/features/informes/insights/period.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toISODate, seasonStart, resolvePeriod, inPeriod } from './period'
import type { TeamFixture } from './types'

function fx(id: number, date: string): TeamFixture {
  return { id, date, league_id: 262, home_team_id: 1, away_team_id: 2, score_home: 1, score_away: 0 }
}

describe('toISODate', () => {
  it('recorta a YYYY-MM-DD', () => {
    expect(toISODate('2026-03-01T01:05:00+00:00')).toBe('2026-03-01')
  })
})

describe('seasonStart', () => {
  it('arranca en el partido siguiente al último hueco de 45+ días', () => {
    const fixtures = [
      fx(1, '2025-08-01T00:00:00Z'),
      fx(2, '2025-08-08T00:00:00Z'),
      fx(3, '2025-12-10T00:00:00Z'), // hueco de 4 meses: acá arranca la temporada
      fx(4, '2025-12-17T00:00:00Z'),
    ]
    expect(seasonStart(fixtures)).toBe('2025-12-10')
  })

  it('sin huecos largos devuelve el primer partido', () => {
    const fixtures = [fx(1, '2026-01-10T00:00:00Z'), fx(2, '2026-01-17T00:00:00Z')]
    expect(seasonStart(fixtures)).toBe('2026-01-10')
  })

  it('sin partidos devuelve null', () => {
    expect(seasonStart([])).toBeNull()
  })
})

describe('resolvePeriod', () => {
  const fixtures = Array.from({ length: 12 }, (_, i) =>
    fx(i + 1, `2026-0${Math.floor(i / 4) + 1}-0${(i % 4) + 1}T00:00:00Z`),
  )

  it('signing ancla en la fecha de llegada', () => {
    const p = resolvePeriod({ mode: 'signing' }, { signingDate: '2025-07-11', fixtures })
    expect(p).toEqual({ mode: 'signing', from: '2025-07-11', to: null, anchorDate: '2025-07-11' })
  })

  it('signing sin fecha de llegada cae a temporada', () => {
    const p = resolvePeriod({ mode: 'signing' }, { signingDate: null, fixtures })
    expect(p.mode).toBe('season')
  })

  it('last10 arranca en el décimo partido contando hacia atrás', () => {
    const p = resolvePeriod({ mode: 'last10' }, { signingDate: null, fixtures })
    expect(p.mode).toBe('last10')
    expect(p.from).toBe('2026-01-03')
  })

  it('custom respeta el rango dado', () => {
    const p = resolvePeriod({ mode: 'custom', from: '2026-02-01', to: '2026-03-01' }, { signingDate: null, fixtures })
    expect(p).toEqual({ mode: 'custom', from: '2026-02-01', to: '2026-03-01', anchorDate: null })
  })
})

describe('inPeriod', () => {
  const p = { mode: 'custom' as const, from: '2026-02-01', to: '2026-03-01', anchorDate: null }

  it('incluye los bordes', () => {
    expect(inPeriod('2026-02-01T20:00:00Z', p)).toBe(true)
    expect(inPeriod('2026-03-01T20:00:00Z', p)).toBe(true)
  })

  it('excluye fuera de rango', () => {
    expect(inPeriod('2026-01-31T20:00:00Z', p)).toBe(false)
    expect(inPeriod('2026-03-02T20:00:00Z', p)).toBe(false)
  })

  it('to null = abierto hacia adelante', () => {
    expect(inPeriod('2030-01-01T00:00:00Z', { ...p, to: null })).toBe(true)
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run src/features/informes/insights/period.test.ts`
Expected: FAIL — "Failed to resolve import './period'"

- [ ] **Step 4: Implementar period.ts**

`src/features/informes/insights/period.ts`:

```ts
// Resolución del período sobre el que se calculan las conclusiones del informe.
// La "temporada actual" se detecta por los datos, no por el calendario: se corta
// en el último hueco largo entre partidos del club. Así funciona igual para ligas
// europeas (agosto-mayo) que para las sudamericanas o los torneos cortos de México.

import type { PeriodConfig, ResolvedPeriod, TeamFixture } from './types'

const DAY_MS = 86_400_000
const SEASON_GAP_DAYS = 45

export function toISODate(d: string | Date): string {
  return (typeof d === 'string' ? new Date(d) : d).toISOString().slice(0, 10)
}

/** Primer partido posterior al último hueco de 45+ días. Null si no hay partidos. */
export function seasonStart(fixtures: TeamFixture[]): string | null {
  const sorted = [...fixtures].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  if (sorted.length === 0) return null
  let start = sorted[0].date
  for (let i = 1; i < sorted.length; i++) {
    const gap = +new Date(sorted[i].date) - +new Date(sorted[i - 1].date)
    if (gap >= SEASON_GAP_DAYS * DAY_MS) start = sorted[i].date
  }
  return toISODate(start)
}

export function resolvePeriod(
  config: PeriodConfig,
  ctx: { signingDate: string | null; fixtures: TeamFixture[] },
): ResolvedPeriod {
  const { signingDate, fixtures } = ctx

  if (config.mode === 'custom' && config.from) {
    return { mode: 'custom', from: config.from, to: config.to ?? null, anchorDate: null }
  }

  if (config.mode === 'signing' && signingDate) {
    const from = toISODate(signingDate)
    return { mode: 'signing', from, to: null, anchorDate: from }
  }

  if (config.mode === 'last10') {
    const played = fixtures
      .filter(f => f.score_home != null)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    const tenth = played[9] ?? played[played.length - 1]
    if (tenth) return { mode: 'last10', from: toISODate(tenth.date), to: null, anchorDate: null }
  }

  // Default y fallback de todo lo anterior: temporada actual.
  return { mode: 'season', from: seasonStart(fixtures) ?? '1970-01-01', to: null, anchorDate: null }
}

export function inPeriod(dateISO: string, period: ResolvedPeriod): boolean {
  const d = dateISO.slice(0, 10)
  if (d < period.from) return false
  if (period.to && d > period.to) return false
  return true
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/informes/insights/period.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/informes/insights/types.ts src/features/informes/insights/period.ts src/features/informes/insights/period.test.ts
git commit -m "feat(informes): tipos y resolucion de periodo del motor de Impacto"
```

---

### Task 2: Agregación del plantel y rankings

**Files:**
- Create: `src/features/informes/insights/squad.ts`
- Test: `src/features/informes/insights/squad.test.ts`

**Interfaces:**
- Consumes: `SquadMatchRow` de `./types`.
- Produces: `SquadAgg` (interfaz), `aggregateSquad(rows): SquadAgg[]`, `defaultMinMinutes(squad): number`, `rankInSquad(squad, playerId, metric, opts): RankResult | null`, `isRankNoteworthy(r): boolean`, y las constantes `RATE_METRICS`, `CUMULATIVE_METRICS`.

- [ ] **Step 1: Escribir el test que falla**

`src/features/informes/insights/squad.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aggregateSquad, defaultMinMinutes, rankInSquad, isRankNoteworthy } from './squad'
import type { SquadMatchRow } from './types'

let seq = 0
function row(p: Partial<SquadMatchRow> & { player_id: number; player_name: string }): SquadMatchRow {
  return {
    fixture_id: ++seq,
    date: '2026-02-01T00:00:00Z',
    minutes: 90,
    goals: 0,
    assists: 0,
    passes_key: 0,
    duels_won: 0,
    duels_total: 0,
    dribbles_success: 0,
    dribbles_attempted: 0,
    match_score: null,
    detected_position: 'EXT',
    ...p,
  }
}

describe('aggregateSquad', () => {
  it('suma por jugador y cuenta sólo los partidos con minutos', () => {
    const agg = aggregateSquad([
      row({ player_id: 1, player_name: 'Orellano', goals: 1, assists: 1, passes_key: 3, match_score: 7.0 }),
      row({ player_id: 1, player_name: 'Orellano', minutes: 0, goals: 0, match_score: null }),
      row({ player_id: 1, player_name: 'Orellano', minutes: 45, goals: 2, match_score: 8.0 }),
    ])
    expect(agg).toHaveLength(1)
    expect(agg[0]).toMatchObject({
      playerId: 1, name: 'Orellano', matches: 2, minutes: 135, goals: 3, assists: 1, ga: 4, keyPasses: 3, scoreAvg: 7.5,
    })
  })

  it('calcula porcentajes de duelos y regates, y null si no hubo intentos', () => {
    const agg = aggregateSquad([
      row({ player_id: 1, player_name: 'A', duels_won: 6, duels_total: 10, dribbles_success: 0, dribbles_attempted: 0 }),
    ])
    expect(agg[0].duelPct).toBe(60)
    expect(agg[0].dribblePct).toBeNull()
  })

  it('marca arqueros por la posición más frecuente', () => {
    const agg = aggregateSquad([
      row({ player_id: 9, player_name: 'Cárdenas', detected_position: 'ARQ' }),
      row({ player_id: 9, player_name: 'Cárdenas', detected_position: 'ARQ' }),
      row({ player_id: 9, player_name: 'Cárdenas', detected_position: 'CB' }),
    ])
    expect(agg[0].isKeeper).toBe(true)
    expect(agg[0].position).toBe('ARQ')
  })
})

describe('defaultMinMinutes', () => {
  it('usa 400 cuando el plantel tiene volumen', () => {
    const agg = aggregateSquad([row({ player_id: 1, player_name: 'A', minutes: 1500 })])
    expect(defaultMinMinutes(agg)).toBe(400)
  })

  it('baja al 40% del líder en períodos cortos, redondeado a 45', () => {
    const agg = aggregateSquad([row({ player_id: 1, player_name: 'A', minutes: 700 })])
    expect(defaultMinMinutes(agg)).toBe(270) // 700 * 0.4 = 280 -> 270
  })

  it('plantel vacío devuelve 0', () => {
    expect(defaultMinMinutes([])).toBe(0)
  })
})

describe('rankInSquad', () => {
  const squad = aggregateSquad([
    row({ player_id: 1, player_name: 'Orellano', minutes: 1136, goals: 3, assists: 4, passes_key: 25, duels_won: 63, duels_total: 122, match_score: 6.7 }),
    row({ player_id: 2, player_name: 'Canales', minutes: 1200, goals: 1, assists: 2, passes_key: 30, duels_won: 40, duels_total: 100, match_score: 6.4 }),
    row({ player_id: 3, player_name: 'Corona', minutes: 900, goals: 4, assists: 1, passes_key: 10, duels_won: 30, duels_total: 60, match_score: 6.9 }),
    row({ player_id: 4, player_name: 'Juvenil', minutes: 60, goals: 0, assists: 0, passes_key: 1, duels_won: 4, duels_total: 4, match_score: 9.5 }),
    row({ player_id: 5, player_name: 'Arquero', minutes: 1200, goals: 0, assists: 0, passes_key: 0, duels_won: 2, duels_total: 2, match_score: 7.5, detected_position: 'ARQ' }),
  ])

  it('rankea acumuladas contra todo el plantel y calcula el share', () => {
    const r = rankInSquad(squad, 1, 'assists', { minMinutes: 400 })!
    expect(r.rank).toBe(1)
    expect(r.teamTotal).toBe(7)
    expect(r.sharePct).toBe(57.1)
  })

  it('no aplica el umbral de minutos a las acumuladas', () => {
    const r = rankInSquad(squad, 1, 'goals', { minMinutes: 400 })!
    expect(r.rank).toBe(2) // Corona 4, Orellano 3
    expect(r.poolSize).toBe(4) // los cuatro de campo
  })

  it('el umbral saca al suplente con promedio inflado', () => {
    const r = rankInSquad(squad, 1, 'scoreAvg', { minMinutes: 400 })!
    expect(r.rank).toBe(2) // Corona 6.9 > Orellano 6.7; el juvenil de 9.5 no califica
    expect(r.poolSize).toBe(3)
  })

  it('con umbral 0 el suplente entra y empuja al protagonista', () => {
    const r = rankInSquad(squad, 1, 'scoreAvg', { minMinutes: 0 })!
    expect(r.rank).toBe(3)
    expect(r.poolSize).toBe(4)
  })

  it('excluye arqueros de los rankings de campo', () => {
    const r = rankInSquad(squad, 1, 'duelPct', { minMinutes: 400 })!
    expect(r.poolSize).toBe(3) // Orellano, Canales, Corona; el arquero queda afuera
    expect(r.sharePct).toBeNull()
  })

  it('devuelve null si el protagonista no llega al umbral en una métrica de eficacia', () => {
    expect(rankInSquad(squad, 4, 'scoreAvg', { minMinutes: 400 })).toBeNull()
  })

  it('devuelve null si el jugador no está en el plantel', () => {
    expect(rankInSquad(squad, 999, 'goals', { minMinutes: 400 })).toBeNull()
  })
})

describe('isRankNoteworthy', () => {
  it('acepta top 5', () => {
    expect(isRankNoteworthy({ metric: 'goals', rank: 5, poolSize: 20, value: 2, teamTotal: 40, sharePct: 5 })).toBe(true)
  })

  it('acepta share alto aunque el puesto sea malo', () => {
    expect(isRankNoteworthy({ metric: 'goals', rank: 8, poolSize: 20, value: 5, teamTotal: 40, sharePct: 12.5 })).toBe(true)
  })

  it('rechaza puesto malo con share bajo', () => {
    expect(isRankNoteworthy({ metric: 'goals', rank: 12, poolSize: 20, value: 1, teamTotal: 40, sharePct: 2.5 })).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/informes/insights/squad.test.ts`
Expected: FAIL — "Failed to resolve import './squad'"

- [ ] **Step 3: Implementar squad.ts**

`src/features/informes/insights/squad.ts`:

```ts
// Agregación del plantel y rankings internos. La regla que define si esto es serio
// o ridículo está acá: las métricas de eficacia (promedios y porcentajes) sólo
// rankean entre jugadores que superan un umbral de minutos; las acumuladas rankean
// contra todos, porque el volumen ya está adentro del número.

import type { SquadMatchRow } from './types'

export interface SquadAgg {
  playerId: number
  name: string
  matches: number
  minutes: number
  goals: number
  assists: number
  ga: number
  keyPasses: number
  duelsWon: number
  duelsTotal: number
  duelPct: number | null
  dribblesSuccess: number
  dribblesAttempted: number
  dribblePct: number | null
  scoreAvg: number | null
  position: string | null
  isKeeper: boolean
}

export type CumulativeMetric = 'goals' | 'assists' | 'ga' | 'keyPasses' | 'minutes'
export type RateMetric = 'duelPct' | 'dribblePct' | 'scoreAvg'
export type RankMetric = CumulativeMetric | RateMetric

export const CUMULATIVE_METRICS: CumulativeMetric[] = ['goals', 'assists', 'ga', 'keyPasses', 'minutes']
export const RATE_METRICS: RateMetric[] = ['duelPct', 'dribblePct', 'scoreAvg']

export interface RankResult {
  metric: RankMetric
  rank: number
  poolSize: number
  value: number
  teamTotal: number | null   // null en métricas de eficacia: sumarlas no significa nada
  sharePct: number | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

function pct(part: number, total: number): number | null {
  return total > 0 ? round1((part / total) * 100) : null
}

interface Acc extends Omit<SquadAgg, 'ga' | 'duelPct' | 'dribblePct' | 'scoreAvg' | 'position' | 'isKeeper'> {
  scoreSum: number
  scoreCount: number
  positions: Record<string, number>
}

export function aggregateSquad(rows: SquadMatchRow[]): SquadAgg[] {
  const by = new Map<number, Acc>()

  for (const r of rows) {
    const cur: Acc = by.get(r.player_id) ?? {
      playerId: r.player_id,
      name: r.player_name,
      matches: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      keyPasses: 0,
      duelsWon: 0,
      duelsTotal: 0,
      dribblesSuccess: 0,
      dribblesAttempted: 0,
      scoreSum: 0,
      scoreCount: 0,
      positions: {},
    }
    if (r.minutes > 0) cur.matches++
    cur.minutes += r.minutes || 0
    cur.goals += r.goals || 0
    cur.assists += r.assists || 0
    cur.keyPasses += r.passes_key || 0
    cur.duelsWon += r.duels_won || 0
    cur.duelsTotal += r.duels_total || 0
    cur.dribblesSuccess += r.dribbles_success || 0
    cur.dribblesAttempted += r.dribbles_attempted || 0
    if (r.match_score != null) {
      cur.scoreSum += r.match_score
      cur.scoreCount++
    }
    if (r.detected_position) cur.positions[r.detected_position] = (cur.positions[r.detected_position] ?? 0) + 1
    by.set(r.player_id, cur)
  }

  return Array.from(by.values()).map(a => {
    const position = Object.entries(a.positions).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
    return {
      playerId: a.playerId,
      name: a.name,
      matches: a.matches,
      minutes: a.minutes,
      goals: a.goals,
      assists: a.assists,
      ga: a.goals + a.assists,
      keyPasses: a.keyPasses,
      duelsWon: a.duelsWon,
      duelsTotal: a.duelsTotal,
      duelPct: pct(a.duelsWon, a.duelsTotal),
      dribblesSuccess: a.dribblesSuccess,
      dribblesAttempted: a.dribblesAttempted,
      dribblePct: pct(a.dribblesSuccess, a.dribblesAttempted),
      scoreAvg: a.scoreCount ? round1(a.scoreSum / a.scoreCount) : null,
      position,
      isKeeper: position === 'ARQ',
    }
  })
}

/** 400 minutos, o el 40% del jugador más usado si es menor. Redondeado a 45. */
export function defaultMinMinutes(squad: SquadAgg[]): number {
  const leader = squad.reduce((max, s) => Math.max(max, s.minutes), 0)
  const fortyPct = Math.round((leader * 0.4) / 45) * 45
  return Math.max(0, Math.min(400, fortyPct))
}

function valueOf(s: SquadAgg, metric: RankMetric): number | null {
  switch (metric) {
    case 'goals': return s.goals
    case 'assists': return s.assists
    case 'ga': return s.ga
    case 'keyPasses': return s.keyPasses
    case 'minutes': return s.minutes
    case 'duelPct': return s.duelPct
    case 'dribblePct': return s.dribblePct
    case 'scoreAvg': return s.scoreAvg
  }
}

export function rankInSquad(
  squad: SquadAgg[],
  playerId: number,
  metric: RankMetric,
  opts: { minMinutes: number },
): RankResult | null {
  const me = squad.find(s => s.playerId === playerId)
  if (!me) return null

  const value = valueOf(me, metric)
  if (value == null) return null

  const isRate = (RATE_METRICS as string[]).includes(metric)
  if (isRate && me.minutes < opts.minMinutes) return null

  const pool = squad.filter(s => {
    if (s.playerId === playerId) return true
    if (s.isKeeper && !me.isKeeper) return false
    if (isRate && s.minutes < opts.minMinutes) return false
    return valueOf(s, metric) != null
  })

  const values = pool.map(s => valueOf(s, metric)).filter((v): v is number => v != null)
  const rank = values.filter(v => v > value).length + 1
  const teamTotal = isRate ? null : squad.reduce((sum, s) => sum + (valueOf(s, metric) ?? 0), 0)

  return {
    metric,
    rank,
    poolSize: values.length,
    value,
    teamTotal,
    sharePct: teamTotal != null ? pct(value, teamTotal) : null,
  }
}

/** Un 12º puesto con el 2% del total no es una conclusión: es relleno. */
export function isRankNoteworthy(r: RankResult): boolean {
  return r.rank <= 5 || (r.sharePct ?? 0) >= 10
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/informes/insights/squad.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/informes/insights/squad.ts src/features/informes/insights/squad.test.ts
git commit -m "feat(informes): agregacion del plantel y rankings con umbral de minutos"
```

---

### Task 3: Bloques de continuidad y peso ofensivo

**Files:**
- Create: `src/features/informes/insights/compute.ts`
- Test: `src/features/informes/insights/compute.test.ts`

**Interfaces:**
- Consumes: `inPeriod` de `./period`; `aggregateSquad`, `defaultMinMinutes` de `./squad`; tipos de `./types`.
- Produces: `InsightsInput` (interfaz), `computeInsights(input): InsightsResult`. En esta tarea produce sólo las tarjetas y los bloques `continuidad` y `ofensivo`; la Task 4 agrega los otros tres.

- [ ] **Step 1: Escribir el test que falla**

`src/features/informes/insights/compute.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeInsights, type InsightsInput } from './compute'
import type { PlayerMatchRow, SquadMatchRow, TeamFixture } from './types'

const TEAM = 100
const RIVAL = 200
const PLAYER = 1

function fixture(id: number, date: string, gf: number, ga: number): TeamFixture {
  return { id, date, league_id: 262, home_team_id: TEAM, away_team_id: RIVAL, score_home: gf, score_away: ga }
}

function mine(fixtureId: number, date: string, p: Partial<PlayerMatchRow> = {}): PlayerMatchRow {
  return {
    player_id: PLAYER, player_name: 'Protagonista', fixture_id: fixtureId, date,
    minutes: 90, goals: 0, assists: 0, passes_key: 0, duels_won: 0, duels_total: 0,
    dribbles_success: 0, dribbles_attempted: 0, match_score: 7, detected_position: 'VI',
    is_substitute: false, team_id: TEAM, home_team_id: TEAM, away_team_id: RIVAL,
    score_home: 1, score_away: 0, ...p,
  }
}

function squadRow(playerId: number, fixtureId: number, p: Partial<SquadMatchRow> = {}): SquadMatchRow {
  return {
    player_id: playerId, player_name: `P${playerId}`, fixture_id: fixtureId, date: '2026-02-01T00:00:00Z',
    minutes: 90, goals: 0, assists: 0, passes_key: 0, duels_won: 0, duels_total: 0,
    dribbles_success: 0, dribbles_attempted: 0, match_score: 6.5, detected_position: 'EXT', ...p,
  }
}

function baseInput(over: Partial<InsightsInput> = {}): InsightsInput {
  const fixtures = [
    fixture(1, '2026-02-01T00:00:00Z', 2, 0),
    fixture(2, '2026-02-08T00:00:00Z', 1, 1),
    fixture(3, '2026-02-15T00:00:00Z', 0, 2),
    fixture(4, '2026-02-22T00:00:00Z', 1, 0),
  ]
  return {
    playerId: PLAYER,
    teamId: TEAM,
    period: { mode: 'season', from: '2026-01-01', to: null, anchorDate: null },
    fixtures,
    playerMatches: [
      mine(1, '2026-02-01T00:00:00Z', { goals: 1 }),
      mine(2, '2026-02-08T00:00:00Z', { assists: 1, is_substitute: true, minutes: 30 }),
      mine(3, '2026-02-15T00:00:00Z', { minutes: 90 }),
    ],
    squadRows: [
      squadRow(PLAYER, 1, { goals: 1 }), squadRow(PLAYER, 2, { assists: 1 }), squadRow(PLAYER, 3),
      squadRow(2, 1, { goals: 1 }), squadRow(2, 2, { goals: 1 }), squadRow(2, 3),
      squadRow(3, 4, { goals: 1 }),
    ],
    injuries: [],
    blocks: ['continuidad', 'ofensivo'],
    ...over,
  }
}

function itemById(res: ReturnType<typeof computeInsights>, id: string) {
  return res.groups.flatMap(g => g.items).find(i => i.id === id)
}

describe('computeInsights — continuidad', () => {
  it('cuenta partidos del club, disputados, titularidades y minutos', () => {
    const res = computeInsights(baseInput())
    expect(itemById(res, 'cont.pj')!.values).toMatchObject({ played: 3, teamMatches: 4, pct: 75 })
    expect(itemById(res, 'cont.titulares')!.values).toMatchObject({ starts: 2, played: 3 })
    expect(itemById(res, 'cont.minutos')!.values).toMatchObject({ minutes: 210 })
  })

  it('marca tono strong cuando jugó todos los partidos', () => {
    const input = baseInput()
    input.playerMatches = [...input.playerMatches, mine(4, '2026-02-22T00:00:00Z')]
    const res = computeInsights(input)
    expect(itemById(res, 'cont.pj')!.values.pct).toBe(100)
    expect(itemById(res, 'cont.pj')!.tone).toBe('strong')
  })

  it('cuenta los partidos perdidos dentro de una ventana de lesión', () => {
    const res = computeInsights(baseInput({ injuries: [{ type: 'Knee injury', start: '2026-02-20', end: '2026-03-01' }] }))
    expect(itemById(res, 'cont.lesiones')!.values).toMatchObject({ missed: 1 })
  })

  it('no emite la línea de lesiones si no se perdió ningún partido por lesión', () => {
    expect(itemById(computeInsights(baseInput()), 'cont.lesiones')).toBeUndefined()
  })

  it('ignora partidos fuera del período', () => {
    const input = baseInput()
    input.period = { mode: 'custom', from: '2026-02-10', to: null, anchorDate: null }
    const res = computeInsights(input)
    expect(itemById(res, 'cont.pj')!.values).toMatchObject({ played: 1, teamMatches: 2 })
  })
})

describe('computeInsights — peso ofensivo', () => {
  it('calcula participaciones, share y promedios', () => {
    const res = computeInsights(baseInput())
    expect(itemById(res, 'ofe.participaciones')!.values).toMatchObject({ goals: 1, assists: 1, ga: 2 })
    // goles del club por fixtures: 2+1+0+1 = 4; por plantel: 4. share = 2/4
    expect(itemById(res, 'ofe.share')!.values).toMatchObject({ ga: 2, teamGoals: 4, pct: 50 })
    expect(itemById(res, 'ofe.share')!.tone).toBe('strong')
    expect(itemById(res, 'ofe.promedio')!.values).toMatchObject({ perMatch: 0.67 })
    expect(itemById(res, 'ofe.cada')!.values).toMatchObject({ every: 1.5 })
  })

  it('el override manual de goles del club gana sobre el cálculo', () => {
    const res = computeInsights(baseInput({ overrides: { teamGoals: 8 } }))
    expect(itemById(res, 'ofe.share')!.values).toMatchObject({ teamGoals: 8, pct: 25 })
  })

  it('avisa cuando fixtures y plantel no coinciden en los goles del club', () => {
    const input = baseInput()
    input.squadRows = input.squadRows.filter(r => r.fixture_id !== 4) // falta un gol del plantel
    const res = computeInsights(input)
    expect(res.warnings).toContain('goalsMismatch')
    expect(itemById(res, 'ofe.share')!.values.teamGoals).toBe(4) // se queda con el mayor
  })

  it('tono weak con share bajo', () => {
    const input = baseInput({ overrides: { teamGoals: 40 } })
    expect(itemById(computeInsights(input), 'ofe.share')!.tone).toBe('weak')
  })

  it('sin fixtures del club no emite share y avisa', () => {
    const res = computeInsights(baseInput({ fixtures: [], squadRows: [] }))
    expect(itemById(res, 'ofe.share')).toBeUndefined()
    expect(res.warnings).toContain('noTeamFixtures')
  })

  it('con menos de 3 partidos no emite promedios y avisa muestra corta', () => {
    const input = baseInput()
    input.playerMatches = [mine(1, '2026-02-01T00:00:00Z', { goals: 1 })]
    const res = computeInsights(input)
    expect(res.warnings).toContain('shortSample')
    expect(itemById(res, 'ofe.promedio')).toBeUndefined()
    expect(itemById(res, 'ofe.participaciones')).toBeDefined()
  })
})

describe('computeInsights — tarjetas', () => {
  it('arma la tarjeta de partidos con dots y la de share con donut', () => {
    const res = computeInsights(baseInput())
    const pj = res.tiles.find(t => t.id === 'tile.pj')!
    expect(pj.render).toBe('dots')
    expect(pj.dots).toEqual({ filled: 3, total: 4 })
    const share = res.tiles.find(t => t.id === 'tile.share')!
    expect(share.render).toBe('donut')
    expect(share.pct).toBe(50)
  })

  it('sólo incluye tarjetas de bloques activos', () => {
    const res = computeInsights(baseInput({ blocks: ['continuidad'] }))
    expect(res.tiles.map(t => t.id)).toContain('tile.pj')
    expect(res.tiles.map(t => t.id)).not.toContain('tile.share')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/informes/insights/compute.test.ts`
Expected: FAIL — "Failed to resolve import './compute'"

- [ ] **Step 3: Implementar compute.ts con los dos primeros bloques**

`src/features/informes/insights/compute.ts`:

```ts
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
        values: { perMatch: round2(ga / played.length), goalsPerMatch: round2(goals / played.length), assistsPerMatch: round2(assists / played.length) },
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/informes/insights/compute.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/informes/insights/compute.ts src/features/informes/insights/compute.test.ts
git commit -m "feat(informes): bloques de continuidad y peso ofensivo"
```

---

### Task 4: Bloques de plantel, rendimiento e impacto en resultados

**Files:**
- Modify: `src/features/informes/insights/compute.ts` (agregar tres bloques antes del `return`)
- Test: `src/features/informes/insights/compute.test.ts` (agregar describes)

**Interfaces:**
- Consumes: `rankInSquad`, `isRankNoteworthy`, `RankMetric` de `./squad` (además de lo que ya importa).
- Produces: los items `plantel.*`, `rend.*`, `res.*` y la tarjeta `tile.score` dentro del mismo `InsightsResult`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/features/informes/insights/compute.test.ts`:

```ts
describe('computeInsights — lugar en el plantel', () => {
  function planteInput() {
    const input = baseInput({ blocks: ['plantel'] })
    // Protagonista: 3 asistencias de 5 del equipo, 20 pases clave de 50.
    input.squadRows = [
      squadRow(PLAYER, 1, { assists: 2, passes_key: 10, minutes: 90, duels_won: 6, duels_total: 10, match_score: 7.5 }),
      squadRow(PLAYER, 2, { assists: 1, passes_key: 10, minutes: 90, duels_won: 6, duels_total: 10, match_score: 7.5 }),
      squadRow(PLAYER, 3, { passes_key: 0, minutes: 300, duels_won: 0, duels_total: 0, match_score: 7.5 }),
      squadRow(2, 1, { assists: 2, passes_key: 20, minutes: 480, match_score: 6.0 }),
      squadRow(3, 1, { passes_key: 10, minutes: 480, match_score: 6.0 }),
      squadRow(4, 1, { minutes: 90, match_score: 9.9 }),
    ]
    input.minMinutes = 400
    return input
  }

  it('emite puesto y share en asistencias', () => {
    const res = computeInsights(planteInput())
    expect(itemById(res, 'plantel.assists')!.values).toMatchObject({ rank: 1, value: 3, teamTotal: 5, pct: 60 })
  })

  it('no emite líneas de ranking irrelevantes', () => {
    const input = planteInput()
    // 20 goles del equipo, ninguno del protagonista: no debe salir la línea de goles.
    input.squadRows.push(squadRow(5, 2, { goals: 20, minutes: 480 }))
    const res = computeInsights(input)
    expect(itemById(res, 'plantel.goals')).toBeUndefined()
  })

  it('el suplente con 9.9 de score no aparece en el ranking de eficacia', () => {
    const res = computeInsights(planteInput())
    expect(itemById(res, 'plantel.score')!.values).toMatchObject({ rank: 1, pool: 3 })
  })

  it('reporta el umbral usado para que el informe lo pueda enunciar', () => {
    const res = computeInsights(planteInput())
    expect(res.minMinutes).toBe(400)
    expect(itemById(res, 'plantel.score')!.values.minMinutes).toBe(400)
  })
})

describe('computeInsights — rendimiento', () => {
  function rendInput() {
    const input = baseInput({ blocks: ['rendimiento'], percentile: 82 })
    input.playerMatches = [
      mine(1, '2026-02-01T00:00:00Z', { match_score: 6.0 }),
      mine(2, '2026-02-08T00:00:00Z', { match_score: 6.0 }),
      mine(3, '2026-02-15T00:00:00Z', { match_score: 7.0 }),
      mine(4, '2026-02-22T00:00:00Z', { match_score: 8.0 }),
    ]
    return input
  }

  it('promedia el Score GG y marca el mejor partido', () => {
    const res = computeInsights(rendInput())
    expect(itemById(res, 'rend.promedio')!.values).toMatchObject({ avg: 6.8, matches: 4 })
    expect(itemById(res, 'rend.mejor')!.values).toMatchObject({ best: 8 })
  })

  it('detecta subida cuando los últimos partidos superan a los anteriores', () => {
    const res = computeInsights(rendInput())
    expect(itemById(res, 'rend.tendencia')!.values.direction).toBe('up')
  })

  it('llama sostenido a una diferencia menor a 0,3', () => {
    const input = rendInput()
    input.playerMatches = input.playerMatches.map(m => ({ ...m, match_score: 7 }))
    const res = computeInsights(input)
    expect(itemById(res, 'rend.tendencia')!.values.direction).toBe('flat')
  })

  it('incluye el percentil de la posición cuando el informe lo tiene', () => {
    const res = computeInsights(rendInput())
    expect(itemById(res, 'rend.percentil')!.values).toMatchObject({ pct: 82 })
  })

  it('arma la tarjeta de score', () => {
    const res = computeInsights(rendInput())
    expect(res.tiles.find(t => t.id === 'tile.score')!.values).toMatchObject({ avg: 6.8 })
  })
})

describe('computeInsights — impacto en resultados', () => {
  it('compara puntos por partido con y sin él', () => {
    const input = baseInput({ blocks: ['resultados'] })
    input.fixtures = [
      fixture(1, '2026-02-01T00:00:00Z', 2, 0), // con él, ganó
      fixture(2, '2026-02-08T00:00:00Z', 1, 1), // con él, empató
      fixture(3, '2026-02-15T00:00:00Z', 0, 2), // con él, perdió
      fixture(4, '2026-02-22T00:00:00Z', 0, 1), // sin él, perdió
      fixture(5, '2026-03-01T00:00:00Z', 0, 3), // sin él, perdió
      fixture(6, '2026-03-08T00:00:00Z', 1, 2), // sin él, perdió
    ]
    const res = computeInsights(input)
    expect(itemById(res, 'res.record')!.values).toMatchObject({ wins: 1, draws: 1, losses: 1 })
    expect(itemById(res, 'res.conSinEl')!.values).toMatchObject({ withPpg: 1.33, withoutPpg: 0 })
    expect(itemById(res, 'res.conSinEl')!.tone).toBe('strong')
  })

  it('no compara si hay menos de 3 partidos sin él', () => {
    const res = computeInsights(baseInput({ blocks: ['resultados'] }))
    expect(itemById(res, 'res.record')).toBeDefined()
    expect(itemById(res, 'res.conSinEl')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/features/informes/insights/compute.test.ts`
Expected: FAIL — los nuevos describes fallan con `itemById(...)` undefined.

- [ ] **Step 3: Agregar los imports de ranking en compute.ts**

Reemplazar la línea de import de `./squad` por:

```ts
import { aggregateSquad, defaultMinMinutes, isRankNoteworthy, rankInSquad, type RankMetric } from './squad'
```

- [ ] **Step 4: Implementar los tres bloques**

Insertar en `compute.ts`, justo antes del `return { period, tiles, groups, warnings, minMinutes, qualifiedCount }`:

```ts
  // ── Bloque: su lugar en el plantel ──
  if (has('plantel') && squad.length > 1) {
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
    const scored = played.filter(m => m.match_score != null)

    if (scored.length > 0) {
      const values = scored.map(m => m.match_score as number)
      const avgScore = round1(values.reduce((a, b) => a + b, 0) / values.length)
      const best = Math.max(...values)

      items.push({
        id: 'rend.promedio',
        values: { avg: avgScore, matches: scored.length },
        tone: avgScore >= 7 ? 'strong' : avgScore >= 6.3 ? 'neutral' : 'weak',
      })
      tiles.push({ id: 'tile.score', render: 'plain', values: { avg: avgScore, matches: scored.length } })

      const bestMatch = scored.find(m => m.match_score === best)
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
        values: { withPpg, withoutPpg, diff: round2(withPpg - withoutPpg), withMatches: withHim.length, withoutMatches: withoutHim.length },
        tone: withPpg - withoutPpg >= 0.3 ? 'strong' : withPpg - withoutPpg <= -0.3 ? 'weak' : 'neutral',
      })
    }

    if (items.length) groups.push({ id: 'resultados', items })
  }
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run src/features/informes/insights/compute.test.ts`
Expected: PASS — 24 tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/informes/insights/compute.ts src/features/informes/insights/compute.test.ts
git commit -m "feat(informes): bloques de plantel, rendimiento e impacto en resultados"
```

---

### Task 5: Redacción de las frases en los seis idiomas

**Files:**
- Modify: `src/features/informes/i18n.ts` (agregar claves al objeto `S`)
- Create: `src/features/informes/insights/text.ts`
- Test: `src/features/informes/insights/text.test.ts`

**Interfaces:**
- Consumes: `t(lang, key, vars)` y `Lang` de `@/features/informes/i18n`; `InsightItem` e `InsightTile` de `./types`.
- Produces: `renderItem(item, lang): string`, `renderTile(tile, lang): { value: string; sub: string }`, `formatNum(n, lang)`.

- [ ] **Step 1: Escribir el test que falla**

`src/features/informes/insights/text.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderItem, renderTile, formatNum } from './text'
import type { InsightItem, InsightTile } from './types'

const item = (id: string, values: InsightItem['values'], tone: InsightItem['tone'] = 'neutral'): InsightItem =>
  ({ id, values, tone })

describe('formatNum', () => {
  it('usa coma decimal en español', () => {
    expect(formatNum(0.46, 'es')).toBe('0,46')
  })
  it('usa punto decimal en inglés', () => {
    expect(formatNum(0.46, 'en')).toBe('0.46')
  })
  it('no agrega decimales a los enteros', () => {
    expect(formatNum(21, 'es')).toBe('21')
  })
})

describe('renderItem — continuidad', () => {
  it('disponibilidad total en español', () => {
    const text = renderItem(item('cont.pj', { played: 46, teamMatches: 46, pct: 100 }, 'strong'), 'es')
    expect(text).toBe('Jugó los 46 partidos oficiales del equipo: disponibilidad total.')
  })

  it('disponibilidad parcial', () => {
    const text = renderItem(item('cont.pj', { played: 30, teamMatches: 46, pct: 65.2 }, 'weak'), 'es')
    expect(text).toBe('Disputó 30 de los 46 partidos oficiales del equipo (65,2%).')
  })

  it('traduce al inglés', () => {
    const text = renderItem(item('cont.pj', { played: 46, teamMatches: 46, pct: 100 }, 'strong'), 'en')
    expect(text).toBe('Played all 46 official matches: fully available.')
  })
})

describe('renderItem — peso ofensivo', () => {
  it('share alto usa la redacción de "uno de cada cuatro"', () => {
    const text = renderItem(item('ofe.share', { ga: 21, teamGoals: 76, pct: 27.6 }, 'strong'), 'es')
    expect(text).toBe('Participó en 21 de los 76 goles del equipo: más de uno de cada cuatro (27,6%).')
  })

  it('share bajo enuncia el porcentaje sin adorno', () => {
    const text = renderItem(item('ofe.share', { ga: 3, teamGoals: 40, pct: 7.5 }, 'weak'), 'es')
    expect(text).toBe('Participó en 3 de los 40 goles del equipo (7,5%).')
  })

  it('promedio por partido', () => {
    const text = renderItem(item('ofe.promedio', { perMatch: 0.46, goalsPerMatch: 0.22, assistsPerMatch: 0.24 }), 'es')
    expect(text).toBe('Promedia 0,46 participaciones de gol por partido (0,22 goles y 0,24 asistencias).')
  })
})

describe('renderItem — plantel', () => {
  it('primer puesto en una acumulada', () => {
    const text = renderItem(item('plantel.assists', { rank: 1, pool: 22, value: 11, teamTotal: 40, pct: 27.5, minMinutes: 400 }, 'strong'), 'es')
    expect(text).toBe('Es el que más asistencias dio del plantel: 11 de 40 (27,5% del total).')
  })

  it('segundo puesto', () => {
    const text = renderItem(item('plantel.keyPasses', { rank: 2, pool: 22, value: 25, teamTotal: 218, pct: 11.5, minMinutes: 400 }), 'es')
    expect(text).toBe('2º del plantel en pases clave: 25 de 218 (11,5% del total).')
  })

  it('métrica de eficacia enuncia el umbral', () => {
    const text = renderItem(item('plantel.duelPct', { rank: 1, pool: 14, value: 61.5, teamTotal: 0, pct: 0, minMinutes: 400 }, 'strong'), 'es')
    expect(text).toBe('Gana el 61,5% de sus duelos: el mejor entre los 14 jugadores con más de 400 minutos.')
  })
})

describe('renderItem — rendimiento y resultados', () => {
  it('tendencia en alza', () => {
    const text = renderItem(item('rend.tendencia', { delta: 0.6, direction: 'up', recent: 7.4, previous: 6.8 }, 'strong'), 'es')
    expect(text).toBe('Viene en alza: 7,4 de promedio en los últimos partidos contra 6,8 antes.')
  })

  it('tendencia sostenida', () => {
    const text = renderItem(item('rend.tendencia', { delta: 0.1, direction: 'flat', recent: 7, previous: 6.9 }), 'es')
    expect(text).toBe('Rendimiento sostenido: 7 de promedio en los últimos partidos contra 6,9 antes.')
  })

  it('impacto en resultados', () => {
    const text = renderItem(item('res.conSinEl', { withPpg: 1.9, withoutPpg: 1.1, diff: 0.8, withMatches: 20, withoutMatches: 8 }, 'strong'), 'es')
    expect(text).toBe('Con él en cancha el equipo saca 1,9 puntos por partido; sin él, 1,1.')
  })
})

describe('renderItem — desconocido', () => {
  it('devuelve cadena vacía en vez de romper', () => {
    expect(renderItem(item('nope.nada', {}), 'es')).toBe('')
  })
})

describe('renderTile', () => {
  const tile = (id: string, values: InsightTile['values'], extra: Partial<InsightTile> = {}): InsightTile =>
    ({ id, render: 'plain', values, ...extra })

  it('tarjeta de partidos', () => {
    expect(renderTile(tile('tile.pj', { played: 46, teamMatches: 46, pct: 100 }), 'es')).toEqual({
      value: '46/46', sub: 'Partidos jugados',
    })
  })

  it('tarjeta de participaciones', () => {
    expect(renderTile(tile('tile.ga', { goals: 10, assists: 11, ga: 21 }), 'es')).toEqual({
      value: '21', sub: '10 goles · 11 asistencias',
    })
  })

  it('tarjeta de share', () => {
    expect(renderTile(tile('tile.share', { pct: 27.6, ga: 21, teamGoals: 76 }), 'es')).toEqual({
      value: '27,6%', sub: 'De los goles del equipo',
    })
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/informes/insights/text.test.ts`
Expected: FAIL — "Failed to resolve import './text'"

- [ ] **Step 3: Agregar las claves al diccionario**

En `src/features/informes/i18n.ts`, dentro del objeto `S`, después de la línea `tab_evolutivas: [...]`, agregar la clave de la pestaña:

```ts
  tab_impacto: ['Impacto', 'Impact', 'Impacto', 'التأثير', 'Impatto', 'Impact'],
```

Y al final del objeto `S` (antes de la llave de cierre), agregar el bloque de plantillas. Cada tupla es `[es, en, pt, ar, it, fr]`:

```ts
  // ── Impacto: títulos ──
  imp_since: ['Desde su llegada — {date}', 'Since joining — {date}', 'Desde a sua chegada — {date}', 'منذ انضمامه — {date}', "Dall'arrivo — {date}", "Depuis son arrivée — {date}"],
  imp_season: ['Temporada actual', 'Current season', 'Temporada atual', 'الموسم الحالي', 'Stagione in corso', 'Saison en cours'],
  imp_last10: ['Últimos 10 partidos', 'Last 10 matches', 'Últimos 10 jogos', 'آخر 10 مباريات', 'Ultime 10 partite', '10 derniers matchs'],
  imp_range: ['{from} a {to}', '{from} to {to}', '{from} a {to}', '{from} إلى {to}', '{from} a {to}', '{from} au {to}'],
  imp_g_continuidad: ['Continuidad', 'Availability', 'Continuidade', 'الاستمرارية', 'Continuità', 'Continuité'],
  imp_g_ofensivo: ['Peso ofensivo', 'Attacking weight', 'Peso ofensivo', 'الوزن الهجومي', 'Peso offensivo', 'Poids offensif'],
  imp_g_plantel: ['Su lugar en el plantel', 'His place in the squad', 'O seu lugar no plantel', 'مكانته في الفريق', 'Il suo posto in rosa', 'Sa place dans l’effectif'],
  imp_g_rendimiento: ['Rendimiento', 'Performance', 'Rendimento', 'الأداء', 'Rendimento', 'Performance'],
  imp_g_resultados: ['Impacto en resultados', 'Impact on results', 'Impacto nos resultados', 'التأثير على النتائج', 'Impatto sui risultati', 'Impact sur les résultats'],
  imp_note_coverage: [
    'Datos de las competencias con cobertura estadística.',
    'Data from competitions with statistical coverage.',
    'Dados das competições com cobertura estatística.',
    'بيانات من المسابقات ذات التغطية الإحصائية.',
    'Dati delle competizioni con copertura statistica.',
    'Données des compétitions avec couverture statistique.',
  ],

  // ── Impacto: tarjetas ──
  imp_tile_pj: ['Partidos jugados', 'Matches played', 'Jogos disputados', 'المباريات المُلعوبة', 'Partite giocate', 'Matchs joués'],
  imp_tile_ga: ['{goals} goles · {assists} asistencias', '{goals} goals · {assists} assists', '{goals} gols · {assists} assistências', '{goals} أهداف · {assists} تمريرات حاسمة', '{goals} gol · {assists} assist', '{goals} buts · {assists} passes décisives'],
  imp_tile_share: ['De los goles del equipo', 'Of the team’s goals', 'Dos gols da equipa', 'من أهداف الفريق', 'Dei gol della squadra', 'Des buts de l’équipe'],
  imp_tile_score: ['Score GG promedio', 'Average Score GG', 'Score GG médio', 'متوسط Score GG', 'Score GG medio', 'Score GG moyen'],

  // ── Impacto: continuidad ──
  imp_cont_pj_all: ['Jugó los {teamMatches} partidos oficiales del equipo: disponibilidad total.', 'Played all {teamMatches} official matches: fully available.', 'Jogou os {teamMatches} jogos oficiais da equipa: disponibilidade total.', 'لعب جميع مباريات الفريق الرسمية البالغة {teamMatches}: جاهزية تامة.', 'Ha giocato tutte le {teamMatches} partite ufficiali: sempre disponibile.', 'A joué les {teamMatches} matchs officiels de l’équipe : disponibilité totale.'],
  imp_cont_pj: ['Disputó {played} de los {teamMatches} partidos oficiales del equipo ({pct}%).', 'Played {played} of the team’s {teamMatches} official matches ({pct}%).', 'Disputou {played} dos {teamMatches} jogos oficiais da equipa ({pct}%).', 'خاض {played} من أصل {teamMatches} مباراة رسمية ({pct}%).', 'Ha disputato {played} delle {teamMatches} partite ufficiali ({pct}%).', 'A disputé {played} des {teamMatches} matchs officiels ({pct}%).'],
  imp_cont_titulares: ['Fue titular en {starts} de esos {played} partidos ({pct}%).', 'Started {starts} of those {played} matches ({pct}%).', 'Foi titular em {starts} desses {played} jogos ({pct}%).', 'كان أساسياً في {starts} من تلك المباريات الـ{played} ({pct}%).', 'Titolare in {starts} di quelle {played} partite ({pct}%).', 'Titulaire lors de {starts} de ces {played} matchs ({pct}%).'],
  imp_cont_minutos: ['Acumuló {minutes} minutos, el {pct}% de los disponibles.', 'Logged {minutes} minutes, {pct}% of those available.', 'Somou {minutes} minutos, {pct}% dos disponíveis.', 'جمع {minutes} دقيقة، أي {pct}% من الدقائق المتاحة.', 'Ha accumulato {minutes} minuti, il {pct}% di quelli disponibili.', 'A cumulé {minutes} minutes, soit {pct}% du total possible.'],
  imp_cont_lesiones: ['Se perdió {missed} partidos por lesión.', 'Missed {missed} matches through injury.', 'Falhou {missed} jogos por lesão.', 'غاب عن {missed} مباريات بسبب الإصابة.', 'Ha saltato {missed} partite per infortunio.', 'A manqué {missed} matchs sur blessure.'],

  // ── Impacto: peso ofensivo ──
  imp_ofe_participaciones: ['Sumó {goals} goles y {assists} asistencias: {ga} participaciones directas en gol.', 'Scored {goals} and assisted {assists}: {ga} direct goal contributions.', 'Somou {goals} gols e {assists} assistências: {ga} participações diretas.', 'سجل {goals} أهداف وصنع {assists}: {ga} مساهمة تهديفية مباشرة.', 'Ha realizzato {goals} gol e {assists} assist: {ga} partecipazioni dirette.', 'A inscrit {goals} buts et délivré {assists} passes décisives : {ga} contributions directes.'],
  imp_ofe_share_strong: ['Participó en {ga} de los {teamGoals} goles del equipo: más de uno de cada cuatro ({pct}%).', 'Was involved in {ga} of the team’s {teamGoals} goals: more than one in four ({pct}%).', 'Participou em {ga} dos {teamGoals} gols da equipa: mais de um em cada quatro ({pct}%).', 'شارك في {ga} من أصل {teamGoals} هدفاً للفريق: أكثر من هدف من كل أربعة ({pct}%).', 'Ha partecipato a {ga} dei {teamGoals} gol della squadra: più di uno su quattro ({pct}%).', 'A participé à {ga} des {teamGoals} buts de l’équipe : plus d’un sur quatre ({pct}%).'],
  imp_ofe_share_third: ['Participó en {ga} de los {teamGoals} goles del equipo: uno de cada tres ({pct}%).', 'Was involved in {ga} of the team’s {teamGoals} goals: one in three ({pct}%).', 'Participou em {ga} dos {teamGoals} gols da equipa: um em cada três ({pct}%).', 'شارك في {ga} من أصل {teamGoals} هدفاً للفريق: هدف من كل ثلاثة ({pct}%).', 'Ha partecipato a {ga} dei {teamGoals} gol della squadra: uno su tre ({pct}%).', 'A participé à {ga} des {teamGoals} buts de l’équipe : un sur trois ({pct}%).'],
  imp_ofe_share: ['Participó en {ga} de los {teamGoals} goles del equipo ({pct}%).', 'Was involved in {ga} of the team’s {teamGoals} goals ({pct}%).', 'Participou em {ga} dos {teamGoals} gols da equipa ({pct}%).', 'شارك في {ga} من أصل {teamGoals} هدفاً للفريق ({pct}%).', 'Ha partecipato a {ga} dei {teamGoals} gol della squadra ({pct}%).', 'A participé à {ga} des {teamGoals} buts de l’équipe ({pct}%).'],
  imp_ofe_promedio: ['Promedia {perMatch} participaciones de gol por partido ({goalsPerMatch} goles y {assistsPerMatch} asistencias).', 'Averages {perMatch} goal contributions per match ({goalsPerMatch} goals and {assistsPerMatch} assists).', 'Média de {perMatch} participações por jogo ({goalsPerMatch} gols e {assistsPerMatch} assistências).', 'بمعدل {perMatch} مساهمة تهديفية لكل مباراة ({goalsPerMatch} أهداف و{assistsPerMatch} تمريرة حاسمة).', 'Media di {perMatch} partecipazioni a partita ({goalsPerMatch} gol e {assistsPerMatch} assist).', 'Moyenne de {perMatch} contributions par match ({goalsPerMatch} buts et {assistsPerMatch} passes).'],
  imp_ofe_cada: ['Un gol o asistencia cada {every} partidos.', 'A goal or assist every {every} matches.', 'Um gol ou assistência a cada {every} jogos.', 'هدف أو تمريرة حاسمة كل {every} مباراة.', 'Un gol o assist ogni {every} partite.', 'Un but ou une passe décisive tous les {every} matchs.'],

  // ── Impacto: plantel ──
  imp_plantel_first: ['Es el que más {metric} del plantel: {value} de {teamTotal} ({pct}% del total).', 'He leads the squad in {metric}: {value} of {teamTotal} ({pct}% of the total).', 'É o que mais {metric} do plantel: {value} de {teamTotal} ({pct}% do total).', 'هو الأول في الفريق في {metric}: {value} من {teamTotal} ({pct}% من الإجمالي).', 'È il primo della rosa per {metric}: {value} su {teamTotal} ({pct}% del totale).', 'Il est le premier de l’effectif en {metric} : {value} sur {teamTotal} ({pct}% du total).'],
  imp_plantel_rank: ['{rank}º del plantel en {metric}: {value} de {teamTotal} ({pct}% del total).', '{rank}th in the squad in {metric}: {value} of {teamTotal} ({pct}% of the total).', '{rank}º do plantel em {metric}: {value} de {teamTotal} ({pct}% do total).', 'الـ{rank} في الفريق في {metric}: {value} من {teamTotal} ({pct}% من الإجمالي).', '{rank}º della rosa per {metric}: {value} su {teamTotal} ({pct}% del totale).', '{rank}e de l’effectif en {metric} : {value} sur {teamTotal} ({pct}% du total).'],
  imp_plantel_rate_first: ['{metric} el {value}% {what}: el mejor entre los {pool} jugadores con más de {minMinutes} minutos.', '{metric} {value}% {what}: the best among the {pool} players with over {minMinutes} minutes.', '{metric} {value}% {what}: o melhor entre os {pool} jogadores com mais de {minMinutes} minutos.', '{metric} {value}% {what}: الأفضل بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', '{metric} il {value}% {what}: il migliore tra i {pool} giocatori con più di {minMinutes} minuti.', '{metric} {value}% {what} : le meilleur parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_rate: ['{metric} el {value}% {what}: {rank}º entre los {pool} jugadores con más de {minMinutes} minutos.', '{metric} {value}% {what}: {rank}th among the {pool} players with over {minMinutes} minutes.', '{metric} {value}% {what}: {rank}º entre os {pool} jogadores com mais de {minMinutes} minutos.', '{metric} {value}% {what}: الـ{rank} بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', '{metric} il {value}% {what}: {rank}º tra i {pool} giocatori con più di {minMinutes} minuti.', '{metric} {value}% {what} : {rank}e parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_score_first: ['Es el mejor Score GG del plantel ({value}) entre los {pool} jugadores con más de {minMinutes} minutos.', 'He has the best Score GG in the squad ({value}) among the {pool} players with over {minMinutes} minutes.', 'Tem o melhor Score GG do plantel ({value}) entre os {pool} jogadores com mais de {minMinutes} minutos.', 'يمتلك أفضل Score GG في الفريق ({value}) بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', 'Ha il miglior Score GG della rosa ({value}) tra i {pool} giocatori con più di {minMinutes} minuti.', 'Il a le meilleur Score GG de l’effectif ({value}) parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_score: ['{rank}º Score GG del plantel ({value}) entre los {pool} jugadores con más de {minMinutes} minutos.', '{rank}th best Score GG in the squad ({value}) among the {pool} players with over {minMinutes} minutes.', '{rank}º melhor Score GG do plantel ({value}) entre os {pool} jogadores com mais de {minMinutes} minutos.', 'الـ{rank} في Score GG داخل الفريق ({value}) بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', '{rank}º Score GG della rosa ({value}) tra i {pool} giocatori con più di {minMinutes} minuti.', '{rank}e Score GG de l’effectif ({value}) parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_position: ['{rank}º entre los {pool} {position} del plantel.', '{rank}th among the squad’s {pool} {position}.', '{rank}º entre os {pool} {position} do plantel.', 'الـ{rank} بين {pool} من {position} في الفريق.', '{rank}º tra i {pool} {position} della rosa.', '{rank}e parmi les {pool} {position} de l’effectif.'],
  imp_m_goals: ['goles convirtió', 'goals', 'gols marcou', 'الأهداف', 'gol', 'buts'],
  imp_m_assists: ['asistencias dio', 'assists', 'assistências deu', 'التمريرات الحاسمة', 'assist', 'passes décisives'],
  imp_m_ga: ['participaciones de gol tuvo', 'goal contributions', 'participações teve', 'المساهمات التهديفية', 'partecipazioni', 'contributions'],
  imp_m_keyPasses: ['pases clave', 'key passes', 'passes decisivos', 'التمريرات المفتاحية', 'passaggi chiave', 'passes clés'],
  imp_m_minutes: ['minutos jugó', 'minutes', 'minutos jogou', 'الدقائق', 'minuti', 'minutes'],
  imp_m_duelPct: ['Gana', 'Wins', 'Ganha', 'يفوز بـ', 'Vince', 'Remporte'],
  imp_m_duelPct_suffix: ['de sus duelos', 'of his duels', 'dos seus duelos', 'من ثنائياته', 'dei suoi duelli', 'de ses duels'],
  imp_m_dribblePct: ['Completa', 'Completes', 'Completa', 'ينجح في', 'Completa', 'Réussit'],
  imp_m_dribblePct_suffix: ['de sus regates', 'of his dribbles', 'dos seus dribles', 'من مراوغاته', 'dei suoi dribbling', 'de ses dribbles'],

  // ── Impacto: rendimiento ──
  imp_rend_promedio: ['Promedia {avg} de Score GG en {matches} partidos.', 'Averages {avg} Score GG across {matches} matches.', 'Média de {avg} de Score GG em {matches} jogos.', 'بمعدل {avg} في Score GG خلال {matches} مباراة.', 'Media di {avg} di Score GG in {matches} partite.', 'Moyenne de {avg} de Score GG sur {matches} matchs.'],
  imp_rend_mejor: ['Su mejor partido del período: {best}.', 'His best match of the period: {best}.', 'O seu melhor jogo do período: {best}.', 'أفضل مباراة له في الفترة: {best}.', 'La sua miglior partita del periodo: {best}.', 'Son meilleur match de la période : {best}.'],
  imp_rend_up: ['Viene en alza: {recent} de promedio en los últimos partidos contra {previous} antes.', 'Trending up: {recent} on average in recent matches against {previous} before.', 'Em alta: {recent} de média nos últimos jogos contra {previous} antes.', 'في تصاعد: {recent} كمعدل في المباريات الأخيرة مقابل {previous} قبلها.', 'In crescita: {recent} di media nelle ultime partite contro {previous} prima.', 'En hausse : {recent} de moyenne sur les derniers matchs contre {previous} avant.'],
  imp_rend_down: ['Viene en baja: {recent} de promedio en los últimos partidos contra {previous} antes.', 'Trending down: {recent} on average in recent matches against {previous} before.', 'Em baixa: {recent} de média nos últimos jogos contra {previous} antes.', 'في تراجع: {recent} كمعدل في المباريات الأخيرة مقابل {previous} قبلها.', 'In calo: {recent} di media nelle ultime partite contro {previous} prima.', 'En baisse : {recent} de moyenne sur les derniers matchs contre {previous} avant.'],
  imp_rend_flat: ['Rendimiento sostenido: {recent} de promedio en los últimos partidos contra {previous} antes.', 'Steady output: {recent} on average in recent matches against {previous} before.', 'Rendimento sustentado: {recent} de média nos últimos jogos contra {previous} antes.', 'أداء ثابت: {recent} كمعدل في المباريات الأخيرة مقابل {previous} قبلها.', 'Rendimento costante: {recent} di media nelle ultime partite contro {previous} prima.', 'Rendement constant : {recent} de moyenne sur les derniers matchs contre {previous} avant.'],
  imp_rend_sobre: ['Superó su propio promedio en {above} de {matches} partidos ({pct}%).', 'Beat his own average in {above} of {matches} matches ({pct}%).', 'Superou a sua média em {above} de {matches} jogos ({pct}%).', 'تجاوز معدله الشخصي في {above} من {matches} مباراة ({pct}%).', 'Ha superato la propria media in {above} partite su {matches} ({pct}%).', 'A dépassé sa propre moyenne dans {above} des {matches} matchs ({pct}%).'],
  imp_rend_percentil: ['Su Score GG lo ubica mejor que el {pct}% de los jugadores de su posición.', 'His Score GG places him above {pct}% of players in his position.', 'O seu Score GG coloca-o acima de {pct}% dos jogadores da sua posição.', 'يضعه Score GG أفضل من {pct}% من لاعبي مركزه.', 'Il suo Score GG lo colloca meglio del {pct}% dei giocatori nel suo ruolo.', 'Son Score GG le place devant {pct}% des joueurs à son poste.'],

  // ── Impacto: resultados ──
  imp_res_record: ['Con él en cancha el equipo ganó {wins}, empató {draws} y perdió {losses}.', 'With him on the pitch the team won {wins}, drew {draws} and lost {losses}.', 'Com ele em campo a equipa venceu {wins}, empatou {draws} e perdeu {losses}.', 'بوجوده في الملعب فاز الفريق {wins} وتعادل {draws} وخسر {losses}.', 'Con lui in campo la squadra ha vinto {wins}, pareggiato {draws} e perso {losses}.', 'Avec lui sur le terrain, l’équipe a gagné {wins}, fait {draws} nuls et perdu {losses}.'],
  imp_res_conSinEl: ['Con él en cancha el equipo saca {withPpg} puntos por partido; sin él, {withoutPpg}.', 'With him the team takes {withPpg} points per match; without him, {withoutPpg}.', 'Com ele a equipa soma {withPpg} pontos por jogo; sem ele, {withoutPpg}.', 'بوجوده يحصد الفريق {withPpg} نقطة في المباراة؛ وبدونه {withoutPpg}.', 'Con lui la squadra ottiene {withPpg} punti a partita; senza di lui, {withoutPpg}.', 'Avec lui l’équipe prend {withPpg} points par match ; sans lui, {withoutPpg}.'],
```

- [ ] **Step 4: Implementar text.ts**

`src/features/informes/insights/text.ts`:

```ts
// De valores calculados a frases. Acá vive el tono: la misma métrica se enuncia
// distinto según el número ("más de uno de cada cuatro" vs el porcentaje pelado).
// Todo pasa por el diccionario de i18n para que el informe siga siendo multiidioma.

import { t, type Lang } from '@/features/informes/i18n'
import type { InsightItem, InsightTile } from './types'

/** Formatea números respetando el separador decimal del idioma. */
export function formatNum(n: number, lang: Lang): string {
  if (Number.isInteger(n)) return String(n)
  const fixed = String(Math.round(n * 100) / 100)
  return lang === 'es' || lang === 'pt' || lang === 'it' || lang === 'fr'
    ? fixed.replace('.', ',')
    : fixed
}

function vars(values: InsightItem['values'], lang: Lang): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(values)) {
    out[k] = typeof v === 'number' ? formatNum(v, lang) : v
  }
  return out
}

const CUMULATIVE_LABEL: Record<string, string> = {
  'plantel.goals': 'imp_m_goals',
  'plantel.assists': 'imp_m_assists',
  'plantel.ga': 'imp_m_ga',
  'plantel.keyPasses': 'imp_m_keyPasses',
  'plantel.minutes': 'imp_m_minutes',
}

const RATE_LABEL: Record<string, { prefix: string; suffix: string }> = {
  'plantel.duelPct': { prefix: 'imp_m_duelPct', suffix: 'imp_m_duelPct_suffix' },
  'plantel.dribblePct': { prefix: 'imp_m_dribblePct', suffix: 'imp_m_dribblePct_suffix' },
}

export function renderItem(item: InsightItem, lang: Lang): string {
  const v = vars(item.values, lang)

  switch (item.id) {
    case 'cont.pj':
      return Number(item.values.pct) >= 100 ? t(lang, 'imp_cont_pj_all', v) : t(lang, 'imp_cont_pj', v)
    case 'cont.titulares':
      return t(lang, 'imp_cont_titulares', v)
    case 'cont.minutos':
      return t(lang, 'imp_cont_minutos', v)
    case 'cont.lesiones':
      return t(lang, 'imp_cont_lesiones', v)

    case 'ofe.participaciones':
      return t(lang, 'imp_ofe_participaciones', v)
    case 'ofe.share': {
      const pct = Number(item.values.pct)
      if (pct >= 33) return t(lang, 'imp_ofe_share_third', v)
      if (pct >= 25) return t(lang, 'imp_ofe_share_strong', v)
      return t(lang, 'imp_ofe_share', v)
    }
    case 'ofe.promedio':
      return t(lang, 'imp_ofe_promedio', v)
    case 'ofe.cada':
      return t(lang, 'imp_ofe_cada', v)

    case 'plantel.score':
      return item.values.rank === 1 ? t(lang, 'imp_plantel_score_first', v) : t(lang, 'imp_plantel_score', v)
    case 'plantel.position':
      return t(lang, 'imp_plantel_position', v)

    case 'rend.promedio':
      return t(lang, 'imp_rend_promedio', v)
    case 'rend.mejor':
      return t(lang, 'imp_rend_mejor', v)
    case 'rend.tendencia': {
      const key = item.values.direction === 'up' ? 'imp_rend_up'
        : item.values.direction === 'down' ? 'imp_rend_down'
        : 'imp_rend_flat'
      return t(lang, key, v)
    }
    case 'rend.sobrePromedio':
      return t(lang, 'imp_rend_sobre', v)
    case 'rend.percentil':
      return t(lang, 'imp_rend_percentil', v)

    case 'res.record':
      return t(lang, 'imp_res_record', v)
    case 'res.conSinEl':
      return t(lang, 'imp_res_conSinEl', v)
  }

  if (CUMULATIVE_LABEL[item.id]) {
    const metric = t(lang, CUMULATIVE_LABEL[item.id])
    const key = item.values.rank === 1 ? 'imp_plantel_first' : 'imp_plantel_rank'
    return t(lang, key, { ...v, metric })
  }

  if (RATE_LABEL[item.id]) {
    // "Gana el 61,5% de sus duelos: el mejor entre los 14 jugadores con más de 400 minutos."
    // El verbo va en {metric} y el sustantivo en {what}: cada idioma los ordena a su manera.
    const { prefix, suffix } = RATE_LABEL[item.id]
    const key = item.values.rank === 1 ? 'imp_plantel_rate_first' : 'imp_plantel_rate'
    return t(lang, key, { ...v, metric: t(lang, prefix), what: t(lang, suffix) })
  }

  return ''
}

export function renderTile(tile: InsightTile, lang: Lang): { value: string; sub: string } {
  const v = vars(tile.values, lang)
  switch (tile.id) {
    case 'tile.pj':
      return { value: `${v.played}/${v.teamMatches}`, sub: t(lang, 'imp_tile_pj') }
    case 'tile.ga':
      return { value: String(v.ga), sub: t(lang, 'imp_tile_ga', v) }
    case 'tile.share':
      return { value: `${v.pct}%`, sub: t(lang, 'imp_tile_share') }
    case 'tile.score':
      return { value: String(v.avg), sub: t(lang, 'imp_tile_score') }
    default:
      return { value: '', sub: '' }
  }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/informes/insights/text.test.ts`
Expected: PASS — 17 tests.

Si alguna frase sale con un espacio doble o una preposición de más en algún idioma, el arreglo va en la plantilla de `i18n.ts` y en el string esperado del test. El contrato es que la frase se lea natural en cada idioma, no que calce con un borrador en español.

- [ ] **Step 6: Verificar que no se rompió la suite de i18n**

Run: `npx vitest run src/features/informes/i18n.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/informes/i18n.ts src/features/informes/insights/text.ts src/features/informes/insights/text.test.ts
git commit -m "feat(informes): redaccion de las conclusiones de Impacto en 6 idiomas"
```

---

### Task 6: Fetches de Supabase y hook

**Files:**
- Modify: `src/services/playerStatsService.ts` (agregar al final)
- Create: `src/features/informes/useInformeInsights.ts`
- Modify: `src/features/informes/types.ts` (campo `insights` en `Informe`)

**Interfaces:**
- Consumes: `computeInsights` de `./insights/compute`; `resolvePeriod` de `./insights/period`; `defaultMinMinutes`, `aggregateSquad` de `./insights/squad`; `usePlayerTransfers` de `@/hooks/usePlayerApiData`; `usePlayerInjuries` de `@/hooks/usePlayerApiData`.
- Produces: `fetchPlayerAllMatches(playerId)`, `fetchTeamFixtures(teamId, fromISO, toISO?)`, `fetchSquadMatchStats(teamId, fromISO, toISO?)`; hook `useInformeInsights(informe): { result: InsightsResult | null; loading: boolean; teamId: number | null; signingDate: string | null; squadLeaderMinutes: number }`; tipo `InsightsConfig` agregado a `Informe`.

- [ ] **Step 1: Agregar el campo persistido al informe**

En `src/features/informes/types.ts`, agregar el import y el campo dentro de `interface Informe`, después de `evolutionCharts`:

```ts
  insights?: import('./insights/types').InsightsConfig   // config de la pestaña Impacto
```

- [ ] **Step 2: Agregar los tres fetches**

Al final de `src/services/playerStatsService.ts`:

```ts
// ── Informes / pestaña Impacto ────────────────────────────────────────────────
// fetchPlayerMatchHistory filtra por posición detectada y por match_score no nulo,
// lo que subcuenta partidos. Para contar continuidad hacen falta todas las filas.

export async function fetchPlayerAllMatches(playerId: number): Promise<PlayerMatchStat[]> {
  const { data, error } = await supabase
    .from('player_match_stats')
    .select(`
      *,
      fixture:fixtures(
        id, date, home_team_id, away_team_id, score_home, score_away, league_id
      )
    `)
    .eq('player_id', playerId)
    .order('fixture(date)', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface TeamFixtureRow {
  id: number;
  date: string;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  score_home: number | null;
  score_away: number | null;
}

export async function fetchTeamFixtures(
  teamId: number,
  fromISO: string,
  toISO?: string,
): Promise<TeamFixtureRow[]> {
  let query = supabase
    .from('fixtures')
    .select('id, date, league_id, home_team_id, away_team_id, score_home, score_away')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gte('date', fromISO)
    .order('date', { ascending: true });

  if (toISO) query = query.lte('date', `${toISO}T23:59:59`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface SquadStatRow {
  player_id: number;
  minutes: number;
  goals: number;
  assists: number;
  passes_key: number;
  duels_won: number;
  duels_total: number;
  dribbles_success: number;
  dribbles_attempted: number;
  match_score: number | null;
  detected_position: string | null;
  fixture_id: number;
  player?: { name: string } | null;
  fixture?: { date: string } | null;
}

export async function fetchSquadMatchStats(
  teamId: number,
  fromISO: string,
  toISO?: string,
): Promise<SquadStatRow[]> {
  let query = supabase
    .from('player_match_stats')
    .select(`
      player_id, fixture_id, minutes, goals, assists, passes_key,
      duels_won, duels_total, dribbles_success, dribbles_attempted,
      match_score, detected_position,
      player:players(name),
      fixture:fixtures!inner(date)
    `)
    .eq('team_id', teamId)
    .gte('fixture.date', fromISO);

  if (toISO) query = query.lte('fixture.date', `${toISO}T23:59:59`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as SquadStatRow[];
}
```

- [ ] **Step 3: Crear el hook**

`src/features/informes/useInformeInsights.ts`:

```ts
// Orquesta los datos de la pestaña Impacto: resuelve el equipo y la fecha de
// llegada, trae partidos del jugador, fixtures del club y filas del plantel, y
// delega todo el cálculo en el módulo puro insights/.

import { useEffect, useMemo, useState } from 'react'
import {
  fetchPlayerAllMatches,
  fetchSquadMatchStats,
  fetchTeamFixtures,
  type SquadStatRow,
  type TeamFixtureRow,
} from '@/services/playerStatsService'
import { usePlayerInjuries, usePlayerTransfers } from '@/hooks/usePlayerApiData'
import type { PlayerMatchStat } from '@/types/scoring'
import { computeInsights } from './insights/compute'
import { resolvePeriod, toISODate } from './insights/period'
import { aggregateSquad, defaultMinMinutes } from './insights/squad'
import { BLOCK_IDS, type InsightsConfig, type InsightsResult, type PlayerMatchRow, type SquadMatchRow, type TeamFixture } from './insights/types'
import type { Informe } from './types'

export const DEFAULT_INSIGHTS_CONFIG: InsightsConfig = {
  enabled: false,
  period: { mode: 'signing' },
  blocks: [...BLOCK_IDS],
  hiddenItems: [],
  overrides: {},
}

export interface InformeInsights {
  result: InsightsResult | null
  loading: boolean
  teamId: number | null
  signingDate: string | null
  squadLeaderMinutes: number
  defaultMinutes: number
}

const EMPTY: InformeInsights = {
  result: null, loading: false, teamId: null, signingDate: null, squadLeaderMinutes: 0, defaultMinutes: 0,
}

function toPlayerRows(matches: PlayerMatchStat[], teamId: number): PlayerMatchRow[] {
  return matches
    .filter(m => m.team_id === teamId && m.fixture?.date)
    .map(m => ({
      player_id: m.player_id,
      player_name: '',
      fixture_id: m.fixture_id,
      date: m.fixture!.date,
      minutes: m.minutes ?? 0,
      goals: m.goals ?? 0,
      assists: m.assists ?? 0,
      passes_key: m.passes_key ?? 0,
      duels_won: m.duels_won ?? 0,
      duels_total: m.duels_total ?? 0,
      dribbles_success: m.dribbles_success ?? 0,
      dribbles_attempted: m.dribbles_attempted ?? 0,
      match_score: m.match_score,
      detected_position: m.detected_position,
      is_substitute: m.is_substitute,
      team_id: m.team_id,
      home_team_id: m.fixture!.home_team_id,
      away_team_id: m.fixture!.away_team_id,
      score_home: m.fixture!.score_home,
      score_away: m.fixture!.score_away,
    }))
}

function toSquadRows(rows: SquadStatRow[]): SquadMatchRow[] {
  return rows
    .filter(r => r.fixture?.date)
    .map(r => ({
      player_id: r.player_id,
      player_name: r.player?.name ?? `#${r.player_id}`,
      fixture_id: r.fixture_id,
      date: r.fixture!.date,
      minutes: r.minutes ?? 0,
      goals: r.goals ?? 0,
      assists: r.assists ?? 0,
      passes_key: r.passes_key ?? 0,
      duels_won: r.duels_won ?? 0,
      duels_total: r.duels_total ?? 0,
      dribbles_success: r.dribbles_success ?? 0,
      dribbles_attempted: r.dribbles_attempted ?? 0,
      match_score: r.match_score,
      detected_position: r.detected_position,
    }))
}

function toFixtures(rows: TeamFixtureRow[]): TeamFixture[] {
  return rows
}

export function useInformeInsights(informe: Informe | null): InformeInsights {
  const playerId = informe?.dbPlayerId ?? null
  const config = informe?.insights ?? DEFAULT_INSIGHTS_CONFIG

  const [matches, setMatches] = useState<PlayerMatchStat[]>([])
  const [fixtures, setFixtures] = useState<TeamFixture[]>([])
  const [squadRows, setSquadRows] = useState<SquadMatchRow[]>([])
  const [loading, setLoading] = useState(false)

  const { transfers } = usePlayerTransfers(playerId)
  const { injuries } = usePlayerInjuries(playerId)

  // 1) Partidos del jugador: definen el club actual.
  useEffect(() => {
    if (!playerId) { setMatches([]); return }
    let cancelled = false
    setLoading(true)
    fetchPlayerAllMatches(playerId)
      .then(rows => { if (!cancelled) setMatches(rows) })
      .catch(() => { if (!cancelled) setMatches([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [playerId])

  const teamId = useMemo(() => {
    const withDate = matches.filter(m => m.fixture?.date)
    if (withDate.length === 0) return null
    return withDate[withDate.length - 1].team_id
  }, [matches])

  // Fecha de llegada: último traspaso hacia el club; si no hay, su primer partido.
  const signingDate = useMemo(() => {
    if (!teamId) return null
    const toTeam = transfers
      .filter(tr => tr.teams?.in?.id === teamId && tr.date)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]
    if (toTeam?.date) return toISODate(toTeam.date)
    const own = matches.filter(m => m.team_id === teamId && m.fixture?.date)
    return own.length ? toISODate(own[0].fixture!.date) : null
  }, [teamId, transfers, matches])

  // 2) Fixtures del club + plantel, desde el inicio de todo lo que pueda pedirse.
  const fetchFrom = useMemo(() => {
    const candidates = [signingDate, ...matches.filter(m => m.fixture?.date).map(m => toISODate(m.fixture!.date))]
      .filter((d): d is string => !!d)
    return candidates.length ? candidates.sort()[0] : null
  }, [signingDate, matches])

  useEffect(() => {
    if (!teamId || !fetchFrom) { setFixtures([]); setSquadRows([]); return }
    let cancelled = false
    setLoading(true)
    Promise.all([fetchTeamFixtures(teamId, fetchFrom), fetchSquadMatchStats(teamId, fetchFrom)])
      .then(([fx, squad]) => {
        if (cancelled) return
        setFixtures(toFixtures(fx))
        setSquadRows(toSquadRows(squad))
      })
      .catch(() => {
        if (cancelled) return
        setFixtures([])
        setSquadRows([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [teamId, fetchFrom])

  return useMemo<InformeInsights>(() => {
    if (!informe || !playerId || !teamId) return { ...EMPTY, loading }

    const period = resolvePeriod(config.period, { signingDate, fixtures })
    const squadInPeriod = aggregateSquad(squadRows.filter(r => r.date.slice(0, 10) >= period.from))
    const leaderMinutes = squadInPeriod.reduce((max, s) => Math.max(max, s.minutes), 0)
    const fallbackMinutes = defaultMinMinutes(squadInPeriod)

    const result = computeInsights({
      playerId,
      teamId,
      period,
      playerMatches: toPlayerRows(matches, teamId),
      squadRows,
      fixtures,
      injuries: injuries.map(i => ({ type: i.type, start: i.start, end: i.end })),
      blocks: config.blocks,
      minMinutes: config.minMinutes,
      overrides: { teamMatches: config.teamMatchesOverride, teamGoals: config.teamGoalsOverride },
      percentile: informe.dbPercentile ?? null,
    })

    return { result, loading, teamId, signingDate, squadLeaderMinutes: leaderMinutes, defaultMinutes: fallbackMinutes }
  }, [informe, playerId, teamId, config, matches, fixtures, squadRows, injuries, signingDate, loading])
}
```

- [ ] **Step 4: Verificar los tipos de traspasos y lesiones**

Los campos `tr.teams.in.id`, `tr.date`, `i.type`, `i.start`, `i.end` tienen que existir en `PlayerTransfer` y `PlayerSidelined`.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores. Si el tipo de traspaso usa otra forma (por ejemplo `tr.teams.in.name` sin `id`), matchear por nombre de equipo contra `teams.name` del fixture es el fallback: leer `src/services/footballApiService.ts` y ajustar el `useMemo` de `signingDate` a los campos reales.

- [ ] **Step 5: Verificar los números contra la base con un script**

Crear un script temporal fuera del repo (en el scratchpad) que replique el cálculo con los datos reales de Luca Orellano (`player_id` 6063, `team_id` 2282) y confirmar que da lo mismo que la exploración del diseño: 15 partidos, 1.136 minutos, 3 goles, 4 asistencias, 2º del plantel en asistencias (4 de 20), 2º en pases clave (25 de 218), 3º en Score GG (6,69).

Si algún número no coincide, el problema está en el cálculo o en el período resuelto, no en el test: arreglarlo antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add src/services/playerStatsService.ts src/features/informes/useInformeInsights.ts src/features/informes/types.ts
git commit -m "feat(informes): fetches y hook de datos para la pestana Impacto"
```

---

### Task 7: UI de configuración en el paso 3

**Files:**
- Create: `src/features/informes/components/Step3Impacto.tsx`
- Modify: `src/features/informes/components/Step3Contenido.tsx`
- Modify: `src/pages/InformesPage.tsx:155-162`

**Interfaces:**
- Consumes: `useInformeInsights`, `DEFAULT_INSIGHTS_CONFIG` de `../useInformeInsights`; `renderItem`, `renderTile` de `../insights/text`; `InsightsConfig`, `BLOCK_IDS` de `../insights/types`.
- Produces: componente `<Step3Impacto informe onChange />`. `Step3Contenido` pasa a recibir `informe: Informe` y `onChangeInforme: (i: Informe) => void` además de lo que ya recibe.

- [ ] **Step 1: Crear el componente de configuración**

`src/features/informes/components/Step3Impacto.tsx`:

```tsx
import { useMemo } from 'react'
import { useInformeInsights, DEFAULT_INSIGHTS_CONFIG } from '@/features/informes/useInformeInsights'
import { renderItem, renderTile } from '@/features/informes/insights/text'
import { BLOCK_IDS, type InsightBlockId, type InsightsConfig, type PeriodMode } from '@/features/informes/insights/types'
import { t } from '@/features/informes/i18n'
import type { Informe } from '@/features/informes/types'

const cardClass = 'rounded-2xl border border-apple-gray-200 dark:border-apple-gray-800 bg-white dark:bg-apple-gray-900 p-5'
const labelClass = 'block text-xs uppercase tracking-wide text-apple-gray-500 dark:text-apple-gray-400 mb-1'
const smallInputClass = 'w-full px-2 py-1.5 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-apple-gray-50 dark:bg-apple-gray-800 text-apple-gray-900 dark:text-white text-xs'

const PERIOD_LABEL: Record<PeriodMode, string> = {
  signing: 'Desde su llegada',
  season: 'Temporada',
  last10: 'Últimos 10',
  custom: 'Rango',
}

const BLOCK_LABEL: Record<InsightBlockId, string> = {
  continuidad: 'Continuidad',
  ofensivo: 'Peso ofensivo',
  plantel: 'Su lugar en el plantel',
  rendimiento: 'Rendimiento',
  resultados: 'Impacto en resultados',
}

const WARNING_TEXT: Record<string, string> = {
  goalsMismatch: 'Los goles del club no coinciden entre fixtures y planilla del plantel: probablemente falte una competencia. Podés pisar el total a mano.',
  shortSample: 'Muestra corta (menos de 3 partidos): no se calculan promedios ni rankings.',
  noTeamFixtures: 'No hay partidos del club en este período: los bloques que dependen del equipo quedan afuera.',
}

interface Props {
  informe: Informe
  onChange: (informe: Informe) => void
}

export default function Step3Impacto({ informe, onChange }: Props) {
  const config: InsightsConfig = informe.insights ?? DEFAULT_INSIGHTS_CONFIG
  const { result, loading, squadLeaderMinutes, defaultMinutes } = useInformeInsights(informe)
  const lang = informe.idioma ?? 'es'

  const setConfig = (patch: Partial<InsightsConfig>) =>
    onChange({ ...informe, insights: { ...config, ...patch } })

  const toggleBlock = (id: InsightBlockId) =>
    setConfig({ blocks: config.blocks.includes(id) ? config.blocks.filter(b => b !== id) : [...config.blocks, id] })

  const toggleItem = (id: string) =>
    setConfig({ hiddenItems: config.hiddenItems.includes(id) ? config.hiddenItems.filter(x => x !== id) : [...config.hiddenItems, id] })

  const setOverride = (id: string, text: string) => {
    const next = { ...config.overrides }
    if (text.trim()) next[id] = text
    else delete next[id]
    setConfig({ overrides: next })
  }

  const minMinutes = config.minMinutes ?? defaultMinutes
  const sliderMax = Math.max(90, Math.ceil(squadLeaderMinutes / 45) * 45)

  const tiles = useMemo(() => result?.tiles ?? [], [result])

  if (!informe.dbPlayerId) {
    return (
      <div className={cardClass}>
        <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white mb-2">Impacto (datos de la API)</h2>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
          Linkeá el jugador con la base en el paso 1 para calcular las conclusiones automáticas.
        </p>
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white">Impacto (datos de la API)</h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-apple-gray-700 dark:text-apple-gray-200">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => setConfig({ enabled: e.target.checked })}
            className="rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
          />
          Incluir en el informe
        </label>
      </div>

      {!config.enabled ? (
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
          Activalo para agregar la pestaña Impacto con las conclusiones calculadas.
        </p>
      ) : loading ? (
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">Calculando…</p>
      ) : !result ? (
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
          No hay partidos de este jugador en la base para calcular el impacto.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Período */}
          <div>
            <span className={labelClass}>Período</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PERIOD_LABEL) as PeriodMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setConfig({ period: { ...config.period, mode } })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    config.period.mode === mode
                      ? 'bg-brand-green text-white border-brand-green'
                      : 'border-apple-gray-200 dark:border-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300'
                  }`}
                >
                  {PERIOD_LABEL[mode]}
                </button>
              ))}
            </div>
            {config.period.mode === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input type="date" value={config.period.from ?? ''} onChange={e => setConfig({ period: { ...config.period, from: e.target.value } })} className={smallInputClass} />
                <input type="date" value={config.period.to ?? ''} onChange={e => setConfig({ period: { ...config.period, to: e.target.value } })} className={smallInputClass} />
              </div>
            )}
            <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400 mt-1.5">
              Desde {result.period.from}{result.period.to ? ` hasta ${result.period.to}` : ''}
            </p>
          </div>

          {/* Avisos */}
          {result.warnings.map(w => (
            <p key={w} className="text-[11px] px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
              {WARNING_TEXT[w] ?? w}
            </p>
          ))}

          {/* Overrides de totales del club */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={labelClass}>Partidos del club (opcional)</span>
              <input
                type="number"
                value={config.teamMatchesOverride ?? ''}
                onChange={e => setConfig({ teamMatchesOverride: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="auto"
                className={smallInputClass}
              />
            </div>
            <div>
              <span className={labelClass}>Goles del club (opcional)</span>
              <input
                type="number"
                value={config.teamGoalsOverride ?? ''}
                onChange={e => setConfig({ teamGoalsOverride: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="auto"
                className={smallInputClass}
              />
            </div>
          </div>

          {/* Tarjetas */}
          {tiles.length > 0 && (
            <div>
              <span className={labelClass}>Tarjetas</span>
              <div className="flex flex-wrap gap-2">
                {tiles.map(tile => {
                  const { value, sub } = renderTile(tile, lang)
                  const hidden = config.hiddenItems.includes(tile.id)
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => toggleItem(tile.id)}
                      className={`px-3 py-2 rounded-xl border text-left transition-opacity ${hidden ? 'opacity-40' : ''} border-apple-gray-200 dark:border-apple-gray-700`}
                    >
                      <span className="block text-base font-bold text-apple-gray-900 dark:text-white">{value}</span>
                      <span className="block text-[10px] text-apple-gray-500 dark:text-apple-gray-400">{sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bloques y frases */}
          <div className="space-y-3">
            {BLOCK_IDS.map(blockId => {
              const group = result.groups.find(g => g.id === blockId)
              const active = config.blocks.includes(blockId)
              return (
                <div key={blockId} className="rounded-xl border border-apple-gray-200 dark:border-apple-gray-800 p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none text-apple-gray-800 dark:text-apple-gray-100">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleBlock(blockId)}
                      className="rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
                    />
                    {BLOCK_LABEL[blockId]}
                  </label>

                  {blockId === 'plantel' && active && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className={labelClass}>Minutos mínimos para comparar eficacia</span>
                        <span className="text-xs font-semibold text-brand-green">{minMinutes}′</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        step={45}
                        value={minMinutes}
                        onChange={e => setConfig({ minMinutes: Number(e.target.value) })}
                        className="w-full accent-brand-green"
                      />
                      <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400">
                        {result.qualifiedCount} jugadores del plantel entran en la comparación.
                      </p>
                    </div>
                  )}

                  {active && group && (
                    <ul className="mt-3 space-y-2">
                      {group.items.map(item => {
                        const hidden = config.hiddenItems.includes(item.id)
                        const text = config.overrides[item.id] ?? renderItem(item, lang)
                        return (
                          <li key={item.id} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={!hidden}
                              onChange={() => toggleItem(item.id)}
                              className="mt-1.5 rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
                            />
                            <textarea
                              value={text}
                              onChange={e => setOverride(item.id, e.target.value)}
                              rows={2}
                              className={`${smallInputClass} resize-y ${hidden ? 'opacity-40' : ''}`}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {active && !group && (
                    <p className="mt-2 text-[11px] text-apple-gray-500 dark:text-apple-gray-400">
                      Sin datos suficientes para este bloque en el período elegido.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Montarlo en el paso 3**

En `src/features/informes/components/Step3Contenido.tsx`:

1. Agregar el import arriba: `import Step3Impacto from './Step3Impacto'` y `import type { Informe } from '@/features/informes/types'`.
2. Cambiar la interfaz de props:

```ts
interface Step3ContenidoProps {
  informe: Informe
  content: InformeContent
  onChange: (content: InformeContent) => void
  onChangeInforme: (informe: Informe) => void
  onBack: () => void
  onNext: () => void
}
```

3. Cambiar la firma del componente a `export default function Step3Contenido({ informe, content, onChange, onChangeInforme, onBack, onNext }: Step3ContenidoProps) {`.
4. Insertar el componente en la columna derecha, después de la tarjeta de "Comparaciones" (el `div` del textarea) y antes del cierre `</div>` de esa columna:

```tsx
          <Step3Impacto informe={informe} onChange={onChangeInforme} />
```

- [ ] **Step 3: Pasar el informe completo desde la página**

En `src/pages/InformesPage.tsx`, reemplazar el bloque del paso 2:

```tsx
          {step === 2 && informe && (
            <Step3Contenido
              informe={informe}
              content={informe.content}
              onChange={(c) => setInforme({ ...informe, content: c })}
              onChangeInforme={setInforme}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 5: Probar a mano en el navegador**

Run: `npm run dev`

Abrir `http://localhost:5173/informes`, crear un informe, linkear un jugador con datos en la base en el paso 1 (por ejemplo Luca Orellano), llegar al paso 3 y confirmar:
- La tarjeta "Impacto" aparece con el toggle apagado.
- Al activarla se ven período, tarjetas y frases.
- Mover el slider cambia el contador de jugadores y los puestos de las frases del bloque plantel.
- Destildar una frase la atenúa; editar el texto lo conserva al cambiar de paso y volver.

- [ ] **Step 6: Commit**

```bash
git add src/features/informes/components/Step3Impacto.tsx src/features/informes/components/Step3Contenido.tsx src/pages/InformesPage.tsx
git commit -m "feat(informes): configuracion de Impacto en el paso 3 con slider de minutos"
```

---

### Task 8: Panel de Impacto en el preview

**Files:**
- Create: `src/features/informes/components/InformeImpacto.tsx`
- Modify: `src/features/informes/components/Step4Preview.tsx:59` (TAB_IDS), `:324-326` (visibleTabs), `:748-750` (renderTab)

**Interfaces:**
- Consumes: `useInformeInsights` de `../useInformeInsights`; `renderItem`, `renderTile` de `../insights/text`.
- Produces: componente `<InformeImpacto informe result lang />` reutilizable por el preview, y la `TabId` `'impacto'`.

- [ ] **Step 1: Crear el panel**

`src/features/informes/components/InformeImpacto.tsx`:

```tsx
import { renderItem, renderTile } from '@/features/informes/insights/text'
import { t, type Lang } from '@/features/informes/i18n'
import type { InsightsConfig, InsightsResult } from '@/features/informes/insights/types'

const DG = {
  cardInner: '#14171B',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F7FA',
  muted: '#8A9099',
  green: '#22C55E',
}

const GROUP_KEY: Record<string, string> = {
  continuidad: 'imp_g_continuidad',
  ofensivo: 'imp_g_ofensivo',
  plantel: 'imp_g_plantel',
  rendimiento: 'imp_g_rendimiento',
  resultados: 'imp_g_resultados',
}

export function periodTitle(result: InsightsResult, lang: Lang): string {
  const { period } = result
  if (period.mode === 'signing' && period.anchorDate) return t(lang, 'imp_since', { date: period.anchorDate })
  if (period.mode === 'last10') return t(lang, 'imp_last10')
  if (period.mode === 'custom') return t(lang, 'imp_range', { from: period.from, to: period.to ?? '' })
  return t(lang, 'imp_season')
}

/** Donut de porcentaje, en SVG (mismo dibujo que el export). */
function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(100, pct))
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={label}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none" stroke={DG.green} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(c * filled) / 100} ${c}`} transform="rotate(-90 36 36)"
      />
    </svg>
  )
}

function Dots({ filled, total }: { filled: number; total: number }) {
  const shown = Math.min(total, 20)
  const filledShown = Math.round((filled / Math.max(total, 1)) * shown)
  return (
    <div className="flex flex-wrap gap-1 mt-1" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i < filledShown ? DG.green : 'rgba(255,255,255,0.18)' }}
        />
      ))}
    </div>
  )
}

interface Props {
  result: InsightsResult
  config: InsightsConfig
  lang: Lang
}

export default function InformeImpacto({ result, config, lang }: Props) {
  const visibleTiles = result.tiles.filter(tile => !config.hiddenItems.includes(tile.id))
  const groups = result.groups
    .filter(g => config.blocks.includes(g.id))
    .map(g => ({ ...g, items: g.items.filter(i => !config.hiddenItems.includes(i.id)) }))
    .filter(g => g.items.length > 0)

  return (
    <div>
      <div className="mb-4">
        <span className="block w-6 h-[2px] rounded-full mb-1.5" style={{ backgroundColor: DG.green }} />
        <h3 className="text-[11px] font-bold uppercase" style={{ letterSpacing: '0.12em', color: DG.muted }}>
          {t(lang, 'tab_impacto')}
        </h3>
        <p className="text-sm mt-1" style={{ color: DG.text }}>{periodTitle(result, lang)}</p>
      </div>

      {visibleTiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {visibleTiles.map(tile => {
            const { value, sub } = renderTile(tile, lang)
            return (
              <div key={tile.id} className="rounded-2xl border p-3" style={{ borderColor: DG.border, backgroundColor: DG.cardInner }}>
                {tile.render === 'donut' && tile.pct != null ? (
                  <div className="flex items-center gap-2">
                    <Donut pct={tile.pct} label={sub} />
                    <span className="text-xl font-bold" style={{ color: DG.text }}>{value}</span>
                  </div>
                ) : (
                  <span className="block text-2xl font-bold" style={{ color: DG.text }}>{value}</span>
                )}
                {tile.render === 'dots' && tile.dots && <Dots filled={tile.dots.filled} total={tile.dots.total} />}
                <span className="block text-[11px] mt-1" style={{ color: DG.muted }}>{sub}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.id}>
            <h4 className="text-xs font-bold uppercase mb-2" style={{ letterSpacing: '0.08em', color: DG.muted }}>
              {t(lang, GROUP_KEY[group.id])}
            </h4>
            <ul className="space-y-1.5">
              {group.items.map(item => (
                <li key={item.id} className="text-sm flex gap-2" style={{ color: DG.text }}>
                  <span style={{ color: DG.green }}>•</span>
                  <span>{config.overrides[item.id] ?? renderItem(item, lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {result.warnings.includes('goalsMismatch') && (
        <p className="text-[11px] mt-4" style={{ color: DG.muted }}>{t(lang, 'imp_note_coverage')}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Registrar la pestaña en el preview**

En `src/features/informes/components/Step4Preview.tsx`:

1. Agregar los imports:

```tsx
import InformeImpacto from './InformeImpacto'
import { useInformeInsights, DEFAULT_INSIGHTS_CONFIG } from '@/features/informes/useInformeInsights'
```

2. Cambiar `TAB_IDS` (línea 59) para insertar `'impacto'` después de `'general'`:

```tsx
const TAB_IDS = ['general', 'impacto', 'radar', 'bars', 'scatter', 'fisico', 'evolutivas', 'video', 'carrera', 'comparaciones'] as const
```

3. Debajo de `const enrichment: InformeEnrichment = useInformeEnrichment(informe)` (línea 266), agregar:

```tsx
  const insightsConfig = informe.insights ?? DEFAULT_INSIGHTS_CONFIG
  const { result: insightsResult } = useInformeInsights(informe)
  const showImpacto = insightsConfig.enabled && !!insightsResult && insightsResult.groups.length > 0
```

4. Cambiar `visibleTabs` (líneas 324-326):

```tsx
  const visibleTabs = TAB_IDS.filter(id =>
    id === 'fisico' ? showFisico
      : id === 'evolutivas' ? showEvolutivas
      : id === 'impacto' ? showImpacto
      : true,
  )
```

5. Agregar el caso en `renderTab` (después de `case 'general': return renderGeneral()`):

```tsx
      case 'impacto':
        return insightsResult
          ? <InformeImpacto result={insightsResult} config={insightsConfig} lang={lang} />
          : null
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Probar a mano**

Run: `npm run dev`

Con el informe del paso anterior, ir al paso 4 y confirmar que la pestaña "Impacto" aparece entre General y Radar, que muestra el donut y los dots, y que las frases destildadas en el paso 3 no aparecen.

- [ ] **Step 5: Commit**

```bash
git add src/features/informes/components/InformeImpacto.tsx src/features/informes/components/Step4Preview.tsx
git commit -m "feat(informes): pestana Impacto en el preview"
```

---

### Task 9: Export HTML

**Files:**
- Modify: `src/features/informes/chartSvg.ts` (agregar al final)
- Modify: `src/features/informes/exportInformeHTML.ts` (panel + `opts.insights` + tabs)
- Modify: `src/features/informes/components/Step4Preview.tsx:812,829` (pasar `insights` al export)
- Test: `src/features/informes/exportInformeHTML.test.ts` (agregar describe)

**Interfaces:**
- Consumes: `InsightsResult`, `InsightsConfig` de `./insights/types`; `renderItem`, `renderTile` de `./insights/text`.
- Produces: `donutSvg({ pct, size? })`, `dotsSvg({ filled, total, width? })` en `chartSvg.ts`; `opts.insights?: { result: InsightsResult; config: InsightsConfig }` en `buildInformeHtml` y `exportInformeHTML`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `src/features/informes/exportInformeHTML.test.ts`:

```ts
describe('buildInformeHtml — pestaña Impacto', () => {
  function insightsFixture() {
    return {
      config: {
        enabled: true,
        period: { mode: 'season' as const },
        blocks: ['continuidad' as const, 'ofensivo' as const],
        hiddenItems: ['cont.minutos'],
        overrides: { 'cont.titulares': 'Texto escrito a mano.' },
      },
      result: {
        period: { mode: 'season' as const, from: '2026-01-01', to: null, anchorDate: null },
        tiles: [
          { id: 'tile.pj', render: 'dots' as const, values: { played: 15, teamMatches: 18, pct: 83.3 }, dots: { filled: 15, total: 18 } },
          { id: 'tile.share', render: 'donut' as const, values: { pct: 28, ga: 7, teamGoals: 25 }, pct: 28 },
        ],
        groups: [
          { id: 'continuidad' as const, items: [
            { id: 'cont.pj', values: { played: 15, teamMatches: 18, pct: 83.3 }, tone: 'neutral' as const },
            { id: 'cont.titulares', values: { starts: 12, played: 15, pct: 80 }, tone: 'strong' as const },
            { id: 'cont.minutos', values: { minutes: 1136, pct: 70 }, tone: 'neutral' as const },
          ] },
          { id: 'ofensivo' as const, items: [
            { id: 'ofe.share', values: { ga: 7, teamGoals: 25, pct: 28 }, tone: 'strong' as const },
          ] },
        ],
        warnings: [],
        minMinutes: 400,
        qualifiedCount: 14,
      },
    }
  }

  it('agrega la pestaña cuando hay insights habilitados', () => {
    const html = buildInformeHtml({ ...baseArgs(), insights: insightsFixture() })
    expect(html).toContain('data-tab="impacto"')
    expect(html).toContain('data-panel="impacto"')
  })

  it('no agrega la pestaña si está deshabilitada', () => {
    const ins = insightsFixture()
    ins.config.enabled = false
    const html = buildInformeHtml({ ...baseArgs(), insights: ins })
    expect(html).not.toContain('data-panel="impacto"')
  })

  it('respeta las frases ocultas y los textos reescritos', () => {
    const html = buildInformeHtml({ ...baseArgs(), insights: insightsFixture() })
    expect(html).toContain('Texto escrito a mano.')
    expect(html).not.toContain('1136')
  })

  it('dibuja el donut del share', () => {
    const html = buildInformeHtml({ ...baseArgs(), insights: insightsFixture() })
    expect(html).toContain('<svg')
    expect(html).toContain('28%')
  })
})
```

Nota: `baseArgs()` es el helper que ya usan los tests de este archivo para construir el informe mínimo. Si el archivo no lo tiene con ese nombre, reutilizar el que exista (leer el principio del archivo) en lugar de crear otro.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/informes/exportInformeHTML.test.ts`
Expected: FAIL — los cuatro tests nuevos, porque `opts.insights` todavía no existe.

- [ ] **Step 3: Agregar los SVG al helper de gráficos**

Al final de `src/features/informes/chartSvg.ts`:

```ts
// ---------------------------------------------------------------------------
// donutSvg / dotsSvg (tarjetas de la pestaña Impacto)
// ---------------------------------------------------------------------------

/** Aro de porcentaje. El texto del centro lo pone el HTML, no el SVG. */
export function donutSvg(opts: { pct: number; size?: number }): string {
  const size = opts.size ?? 72
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(100, opts.pct))
  const cx = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cx}" r="${round2(r)}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="7"/>
    <circle cx="${cx}" cy="${cx}" r="${round2(r)}" fill="none" stroke="${COLOR_GREEN}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${round2((c * filled) / 100)} ${round2(c)}" transform="rotate(-90 ${cx} ${cx})"/>
  </svg>`
}

/** Fila de puntos: partidos jugados sobre partidos del club. Máximo 20 puntos. */
export function dotsSvg(opts: { filled: number; total: number; width?: number }): string {
  const total = Math.max(1, opts.total)
  const shown = Math.min(total, 20)
  const filledShown = Math.round((opts.filled / total) * shown)
  const gap = 7
  const r = 2.5
  const W = opts.width ?? shown * gap
  const dots = Array.from({ length: shown }, (_, i) =>
    `<circle cx="${round2(i * gap + r)}" cy="${r}" r="${r}" fill="${i < filledShown ? COLOR_GREEN : 'rgba(255,255,255,0.18)'}"/>`,
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${r * 2}" viewBox="0 0 ${W} ${r * 2}">${dots}</svg>`
}
```

- [ ] **Step 4: Agregar el panel al export**

En `src/features/informes/exportInformeHTML.ts`:

1. Agregar los imports arriba, junto a los que ya existen:

```ts
import { donutSvg, dotsSvg } from './chartSvg'
import { renderItem, renderTile } from './insights/text'
import type { InsightsConfig, InsightsResult } from './insights/types'
```

(si `chartSvg` ya se importa, sumar `donutSvg, dotsSvg` a esa línea en lugar de duplicar el import)

2. Agregar el tipo al final de las interfaces exportadas, después de `EvolutionChartExport`:

```ts
export interface InsightsExport {
  result: InsightsResult
  config: InsightsConfig
}
```

3. Agregar `insights?: InsightsExport` a los `opts` de `buildInformeHtml` **y** de `exportInformeHTML`.

4. Antes del array `const tabs = [...]`, construir el panel:

```ts
  // ── Impacto (conclusiones desde la API) — sólo si el llamador resolvió la data ──
  const insights = opts.insights
  const insightGroups = insights && insights.config.enabled
    ? insights.result.groups
        .filter(g => insights.config.blocks.includes(g.id))
        .map(g => ({ ...g, items: g.items.filter(i => !insights.config.hiddenItems.includes(i.id)) }))
        .filter(g => g.items.length > 0)
    : []
  const showImpacto = insightGroups.length > 0

  const impactoPanel = showImpacto && insights
    ? (() => {
        const { result, config } = insights
        const period = result.period
        const periodText =
          period.mode === 'signing' && period.anchorDate ? t(lang, 'imp_since', { date: period.anchorDate })
          : period.mode === 'last10' ? t(lang, 'imp_last10')
          : period.mode === 'custom' ? t(lang, 'imp_range', { from: period.from, to: period.to ?? '' })
          : t(lang, 'imp_season')

        const tilesHtml = result.tiles
          .filter(tile => !config.hiddenItems.includes(tile.id))
          .map(tile => {
            const { value, sub } = renderTile(tile, lang)
            const art = tile.render === 'donut' && tile.pct != null
              ? `<div class="dg-imp-art">${donutSvg({ pct: tile.pct })}</div>`
              : tile.render === 'dots' && tile.dots
                ? `<div class="dg-imp-art">${dotsSvg(tile.dots)}</div>`
                : ''
            return `<div class="dg-imp-tile">
                <span class="dg-imp-value">${escapeHtml(value)}</span>
                ${art}
                <span class="dg-imp-sub">${escapeHtml(sub)}</span>
              </div>`
          })
          .join('')

        const groupsHtml = insightGroups
          .map(g => `<h4 class="dg-panel-title dg-mt">${escapeHtml(t(lang, `imp_g_${g.id}`))}</h4>
            <ul class="dg-imp-list">${g.items
              .map(i => `<li>${escapeHtml(config.overrides[i.id] ?? renderItem(i, lang))}</li>`)
              .join('')}</ul>`)
          .join('')

        const note = result.warnings.includes('goalsMismatch')
          ? `<p class="dg-muted dg-subtitle">${escapeHtml(t(lang, 'imp_note_coverage'))}</p>`
          : ''

        return `<div class="dg-panel-inner">
            <h3 class="dg-panel-title">${escapeHtml(t(lang, 'tab_impacto'))}</h3>
            <p class="dg-muted dg-subtitle">${escapeHtml(periodText)}</p>
            ${tilesHtml ? `<div class="dg-imp-tiles">${tilesHtml}</div>` : ''}
            ${groupsHtml}
            ${note}
          </div>`
      })()
    : ''
```

5. Insertar la pestaña en el array `tabs`, justo después de la de `general`:

```ts
    ...(showImpacto ? [{ id: 'impacto', html: impactoPanel }] : []),
```

6. Agregar el CSS junto al resto de las reglas `dg-`:

```css
.dg-imp-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin: 14px 0 4px; }
.dg-imp-tile { border: 1px solid rgba(255,255,255,0.08); background: #14171B; border-radius: 14px; padding: 12px; }
.dg-imp-value { display: block; font-size: 22px; font-weight: 700; color: #F5F7FA; }
.dg-imp-art { margin: 6px 0 2px; }
.dg-imp-sub { display: block; font-size: 11px; color: #8A9099; }
.dg-imp-list { margin: 6px 0 0; padding-left: 18px; }
.dg-imp-list li { font-size: 13px; color: #F5F7FA; margin-bottom: 5px; }
@media (max-width: 640px) { .dg-imp-value { font-size: 19px; } .dg-imp-list li { font-size: 12px; } }
```

- [ ] **Step 5: Correr los tests del export**

Run: `npx vitest run src/features/informes/exportInformeHTML.test.ts`
Expected: PASS — incluidos los cuatro nuevos.

- [ ] **Step 6: Pasar los insights desde el preview**

En `src/features/informes/components/Step4Preview.tsx`, en las dos llamadas (líneas ~812 y ~829), agregar el argumento:

```tsx
      const insightsArg = insightsResult && insightsConfig.enabled
        ? { result: insightsResult, config: insightsConfig }
        : undefined
```

y sumar `insights: insightsArg` a los objetos que se pasan a `exportInformeHTML({ ... })` y a `buildInformeHtml({ ... })`.

- [ ] **Step 7: Verificar la suite completa y el build**

Run: `npx vitest run`
Expected: PASS, toda la suite.

Run: `npm run build`
Expected: build sin errores de TypeScript.

- [ ] **Step 8: Probar el export a mano**

Run: `npm run dev`

Exportar el informe de prueba a HTML, abrir el archivo descargado y confirmar: la pestaña Impacto aparece, el donut se ve, los bullets son los elegidos, y todo funciona sin conexión (el archivo no pide red).

Exportar también a PDF y confirmar que el panel entra en el documento.

- [ ] **Step 9: Commit**

```bash
git add src/features/informes/chartSvg.ts src/features/informes/exportInformeHTML.ts src/features/informes/exportInformeHTML.test.ts src/features/informes/components/Step4Preview.tsx
git commit -m "feat(informes): export HTML de la pestana Impacto con donut y dots"
```

---

## Verificación final

- [ ] `npx vitest run` — suite completa en verde.
- [ ] `npm run build` — sin errores.
- [ ] Informe de Luca Orellano (Monterrey, temporada): 15 partidos, 1.136 minutos, 3 goles, 4 asistencias, 2º del plantel en asistencias (4 de 20), 2º en pases clave (25 de 218), 3º en Score GG promedio (6,69), 28% de participación en los goles del equipo.
- [ ] Informe sin jugador linkeado: el paso 3 muestra el aviso y el paso 4 no tiene pestaña Impacto.
- [ ] Cambiar el idioma del informe a inglés y confirmar que las frases de Impacto se traducen.
- [ ] Guardar el informe, volver a "Mis informes", reabrirlo y confirmar que el período, los bloques, el umbral, las frases ocultas y los textos editados siguen ahí.
