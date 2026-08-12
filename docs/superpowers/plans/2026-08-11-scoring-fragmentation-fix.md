# Motor de scoring: fragmentación por competencia + posiciones adivinadas en cambios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir dos bugs reales del motor de scoring (Supabase/API-Football) que afectan Scouting Externo, Búsqueda de Talento e Informes: filas de score fragmentadas por competencia dentro de la misma temporada/posición, y posiciones adivinadas a ciegas cuando un jugador entra de cambio sin dato de alineación.

**Architecture:** Dos arreglos independientes en el pipeline de Supabase Edge Functions. (1) Fusión de fragmentos: nueva función pura TypeScript testeable (`mergeSeasonScoreFragments`), invocada desde `recalc-scores/index.ts` antes de rankear y guardar, más una migración que angosta la clave primaria de `player_season_scores`. (2) Corrección de posición: nueva función SQL (`backfill_ungridded_positions`) que sobreescribe `detected_position` solo en partidos sin grilla confirmada, usando la posición mayoritaria del jugador en sus partidos con grilla — invocada al inicio de cada corrida de `recalc-scores`. Cierra con una auditoría manual en el navegador del caso de Informes reportado, sin asumir de antemano cuál es la causa.

**Tech Stack:** Deno (Supabase Edge Functions, TypeScript), PostgreSQL/PL-pgSQL (migraciones), Vitest (los tests de `supabase/functions/**/*.test.ts` corren bajo Vitest vía un shim de `Deno.test` — ver Global Constraints).

## Global Constraints

- **Alcance:** solo el pipeline API-Football/Supabase (`player_match_stats`, `player_season_scores`, Edge Functions `sync-player-stats` y `recalc-scores`). El scoring de Scouting Interno (Google Sheets/CSV, `src/utils/scoring.ts`) es un sistema separado y no se toca.
- **Los tests de `supabase/functions/` se escriben con `Deno.test`/`assertEquals` de `https://deno.land/std@0.208.0/assert/mod.ts`** (mismo patrón que `position-mapper.test.ts`, `scoring.test.ts`) — corren de verdad vía `npx vitest run <archivo>` gracias al shim en `vitest.setup.ts` + el alias en `vitest.config.ts`. Deno NO está instalado en esta máquina — nunca uses `deno test`, siempre `npx vitest run`.
- **`supabase/functions/` NO está cubierto por `npx tsc --noEmit` ni `npm run build`** (el `tsconfig.json` raíz solo incluye `src`) — no correr esos comandos como verificación de las tareas que tocan Edge Functions, no van a detectar nada ahí.
- **No hay Supabase local (Docker no está disponible en esta máquina).** Las migraciones SQL se verifican por lectura cuidadosa (sintaxis, lógica), no ejecutándolas — el usuario las corre a mano en producción como con toda migración anterior de este proyecto.
- Nunca usar emoji crudo como ícono en UI (si la Tarea 5 termina agregando una aclaración visual en Informes).
- Cada commit, mensaje en español, mismo estilo que el resto del repo (`feat(scoring): ...`, `fix(scoring): ...`, `docs(scoring): ...`).

---

### Task 1: `mergeSeasonScoreFragments` — función pura de fusión de fragmentos

**Files:**
- Create: `supabase/functions/_shared/mergeSeasonFragments.ts`
- Test: `supabase/functions/_shared/mergeSeasonFragments.test.ts`

**Interfaces:**
- Produces: `export interface SeasonScoreRow { player_id: number; season: number; position: string; league_id: number; matches_played: number; avg_score: number | null; avg_rating: number | null; total_goals: number; total_assists: number; tackles_p90: number | null; interceptions_p90: number | null; blocks_p90: number | null; duels_won_pct: number | null; passes_accuracy: number | null; passes_key_p90: number | null; passes_total_p90: number | null; dribbles_success_p90: number | null; dribbles_pct: number | null; shots_on_p90: number | null; shots_pct: number | null; goals_p90: number | null; assists_p90: number | null; fouls_drawn_p90: number | null; saves_p90: number | null; goals_conceded_p90: number | null; penalty_saved_avg: number | null; clean_sheet_pct: number | null; updated_at: string }`; `export function mergeSeasonScoreFragments(rows: SeasonScoreRow[]): SeasonScoreRow[]`.

