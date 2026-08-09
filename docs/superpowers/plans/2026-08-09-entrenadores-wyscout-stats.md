# Entrenadores — Estadísticas de temporada vía Excel de Wyscout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cargar el Excel "Team Stats" de Wyscout después de cada partido, verificar automáticamente contra la API qué partidos dirigió el entrenador, guardar posesión/xG por partido en Supabase, y mostrar en Resumen un card de estadísticas de temporada (PJ/PG/PE/PP, puntos, GF/GC, posesión y xG promedio) más un aviso cuando falte cargar un partido nuevo.

**Architecture:** Parser + matcher en `src/features/coaches/wyscoutTeamStats/` (lógica pura, sin UI). Persistencia en una tabla nueva de Supabase (`coach_match_team_stats`) vía funciones nuevas en `coachService.ts`, mismo patrón que `coach_match_notes`. Dos componentes nuevos en `src/features/coaches/components/` (panel de carga+revisión, card de estadísticas) embebidos en `CoachSummaryTab.tsx`. Reusa `GpsDropzone` (genérico, sin lógica de GPS) para la UI de arrastrar-y-soltar, y `fetchFixtureLineups`/`matchOutcome`/`normalizeForSearch` ya existentes.

**Tech Stack:** React 18 + TypeScript, `xlsx` (ya en el proyecto), Supabase, Vitest (`environment: 'node'`, solo `.test.ts` de lógica pura).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-09-entrenadores-wyscout-stats-design.md`.
- El layout de columnas del Excel de Wyscout es fijo — se mapea por índice, no con un parser genérico de headers.
- Goles **no** se guardan en la tabla nueva — la fuente canónica sigue siendo el fixture de API-Football, ya mostrado en el resto de la sección.
- Sin tolerancia de fecha en el matcheo automático de fixture — si no matchea exacto, el usuario lo resuelve a mano en la revisión.
- Tests son solo de lógica pura (`.test.ts`). Funciones que solo envuelven una llamada a la API o a Supabase (sin lógica propia) no se testean — mismo criterio que ya se usó para `fetchFixtureLineups`/`fetchFixtureEvents` en el sub-proyecto anterior.
- Seguir el estilo visual y las clases Tailwind ya usadas en `CoachSummaryTab.tsx`/`CoachMatchDetailPage.tsx` — no introducir un sistema de diseño nuevo.

---

## Task 1: Migración de Supabase — `coach_match_team_stats`

**Files:**
- Create: `supabase/migrations/20260809_coach_match_team_stats.sql`

**Interfaces:**
- Produces: tabla `coach_match_team_stats(id, coach_key, fixture_id, possession_pct, xg_for, xg_against, raw_metrics, source_file, created_at, updated_at)`, único por `(coach_key, fixture_id)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Estadisticas de equipo por partido (posesion, xG) cargadas a mano desde el
-- Excel "Team Stats" de Wyscout, porque la API no las tiene para esta liga.
CREATE TABLE IF NOT EXISTS public.coach_match_team_stats (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key       TEXT NOT NULL,
  fixture_id      BIGINT NOT NULL,
  possession_pct  NUMERIC,
  xg_for          NUMERIC,
  xg_against      NUMERIC,
  raw_metrics     JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_match_team_stats ON public.coach_match_team_stats(coach_key, fixture_id);

ALTER TABLE public.coach_match_team_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "read_coach_match_team_stats" ON public.coach_match_team_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "write_coach_match_team_stats" ON public.coach_match_team_stats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Verificar que el archivo quedó bien formado**

Run: `cat supabase/migrations/20260809_coach_match_team_stats.sql`
Expected: el contenido exacto de arriba, sin errores de sintaxis SQL visibles a simple vista (paréntesis balanceados, `;` al final de cada statement).

No se corre en una base de datos real desde acá — el usuario la corre a mano en Supabase (mismo flujo que la migración de `coach_tables` del sub-proyecto anterior). No requiere Docker/Supabase local para este paso.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260809_coach_match_team_stats.sql
git commit -m "feat(entrenadores): migracion de coach_match_team_stats para estadisticas de Wyscout"
```

---

## Task 2: Parser del Excel de Wyscout

**Files:**
- Create: `src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.ts`
- Create: `src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.test.ts`

**Interfaces:**
- Consumes: `normalizeForSearch` de `@/lib/search.ts` (ya existe).
- Produces: `interface WyscoutMatch { fecha: string; partido: string; competencia: string; equipoPropio: string; equipoRival: string; xgFor: number | null; xgAgainst: number | null; possessionPct: number | null; rawMetrics: Record<string, number | string | null> }`, `parseWyscoutTeamStatsXlsx(data: ArrayBuffer, ownTeamName: string): Promise<WyscoutMatch[]>`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.test.ts
import { describe, it, expect } from 'vitest'
import { buildWyscoutMatches, type WyscoutRawRow } from './parseWyscoutTeamStats'

// Simula el resultado de leer 2 filas de un partido (fila propia + fila rival)
// ya con headers de grupo forward-filled, como las devolvería el paso de
// lectura del xlsx (fecha, partido, competencia, equipo, goles, xg, posesion,
// + 2 columnas extra de ejemplo para raw_metrics).
function mkRawRow(over: Partial<WyscoutRawRow> = {}): WyscoutRawRow {
  return {
    fecha: '2026-08-02',
    partido: 'Temperley - Gimnasia y Tiro 1:2',
    competencia: 'Argentina. Primera Nacional',
    equipo: 'Temperley',
    goles: 1,
    xg: 1.15,
    posesion: 64.09,
    extra: { tiros: 16, pases: 601 },
    ...over,
  }
}

describe('buildWyscoutMatches', () => {
  it('empareja la fila propia con la del rival y arma un WyscoutMatch', () => {
    const propia = mkRawRow({ equipo: 'Temperley', goles: 1, xg: 1.15, posesion: 64.09 })
    const rival = mkRawRow({ equipo: 'Gimnasia y Tiro', goles: 2, xg: 1.18, posesion: 35.91 })
    const matches = buildWyscoutMatches([propia, rival], 'Temperley')
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      fecha: '2026-08-02',
      equipoPropio: 'Temperley',
      equipoRival: 'Gimnasia y Tiro',
      xgFor: 1.15,
      xgAgainst: 1.18,
      possessionPct: 64.09,
    })
  })

  it('matchea el nombre propio sin importar tildes/mayusculas', () => {
    const propia = mkRawRow({ equipo: 'TEMPERLEY' })
    const rival = mkRawRow({ equipo: 'Gimnasia y Tiro' })
    const matches = buildWyscoutMatches([propia, rival], 'témperley')
    expect(matches).toHaveLength(1)
    expect(matches[0].equipoPropio).toBe('TEMPERLEY')
  })

  it('descarta un par de filas donde ninguna es el equipo propio', () => {
    const a = mkRawRow({ equipo: 'Equipo A', partido: 'Equipo A - Equipo B 0:0' })
    const b = mkRawRow({ equipo: 'Equipo B', partido: 'Equipo A - Equipo B 0:0' })
    const matches = buildWyscoutMatches([a, b], 'Temperley')
    expect(matches).toHaveLength(0)
  })

  it('procesa varios partidos (varios pares) en un solo llamado', () => {
    const rows: WyscoutRawRow[] = [
      mkRawRow({ fecha: '2026-08-02', partido: 'P1', equipo: 'Temperley' }),
      mkRawRow({ fecha: '2026-08-02', partido: 'P1', equipo: 'Rival 1' }),
      mkRawRow({ fecha: '2026-07-26', partido: 'P2', equipo: 'Rival 2' }),
      mkRawRow({ fecha: '2026-07-26', partido: 'P2', equipo: 'Temperley' }),
    ]
    const matches = buildWyscoutMatches(rows, 'Temperley')
    expect(matches).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `parseWyscoutTeamStats.ts`**

El archivo tiene dos capas: `buildWyscoutMatches` (pura, testeada arriba, agrupa filas ya extraídas en pares partido) y `parseWyscoutTeamStatsXlsx` (I/O — lee el archivo con `xlsx` y arma las `WyscoutRawRow` por índice de columna fijo antes de llamar a `buildWyscoutMatches`). Los índices de columna vienen del archivo de ejemplo de Wyscout ya inspeccionado (columna 0=Fecha, 1=Partido, 2=Competición, 4=Equipo, 6=Goles, 7=xG, 14=Posesión%; todo lo demás va a `rawMetrics` con el header de esa columna, o el de la columna agrupadora más cercana a la izquierda si esta columna vino con header vacío, normalizado a snake_case y desambiguado con sufijo numérico si se repite):

```ts
// src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.ts
import { normalizeForSearch } from '@/lib/search'

export interface WyscoutRawRow {
  fecha: string
  partido: string
  competencia: string
  equipo: string
  goles: number | null
  xg: number | null
  posesion: number | null
  extra: Record<string, number | string | null>
}

export interface WyscoutMatch {
  fecha: string
  partido: string
  competencia: string
  equipoPropio: string
  equipoRival: string
  xgFor: number | null
  xgAgainst: number | null
  possessionPct: number | null
  rawMetrics: Record<string, number | string | null>
}

// Columna 0=Fecha, 1=Partido, 2=Competicion, 4=Equipo, 6=Goles, 7=xG, 14=Posesion%.
// Layout fijo del export "Team Stats" de Wyscout (verificado contra un archivo real).
const COL_FECHA = 0
const COL_PARTIDO = 1
const COL_COMPETENCIA = 2
const COL_EQUIPO = 4
const COL_GOLES = 6
const COL_XG = 7
const COL_POSESION = 14

function toNumberOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function slugify(label: string): string {
  return normalizeForSearch(label).replace(/\s+/g, '_')
}

/** Fila 0 del sheet: forward-fill de headers agrupados (Wyscout deja vacia la celda de las columnas siguientes a la primera de cada grupo). */
function forwardFillHeaders(headerRow: unknown[]): string[] {
  const filled: string[] = []
  let last = ''
  const seen = new Map<string, number>()
  for (const cell of headerRow) {
    const raw = String(cell ?? '').trim()
    if (raw) last = raw
    const base = slugify(last || 'col')
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    filled.push(count > 1 ? `${base}_${count}` : base)
  }
  return filled
}

function rowToRaw(headers: string[], row: unknown[]): WyscoutRawRow {
  const extra: Record<string, number | string | null> = {}
  for (let i = 0; i < headers.length; i++) {
    if ([COL_FECHA, COL_PARTIDO, COL_COMPETENCIA, COL_EQUIPO, COL_GOLES, COL_XG, COL_POSESION].includes(i)) continue
    const v = row[i]
    extra[headers[i]] = v === '' || v === undefined ? null : (typeof v === 'number' ? v : String(v))
  }
  return {
    fecha: String(row[COL_FECHA] ?? ''),
    partido: String(row[COL_PARTIDO] ?? ''),
    competencia: String(row[COL_COMPETENCIA] ?? ''),
    equipo: String(row[COL_EQUIPO] ?? ''),
    goles: toNumberOrNull(row[COL_GOLES]),
    xg: toNumberOrNull(row[COL_XG]),
    posesion: toNumberOrNull(row[COL_POSESION]),
    extra,
  }
}

/** Agrupa filas (ya extraidas, una por equipo por partido) en pares y arma un WyscoutMatch por cada par que incluya al equipo propio. */
export function buildWyscoutMatches(rows: WyscoutRawRow[], ownTeamName: string): WyscoutMatch[] {
  const ownNormalized = normalizeForSearch(ownTeamName)
  const byKey = new Map<string, WyscoutRawRow[]>()
  for (const row of rows) {
    const key = `${row.fecha}__${row.partido}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(row)
  }

  const matches: WyscoutMatch[] = []
  for (const pair of byKey.values()) {
    const own = pair.find(r => normalizeForSearch(r.equipo) === ownNormalized)
    const rival = pair.find(r => normalizeForSearch(r.equipo) !== ownNormalized)
    if (!own || !rival) continue
    matches.push({
      fecha: own.fecha,
      partido: own.partido,
      competencia: own.competencia,
      equipoPropio: own.equipo,
      equipoRival: rival.equipo,
      xgFor: own.xg,
      xgAgainst: rival.xg,
      possessionPct: own.posesion,
      rawMetrics: own.extra,
    })
  }
  return matches
}

export async function parseWyscoutTeamStatsXlsx(data: ArrayBuffer, ownTeamName: string): Promise<WyscoutMatch[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  if (grid.length < 2) return []

  const headers = forwardFillHeaders(grid[0])
  const rows = grid.slice(1).filter(r => r[COL_FECHA]).map(r => rowToRaw(headers, r))
  return buildWyscoutMatches(rows, ownTeamName)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.ts src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.test.ts
git commit -m "feat(entrenadores): parser del Excel Team Stats de Wyscout"
```

---

## Task 3: Matchear filas contra fixtures + verificar el DT

**Files:**
- Create: `src/features/coaches/wyscoutTeamStats/matchFixtures.ts`
- Create: `src/features/coaches/wyscoutTeamStats/matchFixtures.test.ts`

**Interfaces:**
- Consumes: `WyscoutMatch` (Task 2), `AgencyFixture` (`@/types/footballApi`, ya existe), `normalizeForSearch` (`@/lib/search`), `toArDateKey` (`@/services/footballApiService`, ya existe y ya exportado), `fetchFixtureLineups` (`@/services/footballApiService`, ya existe, sub-proyecto anterior).
- Produces: `matchFixtureForRow(row: WyscoutMatch, fixtures: AgencyFixture[]): AgencyFixture | null`, `verifyCoachForFixture(fixtureId: number, ownTeamId: number, coachFullName: string): Promise<{ verified: boolean; coachName: string | null }>`.

- [ ] **Step 1: Escribir el test que falla (solo para la función pura `matchFixtureForRow`)**

```ts
// src/features/coaches/wyscoutTeamStats/matchFixtures.test.ts
import { describe, it, expect } from 'vitest'
import { matchFixtureForRow } from './matchFixtures'
import type { WyscoutMatch } from './parseWyscoutTeamStats'
import type { AgencyFixture } from '@/types/footballApi'

function mkWyscoutMatch(over: Partial<WyscoutMatch> = {}): WyscoutMatch {
  return {
    fecha: '2026-08-02', partido: 'Temperley - Gimnasia y Tiro 1:2', competencia: 'Primera Nacional',
    equipoPropio: 'Temperley', equipoRival: 'Gimnasia y Tiro',
    xgFor: 1.15, xgAgainst: 1.18, possessionPct: 64.09, rawMetrics: {},
    ...over,
  }
}

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-02T18:00:00+00:00', timestamp: 0,
    venue: 'Estadio', city: 'Temperley', status: 'Match Finished', statusShort: 'FT', elapsed: null,
    leagueName: 'Primera Nacional', leagueLogo: '', leagueCountry: 'Argentina', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1928, name: 'Gimnasia Y Tiro', logo: '' },
    goalsHome: 1, goalsAway: 2, isHome: true, players: [], ...over,
  }
}

describe('matchFixtureForRow', () => {
  it('matchea por fecha exacta y nombre de rival normalizado', () => {
    const row = mkWyscoutMatch()
    const fixture = mkFixture()
    const result = matchFixtureForRow(row, [fixture])
    expect(result?.fixtureId).toBe(1)
  })

  it('no matchea si la fecha no coincide', () => {
    const row = mkWyscoutMatch({ fecha: '2026-08-03' })
    const fixture = mkFixture()
    expect(matchFixtureForRow(row, [fixture])).toBeNull()
  })

  it('no matchea si el rival no coincide aunque la fecha si', () => {
    const row = mkWyscoutMatch({ equipoRival: 'Otro Equipo' })
    const fixture = mkFixture()
    expect(matchFixtureForRow(row, [fixture])).toBeNull()
  })

  it('devuelve null si no hay ningun fixture', () => {
    expect(matchFixtureForRow(mkWyscoutMatch(), [])).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/wyscoutTeamStats/matchFixtures.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `matchFixtures.ts`**

```ts
// src/features/coaches/wyscoutTeamStats/matchFixtures.ts
import { normalizeForSearch } from '@/lib/search'
import { toArDateKey, fetchFixtureLineups } from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'
import type { WyscoutMatch } from './parseWyscoutTeamStats'

export function matchFixtureForRow(row: WyscoutMatch, fixtures: AgencyFixture[]): AgencyFixture | null {
  const rivalNormalized = normalizeForSearch(row.equipoRival)
  return (
    fixtures.find(f => {
      if (toArDateKey(f.date) !== row.fecha) return false
      const opponent = f.isHome ? f.awayTeam.name : f.homeTeam.name
      return normalizeForSearch(opponent) === rivalNormalized
    }) ?? null
  )
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
  return { verified: normalizeForSearch(coachName) === normalizeForSearch(coachFullName), coachName }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/wyscoutTeamStats/matchFixtures.test.ts`
Expected: PASS (4 tests)

`verifyCoachForFixture` no tiene test propio — es un envoltorio fino sobre `fetchFixtureLineups` (I/O), mismo criterio ya usado para no testear las funciones de fetch del sub-proyecto anterior.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/wyscoutTeamStats/matchFixtures.ts src/features/coaches/wyscoutTeamStats/matchFixtures.test.ts
git commit -m "feat(entrenadores): matchea filas de Wyscout contra fixtures y verifica el DT"
```

---

## Task 4: Funciones de Supabase en `coachService.ts`

**Files:**
- Modify: `src/services/coachService.ts`

**Interfaces:**
- Produces: `interface CoachMatchTeamStats { id: number; coach_key: string; fixture_id: number; possession_pct: number | null; xg_for: number | null; xg_against: number | null; raw_metrics: Record<string, unknown>; source_file: string | null; created_at: string; updated_at: string }`, `listCoachMatchTeamStats(coachKey: string): Promise<CoachMatchTeamStats[]>`, `upsertCoachMatchTeamStats(coachKey: string, fixtureId: number, stats: { possessionPct: number | null; xgFor: number | null; xgAgainst: number | null; rawMetrics: Record<string, unknown>; sourceFile: string | null }): Promise<{ success: boolean; error?: string }>`.

- [ ] **Step 1: Agregar el tipo y las dos funciones**

Agregar a `src/services/coachService.ts`, junto a las interfaces/funciones de `coach_match_notes` (mismo estilo, mismo archivo):

```ts
export interface CoachMatchTeamStats {
  id: number
  coach_key: string
  fixture_id: number
  possession_pct: number | null
  xg_for: number | null
  xg_against: number | null
  raw_metrics: Record<string, unknown>
  source_file: string | null
  created_at: string
  updated_at: string
}

export async function listCoachMatchTeamStats(coachKey: string): Promise<CoachMatchTeamStats[]> {
  const { data, error } = await supabase
    .from('coach_match_team_stats')
    .select('*')
    .eq('coach_key', coachKey)

  if (error || !data) {
    console.error('Error listando estadisticas de partido:', error)
    return []
  }
  return data
}

export async function upsertCoachMatchTeamStats(
  coachKey: string,
  fixtureId: number,
  stats: {
    possessionPct: number | null
    xgFor: number | null
    xgAgainst: number | null
    rawMetrics: Record<string, unknown>
    sourceFile: string | null
  },
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_match_team_stats').upsert({
    coach_key: coachKey,
    fixture_id: fixtureId,
    possession_pct: stats.possessionPct,
    xg_for: stats.xgFor,
    xg_against: stats.xgAgainst,
    raw_metrics: stats.rawMetrics,
    source_file: stats.sourceFile,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'coach_key,fixture_id',
  })

  if (error) {
    console.error('Error guardando estadisticas de partido:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/services/coachService.ts
git commit -m "feat(entrenadores): listCoachMatchTeamStats y upsertCoachMatchTeamStats"
```

---

## Task 5: Cálculo de estadísticas de temporada

**Files:**
- Create: `src/features/coaches/seasonStats.ts`
- Create: `src/features/coaches/seasonStats.test.ts`

**Interfaces:**
- Consumes: `AgencyFixture` (`@/types/footballApi`), `CoachMatchTeamStats` (Task 4), `matchOutcome` (`./matchResult`, ya existe del sub-proyecto anterior).
- Produces: `interface SeasonStats { played: number; won: number; drawn: number; lost: number; points: number; possiblePoints: number; goalsFor: number; goalsAgainst: number; avgPossession: number | null; avgXgFor: number | null; avgXgAgainst: number | null }`, `computeSeasonStats(fixtures: AgencyFixture[], statsRows: CoachMatchTeamStats[]): SeasonStats`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/seasonStats.test.ts
import { describe, it, expect } from 'vitest'
import { computeSeasonStats } from './seasonStats'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachMatchTeamStats } from '@/services/coachService'

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-02T18:00:00+00:00', timestamp: 0,
    venue: '', city: '', status: 'Match Finished', statusShort: 'FT', elapsed: null,
    leagueName: '', leagueLogo: '', leagueCountry: '', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1, name: 'Rival', logo: '' },
    goalsHome: null, goalsAway: null, isHome: true, players: [], ...over,
  }
}

