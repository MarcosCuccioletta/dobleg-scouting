# Rating reemplaza a Score GG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el cálculo ponderado propio "Score GG" y que el rating crudo de Sofascore/API-Football (ya calculado como `avg_rating`/`rating`) sea el número principal en toda la plataforma, con el nombre "Rating".

**Architecture:** El dato ya existe (`player_season_scores.avg_rating`, `player_match_stats.rating`) — no hay pipeline nuevo que construir. El trabajo es: (1) dejar de calcular el score ponderado en las edge functions, (2) repuntar los ~2 puntos de entrada del frontend que arman el campo genérico de score hacia `avg_rating`/`rating` en vez de `avg_score`/`match_score`, y (3) barrer cada pantalla/archivo que lee directamente `avg_score` o usa el nombre `ggScore`/"Score GG".

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + Edge Functions Deno), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-rating-reemplaza-score-gg-design.md`

## Global Constraints

- El valor mostrado es el rating crudo, **sin re-escalar por percentil**. No agregar ninguna normalización nueva al número principal.
- **Sin mínimo de partidos jugados** para mostrar el rating.
- No se dropean columnas de base de datos (`avg_score`, `match_score` quedan en las tablas, simplemente dejan de escribirse — quedan `null` para todo dato nuevo).
- **Regla de naming, aplicar siempre igual:** los campos TypeScript `avg_score` (en `PlayerSeasonScore`/`PositionAverage`) y `match_score` (en `PlayerMatchStat`) **NO se renombran** — siguen mirroreando columnas reales de la base que quedan ahí sin usarse. Lo que cambia es que **ningún consumidor debe seguir LEYENDO `.avg_score` o `.match_score`** — cada lectura pasa a leer `.avg_rating` / `.rating` en su lugar. `PositionAverage.avg_score` (el promedio por posición) tampoco se renombra — es un campo genérico, no una referencia a la marca "Score GG"; solo cambia de qué columna se computa (`fetchPositionAverages`, Task 9).
- **Regla de naming para la marca:** todo identificador que literalmente dice "Score GG"/`ggScore`/`GGScore` (nombres de función, de campo, texto de UI, comentarios) sí se renombra a "Rating"/`rating`. No tocar nombres que dicen "GG" por otro motivo (ej. la página `ScoutTrackingGGPage.tsx` — "GG" ahí es "Doble G", el nombre de la página no cambia).
- Después de CADA tarea: `npx tsc --noEmit` y `npx vitest run` limpios antes de commitear. No acumular tareas sin verificar.
- Commits separados por tarea (no un commit gigante al final).
- Cortes de color recalibrados (reemplazan 8.0/5.5/3.5 y 8.0/7.0/5.5/4.0 en todo el código): **elite ≥7.3, bueno ≥6.8, regular ≥6.4, bajo ≥6.0, muy bajo <6.0.** Basado en la distribución real medida en Supabase el 2026-09-01 (p50=6.80, p90=7.10, p95=7.30, min=5.70, max=8.60 para jugadores con ≥5 PJ en 2025+). Rango de normalización visual (barras/aguja): **5.5 a 8.5** en vez de 1 a 10.

---

## Backend

### Task 1: Borrar el motor de cálculo ponderado

**Files:**
- Modify: `supabase/functions/_shared/scoring.ts` (queda vacío de lógica de cálculo — ver qué sobrevive abajo)
- Modify: `supabase/functions/_shared/types.ts:92-99` (borrar `ScoringWeight`)
- Delete: `supabase/functions/_shared/scoring.test.ts`

**Interfaces:**
- Produces: nada — este archivo deja de exportar `SCORING_WEIGHTS`, `calculateMatchScore`, `calculateSeasonScore`, `calculateSeasonScores`, `rankNormalize`, `normalizeToScale`. Los consumidores se arreglan en Tasks 2, 3, 6.

- [ ] **Step 1:** Vaciar `supabase/functions/_shared/scoring.ts` — dejarlo como archivo vacío (0 bytes de código) o borrarlo directamente. Se borra el archivo:

```bash
rm supabase/functions/_shared/scoring.ts
rm supabase/functions/_shared/scoring.test.ts
```

- [ ] **Step 2:** En `supabase/functions/_shared/types.ts`, borrar el bloque `ScoringWeight` (líneas 92-99):

```ts
export interface ScoringWeight {
  metric: string;
  weight: number;
  source: (row: PlayerMatchRow) => number;
  inverse?: boolean; // lower is better
  per90?: boolean;   // normalize to /90 min
  isPercentage?: boolean; // already 0-100, don't per90
}
```

El resto de `types.ts` (incluyendo `PlayerMatchRow` con su campo `match_score: number | null`) queda intacto — la columna sigue existiendo, solo deja de calcularse (Tasks 2-3).

- [ ] **Step 3:** No correr tests todavía — `sync-player-stats`, `sync-sofascore` y `recalc-scores` todavía importan de `scoring.ts` y van a romper el build hasta Tasks 2, 3 y 6. Seguir directo a Task 2 antes de verificar.

---

### Task 2: `sync-player-stats` deja de calcular `match_score`

**Files:**
- Modify: `supabase/functions/sync-player-stats/index.ts:5,131`

**Interfaces:**
- Consumes: nada nuevo — `row.match_score` sigue existiendo en `PlayerMatchRow`, solo queda siempre `null` (ya inicializado así en la línea 122).

- [ ] **Step 1:** Borrar la línea de import (línea 5):

```ts
import { calculateMatchScore } from '../_shared/scoring.ts';
```

- [ ] **Step 2:** Borrar el bloque que calculaba el score (línea 129-132 original):

```ts
        for (const row of allRows) {
          const peers = allRows.filter(r => r.player_id !== row.player_id);
          row.match_score = calculateMatchScore(row, peers);
        }
```

`row.match_score` queda en `null` (valor con el que ya se inicializa en la línea 122), y esa `null` es la que se manda al `upsert` en la línea 171 (`match_score: r.match_score`) — no hace falta tocar esas dos líneas.

- [ ] **Step 3:** Verificar que el archivo tipa bien:

Run: `npx tsc --noEmit -p supabase/functions/sync-player-stats 2>&1 || npx deno check supabase/functions/sync-player-stats/index.ts`

Si no hay `deno` ni un tsconfig de Deno separado en el entorno, alcanza con revisar visualmente que no quedó ninguna referencia a `calculateMatchScore` (`grep -n calculateMatchScore supabase/functions/sync-player-stats/index.ts` debe no devolver nada).

- [ ] **Step 4:** Commit:

```bash
git add supabase/functions/sync-player-stats/index.ts
git commit -m "refactor(scoring): sync-player-stats deja de calcular match_score ponderado"
```

---

### Task 3: `sync-sofascore` deja de calcular `match_score`

**Files:**
- Modify: `supabase/functions/sync-sofascore/index.ts:17,273-277`

- [ ] **Step 1:** Borrar el import (línea 17):

```ts
import { calculateMatchScore } from '../_shared/scoring.ts';
```

- [ ] **Step 2:** Borrar el bloque (líneas 272-277 originales):

```ts
        // Calculate match scores
        for (const row of allRows) {
          const peers = allRows.filter(r => r.player_id !== row.player_id);
          row.match_score = calculateMatchScore(row, peers);
        }
```

`match_score` queda `null` desde `mapPlayerStats` (línea 111 original ya lo inicializa así), y el `upsert` de más abajo sube el objeto `deduped` completo tal cual — no hace falta tocar el upsert.

- [ ] **Step 3:** `grep -n calculateMatchScore supabase/functions/sync-sofascore/index.ts` no debe devolver nada.

- [ ] **Step 4:** Commit:

```bash
git add supabase/functions/sync-sofascore/index.ts
git commit -m "refactor(scoring): sync-sofascore deja de calcular match_score ponderado"
```

---

### Task 4: Borrar la función `recalc-match-scores`

Su único propósito era recalcular `match_score` retroactivamente sobre partidos ya guardados (ver comentario en el header del archivo) — sin `match_score` no tiene nada que hacer.

**Files:**
- Delete: `supabase/functions/recalc-match-scores/` (carpeta completa)

- [ ] **Step 1:** Confirmar que nada más la referencia (rutas, otros functions, README, scripts de cron):

```bash
grep -rln "recalc-match-scores" --include="*.ts" --include="*.json" --include="*.md" --include="*.toml" .
```

Debe listar solo archivos dentro de `supabase/functions/recalc-match-scores/` (y opcionalmente algún doc histórico que no hace falta tocar — si aparece un `.md` de docs viejos, dejarlo, es historial).

- [ ] **Step 2:** Borrar la carpeta:

```bash
rm -rf supabase/functions/recalc-match-scores
```

- [ ] **Step 3:** Si la función está deployada en Supabase, borrarla del proyecto remoto también:

```bash
npx supabase functions delete recalc-match-scores --project-ref qgwmxjjumauortbwvivu
```

(Si el comando falla porque la función ya no existe remotamente, no es un error — seguir.)

- [ ] **Step 4:** Commit:

```bash
git add -A supabase/functions/recalc-match-scores
git commit -m "refactor(scoring): elimina recalc-match-scores (match_score ya no se calcula)"
```

---

### Task 5: `mergeSeasonFragments.ts` deja de mergear `avg_score`

**Files:**
- Modify: `supabase/functions/_shared/mergeSeasonFragments.ts:8,34`
- Modify: `supabase/functions/_shared/mergeSeasonFragments.test.ts` (reemplazar `avg_score` por `avg_rating` en las fixtures — mismo mecanismo de merge, solo cambia qué campo se usa de ejemplo)

**Interfaces:**
- Produces: `SeasonScoreRow` ya no tiene `avg_score` — Task 6 (`recalc-scores/index.ts`) es el único caller y deja de construir ese campo en el mismo commit lógico (hacer Task 6 inmediatamente después, antes de verificar tipos).

- [ ] **Step 1:** En `mergeSeasonFragments.ts`, borrar la línea 8 de la interfaz:

```ts
  avg_score: number | null;
```

- [ ] **Step 2:** En el array `WEIGHTED_AVG_FIELDS` (línea 34), sacar `'avg_score'`:

```ts
const WEIGHTED_AVG_FIELDS: (keyof SeasonScoreRow)[] = [
  'avg_rating', 'tackles_p90', 'interceptions_p90', 'blocks_p90',
  'duels_won_pct', 'passes_accuracy', 'passes_key_p90', 'passes_total_p90',
  'dribbles_success_p90', 'dribbles_pct', 'shots_on_p90', 'shots_pct',
  'goals_p90', 'assists_p90', 'fouls_drawn_p90', 'saves_p90',
  'goals_conceded_p90', 'penalty_saved_avg', 'clean_sheet_pct',
];
```

- [ ] **Step 3:** En `mergeSeasonFragments.test.ts`, reemplazar **todas** las ocurrencias de `avg_score` por `avg_rating` (son fixtures genéricas para probar el merge ponderado, el mecanismo es idéntico con cualquier campo numérico — no cambia ninguna aserción de negocio):

```bash
sed -i 's/avg_score/avg_rating/g' supabase/functions/_shared/mergeSeasonFragments.test.ts
```

- [ ] **Step 4:** No correr tests todavía (Task 6 modifica el único caller real). Seguir directo a Task 6.

---

### Task 6: `recalc-scores/index.ts` — dejar de calcular `avg_score` y arreglar el filtro roto de `match_score`

**Riesgo real si no se hace bien:** la query de partidos (línea 104-111 original) filtra `.not('match_score', 'is', null)` — como `match_score` va a ser siempre `null` desde Tasks 2-3, ese filtro dejaría la función devolviendo CERO filas para todos los jugadores. Hay que sacar ese filtro, no solo dejar de usar el resultado.

**Files:**
- Modify: `supabase/functions/recalc-scores/index.ts:1-6,100-186,238-273`

**Interfaces:**
- Consumes: `mergeSeasonScoreFragments` de Task 5 (ya no tiene `avg_score`).
- Produces: filas de `player_season_scores` sin campo `avg_score` en el objeto (la columna en la tabla queda intacta, simplemente no se manda — Postgres la deja en su default/`null` en el insert fresco).

- [ ] **Step 1:** Borrar el import de `calculateSeasonScores` (línea 3):

```ts
import { calculateSeasonScores } from '../_shared/scoring.ts';
```

- [ ] **Step 2:** En la query de `player_match_stats` (lo que era línea 101-111), sacar `match_score` del `.select()` y borrar el `.not('match_score', 'is', null)`:

```ts
        const allStats = await fetchAllRows<any>((from, to) =>
          supabase
            .from('player_match_stats')
            .select('player_id, detected_position, team_id, rating, goals, assists, fixture_id, minutes, tackles, interceptions, blocks, duels_total, duels_won, passes_accuracy, passes_key, passes_total, dribbles_success, dribbles_attempted, shots_on, shots_total, fouls_drawn, saves, goals_conceded, penalty_saved, fixtures!inner(season)')
            .not('rating', 'is', null)
            .not('detected_position', 'is', null)
            .in('team_id', teamIds)
            .eq('fixtures.season', season)
            .order('id')
            .range(from, to)
        );