- [ ] **Step 1: Escribir el test que falla primero**

```ts
// supabase/functions/_shared/mergeSeasonFragments.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { mergeSeasonScoreFragments, type SeasonScoreRow } from './mergeSeasonFragments.ts';

function makeRow(overrides: Partial<SeasonScoreRow>): SeasonScoreRow {
  return {
    player_id: 1, season: 2026, position: 'EXT', league_id: 100,
    matches_played: 0, avg_score: null, avg_rating: null,
    total_goals: 0, total_assists: 0,
    tackles_p90: null, interceptions_p90: null, blocks_p90: null,
    duels_won_pct: null, passes_accuracy: null, passes_key_p90: null,
    passes_total_p90: null, dribbles_success_p90: null, dribbles_pct: null,
    shots_on_p90: null, shots_pct: null, goals_p90: null, assists_p90: null,
    fouls_drawn_p90: null, saves_p90: null, goals_conceded_p90: null,
    penalty_saved_avg: null, clean_sheet_pct: null,
    updated_at: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

Deno.test('mergeSeasonScoreFragments: una sola fila por jugador+posicion no cambia', () => {
  const rows = [makeRow({ matches_played: 10, avg_score: 6.5 })];
  const result = mergeSeasonScoreFragments(rows);
  assertEquals(result.length, 1);
  assertEquals(result[0].matches_played, 10);
  assertEquals(result[0].avg_score, 6.5);
});

Deno.test('mergeSeasonScoreFragments: dos fragmentos de la misma posicion se funden en uno', () => {
  const rows = [
    makeRow({ league_id: 100, matches_played: 6, avg_score: 6.1, total_goals: 2, total_assists: 1 }),
    makeRow({ league_id: 200, matches_played: 7, avg_score: 5.4, total_goals: 3, total_assists: 0 }),
  ];
  const result = mergeSeasonScoreFragments(rows);
  assertEquals(result.length, 1);
  assertEquals(result[0].matches_played, 13);
  assertEquals(result[0].total_goals, 5);
  assertEquals(result[0].total_assists, 1);
  // (6*6.1 + 7*5.4) / 13 = (36.6 + 37.8) / 13 = 74.4 / 13 = 5.7230... -> 5.72
  assertEquals(result[0].avg_score, 5.72);
});

Deno.test('mergeSeasonScoreFragments: distintas posiciones del mismo jugador no se mezclan', () => {
  const rows = [
    makeRow({ position: 'EXT', matches_played: 5, avg_score: 7 }),
    makeRow({ position: 'VI', matches_played: 3, avg_score: 6 }),
  ];
  const result = mergeSeasonScoreFragments(rows);
  assertEquals(result.length, 2);
});

Deno.test('mergeSeasonScoreFragments: jugadores distintos no se mezclan', () => {
  const rows = [
    makeRow({ player_id: 1, matches_played: 5, avg_score: 7 }),
    makeRow({ player_id: 2, matches_played: 5, avg_score: 4 }),
  ];
  const result = mergeSeasonScoreFragments(rows);
  assertEquals(result.length, 2);
});

Deno.test('mergeSeasonScoreFragments: campos null en un fragmento no rompen el promedio ponderado', () => {
  const rows = [
    makeRow({ league_id: 100, matches_played: 4, avg_score: 6, passes_accuracy: 80 }),
    makeRow({ league_id: 200, matches_played: 2, avg_score: 5, passes_accuracy: null }),
  ];
  const result = mergeSeasonScoreFragments(rows);
  assertEquals(result.length, 1);
  // passes_accuracy nulo cuenta como 0 en la ponderacion, no se descarta el fragmento:
  // (80*4 + 0*2) / 6 = 320/6 = 53.33...
  assertEquals(result[0].passes_accuracy, 53.33);
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run supabase/functions/_shared/mergeSeasonFragments.test.ts`
Expected: FAIL con "Cannot find module './mergeSeasonFragments.ts'" (o equivalente, el archivo de implementación no existe todavía).

- [ ] **Step 3: Implementar la función**