function mkStats(over: Partial<CoachMatchTeamStats> = {}): CoachMatchTeamStats {
  return {
    id: 1, coach_key: 'domingo', fixture_id: 1,
    possession_pct: 60, xg_for: 1.5, xg_against: 1.0,
    raw_metrics: {}, source_file: null, created_at: '', updated_at: '',
    ...over,
  }
}

describe('computeSeasonStats', () => {
  it('solo cuenta fixtures que tienen fila de stats (partidos confirmados)', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 2, goalsAway: 1 }),
      mkFixture({ fixtureId: 2, isHome: true, goalsHome: 0, goalsAway: 0 }), // sin stats, no cuenta
    ]
    const stats = [mkStats({ fixture_id: 1 })]
    const result = computeSeasonStats(fixtures, stats)
    expect(result.played).toBe(1)
  })

  it('calcula PG/PE/PP y puntos sobre posibles', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 2, goalsAway: 1 }),  // gana
      mkFixture({ fixtureId: 2, isHome: false, goalsHome: 1, goalsAway: 1 }), // empata
      mkFixture({ fixtureId: 3, isHome: true, goalsHome: 0, goalsAway: 2 }),  // pierde
    ]
    const stats = [mkStats({ fixture_id: 1 }), mkStats({ fixture_id: 2 }), mkStats({ fixture_id: 3 })]
    const result = computeSeasonStats(fixtures, stats)
    expect(result).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, points: 4, possiblePoints: 9 })
  })

  it('suma goles a favor y en contra', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 2, goalsAway: 1 }),
      mkFixture({ fixtureId: 2, isHome: false, goalsHome: 3, goalsAway: 0 }),
    ]
    const stats = [mkStats({ fixture_id: 1 }), mkStats({ fixture_id: 2 })]
    const result = computeSeasonStats(fixtures, stats)
    expect(result.goalsFor).toBe(2) // 2 (local) + 0 (visitante, le hicieron 3)
    expect(result.goalsAgainst).toBe(4) // 1 (local) + 3 (visitante)
  })

  it('promedia posesion y xG solo de los partidos con ese dato cargado', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, isHome: true, goalsHome: 1, goalsAway: 0 }),
      mkFixture({ fixtureId: 2, isHome: true, goalsHome: 1, goalsAway: 0 }),
    ]
    const stats = [
      mkStats({ fixture_id: 1, possession_pct: 60, xg_for: 2, xg_against: 1 }),
      mkStats({ fixture_id: 2, possession_pct: 40, xg_for: 1, xg_against: 0.5 }),
    ]
    const result = computeSeasonStats(fixtures, stats)
    expect(result.avgPossession).toBe(50)
    expect(result.avgXgFor).toBe(1.5)
    expect(result.avgXgAgainst).toBe(0.75)
  })

  it('sin partidos con stats, devuelve todo en cero y promedios null', () => {
    const result = computeSeasonStats([], [])
    expect(result).toMatchObject({ played: 0, won: 0, drawn: 0, lost: 0, points: 0, possiblePoints: 0, goalsFor: 0, goalsAgainst: 0 })
    expect(result.avgPossession).toBeNull()
    expect(result.avgXgFor).toBeNull()
    expect(result.avgXgAgainst).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/seasonStats.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `seasonStats.ts`**

```ts
// src/features/coaches/seasonStats.ts
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachMatchTeamStats } from '@/services/coachService'
import { matchOutcome } from './matchResult'

export interface SeasonStats {
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  possiblePoints: number
  goalsFor: number
  goalsAgainst: number
  avgPossession: number | null
  avgXgFor: number | null
  avgXgAgainst: number | null
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function computeSeasonStats(fixtures: AgencyFixture[], statsRows: CoachMatchTeamStats[]): SeasonStats {
  const statsByFixture = new Map(statsRows.map(s => [s.fixture_id, s]))
  const confirmed = fixtures.filter(f => statsByFixture.has(f.fixtureId))

  let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0
  const possessionValues: number[] = []
  const xgForValues: number[] = []
  const xgAgainstValues: number[] = []

  for (const fixture of confirmed) {
    const { result } = matchOutcome(fixture)
    if (result === 'G') won++
    else if (result === 'E') drawn++
    else if (result === 'P') lost++

    const teamGoals = fixture.isHome ? fixture.goalsHome : fixture.goalsAway
    const oppGoals = fixture.isHome ? fixture.goalsAway : fixture.goalsHome
    goalsFor += teamGoals ?? 0
    goalsAgainst += oppGoals ?? 0

    const stats = statsByFixture.get(fixture.fixtureId)!
    if (stats.possession_pct !== null) possessionValues.push(stats.possession_pct)
    if (stats.xg_for !== null) xgForValues.push(stats.xg_for)
    if (stats.xg_against !== null) xgAgainstValues.push(stats.xg_against)
  }

  const played = confirmed.length
  return {
    played, won, drawn, lost,
    points: won * 3 + drawn,
    possiblePoints: played * 3,
    goalsFor, goalsAgainst,
    avgPossession: average(possessionValues),
    avgXgFor: average(xgForValues),
    avgXgAgainst: average(xgAgainstValues),
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/seasonStats.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/seasonStats.ts src/features/coaches/seasonStats.test.ts
git commit -m "feat(entrenadores): calculo de estadisticas de temporada (PJ/PG/PE/PP, xG, posesion)"
```

---

## Task 6: Panel de carga y revisión del Excel

**Files:**
- Create: `src/features/coaches/components/CoachWyscoutUploadPanel.tsx`

**Interfaces:**
- Consumes: `parseWyscoutTeamStatsXlsx` (Task 2), `matchFixtureForRow`/`verifyCoachForFixture` (Task 3), `upsertCoachMatchTeamStats` (Task 4), `GpsDropzone` (`@/features/gps/components/GpsDropzone`, genérico y ya existente — prop `{ onFile: (file: File) => void; accept?: string; label?: string; hint?: string }`), `fetchTeamFixtures` (`@/services/footballApiService`, ya existe).
- Produces: `CoachWyscoutUploadPanel({ coach, fixtures, onSaved }: { coach: AgencyCoach; fixtures: AgencyFixture[]; onSaved: () => void })` — default export.

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/CoachWyscoutUploadPanel.tsx
import { useState } from 'react'
import GpsDropzone from '@/features/gps/components/GpsDropzone'
import { parseWyscoutTeamStatsXlsx, type WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import { matchFixtureForRow, verifyCoachForFixture } from '@/features/coaches/wyscoutTeamStats/matchFixtures'
import { upsertCoachMatchTeamStats } from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import type { AgencyFixture } from '@/types/footballApi'

interface ReviewRow {
  wyscout: WyscoutMatch
  fixture: AgencyFixture | null
  coachVerified: boolean | null
  coachNameFromApi: string | null
  included: boolean
}

export default function CoachWyscoutUploadPanel({
  coach,
  fixtures,
  onSaved,
}: {
  coach: AgencyCoach
  fixtures: AgencyFixture[]
  onSaved: () => void
}) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleFile = async (file: File) => {
    if (!coach.club || !coach.apiTeamId) return
    setParsing(true)
    setFileName(file.name)
    try {
      const data = await file.arrayBuffer()
      const matches = await parseWyscoutTeamStatsXlsx(data, coach.club)
      const withFixtures = await Promise.all(
        matches.map(async wyscout => {
          const fixture = matchFixtureForRow(wyscout, fixtures)
          if (!fixture || !coach.apiTeamId) {
            return { wyscout, fixture, coachVerified: null, coachNameFromApi: null, included: !!fixture }
          }
          const { verified, coachName } = await verifyCoachForFixture(fixture.fixtureId, coach.apiTeamId, coach.fullName)
          return { wyscout, fixture, coachVerified: verified, coachNameFromApi: coachName, included: verified }
        }),
      )
      setRows(withFixtures)
    } finally {
      setParsing(false)
    }
  }

  const toggleIncluded = (index: number) => {
    setRows(prev => prev?.map((r, i) => (i === index ? { ...r, included: !r.included } : r)) ?? null)
  }

  const handleSave = async () => {
    if (!rows) return
    setSaving(true)
    try {
      const toSave = rows.filter(r => r.included && r.fixture)
      for (const row of toSave) {
        await upsertCoachMatchTeamStats(coach.key, row.fixture!.fixtureId, {
          possessionPct: row.wyscout.possessionPct,
          xgFor: row.wyscout.xgFor,
          xgAgainst: row.wyscout.xgAgainst,
          rawMetrics: row.wyscout.rawMetrics,
          sourceFile: fileName,
        })
      }
      setRows(null)
      setFileName(null)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (!rows) {
    return (
      <GpsDropzone
        onFile={file => void handleFile(file)}
        disabled={parsing}
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        label={parsing ? 'Leyendo el Excel…' : 'Arrastrá el Excel de Wyscout o tocá para elegirlo'}
        hint="Export 'Team Stats' de Wyscout. Se revisa antes de guardar."
      />
    )
  }

  const includedCount = rows.filter(r => r.included && r.fixture).length

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-3 sm:px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate">
                vs {row.wyscout.equipoRival} · {row.wyscout.fecha}
              </p>
              {!row.fixture && <p className="text-2xs text-brand-red">No se encontró el partido en la agenda</p>}
              {row.fixture && row.coachVerified === true && (
                <p className="text-2xs text-brand-green">DT confirmado por la API: {row.coachNameFromApi}</p>
              )}
              {row.fixture && row.coachVerified === false && (
                <p className="text-2xs text-amber-500">
                  {row.coachNameFromApi
                    ? `La API dice que dirigió ${row.coachNameFromApi}, no ${coach.fullName}`
                    : 'No se pudo verificar quién dirigió este partido'}
                </p>
              )}
            </div>
            {row.fixture && (
              <label className="flex items-center gap-1.5 text-2xs text-apple-gray-500 flex-shrink-0">
                <input type="checkbox" checked={row.included} onChange={() => toggleIncluded(i)} />
                Incluir
              </label>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || includedCount === 0}
          className="min-h-[40px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Guardando…' : `Guardar ${includedCount} ${includedCount === 1 ? 'partido' : 'partidos'}`}
        </button>
        <button
          type="button"
          onClick={() => { setRows(null); setFileName(null) }}
          className="text-sm text-apple-gray-500 hover:text-apple-gray-700 dark:hover:text-apple-gray-300"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/CoachWyscoutUploadPanel.tsx
git commit -m "feat(entrenadores): panel de carga y revision del Excel de Wyscout"
```

---

## Task 7: Card de estadísticas de temporada + aviso de partidos faltantes

**Files:**
- Create: `src/features/coaches/components/CoachSeasonStatsCard.tsx`

**Interfaces:**
- Consumes: `computeSeasonStats` (Task 5), `listCoachMatchTeamStats` (Task 4), `isMatchFinished` (`@/utils/coachCalendar`, ya existe), `CoachWyscoutUploadPanel` (Task 6).
- Produces: `CoachSeasonStatsCard({ coach, fixtures }: { coach: AgencyCoach; fixtures: AgencyFixture[] })` — default export. Maneja su propio fetch de `listCoachMatchTeamStats` y su propio estado de "mostrar panel de carga".

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/CoachSeasonStatsCard.tsx
import { useEffect, useState } from 'react'
import { listCoachMatchTeamStats, type CoachMatchTeamStats } from '@/services/coachService'
import { computeSeasonStats } from '@/features/coaches/seasonStats'
import { isMatchFinished } from '@/utils/coachCalendar'
import CoachWyscoutUploadPanel from './CoachWyscoutUploadPanel'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import type { AgencyFixture } from '@/types/footballApi'

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg px-3 py-3 text-center">
      <p className="text-lg sm:text-xl font-bold text-apple-gray-800 dark:text-white">{value}</p>
      <p className="text-[10px] font-semibold text-apple-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  )
}

function fmtPct(v: number | null): string {
  return v === null ? '–' : `${v.toFixed(0)}%`
}

function fmtDecimal(v: number | null): string {
  return v === null ? '–' : v.toFixed(2)
}

export default function CoachSeasonStatsCard({ coach, fixtures }: { coach: AgencyCoach; fixtures: AgencyFixture[] }) {
  const [statsRows, setStatsRows] = useState<CoachMatchTeamStats[] | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const reload = () => {
    listCoachMatchTeamStats(coach.key).then(setStatsRows)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.key])

  if (statsRows === null) return null

  const stats = computeSeasonStats(fixtures, statsRows)
  const finishedFixtureIds = new Set(fixtures.filter(f => isMatchFinished(f.statusShort)).map(f => f.fixtureId))
  const loadedFixtureIds = new Set(statsRows.map(s => s.fixture_id))
  const missingCount = [...finishedFixtureIds].filter(id => !loadedFixtureIds.has(id)).length

  return (
    <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 shadow-apple dark:shadow-apple-dark p-5 sm:p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide">
          Temporada con {coach.fullName.split(' ')[0]}
        </p>
        <button
          type="button"
          onClick={() => setShowUpload(v => !v)}
          className="text-2xs font-semibold text-brand-green hover:underline"
        >
          {showUpload ? 'Cerrar' : 'Cargar Excel de Wyscout'}
        </button>
      </div>

      {missingCount > 0 && (
        <div className="flex items-center gap-2 bg-brand-red/10 text-brand-red rounded-apple-lg px-3 py-2 mb-4 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-red flex-shrink-0" />
          Faltan cargar {missingCount} {missingCount === 1 ? 'partido' : 'partidos'} — subí el Excel actualizado.
        </div>
      )}

      {showUpload && (
        <div className="mb-4">
          <CoachWyscoutUploadPanel coach={coach} fixtures={fixtures} onSaved={() => { reload(); setShowUpload(false) }} />
        </div>
      )}

      {stats.played === 0 ? (
        <p className="text-sm text-apple-gray-400 text-center py-6">
          Todavía no cargaste ningún partido. Subí el primer Excel de Wyscout para ver las estadísticas acá.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatTile label="PJ" value={String(stats.played)} />
          <StatTile label="PG - PE - PP" value={`${stats.won}-${stats.drawn}-${stats.lost}`} />
          <StatTile label="Puntos" value={`${stats.points}/${stats.possiblePoints}`} />
          <StatTile label="GF - GC" value={`${stats.goalsFor}-${stats.goalsAgainst}`} />
          <StatTile label="Posesión prom." value={fmtPct(stats.avgPossession)} />
          <StatTile label="xG a favor" value={fmtDecimal(stats.avgXgFor)} />
          <StatTile label="xG en contra" value={fmtDecimal(stats.avgXgAgainst)} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/CoachSeasonStatsCard.tsx
git commit -m "feat(entrenadores): card de estadisticas de temporada y aviso de partidos faltantes"
```

---

## Task 8: Embeber el card en `CoachSummaryTab.tsx`

**Files:**
- Modify: `src/features/coaches/components/CoachSummaryTab.tsx`

**Interfaces:**
- Consumes: `CoachSeasonStatsCard` (Task 7).

- [ ] **Step 1: Leer el archivo actual y agregar el card arriba de la card de "Próximo partido"**

Leer el contenido actual de `CoachSummaryTab.tsx` (fue modificado por el sub-proyecto anterior — no asumir el estado original) y agregar, dentro del `return` del componente, `<CoachSeasonStatsCard coach={coach} fixtures={fixtures} />` como primer elemento dentro del `<div className="space-y-6 ...">` raíz, antes del bloque `{next ? (...) : (...)}` de "Próximo partido". `fixtures` ya existe como variable en el componente (viene de `fetchTeamFixtures`, usado más abajo para `sorted`/`lastTen`) — pasar la misma referencia, no volver a pedirla. Agregar el import:

```tsx
import CoachSeasonStatsCard from './CoachSeasonStatsCard'
```

Si `fixtures` en el componente puede ser `null` mientras carga (revisar el estado actual — el archivo ya tenía un `LoadingSpinner` mientras `fixtures === null` antes de llegar al `return` principal), `CoachSeasonStatsCard` solo se renderiza en la rama donde `fixtures` ya está resuelto — no requiere manejo de loading propio para ese prop.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add src/features/coaches/components/CoachSummaryTab.tsx
git commit -m "feat(entrenadores): integra el card de estadisticas de temporada en Resumen"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 13 nuevos de este plan (4 de `parseWyscoutTeamStats.test.ts` + 4 de `matchFixtures.test.ts` + 5 de `seasonStats.test.ts`).

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`, tab Resumen):
  - Se ve el card "Temporada con Nicolás Domingo" arriba de "Próximo partido", con estado vacío si todavía no se cargó nada.
  - Botón "Cargar Excel de Wyscout" abre el dropzone.
  - Arrastrar el archivo de ejemplo del usuario muestra la tabla de revisión con cada partido, el estado de verificación del DT, y permite guardar.
  - Después de guardar, el card muestra PJ/PG/PE/PP/Puntos/GF-GC/Posesión/xG reales.
  - Si hay partidos finalizados sin stats cargadas, aparece el cartel rojo de aviso.