```

(Se filtra por `rating` no nulo en vez de `match_score` no nulo — mismo propósito: no traer filas sin dato usable.)

- [ ] **Step 3:** En el bloque que arma `upsertRows` (lo que era línea 125-182), borrar la línea `const scores = ...` y el campo `avg_score` del objeto:

```ts
        const upsertRows = [];
        for (const [key, rows] of groups) {
          const [playerId, position] = key.split('|');
          const ratings = rows.map(r => r.rating).filter((r: any) => r !== null);

          // Métricas /90 y porcentajes del jugador en esta posición (mismas que el radar)
          const mins = rows.filter((r: any) => r.minutes > 0);
          const p90 = (field: string) => {
            const vals = mins.map((r: any) => ((r[field] ?? 0) / r.minutes) * 90);
            return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
          };
          const avg = (field: string) => {
            const vals = rows.map((r: any) => r[field] ?? 0).filter((v: number) => v > 0);
            return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
          };
          const pct = (num: string, den: string) => {
            const totN = rows.reduce((acc: number, r: any) => acc + (r[num] ?? 0), 0);
            const totD = rows.reduce((acc: number, r: any) => acc + (r[den] ?? 0), 0);
            return totD > 0 ? (totN / totD) * 100 : null;
          };
          const rd = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

          upsertRows.push({
            player_id: parseInt(playerId),
            season,
            position,
            league_id: league.id,
            matches_played: rows.length,
            avg_rating: ratings.length > 0
              ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
              : null,
            total_goals: rows.reduce((s: number, r: any) => s + (r.goals ?? 0), 0),
            total_assists: rows.reduce((s: number, r: any) => s + (r.assists ?? 0), 0),
            tackles_p90: rd(p90('tackles')),
            interceptions_p90: rd(p90('interceptions')),
            blocks_p90: rd(p90('blocks')),
            duels_won_pct: rd(pct('duels_won', 'duels_total')),
            passes_accuracy: rd(avg('passes_accuracy')),
            passes_key_p90: rd(p90('passes_key')),
            passes_total_p90: rd(p90('passes_total')),
            dribbles_success_p90: rd(p90('dribbles_success')),
            dribbles_pct: rd(pct('dribbles_success', 'dribbles_attempted')),
            shots_on_p90: rd(p90('shots_on')),
            shots_pct: rd(pct('shots_on', 'shots_total')),
            goals_p90: rd(p90('goals')),
            assists_p90: rd(p90('assists')),
            fouls_drawn_p90: rd(p90('fouls_drawn')),
            saves_p90: rd(p90('saves')),
            goals_conceded_p90: rd(p90('goals_conceded')),
            penalty_saved_avg: rd(avg('penalty_saved')),
            clean_sheet_pct: rd((rows.filter((r: any) => r.goals_conceded === 0).length / rows.length) * 100),
            updated_at: new Date().toISOString(),
          });
        }
```

Nota: `matches_played` pasa de `scores.length` (que eran los partidos con `match_score` no nulo) a `rows.length` (todos los partidos del grupo, que ya vienen filtrados por `rating` no nulo en la query — mismo universo de datos, ya no depende de un campo que nunca se calculó en esta pasada).

- [ ] **Step 4:** Borrar el bloque completo de ranking global (lo que era línea 256-273 — todo el bloque `byPos`/`calculateSeasonScores`/asignación de `r.avg_score`):

```ts
      // ── Ranking GLOBAL por posición: cada jugador contra TODOS los de su puesto
      // en la plataforma (todas las ligas), SIN ajuste por nivel de liga. ──
      const byPos = new Map<string, any[]>();
      for (const r of primaryRows) {
        if (!byPos.has(r.position)) byPos.set(r.position, []);
        byPos.get(r.position)!.push(r);
      }
      for (const [pos, rowsForPos] of byPos) {
        const pool = rowsForPos.filter((r: any) => (r.matches_played ?? 0) >= MIN_POOL_MATCHES);
        const canRank = pool.length >= MIN_POOL_SIZE;
        const scores = canRank
          ? calculateSeasonScores(rowsForPos, pool, pos as Position)
          : rowsForPos.map(() => null);
        rowsForPos.forEach((r: any, i: number) => {
          r.avg_score = scores[i] ?? (r.avg_rating ?? null); // fallback: rating de API
        });
      }

```

Borrar también las constantes que quedan sin uso al principio del archivo (línea 8-11 originales):

```ts
const MIN_POOL_MATCHES = 3;
const MIN_POOL_SIZE = 5;
```

Y el import `import type { Position } from '../_shared/types.ts';` si `Position` no se usa en ningún otro lado del archivo (verificar con `grep -n "Position" supabase/functions/recalc-scores/index.ts` después de este borrado — si solo queda el import, borrarlo también).

- [ ] **Step 5:** El resto del archivo (fusión de fragmentos con `mergeSeasonScoreFragments`, elección de posición primaria `bestPos`, el upsert a `player_season_scores`, el fix de `current_team_id`, la llamada a `recalc_percentiles`) queda **sin cambios** — sigue funcionando igual, ahora sobre filas que ya no tienen `avg_score`.

- [ ] **Step 6:** Typecheck del archivo (Deno):

```bash
npx deno check supabase/functions/recalc-scores/index.ts 2>&1 || echo "deno no disponible, revisar a mano que no queda ninguna referencia a scoring.ts/calculateSeasonScores/avg_score"
```

```bash
grep -n "calculateSeasonScores\|_shared/scoring\|avg_score" supabase/functions/recalc-scores/index.ts
```

Debe no devolver nada.

- [ ] **Step 7:** Correr la suite de Deno de `_shared` si el entorno la tiene configurada (mismo runner que usa `mergeSeasonFragments.test.ts`):

```bash
cd supabase/functions/_shared && deno test --allow-none 2>&1 || echo "deno test no disponible localmente, se valida en Task 8 (deploy) con datos reales"
```

- [ ] **Step 8:** Commit:

```bash
git add supabase/functions/_shared/mergeSeasonFragments.ts supabase/functions/_shared/mergeSeasonFragments.test.ts supabase/functions/recalc-scores/index.ts supabase/functions/_shared/scoring.ts supabase/functions/_shared/scoring.test.ts supabase/functions/_shared/types.ts supabase/functions/recalc-match-scores
git commit -m "refactor(scoring): recalc-scores calcula solo avg_rating, elimina el ranking ponderado"
```

(Este commit agrupa Tasks 1, 5 y 6 porque `recalc-scores.ts` no compila sin los borrados de `scoring.ts`/`mergeSeasonFragments.ts` — si se prefiere un commit por task, usar `git add` selectivo por archivo en cada Step de commit anterior y dejar este como el commit final que junta todo si algo quedó sin commitear.)

---

### Task 7: Migraciones SQL — percentiles y forma reciente sobre `avg_rating`

**Files:**
- Create: `supabase/migrations/20260901_recalc_percentiles_by_rating.sql`
- Create: `supabase/migrations/20260901_fetch_recent_form_by_rating.sql`

- [ ] **Step 1:** Crear `supabase/migrations/20260901_recalc_percentiles_by_rating.sql`:

```sql
-- Rating reemplaza a Score GG: los percentiles (por liga y global) ahora
-- rankean por avg_rating en vez de avg_score (que ya no se calcula, ver
-- docs/superpowers/specs/2026-09-01-rating-reemplaza-score-gg-design.md).
CREATE OR REPLACE FUNCTION recalc_percentiles(p_season int)
RETURNS void AS $$
BEGIN
  UPDATE player_season_scores pss
  SET percentile = sub.pct
  FROM (
    SELECT player_id, season, position, league_id,
      ROUND(percent_rank() OVER (
        PARTITION BY position, league_id
        ORDER BY avg_rating
      )::numeric * 100, 2) AS pct
    FROM player_season_scores
    WHERE season = p_season AND avg_rating IS NOT NULL
  ) sub
  WHERE pss.player_id = sub.player_id
    AND pss.season = sub.season
    AND pss.position = sub.position
    AND pss.league_id = sub.league_id;

  UPDATE player_season_scores pss
  SET global_percentile = sub.pct
  FROM (
    SELECT player_id, season, position, league_id,
      ROUND(percent_rank() OVER (
        PARTITION BY position
        ORDER BY avg_rating
      )::numeric * 100, 2) AS pct
    FROM player_season_scores
    WHERE season = p_season AND avg_rating IS NOT NULL
  ) sub
  WHERE pss.player_id = sub.player_id
    AND pss.season = sub.season
    AND pss.position = sub.position
    AND pss.league_id = sub.league_id;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 2:** Crear `supabase/migrations/20260901_fetch_recent_form_by_rating.sql`:

```sql
-- Rating reemplaza a Score GG: la forma reciente ahora promedia `rating`
-- crudo por partido en vez de `match_score` (que ya no se calcula), y
-- compara contra `avg_rating` de temporada en vez de `avg_score`.
CREATE OR REPLACE FUNCTION fetch_recent_form(
  p_window_months       int,
  p_min_matches         int    DEFAULT 3,
  p_fallback_months     int    DEFAULT 6,
  p_fallback_limit      int    DEFAULT 5,
  p_cheap_max_value     bigint DEFAULT NULL,
  p_contract_max_months int    DEFAULT NULL,
  p_positions           text[] DEFAULT NULL,
  p_limit               int    DEFAULT 200
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH scored AS (
    SELECT pms.player_id, pms.rating, f.date::date AS d
    FROM player_match_stats pms
    JOIN fixtures f ON f.id = pms.fixture_id
    WHERE pms.rating IS NOT NULL
  ),
  window_agg AS (
    SELECT player_id, count(*) AS n, avg(rating) AS avg_rating,
           jsonb_agg(rating ORDER BY d) AS scores
    FROM scored
    WHERE d >= (now() - make_interval(months => p_window_months))::date
    GROUP BY player_id
  ),
  fb_ranked AS (
    SELECT player_id, rating, d,
           row_number() OVER (PARTITION BY player_id ORDER BY d DESC) AS rn
    FROM scored
    WHERE d >= (now() - make_interval(months => p_fallback_months))::date
  ),
  fb_agg AS (
    SELECT player_id, count(*) AS n, avg(rating) AS avg_rating,
           jsonb_agg(rating ORDER BY d) AS scores
    FROM fb_ranked
    WHERE rn <= p_fallback_limit
    GROUP BY player_id
  ),
  chosen AS (
    SELECT
      COALESCE(w.player_id, fb.player_id) AS player_id,
      CASE WHEN COALESCE(w.n,0) >= p_min_matches THEN w.n         ELSE fb.n END          AS n,
      CASE WHEN COALESCE(w.n,0) >= p_min_matches THEN w.avg_rating ELSE fb.avg_rating END AS avg_rating,
      CASE WHEN COALESCE(w.n,0) >= p_min_matches THEN w.scores    ELSE fb.scores END     AS scores,
      CASE WHEN COALESCE(w.n,0) >= p_min_matches THEN 'window'    ELSE 'fallback' END    AS window_used
    FROM window_agg w
    FULL OUTER JOIN fb_agg fb ON fb.player_id = w.player_id
  ),
  qualified AS (
    SELECT
      c.player_id, c.n, c.avg_rating, c.scores, c.window_used,
      pl.name, pl.photo, pl.birth_date, pl.primary_position,
      pl.market_value_eur, pl.contract_end_date, pl.current_team_id,
      tm.id AS team_id, tm.name AS team_name, tm.logo AS team_logo, tm.league_id AS team_league_id,
      lg.name AS league_name,
      pss.avg_rating AS primary_score
    FROM chosen c
    JOIN players pl ON pl.id = c.player_id
    LEFT JOIN teams tm ON tm.id = pl.current_team_id
    LEFT JOIN leagues lg ON lg.id = tm.league_id
    LEFT JOIN LATERAL (
      SELECT s.avg_rating
      FROM player_season_scores s
      WHERE s.player_id = c.player_id AND s.position = pl.primary_position
      ORDER BY s.season DESC, s.matches_played DESC
      LIMIT 1
    ) pss ON true
    WHERE c.n >= p_min_matches
      AND (p_positions IS NULL OR pl.primary_position = ANY(p_positions))
      AND (
        (p_cheap_max_value IS NOT NULL AND pl.market_value_eur IS NOT NULL
           AND pl.market_value_eur <= p_cheap_max_value)
        OR
        (p_contract_max_months IS NOT NULL AND pl.contract_end_date IS NOT NULL
           AND pl.contract_end_date >= now()::date
           AND pl.contract_end_date <= (now() + make_interval(months => p_contract_max_months))::date)
      )
  )
  SELECT COALESCE(jsonb_agg(obj ORDER BY avg_rating DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', player_id, 'name', name, 'photo', photo, 'birth_date', birth_date,
      'primary_position', primary_position, 'market_value_eur', market_value_eur,
      'contract_end_date', contract_end_date, 'primary_score', primary_score,
      'recent_avg', round(avg_rating::numeric, 2), 'recent_matches', n,
      'recent_scores', scores, 'window_used', window_used,
      'on_the_rise', (primary_score IS NOT NULL AND avg_rating > primary_score),
      'league_name', league_name,
      'team', CASE WHEN team_id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', team_id, 'name', team_name, 'logo', team_logo, 'league_id', team_league_id
      ) END
    ) AS obj, avg_rating
    FROM qualified
    ORDER BY avg_rating DESC
    LIMIT GREATEST(p_limit, 0)
  ) s;
$$;

GRANT EXECUTE ON FUNCTION fetch_recent_form(int, int, int, int, bigint, int, text[], int)
  TO anon, authenticated, service_role;
```

Nota: el contrato de salida (`recent_avg`, `recent_matches`, `recent_scores`, `on_the_rise`, `primary_score`, etc.) queda **idéntico** — solo cambió de qué columnas se lee. No hace falta tocar `src/utils/opportunities.ts` ni ningún consumidor de `fetch_recent_form`.

- [ ] **Step 3:** Aplicar las dos migraciones al proyecto vinculado (el historial de migraciones de este proyecto está desincronizado con `supabase db push` desde hace tiempo — se usa `db query --file --linked`, que ya se confirmó funcional en este proyecto):

```bash
npx supabase db query --file supabase/migrations/20260901_recalc_percentiles_by_rating.sql --linked
npx supabase db query --file supabase/migrations/20260901_fetch_recent_form_by_rating.sql --linked
```

Cada comando no debe devolver error (una función `CREATE OR REPLACE` no imprime filas).

- [ ] **Step 4:** Verificar que las funciones responden con la firma esperada:

```bash
npx supabase db query "select fetch_recent_form(6, 3, 6, 5, null, null, null, 5);" --linked
```

Debe devolver un array JSON de hasta 5 jugadores con `recent_avg` en el rango ~5.5-8.6 (rating), no en el rango ~1-10 amplio de antes.

- [ ] **Step 5:** Commit:

```bash
git add supabase/migrations/20260901_recalc_percentiles_by_rating.sql supabase/migrations/20260901_fetch_recent_form_by_rating.sql
git commit -m "feat(scoring): percentiles y forma reciente rankean por avg_rating/rating"
```

---

### Task 8: Deploy de las edge functions tocadas

**Files:** ninguno (solo deploy)

- [ ] **Step 1:** Deployar las tres funciones editadas:

```bash
npx supabase functions deploy sync-player-stats --project-ref qgwmxjjumauortbwvivu
npx supabase functions deploy sync-sofascore --project-ref qgwmxjjumauortbwvivu
npx supabase functions deploy recalc-scores --project-ref qgwmxjjumauortbwvivu
```

- [ ] **Step 2:** Disparar un `recalc-scores` manual para la temporada actual y confirmar que corre sin error (usa el mismo mecanismo que el cron de 6hs, sin esperar):

```bash
curl -s -X POST "https://qgwmxjjumauortbwvivu.supabase.co/functions/v1/recalc-scores" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{}'
```

(`$SUPABASE_ANON_KEY` = el valor de `VITE_SUPABASE_ANON_KEY` en `.env.local`.) La respuesta debe ser `{"success":true,...}`, no un 500.

- [ ] **Step 3:** Confirmar en la base que `player_season_scores` sigue teniendo `avg_rating` poblado y que `percentile`/`global_percentile` no quedaron en `null` para las filas recién procesadas:

```bash
npx supabase db query "select count(*) filter (where avg_rating is not null) as con_rating, count(*) filter (where percentile is not null) as con_percentile from player_season_scores where season = extract(year from now())::int;" --linked
```

Ambos conteos deben ser > 0 y del mismo orden de magnitud.

- [ ] **Step 4:** No hay commit en este task (solo deploy/verificación contra el proyecto real).

---

## Frontend — capa de datos

### Task 9: `playerStatsService.ts` — los 4 puntos de lectura de `avg_score`/`match_score`

**Files:**
- Modify: `src/services/playerStatsService.ts:144,159-175,538-542,565,592`

**Interfaces:**
- Produces: `PlayerWithScore.primary_score`, `PositionAverage.avg_score` (nombre de campo sin cambios, ver Global Constraints), `ScoreLookupEntry.score`, `PlayerMatchStat[]` — mismos tipos y nombres de campo que antes, cambia solo la columna de origen.

- [ ] **Step 1:** En `fetchPlayerDetail` (línea 144), cambiar:

```ts
      primary_score: primaryScore?.avg_score ?? null,
```
por:
```ts
      primary_score: primaryScore?.avg_rating ?? null,
```

- [ ] **Step 2:** En `fetchPositionAverages` (líneas 158-175), cambiar el `.select()`, el `.not()` y la lectura de fila:

```ts
  const { data, error } = await supabase
    .from('player_season_scores')
    .select('position, league_id, avg_rating')
    .in('season', seasons)
    .not('avg_rating', 'is', null);

  if (error) throw error;

  const groups = new Map<string, { scores: number[]; league_id: number; position: string }>();
  for (const row of data ?? []) {
    const key = `${row.position}|${row.league_id}`;
    if (!groups.has(key)) groups.set(key, { scores: [], league_id: row.league_id, position: row.position });
    groups.get(key)!.scores.push(row.avg_rating);
  }
```

La forma del objeto que devuelve la función (`avg_score` como nombre de salida) no cambia — ver Global Constraints:

```ts
  return Array.from(groups.values()).map(g => ({
    position: g.position as Position,
    league_id: g.league_id,
    avg_score: Math.round((g.scores.reduce((a, b) => a + b, 0) / g.scores.length) * 10) / 10,
    player_count: g.scores.length,
  }));
```
(esta última parte no cambia, queda igual que hoy)

- [ ] **Step 3:** En `fetchScoreLookup` (líneas 537-565), cambiar el `.select()`, el `.not()` y la lectura:

```ts
    const { data, error } = await supabase
      .from('player_season_scores')
      .select(`
        player_id, position, avg_rating, percentile, matches_played, season,
        player:players!inner(name, current_team_id, transfermarkt_id, birth_date, team:teams(name, logo))
      `)
      .in('season', seasons)
      .not('avg_rating', 'is', null)
      .range(from, from + PAGE_SIZE - 1);
```

y más abajo:

```ts
      score: row.avg_rating,
```

- [ ] **Step 4:** En `fetchPlayerMatchHistory` (línea 592), cambiar el filtro:

```ts
    .eq('player_id', playerId)
    .not('rating', 'is', null);
```

(antes filtraba por `match_score` no nulo — con `match_score` siempre `null` desde Task 2, ese filtro dejaría la función devolviendo 0 partidos siempre. `rating` es el campo correcto: siempre viene poblado por el proveedor.)

- [ ] **Step 5:** Correr:

```bash
npx tsc --noEmit
npx vitest run src/services/playerStatsService.test.ts
```

`playerStatsService.test.ts` no testea estas 4 funciones directamente (son de red, ver el resto del archivo de test) — debe seguir en verde sin cambios.

- [ ] **Step 6:** Commit:

```bash
git add src/services/playerStatsService.ts
git commit -m "refactor(scoring): playerStatsService lee avg_rating/rating en vez de avg_score/match_score"
```

---

### Task 9.1 (insertada durante ejecución): Motor de Insights de Informes ("Impacto") lee `match_score` — gap real del plan original

**Por qué existe esta tarea:** al revisar la Task 9, se encontró que `src/features/informes/insights/compute.ts`, `src/features/informes/insights/squad.ts`, `src/features/informes/useInformeEnrichment.ts` y `src/features/informes/useInformeInsights.ts` leen `.match_score` extensamente para calcular el bloque "Rendimiento" de la pestaña Impacto de Informes (promedio de partidos, mejor partido, ranking de plantel, gráfico de "Evolución de nivel"). Ninguno de estos archivos estaba en el inventario original del spec/plan. Como `match_score` quedó permanentemente `null` desde que las Tasks 2-3 se deployaron (Task 8), **esta funcionalidad ya está silenciosamente rota en producción** — no es un riesgo a futuro, es un bug ya vivo. Se inserta esta tarea para cerrarlo, en el mismo lugar del plan donde se descubrió (antes de continuar con el resto del barrido frontend).

**Files:**
- Modify: `src/features/informes/insights/types.ts:49` — renombrar el campo `match_score` a `rating` en `SquadMatchRow` (tipo local de Informes, NO mirrorea una columna real de la base — a diferencia de `PlayerMatchStat`/`SquadStatRow`, acá sí se renombra limpio).
- Modify: `src/services/playerStatsService.ts` — `SquadStatRow` interface (agregar `rating: number | null`, dejar `match_score` como está — este SÍ mirrorea la columna real) y el `.select()` de `fetchSquadMatchStats` (agregar `rating` a la lista de columnas).
- Modify: `src/features/informes/useInformeInsights.ts:65,92` — `toPlayerRows`/`toSquadRows` pasan a mapear `rating: m.rating` / `rating: r.rating` en vez de `match_score: m.match_score` / `match_score: r.match_score`.
- Modify: `src/features/informes/useInformeEnrichment.ts:199-200` — el filtro/map de "Evolución de nivel" pasa de `m.match_score` a `m.rating` (este archivo ya usa `PlayerMatchStat` directo, que ya tiene `.rating` — no hace falta tocar su fuente de datos).
- Modify: `src/features/informes/insights/compute.ts:222,227,234,238` — `m.match_score` → `m.rating` en las 3 lecturas; recalibrar los cortes de tono `avgScore >= 7 ? 'strong' : avgScore >= 6.3 ? 'neutral' : 'weak'` a `avgScore >= 6.8 ? 'strong' : avgScore >= 6.4 ? 'neutral' : 'weak'` (mismos cortes "bueno"/"regular" que el resto del plan, Global Constraints).
- Modify: `src/features/informes/insights/squad.ts:96-97` — `r.match_score` → `r.rating`.
- Modify: `src/features/informes/insights/compute.test.ts` — helpers `mine`/`squadRow` y toda fixture que pase `match_score:` pasan a `rating:` (reemplazo mecánico, mismo criterio que Task 5: el mecanismo no depende del nombre del campo, solo cambia qué campo simula).
- Modify: `src/features/informes/insights/squad.test.ts` — helper `row` y toda fixture con `match_score:` pasan a `rating:`.