```ts
// supabase/functions/_shared/mergeSeasonFragments.ts

export interface SeasonScoreRow {
  player_id: number;
  season: number;
  position: string;
  league_id: number;
  matches_played: number;
  avg_score: number | null;
  avg_rating: number | null;
  total_goals: number;
  total_assists: number;
  tackles_p90: number | null;
  interceptions_p90: number | null;
  blocks_p90: number | null;
  duels_won_pct: number | null;
  passes_accuracy: number | null;
  passes_key_p90: number | null;
  passes_total_p90: number | null;
  dribbles_success_p90: number | null;
  dribbles_pct: number | null;
  shots_on_p90: number | null;
  shots_pct: number | null;
  goals_p90: number | null;
  assists_p90: number | null;
  fouls_drawn_p90: number | null;
  saves_p90: number | null;
  goals_conceded_p90: number | null;
  penalty_saved_avg: number | null;
  clean_sheet_pct: number | null;
  updated_at: string;
}

const WEIGHTED_AVG_FIELDS: (keyof SeasonScoreRow)[] = [
  'avg_score', 'avg_rating', 'tackles_p90', 'interceptions_p90', 'blocks_p90',
  'duels_won_pct', 'passes_accuracy', 'passes_key_p90', 'passes_total_p90',
  'dribbles_success_p90', 'dribbles_pct', 'shots_on_p90', 'shots_pct',
  'goals_p90', 'assists_p90', 'fouls_drawn_p90', 'saves_p90',
  'goals_conceded_p90', 'penalty_saved_avg', 'clean_sheet_pct',
];

// Fusiona filas fragmentadas por competencia (mismo player_id+position, distinto
// league_id) en una sola fila por jugador+posicion. Sin esto, un jugador que jugo
// la misma posicion en dos competencias la misma temporada queda con dos filas
// "iguales" en player_season_scores, con distinto matches_played/avg_score --
// el bug real detras de ver "EXT 6 PJ 6.1" y "EXT 7 PJ 5.4" en la ficha.
export function mergeSeasonScoreFragments(rows: SeasonScoreRow[]): SeasonScoreRow[] {
  const byKey = new Map<string, SeasonScoreRow[]>();
  for (const r of rows) {
    const key = `${r.player_id}|${r.position}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  const merged: SeasonScoreRow[] = [];
  for (const fragments of byKey.values()) {
    if (fragments.length === 1) {
      merged.push(fragments[0]);
      continue;
    }

    const totalMatches = fragments.reduce((s, f) => s + (f.matches_played ?? 0), 0);
    const weightedAvg = (field: keyof SeasonScoreRow): number | null => {
      if (totalMatches === 0) return null;
      const weighted = fragments.reduce(
        (s, f) => s + ((f[field] as number | null) ?? 0) * (f.matches_played ?? 0),
        0,
      );
      return Math.round((weighted / totalMatches) * 100) / 100;
    };

    // La liga con mas partidos queda como league_id de referencia (informativo:
    // ya no forma parte de la clave unica de la tabla, ver Task 2).
    const mainFragment = [...fragments].sort((a, b) => (b.matches_played ?? 0) - (a.matches_played ?? 0))[0];

    const mergedRow: SeasonScoreRow = {
      ...mainFragment,
      matches_played: totalMatches,
      total_goals: fragments.reduce((s, f) => s + (f.total_goals ?? 0), 0),
      total_assists: fragments.reduce((s, f) => s + (f.total_assists ?? 0), 0),
    };
    for (const field of WEIGHTED_AVG_FIELDS) {
      (mergedRow as unknown as Record<string, number | null>)[field] = weightedAvg(field);
    }
    merged.push(mergedRow);
  }

  return merged;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run supabase/functions/_shared/mergeSeasonFragments.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/mergeSeasonFragments.ts supabase/functions/_shared/mergeSeasonFragments.test.ts
git commit -m "feat(scoring): funcion pura para fusionar fragmentos de score por competencia"
```

---

### Task 2: Migración — angostar la clave primaria de `player_season_scores`

**Files:**
- Create: `supabase/migrations/20260811_merge_season_score_fragments.sql`

**Interfaces:**
- Produces: `player_season_scores` pasa a tener `PRIMARY KEY (player_id, season, position)` en vez de `(player_id, season, position, league_id)`. `league_id` sigue existiendo como columna informativa.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260811_merge_season_score_fragments.sql
-- La clave primaria de player_season_scores incluia league_id, lo que permitia
-- que un jugador tuviera mas de una fila para la misma posicion+temporada si
-- jugaba esa posicion en mas de una competencia (liga domestica + copa, por
-- ejemplo) -- el bug real detras de ver "EXT 6 PJ 6.1" y "EXT 7 PJ 5.4" en la
-- ficha, ademas de que el score principal de la ficha eligiera cualquiera de
-- las dos filas sin garantia de elegir la mejor. De ahora en mas recalc-scores
-- fusiona esos fragmentos antes de guardar (ver mergeSeasonFragments.ts), asi
-- que la clave unica pasa a ser player_id+season+position.

-- Antes de angostar la PK no puede haber mas de una fila por (player_id, season,
-- position) -- se conserva la de mas partidos jugados de cada grupo; el proximo
-- recalc-scores (automatico cada 6h) recalcula todo correctamente de todas formas.
DELETE FROM public.player_season_scores t
WHERE ctid NOT IN (
  SELECT DISTINCT ON (player_id, season, position) ctid
  FROM public.player_season_scores
  ORDER BY player_id, season, position, matches_played DESC
);

ALTER TABLE public.player_season_scores DROP CONSTRAINT player_season_scores_pkey;
ALTER TABLE public.player_season_scores ADD PRIMARY KEY (player_id, season, position);
```

- [ ] **Step 2: Verificar la sintaxis leyendo el SQL con cuidado**

No hay Supabase local para correr esto (Docker no disponible). Releer la migración y confirmar:
- El `DELETE ... USING ctid NOT IN (subquery)` es un patron valido de Postgres para "quedarse con una fila por grupo" (`DISTINCT ON` + `ORDER BY` elige la de mayor `matches_played`).
- El nombre de la constraint a borrar (`player_season_scores_pkey`) es el nombre por defecto que Postgres le da a una `PRIMARY KEY` declarada sin nombre explicito en `CREATE TABLE` (confirmado en `supabase/migrations/001_scoring_schema.sql:134`, la tabla no le puso nombre a la PK).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260811_merge_season_score_fragments.sql
git commit -m "feat(scoring): migracion para angostar la PK de player_season_scores (quita league_id)"
```

---

### Task 3: Migración — `backfill_ungridded_positions()`

**Files:**
- Create: `supabase/migrations/20260811_backfill_ungridded_positions.sql`

**Interfaces:**
- Produces: función SQL `backfill_ungridded_positions()` que sobreescribe `player_match_stats.detected_position` en filas sin `grid_position`, usando la posición mayoritaria del jugador entre sus partidos con `grid_position` confirmado.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260811_backfill_ungridded_positions.sql
-- Cuando un partido no tiene dato de grilla (tipico de un suplente que entra
-- desde el banco, donde API-Football no publica una casilla de formacion),
-- sync-player-stats cae a fallbackPosition(), que para el codigo generico 'F'
-- de API-Football devuelve siempre 'DEL' sin importar si el jugador es
-- realmente extremo. Confirmado con datos reales (Santiago Montiel, id 265973):
-- TODAS sus apariciones marcadas DEL fueron entradas de banco de pocos minutos;
-- TODAS sus apariciones como titular con casi todo el partido quedaron bien
-- marcadas EXT/VI.
--
-- Esta funcion corrige esas filas adivinadas a ciegas usando lo que el propio
-- jugador ya demuestra en los partidos donde SI hay grilla confirmada: nunca
-- toca una fila que ya tiene grid_position (dato real), solo las que no.
CREATE OR REPLACE FUNCTION backfill_ungridded_positions()
RETURNS void AS $$
WITH grid_majority AS (
  SELECT player_id, detected_position AS position,
         ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY COUNT(*) DESC) AS rn
  FROM player_match_stats
  WHERE grid_position IS NOT NULL AND detected_position IS NOT NULL
  GROUP BY player_id, detected_position
)
UPDATE player_match_stats pms
SET detected_position = gm.position
FROM grid_majority gm
WHERE gm.rn = 1
  AND pms.player_id = gm.player_id
  AND pms.grid_position IS NULL
  AND pms.detected_position IS NOT NULL
  AND pms.detected_position IS DISTINCT FROM gm.position;
$$ LANGUAGE sql;
```