**Interfaces:**
- Produces: `SquadMatchRow.rating: number | null` (reemplaza a `match_score` en este tipo local). `SquadStatRow.rating: number | null` (nuevo, además de `match_score` que se mantiene).
- Consumes: `PlayerMatchStat.rating` (ya existe, viene de `fetchPlayerAllMatches`'s `select('*')`), `SquadStatRow.rating` (nuevo, ver arriba).

- [ ] **Step 1:** En `insights/types.ts` línea 49, cambiar `match_score: number | null` por `rating: number | null` dentro de `SquadMatchRow` (heredado por `PlayerMatchRow`).

- [ ] **Step 2:** En `playerStatsService.ts`, agregar `rating: number | null;` a la interfaz `SquadStatRow` (sin sacar `match_score`, que mirrorea la columna real), y en `fetchSquadMatchStats`, agregar `rating` a la lista de columnas del `.select()`:

```ts
      .select(`
        player_id, fixture_id, minutes, goals, assists, passes_key,
        duels_won, duels_total, dribbles_success, dribbles_attempted,
        rating, match_score, detected_position,
        player:players(name),
        fixture:fixtures!inner(date)
      `)
```

- [ ] **Step 3:** En `useInformeInsights.ts`, en `toPlayerRows` (línea 65) y `toSquadRows` (línea 92), cambiar `match_score: m.match_score,` / `match_score: r.match_score,` por `rating: m.rating,` / `rating: r.rating,` respectivamente.

- [ ] **Step 4:** En `useInformeEnrichment.ts` líneas 199-200:

```ts
    const scored = dated
      .filter(m => m.rating != null)
      .map(m => ({ date: new Date(m.fixture!.date), score: Math.round((m.rating ?? 0) * 10) / 10 }))
```

- [ ] **Step 5:** En `insights/compute.ts` líneas 222-238, cambiar las 3 lecturas de `m.match_score` a `m.rating`, y recalibrar los cortes de tono:

```ts
    const scored = played.filter(m => m.rating != null)

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
```

- [ ] **Step 6:** En `insights/squad.ts` líneas 96-97:

```ts
    if (r.rating != null) {
      cur.scoreSum += r.rating
      cur.scoreCount++
    }
```

- [ ] **Step 7:** En `compute.test.ts` y `squad.test.ts`, reemplazar mecánicamente cada `match_score:` por `rating:` en los helpers de fixture (`mine`, `squadRow`, `row`) y en cada llamada que pase ese campo (son valores de prueba genéricos, no cambia ninguna aserción de negocio — mismo criterio que Task 5).

- [ ] **Step 8:** Actualizar también el comentario stale en `playerStatsService.ts:705` (`// fetchPlayerMatchHistory filtra por posición detectada y por match_score no nulo,`) → `// fetchPlayerMatchHistory filtra por posición detectada y por rating no nulo,` (encontrado durante la revisión de Task 9, describía el comportamiento viejo).

- [ ] **Step 9:** Correr:

```bash
npx tsc --noEmit
npx vitest run src/features/informes
```

Ambos deben quedar limpios — este es el bloque de tests más grande tocado hasta ahora en este plan, prestar atención a cualquier aserción de negocio que dependa del valor numérico de `match_score`/`rating` (deberían seguir pasando porque los valores de fixture no cambian, solo el nombre del campo).

- [ ] **Step 10:** Commit:

```bash
git add src/features/informes/insights/types.ts src/features/informes/insights/compute.ts src/features/informes/insights/squad.ts src/features/informes/insights/compute.test.ts src/features/informes/insights/squad.test.ts src/features/informes/useInformeInsights.ts src/features/informes/useInformeEnrichment.ts src/services/playerStatsService.ts
git commit -m "fix(scoring): motor de Insights de Informes lee rating (estaba roto en produccion desde el deploy de match_score=null)"
```

---

### Task 10: `scoutPlayersService.ts` — fuente de score de Seguimiento GG

**Files:**
- Modify: `src/services/scoutPlayersService.ts:217,220,233`

- [ ] **Step 1:** Cambiar el `.select()` y el `.not()` (líneas 215-220):

```ts
    const { data: scores } = await supabase
      .from('player_season_scores')
      .select('player_id, avg_rating, percentile, position, matches_played, season')
      .in('player_id', supabaseIds)
      .in('season', currentSeasons())
      .not('avg_rating', 'is', null)
```

- [ ] **Step 2:** Cambiar la lectura de fila (línea 233):

```ts
          scoreMap.set(s.player_id, {
            score: s.avg_rating,
            percentile: s.percentile,
            position: s.position,
            matches: s.matches_played,
          })
```

- [ ] **Step 3:**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 4:** Commit:

```bash
git add src/services/scoutPlayersService.ts
git commit -m "refactor(scoring): scoutPlayersService (Seguimiento GG) lee avg_rating"
```

---

### Task 11: Rename del núcleo — `applyScoreGG`→`applyRating`, `ggScore`→`rating`

Este es el cambio de mayor superficie: todo lo que sigue lee `EnrichedPlayer.ggScore`/`ggScorePercentile` (el campo que arma `applyScoreGG`). Se renombra acá una sola vez en el tipo/función núcleo; las Tasks 14-20 son el barrido mecánico de cada consumidor.

**Files:**
- Modify: `src/utils/scoring.ts:96-187`
- Rename + Modify: `src/utils/applyScoreGG.test.ts` → `src/utils/applyRating.test.ts`
- Modify: `src/types/index.ts:58,64,69,192-193,282`
- Modify: `src/context/DataContext.tsx` (múltiples líneas, ver abajo)
- Modify: `src/context/DataContext.test.ts:12`

**Interfaces:**
- Produces: `applyRating(players, source, lookup): EnrichedPlayer[]`, `RatingEntry { score, percentile }` (reemplaza `ScoreGGEntry`), `EnrichedPlayer.rating: number | null`, `EnrichedPlayer.ratingPercentile: number | null` (reemplazan `ggScore`/`ggScorePercentile`).

- [ ] **Step 1:** En `src/utils/scoring.ts`, renombrar la firma de `enrichPlayer` (línea 96-101) y su cuerpo (línea 138-139):

```ts
function enrichPlayer(
  player: Record<string, string>,
  rating: number | null,
  ratingPercentile: number | null,
  source: 'externo' | 'interno'
): EnrichedPlayer {
```
... (sin cambios en el resto del cuerpo hasta el `return`) ...
```ts
    rating,
    ratingPercentile,
```

- [ ] **Step 2:** Renombrar el tipo y la función (líneas 157-187):

```ts
/** Lo mínimo que `applyRating` necesita de una entrada del lookup de la API. */
export interface RatingEntry {
  score: number | null
  percentile: number | null
}

/**
 * Asigna a cada jugador del CSV el Rating (1-10) que ya calculó la API
 * (promedio de rating de Sofascore/API-Football por temporada), buscándolo
 * por nombre normalizado.
 *
 * Reemplaza al scoring ponderado propio ("Score GG") que combinaba métricas
 * con pesos elegidos a criterio propio — ver
 * docs/superpowers/specs/2026-09-01-rating-reemplaza-score-gg-design.md. Si
 * un jugador no está en la API queda en null: preferimos que la ficha diga
 * que no hay rating antes que mostrar un número de otra fuente.
 */
export function applyRating(
  players: (RawExternalPlayer | RawInternalPlayer)[],
  source: 'externo' | 'interno',
  lookup: Map<string, RatingEntry>
): EnrichedPlayer[] {
  return players.map(player => {
    const entry = lookup.get(normalizeName(player['Jugador'] ?? ''))
    return enrichPlayer(
      player as Record<string, string>,
      entry?.score ?? null,
      entry?.percentile ?? null,
      source
    )
  })
}
```

- [ ] **Step 3:** Renombrar el archivo de test y actualizar su contenido:

```bash
git mv src/utils/applyScoreGG.test.ts src/utils/applyRating.test.ts
sed -i \
  -e "s/applyScoreGG/applyRating/g" \
  -e "s/ScoreGGEntry/RatingEntry/g" \
  -e "s/\.ggScore\b/.rating/g" \
  -e "s/\.ggScorePercentile\b/.ratingPercentile/g" \
  -e "s/pega el Score GG de la API/pega el Rating de la API/" \
  src/utils/applyRating.test.ts
```

- [ ] **Step 4:** En `src/types/index.ts`, renombrar los 6 campos/comentarios:

| Línea | Antes | Después |
|---|---|---|
| 58 | `ggScore?: number \| null` | `rating?: number \| null` |
| 64 | `opportunityScore?: number \| null  // ggScore / marketValue ratio` | `opportunityScore?: number \| null  // rating / marketValue ratio` |
| 69 | `avgInternalScore?: number \| null  // Average ggScore of internal players in same position` | `avgInternalScore?: number \| null  // Average rating of internal players in same position` |
| 192 | `ggScore: number \| null` | `rating: number \| null` |
| 193 | `ggScorePercentile: number \| null  // percentile within position group (0-100)` | `ratingPercentile: number \| null  // percentile within position group (0-100)` |
| 282 | `ggScore: number` | `rating: number` |

- [ ] **Step 5:** En `src/context/DataContext.tsx`, aplicar (mismo mecanismo en las ~20 ocurrencias que hoy dicen `ggScore`/`ggScorePercentile`/`applyScoreGG`/"Score GG"):

```bash
sed -i \
  -e "s/applyScoreGG/applyRating/g" \
  -e "s/\.ggScorePercentile\b/.ratingPercentile/g" \
  -e "s/ggScorePercentile:/ratingPercentile:/g" \
  -e "s/\.ggScore\b/.rating/g" \
  -e "s/ggScore:/rating:/g" \
  -e "s/existingPlayer\.rating/existingPlayer.rating/g" \
  src/context/DataContext.tsx
```

Después del `sed`, revisar a mano estos 3 puntos que necesitan además un cambio de texto/nombre de función local (el `sed` de arriba solo cubre el nombre de campo):

- Línea ~412 (comentario): `// Cortes sobre el Score GG (1-10)...` → `// Cortes sobre el Rating (1-10)...`
- Línea ~1010-1014 (comentario de la función `enrichScoutPlayer` o similar): reemplazar "Score GG" por "Rating" en el texto del comentario.
- Línea ~1076: `function calculateOpportunityScore(ggScore: number | null, marketValue: number)` — el `sed` ya renombra el parámetro a `rating` vía la regla `.ggScore\b`→`.rating` NO aplica acá (es un nombre de parámetro, no un acceso `.ggScore`) — renombrar a mano: `function calculateOpportunityScore(rating: number | null, marketValue: number)` y su cuerpo (`if (rating === null...`, `return Math.round((rating / ...`).

Verificar con:
```bash
grep -n "ggScore\|applyScoreGG\|Score GG" src/context/DataContext.tsx
```
No debe quedar nada.

- [ ] **Step 6:** En `src/context/DataContext.test.ts:12`, reemplazar `ggScore: null, ggScorePercentile: null,` por `rating: null, ratingPercentile: null,`.

- [ ] **Step 7:**

```bash
npx tsc --noEmit
npx vitest run src/utils/applyRating.test.ts src/context/DataContext.test.ts
```

Ambos deben pasar. El `tsc` va a mostrar errores en cascada en TODOS los archivos que todavía leen `.ggScore` (Tasks 12-20) — es esperado en este punto del plan, se resuelve tarea por tarea. Si se quiere confirmar que Task 11 en sí está bien, alcanza con que no haya errores DENTRO de `scoring.ts`, `applyRating.test.ts`, `DataContext.tsx`/`.test.ts`.

- [ ] **Step 8:** Commit:

```bash
git add src/utils/scoring.ts src/utils/applyScoreGG.test.ts src/utils/applyRating.test.ts src/types/index.ts src/context/DataContext.tsx src/context/DataContext.test.ts
git commit -m "refactor(scoring): applyScoreGG -> applyRating, ggScore -> rating en el nucleo"
```

---

### Task 12: `ScoreBar.tsx` — recalibrar cortes y barra al rango real del rating

**Files:**
- Modify: `src/components/ui/ScoreBar.tsx:1-13,99,117,137-139`

- [ ] **Step 1:** Reemplazar la función `threshold` (líneas 11-13) para que la escala `'10'` use los cortes reales en vez de dividir por 10:

```ts
function threshold(val100: number, scale: ScoreScale): number {
  if (scale !== '10') return val100
  // Cortes calibrados sobre el rating crudo (Sofascore/API-Football), que se
  // distribuye comprimido entre ~5.7 y ~8.6 (medido en Supabase 2026-09-01) —
  // ver docs/superpowers/specs/2026-09-01-rating-reemplaza-score-gg-design.md.
  if (val100 >= 80) return 7.3
  if (val100 >= 55) return 6.8
  if (val100 >= 35) return 6.4
  if (val100 >= 20) return 6.0
  return 0
}
```

- [ ] **Step 2:** En el componente `ScoreBar` (línea 99), cambiar el mapeo de porcentaje de la barra:

```ts
  const pct = scale === '10' ? ((score - 5.5) / (8.5 - 5.5)) * 100 : score
```

- [ ] **Step 3:** Línea 117, cambiar el label:

```tsx
          <span className="text-sm text-apple-gray-500 dark:text-apple-gray-400">Rating</span>
```

- [ ] **Step 4:** Líneas 136-140, cambiar los ticks del eje:

```tsx
        <div className="flex justify-between text-xs text-apple-gray-400">
          <span>{scale === '10' ? '5.5' : '0'}</span>
          <span>{scale === '10' ? '7' : '50'}</span>
          <span>{scale === '10' ? '8.5' : '100'}</span>
        </div>
```

- [ ] **Step 5:**

```bash
npx tsc --noEmit
```

No debe haber errores nuevos en `ScoreBar.tsx` (los que queden en otros archivos son de Tasks pendientes).

- [ ] **Step 6:** Commit:

```bash
git add src/components/ui/ScoreBar.tsx
git commit -m "feat(scoring): recalibra ScoreBar a la escala real del rating"
```

---

### Task 13: `GaugeScore.tsx` — recalibrar el velocímetro (aguja SVG)

**Files:**
- Modify: `src/components/charts/GaugeScore.tsx:14-27,29-40,42-62,64-84,147-149,166-171,173-180,275,301,414-415,465-516`

- [ ] **Step 1:** Reemplazar `getScoreColorAbsolute` (líneas 14-27):

```ts
function getScoreColorAbsolute(score: number, scale: '100' | '10' = '100'): string {
  if (scale === '10') {
    if (score >= 7.3) return '#34D399'
    if (score >= 6.8) return '#10B981'
    if (score >= 6.4) return '#F59E0B'
    if (score >= 6.0) return '#F97316'
    return '#EF4444'
  }
  if (score >= 80) return '#34D399'
  if (score >= 55) return '#10B981'
  if (score >= 35) return '#F59E0B'
  if (score >= 20) return '#F97316'
  return '#EF4444'
}
```

- [ ] **Step 2:** En `getScoreColor` (línea 29-40), `getScoreLabel` (42-62) y `getScoreDescription` (64-84), cambiar `const elite = scale === '10' ? 8.0 : 80` por `const elite = scale === '10' ? 7.3 : 80` en las tres funciones, y dentro de `getScoreLabel`/`getScoreDescription` cambiar los cortes del bloque `if (scale === '10') { ... }`:

```ts
  if (scale === '10') {
    if (score >= 6.8) return 'Bueno'
    if (score >= 6.4) return 'Promedio'
    if (score >= 6.0) return 'Bajo'
    return 'Critico'
  }
```
(mismo patrón para `getScoreDescription`, cambiando los textos de retorno que ya tiene, solo los números de corte: `7.0`→`6.8`, `5.5`→`6.4`, `4.0`→`6.0`).

- [ ] **Step 3:** En el componente `GaugeScore`, reemplazar el cálculo de `normalizedValue` (líneas 147-149):

```ts
  const normalizedValue = scale === '10'
    ? Math.max(0, Math.min(100, ((displayValue - 5.5) / (8.5 - 5.5)) * 100))
    : Math.max(0, Math.min(100, displayValue))
```

- [ ] **Step 4:** El cálculo de `comparisonDeg` (líneas 166-171), mismo reemplazo de fórmula:

```ts
  const comparisonDeg = comparisonScore !== null && comparisonScore !== undefined
    ? startDeg + ((scale === '10'
        ? Math.max(0, Math.min(100, ((comparisonScore - 5.5) / (8.5 - 5.5)) * 100))
        : Math.max(0, Math.min(100, comparisonScore))
      ) / 100) * 270
    : null
```

- [ ] **Step 5:** El array `zones` (líneas 173-180) recalculado con la misma fórmula de normalización y los nuevos cortes (6.0/6.4/6.8/7.3):

```ts
  const norm = (v: number) => ((v - 5.5) / (8.5 - 5.5)) * 100
  const zones = scale === '10'
    ? [
        { start: 0, end: norm(6.0), color: '#EF4444' },
        { start: norm(6.0), end: norm(6.4), color: '#F97316' },
        { start: norm(6.4), end: norm(6.8), color: '#F59E0B' },
        { start: norm(6.8), end: norm(7.3), color: '#10B981' },
        { start: norm(7.3), end: 100, color: '#34D399' },
      ]
    : [
        { start: 0, end: 20, color: '#EF4444' },
        { start: 20, end: 35, color: '#F97316' },
        { start: 35, end: 55, color: '#F59E0B' },
        { start: 55, end: 80, color: '#10B981' },
        { start: 80, end: 100, color: '#34D399' },
      ]
```

(Declarar `norm` justo antes del `const zones`, dentro del cuerpo del componente.)

- [ ] **Step 6:** Los tick marks (línea 275 y 276):

```ts
        {(scale === '10' ? [5.5, 6.25, 7, 7.75, 8.5] : [0, 25, 50, 75, 100]).map(v => {
          const normalized = scale === '10' ? ((v - 5.5) / (8.5 - 5.5)) * 100 : v
```

Y en el `<text>` que renderiza `{v}` (línea ~301), formatear con un decimal cuando `scale==='10'` para que no se vea "6.25" pegado sin espacio ni "7" sin punto — usar:

```tsx
                {scale === '10' ? v.toFixed(2).replace(/\.?0+$/, '') : v}
```

(esto imprime `5.5`, `6.25`, `7`, `7.75`, `8.5` — sin ceros de más).

- [ ] **Step 7:** `GaugeScoreMini` (línea 465-516), el cálculo de `progress` (línea 472):

```ts
  const progress = scale === '10' ? Math.max(0, Math.min(1, (score - 5.5) / (8.5 - 5.5))) : (score / 100)
```

- [ ] **Step 8:**

```bash
npx tsc --noEmit
```

- [ ] **Step 9:** Commit:

```bash
git add src/components/charts/GaugeScore.tsx
git commit -m "feat(scoring): recalibra GaugeScore (velocimetro) a la escala real del rating"
```

---

## Frontend — barrido de pantallas

Para cada tarea de esta sección: aplicar los reemplazos listados, correr `npx tsc --noEmit` y `npx vitest run`, verificar en Chrome MCP la pantalla afectada (login, navegar, mirar el número/label), commitear.

### Task 14: Búsquedas y tablas

**Files:** `src/components/players/PlayerTable.tsx`, `src/pages/BusquedaPage.tsx`, `src/pages/ExternalScoutingPage.tsx`

| Archivo | Línea | Antes | Después |
|---|---|---|---|
| `PlayerTable.tsx` | 67 | `const SCORE_COLUMN: Column = { key: 'ggScore', label: 'Score', sortable: true, align: 'center' }` | `const SCORE_COLUMN: Column = { key: 'rating', label: 'Rating', sortable: true, align: 'center' }` |
| `PlayerTable.tsx` | 104 | `useState<SortState>({ column: 'ggScore', direction: 'desc' })` | `useState<SortState>({ column: 'rating', direction: 'desc' })` |
| `PlayerTable.tsx` | 138-139 | `column === 'ggScore' ? getPlayerScore(a).score : a[column]` (x2, a/b) | `column === 'rating' ? getPlayerScore(a).score : a[column]` (x2) |
| `PlayerTable.tsx` | 348 | `{/* Score GG */}` | `{/* Rating */}` |
| `BusquedaPage.tsx` | 58-59 | `ggScore: p.primary_score, ggScorePercentile: p.primary_percentile,` | `rating: p.primary_score, ratingPercentile: p.primary_percentile,` |
| `BusquedaPage.tsx` | 875 | `<span ...>Score GG</span>` | `<span ...>Rating</span>` |
| `BusquedaPage.tsx` | 1315 | `<p ...>Score GG</p>` | `<p ...>Rating</p>` |
| `ExternalScoutingPage.tsx` | 854 | `const score = ss?.avg_score ?? null` | `const score = ss?.avg_rating ?? null` |

- [ ] **Step 1:** Aplicar los 8 reemplazos de la tabla.
- [ ] **Step 2:** `npx tsc --noEmit && npx vitest run`
- [ ] **Step 3:** Chrome MCP: entrar a Scout Externo e Interno, confirmar que la columna dice "Rating", que ordena, y que el número mostrado coincide con lo que muestra la ficha del mismo jugador (Task 15 todavía no está hecha, comparar contra el valor crudo en Supabase si hace falta).
- [ ] **Step 4:** Commit: `git commit -am "refactor(scoring): Rating en tablas de Busqueda/Scout Externo"`

---

### Task 15: Fichas de jugador

**Files:** `src/pages/PlayerDetailPage.tsx`, `src/components/players/SupabasePlayerDetail.tsx`, `src/components/tracking/LinkPlayerModal.tsx`, `src/components/charts/ScoreEvolutionMini.tsx`, `src/services/scoreHistoryService.ts`, `src/components/players/SimilarPlayersCard.tsx`, `src/pages/SimilarPlayersPage.tsx`

**`PlayerDetailPage.tsx`** — todas las lecturas directas de `avg_score` sobre objetos `PlayerSeasonScore` pasan a `avg_rating` (el campo `activeSeasonScore.percentile` NO cambia, ya lo recalcula la RPC de Task 7):

| Línea | Antes | Después |
|---|---|---|
| 764 | `.filter(s => s.avg_score != null)` | `.filter(s => s.avg_rating != null)` |
| 779 | `s => s.position === scoredPosition && s.avg_score != null` | `s => s.position === scoredPosition && s.avg_rating != null` |
| 856 | `.find(...)?.avg_score ?? null` | `.find(...)?.avg_rating ?? null` |
| 864 | `return avg?.avg_score ?? null` | `return avg?.avg_rating ?? null` |
| 916 | `p.ggScore !== null && p.minutesPlayed >= 300` | `p.rating !== null && p.minutesPlayed >= 300` |
| 919 | `s + (p.ggScore ?? 0)` | `s + (p.rating ?? 0)` |
| 1559 | `.filter(s => s.avg_score != null)` | `.filter(s => s.avg_rating != null)` |
| 1593 | `{s.avg_score != null ? s.avg_score.toFixed(1) : '—'}` | `{s.avg_rating != null ? s.avg_rating.toFixed(1) : '—'}` |
| 1539 | `Score GG` (texto en JSX) | `Rating` |
| 1547 | comentario `/* Sólo Score GG (1-10)... */` | `/* Sólo Rating (1-10)... */` |
| 1563 | `>Sobre el Score GG</h3>` | `>Sobre el Rating</h3>` |
| 1781 | `Su Score GG de <span...>{supabaseAvgScore.toFixed(1)}</span>/10` | `Su Rating de <span...>{supabaseAvgScore.toFixed(1)}</span>/10` |
| 1791 | `Todavía no tiene Score GG calculado.` | `Todavía no tiene Rating calculado.` |
| 1908 | `{activeSeasonScore.avg_score?.toFixed(1)}` | `{activeSeasonScore.avg_rating?.toFixed(1)}` |
| 756 | comentario `Posición sobre la que existe Score GG...` | `Posición sobre la que existe Rating...` |
| 1304 | comentario `{/* HERO: perfil + Score GG */}` | `{/* HERO: perfil + Rating */}` |

Buscar también la variable `supabaseAvgScore` (usada en línea 1781) — si se arma en el mismo archivo leyendo `.avg_score` de algún objeto de score, aplicar el mismo cambio a `.avg_rating` en su definición (`grep -n "supabaseAvgScore" src/pages/PlayerDetailPage.tsx` para ubicarla).

**`SupabasePlayerDetail.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 115 | `return avg?.avg_score ?? null` | `return avg?.avg_rating ?? null` |
| 256 | `score={activeScore?.avg_score ?? null}` | `score={activeScore?.avg_rating ?? null}` |
| 311 | `.sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))` | `.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))` |
| 326-328 | `s.avg_score !== null && ... getScoreColorClass(s.avg_score, '10') ... {s.avg_score.toFixed(1)}` | mismos 3 usos con `s.avg_rating` |
| 371 | `avgScore={activeScore?.avg_score ?? null}` | `avgScore={activeScore?.avg_rating ?? null}` |

**`LinkPlayerModal.tsx`** (tiene su propio tipo local con campo `ggScore`, no depende de `types/index.ts`):

| Línea | Antes | Después |
|---|---|---|
| 21 | `ggScore: number \| null` | `rating: number \| null` |
| 65 | `ggScore: p.primary_score,` | `rating: p.primary_score,` |
| 86 | `ggScore: p.ggScore ?? null,` | `rating: p.rating ?? null,` |
| 219,221-223,225 | `p.ggScore !== null && p.ggScore !== undefined && (... p.ggScore >= 7 ... p.ggScore >= 5 ... p.ggScore >= 3 ... {p.ggScore.toFixed(1)}` | mismos usos reemplazando `p.ggScore` por `p.rating`. **Recalibrar también los cortes 7/5/3** (son de la escala vieja) **a 6.8/6.4/6.0** para consistencia con Task 12-13. |

**`ScoreEvolutionMini.tsx`** (usa `ScoreHistoryRecord.ggScore`, definido en `scoreHistoryService.ts` — hacer ambos archivos en el mismo paso):

`scoreHistoryService.ts`:
| Línea | Antes | Después |
|---|---|---|
| 35 | `ggScore: number` (en la interfaz del batch a guardar) | `rating: number` |
| 61 | `gg_score: s.ggScore,` (mapeo al insert de Supabase) | `gg_score: s.rating,` — **OJO: `gg_score` acá es el nombre de la COLUMNA en la tabla `score_history`, no se toca; solo se renombra `s.ggScore` (el campo del parámetro TS) a `s.rating`.** |

`ScoreEvolutionMini.tsx` — usa `ScoreHistoryEntry` de `src/types/index.ts:280-284` (renombrado ya en Task 11, Step 4: `ggScore: number` → `rating: number`), **no** `ScoreHistoryRecord` de `scoreHistoryService.ts` (son dos tipos distintos e independientes — no confundirlos):

| Línea | Antes | Después |
|---|---|---|
| 14 | `history.filter(entry => entry.ggScore > 0)` | `history.filter(entry => entry.rating > 0)` |
| 20 | `score: entry.ggScore,` | `score: entry.rating,` |
| 26-27 | `validHistory[0].ggScore` / `validHistory[validHistory.length - 1].ggScore` | `validHistory[0].rating` / `validHistory[validHistory.length - 1].rating` |

**`SimilarPlayersCard.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 74 | `const pScore = player.season_scores[0]?.avg_score ?? null` | `const pScore = player.season_scores[0]?.avg_rating ?? null` |

**`SimilarPlayersPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 181 | `<div ...>Score GG</div>` | `<div ...>Rating</div>` |
| 249 | `{/* Score GG */}` | `{/* Rating */}` |

- [ ] **Step 1:** Aplicar todos los reemplazos de arriba, resolviendo primero la ambigüedad de `ScoreEvolutionMini.tsx` (correr el grep indicado y usar el nombre que realmente compila).
- [ ] **Step 2:** `npx tsc --noEmit && npx vitest run`
- [ ] **Step 3:** Chrome MCP: abrir una ficha de jugador con datos (ej. Gianluca Prestianni u otro con muchos partidos), confirmar: el velocímetro dice "Rating", el número coincide con `avg_rating` en Supabase para esa posición/temporada, "Top X%" sigue mostrando un percentil coherente, el gráfico de evolución de partidos sigue graficando (con valores de `rating` crudo, ya no `match_score`).
- [ ] **Step 4:** Commit: `git commit -am "refactor(scoring): Rating en fichas de jugador, similares y evolucion"`

---

### Task 16: Dashboard, Monitoreo y Seguimiento GG

**Files:** `src/pages/DashboardPage.tsx`, `src/pages/MonitoringPage.tsx`, `src/pages/ScoutTrackingGGPage.tsx`, `src/components/dashboard/PortfolioInsights.test.ts`

**`DashboardPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 67 | `const displayScore = score !== undefined ? score : player.ggScore` | `const displayScore = score !== undefined ? score : player.rating` |
| 151-153 | `player.ggScore ? (... player.ggScore ... {player.ggScore.toFixed(1)}` | mismos 3 usos con `player.rating` |
| 175 | comentario `// Cortes del Score GG, que siempre viene 1-10 de la API.` | `// Cortes del Rating, que siempre viene 1-10 de la API.` |
| 176 | `const thresholds = { elite: 8.0, good: 5.5, developing: 3.5 }` | `const thresholds = { elite: 7.3, good: 6.8, developing: 6.4 }` |
| 185 | `p.ggScore !== null` | `p.rating !== null` |
| 189 | comentario `// Score GG por posición...` | `// Rating por posición...` |
| 351 | `p.ggScore != null` | `p.rating != null` |
| 369 | `p.ggScore != null && p.ggScore >= 4` | `p.rating != null && p.rating >= 6.0` (el corte `>= 4` era de la escala vieja — usar el nuevo piso "bajo" de Global Constraints) |
| 377 | `p.ggScore != null && p.hasEnoughData` | `p.rating != null && p.hasEnoughData` |
| 521 | `{/* Score GG por Posición */}` | `{/* Rating por Posición */}` |

**`MonitoringPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 634 | `{/* Score GG */}` | `{/* Rating */}` |
| 733 | comentario `// fetchScoutPlayersWithScores recién ahí resuelve el Score GG/foto/equipo` | `// ...resuelve el Rating/foto/equipo` |

**`ScoutTrackingGGPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 660 | `{/* Score GG (Supabase 1-10) */}` | `{/* Rating (Supabase 1-10) */}` |
| 932 | comentario `// ...resuelve el Score GG/foto/equipo reales...` | `// ...resuelve el Rating/foto/equipo reales...` |

(El nombre de la página/ruta `ScoutTrackingGGPage`/"Seguimiento GG" **no cambia** — "GG" ahí es Doble G, ver Global Constraints.)

**`PortfolioInsights.test.ts:10`:** `ggScore: null, ggScorePercentile: null,` → `rating: null, ratingPercentile: null,`

- [ ] **Step 1:** Aplicar los reemplazos.
- [ ] **Step 2:** `npx tsc --noEmit && npx vitest run src/components/dashboard/PortfolioInsights.test.ts`
- [ ] **Step 3:** Chrome MCP: Panel Interno (Dashboard), Seguimiento Datos y Seguimiento GG — confirmar que los números y textos dicen "Rating" y que los umbrales elite/bueno separan jugadores de forma razonable (no casi todos "elite" ni casi todos "bajo").
- [ ] **Step 4:** Commit: `git commit -am "refactor(scoring): Rating en Dashboard, Monitoreo y Seguimiento GG"`

---

### Task 17: Formaciones, Comparación, Oportunidades, Radar, Dispersión

**Files:** `src/pages/FormationPage.tsx`, `src/services/formationService.ts`, `src/pages/ComparisonPage.tsx`, `src/pages/OpportunitiesPage.tsx`, `src/pages/RadarAnalysisPage.tsx`, `src/pages/ScatterChartPage.tsx`

**`formationService.ts:8`:** `ggScore: number | null` → `rating: number | null` (campo de una interfaz local de "jugador sugerido para la formación").

**`FormationPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 90 | comentario `// ...top por Score GG DE...` | `// ...top por Rating DE...` |
| 245-247 | `p.ggScore !== null && (... getScoreColorClass(p.ggScore, '10') ... {p.ggScore.toFixed(1)}` | mismos 3 usos con `p.rating` |
| 432 | `ggScore: player.primary_score,` | `rating: player.primary_score,` |
| 710-712 | mismos 3 usos que 245-247 pero en otro bloque del render | ídem, `p.rating` |

**`ComparisonPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 324 | `label="Score GG"` | `label="Rating"` |
| 383 | `Score GG: {player.primary_score.toFixed(1)}` | `Rating: {player.primary_score.toFixed(1)}` |

**`OpportunitiesPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 114 | comentario `// Ranking: Score GG reciente + boost...` | `// Ranking: Rating reciente + boost...` |
| 424 | `{/* Score GG reciente */}` | `{/* Rating reciente */}` |

**`RadarAnalysisPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 18 | `{ key: 'ggScore', label: 'GG Score' },` | `{ key: 'rating', label: 'Rating' },` — **este `key` es el nombre de métrica usado como columna en `EnrichedPlayer` (viene de `player['ggScore']` en algún acceso dinámico más abajo, ver Step 1 de este bloque)** |
| 87 | comentario `// Score GG de la API, siempre 1-10...` | `// Rating de la API, siempre 1-10...` |
| 107 | `'ggScore', 'Goles', 'xG', ...` (array de métricas default seleccionadas) | `'rating', 'Goles', 'xG', ...` |
| 973 | `Es el <span...>GG Score</span>, una puntuación propia que resume...` | `Es el <span...>Rating</span>, una puntuación que resume...` (sacar "propia" — ya no es una fórmula propia) |

Antes de reemplazar la línea 18, buscar dónde `METRIC_CATEGORIES`/`ALL_METRICS` se usan para leer el valor dinámico del jugador (ej. `player[metricKey]` o similar) — si el acceso es genérico por string (`player[m.key]`), y `EnrichedPlayer` ya no tiene `ggScore` sino `rating` (Task 11), el string `'ggScore'` como key rompería ese acceso dinámico en silencio (no da error de TypeScript porque probablemente el acceso es a `Record<string, unknown>`, no al tipo `EnrichedPlayer` completo). Verificar con:

```bash
grep -n "player\[.*key\]\|player\[metricKey\]\|\[metric\]" src/pages/RadarAnalysisPage.tsx
```

y confirmar que después de cambiar `'ggScore'` por `'rating'` en `METRIC_CATEGORIES`/el array de default, ese acceso dinámico sigue encontrando el dato (por eso `EnrichedPlayer` spreadea `...player` con todas las columnas crudas del CSV **más** `rating` — el acceso dinámico por string sigue funcionando igual, solo cambió el nombre del string).

**`ScatterChartPage.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 19 | comentario `// Input range recalibrated to 1-10 (Score GG scale)` | `// Input range recalibrated to 1-10 (Rating scale)` — y revisar si el "input range" mencionado en el comentario también necesita el recalibrado 5.5-8.5 de Tasks 12-13 (`grep -n "range\|domain" src/pages/ScatterChartPage.tsx` para ubicar el código real, no solo el comentario, y aplicar el mismo criterio de Task 12 si hay un rango fijo 1-10 hardcodeado para el eje/color de este gráfico). |
| 345 | `<p ...>Score GG</p>` | `<p ...>Rating</p>` |
| 791 | `` `Score GG: ${score.toFixed(1)}` `` | `` `Rating: ${score.toFixed(1)}` `` |

- [ ] **Step 1:** Aplicar todos los reemplazos, incluyendo la verificación del acceso dinámico en `RadarAnalysisPage.tsx` y el posible rango hardcodeado en `ScatterChartPage.tsx`.
- [ ] **Step 2:** `npx tsc --noEmit && npx vitest run`
- [ ] **Step 3:** Chrome MCP: Formaciones (armar un XI y ver el número en cada jugador), Comparación (comparar 2 jugadores), Oportunidades, Gráfico de Dispersión (confirmar que el eje/color de "Score GG" ahora distribuye visualmente bien con el rango real del rating, no amontonado en una esquina).
- [ ] **Step 4:** Commit: `git commit -am "refactor(scoring): Rating en Formaciones, Comparacion, Oportunidades, Radar y Dispersion"`

---

### Task 18: PDF y chat IA

**Files:** `src/utils/pdfExport.ts`, `src/components/pdf/AnalisisCompletoPDF.tsx`, `src/components/chat/AIAnalystChat.tsx`, `src/components/ui/ExportPDFModal.tsx`

**`pdfExport.ts`:**

| Línea | Antes | Después |
|---|---|---|
| 83 | comentario `// Cortes sobre el Score GG (1-10).` | `// Cortes sobre el Rating (1-10).` |
| 651 | `pdf.scoreGauge(player.ggScore, positionAverageScore)` | `pdf.scoreGauge(player.rating, positionAverageScore)` |

Revisar también `scoreColor`/`scoreLabel` (líneas 84-93 aprox, mencionadas en la exploración) — si tienen cortes hardcodeados en escala 1-10 (probablemente 8.0/7.0/5.5/4.0 o similar, mismo patrón que `GaugeScore.tsx`), aplicar el mismo recalibrado de Task 13 (7.3/6.8/6.4/6.0). Confirmar con:

```bash
sed -n '80,95p' src/utils/pdfExport.ts
```
y ajustar los números de corte que aparezcan ahí al mismo criterio de Global Constraints.

**`AnalisisCompletoPDF.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 478 | `<Text ...>Score GG</Text>` | `<Text ...>Rating</Text>` |
| 592-596 | `player.ggScore != null && (... scoreColor(player.ggScore) ... {player.ggScore.toFixed(1)} ... scoreLabel(player.ggScore)` | mismos usos con `player.rating` |
| 602 | `leagueContext && player.ggScore != null` | `leagueContext && player.rating != null` |
| 614 | `player.ggScore != null ? ... player.ggScore > leagueContext.avg ... player.ggScore - leagueContext.avg ...` | mismos usos con `player.rating` |

**`AIAnalystChat.tsx`:**

| Línea | Antes | Después |
|---|---|---|
| 36 | `{ text: '¿Qué es el Score GG?', category: 'help' },` | `{ text: '¿Qué es el Rating?', category: 'help' },` |
| 63-65 | `` 'score_gg': `**¿Qué es el Score GG?**\n\nEl **Score GG** es una puntuación de 0-100 que calcula el rendimiento general del jugador según su posición.` `` | reemplazar por una explicación fiel al nuevo mecanismo — ver Step 1 abajo |
| 139 | `📊 **Explicarte métricas** - Score GG, radar, percentiles` | `📊 **Explicarte métricas** - Rating, radar, percentiles` |
| 167 | comentario `// Score GG` | `// Rating` |
| 346 | `(p.ggScore ?? 0) >= criteria.minScore!` | `(p.rating ?? 0) >= criteria.minScore!` |
| 362-363 | comentario `// Sort by ggScore...` + `(b.ggScore ?? 0) - (a.ggScore ?? 0)` | `// Sort by rating...` + `(b.rating ?? 0) - (a.rating ?? 0)` |
| 422-423 | `` `Filtré jugadores con Score GG ${criteria.minScore}+...` `` + `` `El Score GG considera todas las métricas importantes de su posición.\n\n` `` | reemplazar "Score GG" por "Rating" en ambas, y en la segunda ajustar el texto: "El Rating es el promedio de calificación del proveedor de datos (Sofascore/API-Football) en la temporada." (ya no "considera todas las métricas", porque dejó de ser una fórmula propia) |
| 425 | `` `📊 **Ordenados por Score GG**\n` `` | `` `📊 **Ordenados por Rating**\n` `` |
| 457 | `...📊 **Entender métricas** como Score GG, radar, etc...` | `...📊 **Entender métricas** como Rating, radar, etc...` |

- [ ] **Step 1:** Para el bloque `score_gg` (líneas 63-65), reemplazar el texto completo de la respuesta del chat por algo fiel al nuevo mecanismo, por ejemplo:

```ts
  'score_gg': `**¿Qué es el Rating?**

El **Rating** es el promedio de calificación por partido que calculan Sofascore/API-Football, en escala 1-10. Es el mismo dato que usan esas plataformas — la agencia no le aplica ninguna fórmula propia encima.`,
```

(Si la clave del objeto `'score_gg'` se usa como identificador interno en otro lado del chat — ej. detección de intención por keyword — dejar la clave tal cual está, solo cambia el texto de la respuesta; verificar con `grep -n "'score_gg'" src/components/chat/AIAnalystChat.tsx` antes de decidir si conviene renombrar también la clave.)

**`ExportPDFModal.tsx:44`:** `description: 'Foto, nombre, equipo, edad, posición y Score GG',` → `description: 'Foto, nombre, equipo, edad, posición y Rating',`

- [ ] **Step 2:** Aplicar todos los reemplazos.
- [ ] **Step 3:** `npx tsc --noEmit && npx vitest run`
- [ ] **Step 4:** Chrome MCP: exportar un PDF de Análisis Completo real y confirmar que dice "Rating" y el número/color coincide con la ficha; probar en el chat IA preguntando "¿Qué es el Score GG?" (o "Rating") y "ordename por score" para confirmar que sigue filtrando/ordenando bien.
- [ ] **Step 5:** Commit: `git commit -am "refactor(scoring): Rating en PDF y chat IA"`

---

### Task 19: Entrenadores (Plantel futuro)

**Files:** `src/features/coaches/components/CoachFutureSquadTab.tsx`, `src/features/coaches/components/FutureSquadPitch.tsx`, `src/features/coaches/components/FutureSquadPlayerPicker.tsx`, `src/features/coaches/components/TeamRosterPanel.tsx`, `src/services/futureSquadService.ts`, `src/features/coaches/futureSquadPrefill.ts`, `src/features/coaches/futureSquadPrefill.test.ts`, `src/features/coaches/manualExternalPlayer.ts`, `src/features/coaches/manualExternalPlayer.test.ts`, `src/services/coachService.ts`

Todos estos archivos usan `ggScore: number | null` como campo de una interfaz local de "slot"/"jugador candidato" (no `EnrichedPlayer`) — mismo criterio: renombrar a `rating`.

- [ ] **Step 1:** Reemplazo mecánico en los 8 archivos:

```bash
for f in \
  src/features/coaches/components/CoachFutureSquadTab.tsx \
  src/features/coaches/components/FutureSquadPitch.tsx \
  src/services/futureSquadService.ts \
  src/features/coaches/futureSquadPrefill.ts \
  src/features/coaches/futureSquadPrefill.test.ts \
  src/features/coaches/manualExternalPlayer.ts \
  src/features/coaches/manualExternalPlayer.test.ts \
; do
  sed -i 's/ggScore/rating/g' "$f"
done
```

- [ ] **Step 2:** En `manualExternalPlayer.ts:22`, el parámetro de la función también se renombra (el `sed` ya lo cubre): `export function manualExternalToEnriched(row: ManualExternalPlayerRow, rating: number | null): EnrichedPlayer`.

- [ ] **Step 3:** Comentarios de texto (no cubiertos por el `sed` de campo porque no dicen `ggScore` sino "Score GG"):

| Archivo | Línea | Antes | Después |
|---|---|---|---|
| `TeamRosterPanel.tsx` | 52 | comentario `- \`supabase\`: el jugador ya tiene fila real en \`players\` (Score GG, historial,` | `...(Rating, historial,` |
| `FutureSquadPlayerPicker.tsx` | 69 | comentario `// Score GG del plantel actual -- consulta acotada por equipo...` | `// Rating del plantel actual -- consulta acotada por equipo...` |
| `coachService.ts` | 250 | comentario `...un entrenador linkee a la ficha rica (Score GG, historial, transfers)...` | `...(Rating, historial, transfers)...` |

- [ ] **Step 4:** `npx tsc --noEmit && npx vitest run`
- [ ] **Step 5:** Chrome MCP: entrar a un DT, pestaña Plantel futuro, arrastrar un candidato y confirmar que el número que muestra es el rating correcto.
- [ ] **Step 6:** Commit: `git commit -am "refactor(scoring): Rating en Plantel futuro de Entrenadores"`

---

### Task 20: Informes

**Files:** `src/features/informes/components/Step1Archivo.tsx`, `src/features/informes/components/Step2Metricas.tsx`, `src/features/informes/components/Step3Contenido.tsx`, `src/features/informes/types.ts`, `src/features/informes/i18n.ts`, `src/features/informes/chartData.ts`, `src/features/informes/insights/text.ts`, `src/features/informes/insights/compute.test.ts`, `src/features/informes/exportInformeHTML.test.ts`

**`Step1Archivo.tsx:243-245`:**

```ts
    // Rating: autocompletar desde el rating del jugador si el campo está vacío.
    const rating = p.primary_score ?? p.season_scores?.[0]?.avg_rating ?? null
    const ratingFromGG = rating != null ? String(Math.round(rating * 10) / 10) : ''
```

(el nombre de variable `ratingFromGG` puede quedar así o renombrarse a `ratingFromApi` — usar `ratingFromApi` para no dejar "GG" colgado sin sentido; revisar sus 1-2 usos más abajo en el mismo archivo con `grep -n "ratingFromGG" src/features/informes/components/Step1Archivo.tsx` y renombrarlos igual).

**`Step2Metricas.tsx:203`:** `...bajo el Score GG, comparando...` → `...bajo el Rating, comparando...`

**`Step3Contenido.tsx:166,201`:**
- `label="No mostrar el rating (Score GG) en este informe"` → `label="No mostrar el Rating en este informe"`
- `label="Ocultar Evolución de nivel (Score GG) y su “Cómo leerlo”"` → `label="Ocultar Evolución de nivel (Rating) y su “Cómo leerlo”"`

**`types.ts:67,70,100`:**
- `hideRating?: boolean  // no mostrar el rating (Score GG) en ningún lado del informe` → `// no mostrar el Rating en ningún lado del informe`
- `hideLevelEvo?: boolean  // General: sacar "Evolución de nivel (Score GG)"...` → `// General: sacar "Evolución de nivel (Rating)"...`
- `dbPercentile?: number  // percentil del Score GG dentro de su posición...` → `// percentil del Rating dentro de su posición...`

**`i18n.ts`** — reemplazar "Score GG"/"GG Score" por "Rating" en las 6 entradas de arrays multi-idioma (`t_levelEvo`, el texto de `imp_...` en líneas 163-168, `imp_tile_score` línea 248, línea 273-274 omitidas por el grep — revisar con `sed -n '270,300p' src/features/informes/i18n.ts`, `imp_rend_promedio` línea 294, `imp_rend_percentil` línea 300). Cada entrada es un array de 6 strings (uno por idioma soportado en Informes — confirmar cuántos son con `grep -n "^const LANGS\|LANG_COUNT" src/features/informes/i18n.ts` antes de asumir 6) — reemplazar "Score GG" por el equivalente de "Rating" en CADA idioma del array, no solo en español. Los idiomas no-español ya dicen básicamente "Rating"/"nota"/"pontuação" etc combinado con "Score GG" — sacar únicamente el token "Score GG"/"GG Score" y dejar "Rating" (en inglés ya queda perfecto tal cual, ej. "Level evolution (GG Score)" → "Level evolution (Rating)").

**`chartData.ts:245`:** comentario `/** Escala automática del gauge: ≤10 → sobre 10 (tipo partido); si no, sobre 100 (Score GG). */` → `...si no, sobre 100 (Rating). */`

**`insights/text.ts:31`:** comentario `* "7 de Score GG" se lee como un conteo, no como una media.` → `* "7 de Rating" se lee como un conteo, no como una media.`

**Tests** (`insights/compute.test.ts:257`, `exportInformeHTML.test.ts:289,293`): son nombres de test (`it('promedia el Score GG...')`) y aserciones de texto renderizado (`expect(visible).toContain('Evolución de nivel (Score GG)')`) — cambiar el string a `'Evolución de nivel (Rating)'` en la aserción **solo después de** haber hecho el cambio real en `Step3Contenido.tsx` (si no, el test queda buscando un texto que el componente ya no imprime, y falla por la razón correcta pero en el orden equivocado — hacer este task completo de una sola pasada evita ese problema).

- [ ] **Step 1:** Aplicar todos los reemplazos de arriba.
- [ ] **Step 2:** `npx tsc --noEmit && npx vitest run src/features/informes`
- [ ] **Step 3:** Chrome MCP: armar un informe de prueba, pasar por Step1 (confirmar que el campo rating se autocompleta), Step2 (texto de comparación vs liga), Step3 (checkbox de ocultar rating/evolución), Step4 (preview final) — confirmar que en ningún lado quedó "Score GG" visible.
- [ ] **Step 4:** Commit: `git commit -am "refactor(scoring): Rating en Informes"`

---

### Task 21: Traducciones (9 idiomas)

**Files:** `src/constants/translations.ts`

9 keys × 9 idiomas (es, en, tr, it, fr, de, ar, zh, ja) = 63 valores a tocar. Reemplazar el token "Score GG"/"GG Score" por el equivalente de "Rating" en cada idioma, dejando el resto de la oración igual. Las keys son las mismas en los 9 bloques:

- `informesStep2.comparacionVsLigaDesc`
- `informesStep3.noMostrarRating`
- `informesStep3.ocultarEvoNivel`
- `oportunidades.jugadoresEnAlza`
- `oportunidades.scoreGGpj`
- `dispersion.colorScoreGG`
- `dispersion.scoreGGLabel`
- `dispersion.reporteDescripcion`
- `dispersion.analisisColorVerde`
- `dashboard.scoreGGPorPosicion`
- `seguimiento.colScoreGG`

(Nota: son 11 keys, no 9 — corregido de la cuenta inicial. `dispersion.scoreGGLabel`, `dashboard.scoreGGPorPosicion` y `seguimiento.colScoreGG` tienen "ScoreGG" en el nombre de la KEY misma, no solo en el valor — **no renombrar las keys** en este task, solo los valores de texto: renombrar una key usada en 9 idiomas + los componentes que la llaman (`t('dashboard.scoreGGPorPosicion')`, etc.) es más riesgo que beneficio para este plan — el nombre interno de la key no es visible al usuario. Si más adelante se quiere prolijidad total en los nombres de key, es un cambio aparte.)

Valores concretos a reemplazar (uno por idioma, tomados literal del archivo actual):

| Idioma | Key | Antes | Después |
|---|---|---|---|
| es | `informesStep2.comparacionVsLigaDesc` | `...bajo el Score GG, comparando...` | `...bajo el Rating, comparando...` |
| es | `informesStep3.noMostrarRating` | `No mostrar el rating (Score GG) en este informe` | `No mostrar el Rating en este informe` |
| es | `informesStep3.ocultarEvoNivel` | `Ocultar Evolución de nivel (Score GG) y su "Cómo leerlo"` | `Ocultar Evolución de nivel (Rating) y su "Cómo leerlo"` |
| es | `oportunidades.jugadoresEnAlza` | `{count} jugadores en alza · ranking por Score GG reciente` | `{count} jugadores en alza · ranking por Rating reciente` |
| es | `oportunidades.scoreGGpj` | `Score GG · {count} PJ` | `Rating · {count} PJ` |
| es | `dispersion.colorScoreGG` | `Color: Score GG (1-10) \| {count} jugadores analizados` | `Color: Rating (1-10) \| {count} jugadores analizados` |
| es | `dispersion.scoreGGLabel` | `Score GG:` | `Rating:` |
| es | `dispersion.reporteDescripcion` | `Gráfico de dispersión con {count} jugadores. Color por Score GG.` | `...Color por Rating.` |
| es | `dispersion.analisisColorVerde` | `El color verde indica mayor Score GG.` | `El color verde indica mayor Rating.` |
| es | `dashboard.scoreGGPorPosicion` | `Score GG por Posición` | `Rating por Posición` |
| es | `seguimiento.colScoreGG` | `Score GG` | `Rating` |
| en | (mismas keys) | `...Score GG...` (9 variantes en inglés) | reemplazar cada "Score GG" por `Rating` (el inglés no necesita reformular nada, "Score GG" es literal en todas) |
| tr | (mismas keys) | `...Score GG...` | `...Rating...` (mismo criterio — el resto de la oración en turco queda igual) |
| it | (mismas keys) | `...Score GG...` | `...Rating...` |
| fr | (mismas keys) | `...Score GG...` | `...Rating...` |
| de | (mismas keys) | `...Score GG...` | `...Rating...` |
| ar | (mismas keys) | `...Score GG...` | `...Rating...` (dejar el resto del texto en árabe intacto, solo sustituir el token latino) |
| zh | (mismas keys) | `...Score GG...` | `...Rating...` |
| ja | (mismas keys) | `...Score GG...` | `...Rating...` |

- [ ] **Step 1:** Dado que el token a reemplazar es literalmente el string `Score GG` en las 11 keys × 9 idiomas, y el reemplazo es siempre `Rating` sin importar el idioma circundante (queda como palabra en inglés/genérica dentro de cualquier idioma, igual que ya pasa con nombres de producto), aplicar un reemplazo global de texto **acotado a los valores, no a las keys**:

```bash
sed -i "s/Score GG/Rating/g; s/GG Score/Rating/g" src/constants/translations.ts
```

Esto es seguro en este archivo puntual porque: (a) las keys mismas (`scoreGGpj`, `colScoreGG`, etc.) usan `scoreGG`/`ScoreGG` en minúscula/PascalCase sin espacio, nunca `Score GG` con espacio — el `sed` no las toca; (b) se verificó arriba que TODAS las 168 líneas que contienen el string `Score GG`/`GG Score` en este archivo son valores de traducción, no código.

- [ ] **Step 2:** Verificar que no quedó ningún residuo y que las keys siguen intactas:

```bash
grep -c "Score GG\|GG Score" src/constants/translations.ts   # debe dar 0
grep -c "scoreGGpj\|colScoreGG\|scoreGGPorPosicion\|colorScoreGG\|scoreGGLabel" src/constants/translations.ts   # debe seguir dando el mismo numero de antes (9, una por idioma, x5 keys = 45)
```

- [ ] **Step 3:** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 4:** Chrome MCP: cambiar el idioma de la app a inglés y turco (los dos más fáciles de leer/verificar) y confirmar visualmente que Dispersión, Oportunidades, Seguimiento y el Dashboard dicen "Rating" y no "Score GG" ni una key cruda sin traducir.

- [ ] **Step 5:** Commit: `git commit -am "refactor(i18n): Score GG -> Rating en las 9 traducciones"`

---

### Task 22: Barrido final, verificación y cierre

**Files:** ninguno nuevo — solo verificación + memoria.

- [ ] **Step 1:** Grep final de residuales en TODO el repo (código, no solo los archivos de este plan — puede haber quedado algo fuera de la lista original si el grep de reconocimiento no lo agarró):

```bash
grep -rn "ggScore\|GGScore\|applyScoreGG\|ScoreGGEntry\|Score GG\|GG Score" src/ supabase/functions/ --include="*.ts" --include="*.tsx"
```

Debe devolver **cero** resultados. Si aparece algo, es una omisión del plan — arreglarlo ahí mismo (mismo criterio de las Tasks 14-20: renombrar el campo/texto, typecheck, test, commit aparte con mensaje `fix(scoring): residual de Score GG en <archivo>`).

```bash
grep -rn "\.avg_score\b" src/ --include="*.ts" --include="*.tsx"
```

Debe devolver **cero** resultados (todo lector de `avg_score` tuvo que pasar a `avg_rating` en Tasks 9-20; los únicos usos de la palabra `avg_score` que deben quedar son la DECLARACIÓN del campo en `src/types/scoring.ts:43,138` y en `supabase/functions/_shared/types.ts` si existiera ahí — nunca una lectura `.avg_score`).

```bash
grep -rln "calculateMatchScore\|calculateSeasonScore\|SCORING_WEIGHTS\|_shared/scoring" supabase/
```

Debe devolver **cero** resultados.

- [ ] **Step 2:** Typecheck y test suite completos:

```bash
npx tsc --noEmit
npx vitest run
```

Ambos en verde. Los únicos fallos esperables son los 4 preexistentes de `opportunities.test.ts` (flaky por `Date.now()`, documentado, no relacionado a este trabajo) — si aparece cualquier otro fallo, es una regresión real de este plan, no seguir hasta resolverla.

- [ ] **Step 3:** Verificación visual final en Chrome MCP recorriendo, en orden, las páginas que NO tuvieron su propio Chrome-check dedicado en una task anterior (si alguna quedó sin mirar): Panel Interno, Scout Externo, Scout Interno, Seguimiento GG, Seguimiento Datos, Mercado (no debería estar afectado, pero confirmar que no muestra nada relacionado a score), Comparación, Oportunidades, Formaciones, un Informe completo, un PDF exportado, Entrenadores → Plantel futuro.

- [ ] **Step 4:** Actualizar la memoria del proyecto — la memoria `feedback_score_gg_name` decía "Score GG es la marca del scoring, nunca renombrarlo en la UI"; esa instrucción quedó **superada explícitamente** por la decisión de este plan (ver spec, sección 4). Reescribir esa memoria:

```markdown
---
name: feedback-score-gg-name
description: "SUPERADA 2026-09-01: Score GG se eliminó, ahora es 'Rating' (rating crudo del proveedor) en toda la plataforma"
metadata:
  type: feedback
---

Hasta el 2026-08-XX "Score GG" era la marca del scoring propio y nunca se
renombraba. El 2026-09-01 el usuario decidió eliminar el cálculo ponderado
por completo y usar el rating crudo de Sofascore/API-Football como número
principal, renombrado a "Rating" en toda la UI (ver
docs/superpowers/specs/2026-09-01-rating-reemplaza-score-gg-design.md y
docs/superpowers/plans/2026-09-01-rating-reemplaza-score-gg.md).

**How to apply:** si en el futuro se menciona "Score GG", es una referencia
histórica — el nombre correcto ahora es "Rating". No revertir a "Score GG"
sin que el usuario lo pida explícitamente.
```

(Guardar en el mismo path de memoria que ya existe para `feedback_score_gg_name.md`, y agregar una línea nueva a `MEMORY.md` si el índice no se actualiza solo.)

- [ ] **Step 5:** Commit final (si quedó algo suelto de los Steps 1/3):

```bash
git add -A
git commit -m "chore(scoring): barrido final Score GG -> Rating, memoria actualizada"
```

No hacer `git push` — commitear localmente y avisar al usuario que está listo para revisar antes de publicar (ver preferencia registrada: no pushear sin que el usuario lo pida explícitamente).