- [ ] **Step 2: Verificar la sintaxis leyendo el SQL con cuidado**

No hay Supabase local para correr esto. Releer y confirmar:
- El CTE `grid_majority` agrupa por `(player_id, detected_position)` contando partidos, y `ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY COUNT(*) DESC)` numera las posiciones de cada jugador de mas a menos frecuente entre sus partidos con grilla — `rn = 1` es la mayoritaria.
- El `UPDATE ... FROM ... WHERE` solo toca `player_match_stats` donde `grid_position IS NULL` (sin dato real) — nunca sobreescribe una fila que sí tiene grilla.
- `IS DISTINCT FROM` evita un `UPDATE` innecesario cuando el valor ya coincide (fila ya correcta).
- Un jugador sin ningún partido con `grid_position` confirmado no aparece en `grid_majority` — sus filas sin grilla quedan como están (no hay con qué corregirlas), comportamiento esperado y documentado en la spec.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260811_backfill_ungridded_positions.sql
git commit -m "feat(scoring): funcion SQL que corrige posiciones adivinadas en partidos sin grilla"
```

---

### Task 4: Enganchar los dos arreglos en `recalc-scores/index.ts`

**Files:**
- Modify: `supabase/functions/recalc-scores/index.ts`

**Interfaces:**
- Consumes: `mergeSeasonScoreFragments` (Task 1, `../_shared/mergeSeasonFragments.ts`); `backfill_ungridded_positions()` (Task 3, invocado vía `supabase.rpc`).

- [ ] **Step 1: Importar `mergeSeasonScoreFragments`**

Ubicar (línea 5 del archivo actual):

```ts
import type { Position } from '../_shared/types.ts';
```

y agregar debajo:

```ts
import { mergeSeasonScoreFragments } from '../_shared/mergeSeasonFragments.ts';
```

- [ ] **Step 2: Fusionar `primaryRows` antes de rankear**

Ubicar (línea 241 del archivo actual):

```ts
      const primaryRows = allSeasonRows.filter((r: any) => bestPos.get(r.player_id)?.position === r.position);

      // ── Ranking GLOBAL por posición: cada jugador contra TODOS los de su puesto
      // en la plataforma (todas las ligas), SIN ajuste por nivel de liga. ──
      const byPos = new Map<string, any[]>();
      for (const r of primaryRows) {
        if (!byPos.has(r.position)) byPos.set(r.position, []);
        byPos.get(r.position)!.push(r);
      }
```

y reemplazarlo por:

```ts
      const primaryRows = allSeasonRows.filter((r: any) => bestPos.get(r.player_id)?.position === r.position);

      // Fusionar fragmentos: un jugador puede tener mas de una fila de la misma
      // posicion-primaria si jugo esa posicion en mas de una liga/competencia
      // esta temporada (liga domestica + copa, por ejemplo).
      const mergedPrimaryRows = mergeSeasonScoreFragments(primaryRows);

      // ── Ranking GLOBAL por posición: cada jugador contra TODOS los de su puesto
      // en la plataforma (todas las ligas), SIN ajuste por nivel de liga. ──
      const byPos = new Map<string, any[]>();
      for (const r of mergedPrimaryRows) {
        if (!byPos.has(r.position)) byPos.set(r.position, []);
        byPos.get(r.position)!.push(r);
      }
```

- [ ] **Step 3: Usar las filas fusionadas en el upsert final**

Ubicar (líneas 266-276 del archivo actual):

```ts
      if (primaryRows.length > 0) {
        await supabase.from('player_season_scores').delete().eq('season', season);
        const CHUNK = 500;
        for (let i = 0; i < primaryRows.length; i += CHUNK) {
          await supabase.from('player_season_scores').upsert(
            primaryRows.slice(i, i + CHUNK),
            { onConflict: 'player_id,season,position,league_id' }
          );
        }
        totalUpserted += primaryRows.length;
      }
```

y reemplazarlo por:

```ts
      if (mergedPrimaryRows.length > 0) {
        await supabase.from('player_season_scores').delete().eq('season', season);
        const CHUNK = 500;
        for (let i = 0; i < mergedPrimaryRows.length; i += CHUNK) {
          await supabase.from('player_season_scores').upsert(
            mergedPrimaryRows.slice(i, i + CHUNK),
            { onConflict: 'player_id,season,position' }
          );
        }
        totalUpserted += mergedPrimaryRows.length;
      }
```

- [ ] **Step 4: Invocar `backfill_ungridded_positions()` al principio de la corrida**

Ubicar (línea 31-32 del archivo actual, dentro del `try`):

```ts
  try {
    const { data: domesticLeagues } = await supabase
```

y reemplazarlo por:

```ts
  try {
    // Corrige posiciones adivinadas a ciegas en partidos sin dato de grilla
    // (tipico de entradas de banco) ANTES de calcular distribucion y scores de
    // esta misma corrida, para que ya salgan bien en esta pasada.
    const { error: backfillError } = await supabase.rpc('backfill_ungridded_positions');
    if (backfillError) throw new Error(`backfill_ungridded_positions: ${backfillError.message}`);

    const { data: domesticLeagues } = await supabase
```

- [ ] **Step 5: Confirmar que no queda ninguna referencia suelta a `primaryRows` después de la fusión**

Run: `grep -n "primaryRows" supabase/functions/recalc-scores/index.ts`
Expected: la única línea que queda con `primaryRows` (sin `merged`) es la de su propia declaración (`const primaryRows = allSeasonRows.filter(...)`, la entrada de `mergeSeasonScoreFragments`) — todo lo que viene después (`byPos`, el upsert) debe decir `mergedPrimaryRows`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/recalc-scores/index.ts
git commit -m "feat(scoring): enganchar fusion de fragmentos y correccion de posiciones en recalc-scores"
```

---

### Task 5: Auditoría en vivo del rating de Informes (Julián Palacios)

**Files:**
- Modify (solo si la auditoría confirma que hace falta): a determinar en el Step 2 de esta tarea — candidatos ya identificados en la spec: `src/features/informes/useInformeEnrichment.ts` (tabla de últimos 5 partidos) o `src/features/informes/components/Step3Contenido.tsx` (presentación del campo Rating).

**Interfaces:**
- No produce ni consume interfaces nuevas — es una tarea de investigación con un posible ajuste de UI pequeño al final.

- [ ] **Step 1: Levantar el servidor de desarrollo**

Run: `npm run dev` (dejarlo corriendo en background si no está ya corriendo).

- [ ] **Step 2: Reproducir el flujo en el navegador**

Con Chrome (vía MCP u otro método disponible):
1. Ir a la sección Informes, iniciar un informe nuevo (o abrir uno existente) para "Julián Palacios" (id API-Football `167652`, equipo actual id `441`, `primary_position` `VI`).
2. En el paso de selección de jugador (Step1Archivo), confirmar qué valor se auto-completa en el campo Rating. Con los arreglos de las Tareas 1-4 ya aplicados en producción, debería ser `7.1` (su `avg_score` real en `player_season_scores` para 2026/VI). Si el usuario corrió las migraciones y el recalc manual antes de esta tarea, verificar contra datos reales; si no, verificar la lógica leyendo el código con el mismo razonamiento (no hace falta produccion actualizada para confirmar que el código hace lo correcto).
3. Avanzar hasta el paso donde se arma/visualiza la tabla de "Últimos 5 partidos" (`useInformeEnrichment.ts`) y confirmar qué encabezado/etiqueta tiene la columna de rating ahí, y si en el PDF final (Step4Preview o el export) queda claro que es un rating de partido puntual y no el Score GG.
4. Documentar en el reporte de esta tarea: ¿el campo Rating auto-completado coincide con el Score GG real? ¿La tabla de últimos partidos podría confundirse visualmente con "el" rating del jugador?

- [ ] **Step 3: Aplicar el ajuste que corresponda según lo encontrado**

- Si el Rating auto-completado ya es correcto (7.1) y la tabla de últimos partidos tiene una etiqueta suficientemente clara (ej. columna dice "Rating" pero el contexto de la tabla — "Últimos 5 partidos" — ya deja claro que es por partido, no un acumulado) → no hace falta cambio de código. Documentar la conclusión y pasar al Step 4.
- Si la tabla de últimos partidos es ambigua → agregar una aclaración mínima (ej. tooltip o texto secundario bajo el encabezado de esa columna aclarando "rating del partido") en el archivo donde se define esa columna. Sin inventar un rediseño — cambio de texto/etiqueta únicamente.
- Si se encuentra que el Rating auto-completado NO coincide con el Score GG real a pesar de las Tareas 1-4 ya aplicadas → **detenerse y reportar como BLOCKED** con el detalle exacto de qué se encontró (esto significaría un bug adicional no cubierto por este plan, a especificar aparte).

- [ ] **Step 4: Si hubo cambio de código, verificar y commitear**

Si el Step 3 no tocó código, saltear este paso.

Si tocó código: correr `npx tsc --noEmit` (sí aplica acá, es código de `src/`) y confirmar que compila limpio, verificar visualmente en el navegador que el texto nuevo se ve bien (dark/light si aplica), y commitear:

```bash
git add <archivos tocados>
git commit -m "fix(informes): aclara que el rating de ultimos partidos es por partido, no el Score GG"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test` (o `npx vitest run`)
Expected: todos los tests en verde, incluidos los 6 de `mergeSeasonFragments.test.ts` (5 originales + 1 agregado en la revisión final para el caso "campo null en todos los fragmentos") y los ya existentes de `_shared/` (`position-mapper.test.ts`, `scoring.test.ts`, `stats-normalize.test.ts`, `fetchAll.test.ts`), que no deben haberse roto.

- [ ] **Typecheck y build de `src/`**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores (recordar: esto NO cubre `supabase/functions/`, que no tiene un typecheck automatizado disponible en esta máquina).

- [ ] **Avisar al usuario que corra a mano en Supabase, en este orden (el deploy va primero, antes que las migraciones — ver nota abajo):**
  1. Deploy de la función `recalc-scores` actualizada (y `sync-player-stats` si el proceso de deploy los actualiza juntos, aunque esta función no tuvo cambios funcionales), **con las migraciones todavía sin correr**.
  2. `supabase/migrations/20260811_merge_season_score_fragments.sql`
  3. `supabase/migrations/20260811_backfill_ungridded_positions.sql`
  4. Disparar una corrida manual de `recalc-scores` (su URL de función, sin `body.season` para que cubra los dos años vigentes por defecto) — **no esperar el cron de 6h** para verificar.
  5. Confirmar en la tabla `sync_log` que la corrida de `recalc-scores` quedó con `status: 'success'` **y** confirmar además que `player_season_scores` tiene filas para la temporada actual (`count(*) > 0`) — no alcanza con mirar solo `sync_log`.

  Por qué el deploy va primero: mientras las migraciones no corrieron, la función nueva falla segura (su primer paso, `backfill_ungridded_positions()`, todavía no existe como RPC, así que corta antes de tocar `player_season_scores` y queda logueado como error). Si en cambio se corriera la migración 1 antes del deploy, la función VIEJA (que no revisa errores de `upsert`) seguiría en el cron, y su `upsert` fallaría contra la PK ya angostada dejando `player_season_scores` vacía con `sync_log` en `status: 'success'` — pérdida silenciosa de datos. Ver nota de riesgo completa en la spec, sección Rollout. Si la primera corrida (ya con ambas migraciones aplicadas) falla puntualmente en `backfill_ungridded_positions` puede ser timeout por la cantidad de filas históricas a corregir la primera vez — reintentar (es idempotente).

- [ ] **Verificación visual final en el navegador, con las migraciones y el recalc ya corridos:**
  - Ficha de Santiago Montiel (Externo): "Posiciones" ya no debería mostrar un % relevante de DEL para sus entradas de banco; "Historial de partidos" debería mostrar más partidos que antes, incluyendo los más recientes.
  - Buscar (con una consulta de auditoría similar a la usada durante la investigación de este plan) al menos un jugador real con fragmentos multi-liga confirmados antes del fix, y verificar que "Score por posición" ahora muestra una sola fila para esa posición.
  - Informes: confirmar la conclusión de la Tarea 5 sigue siendo válida con datos reales ya recalculados.
