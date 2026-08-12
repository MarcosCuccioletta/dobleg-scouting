# Motor de scoring: fragmentación por competencia + posiciones adivinadas en cambios

## Contexto

El usuario reportó, sobre la ficha de un jugador de Scouting Externo, cuatro síntomas que resultaron tener la misma causa raíz en dos bugs concretos del motor de scoring (Supabase, `player_season_scores` / `player_match_stats`), más un tercer síntoma en Informes cuyo mecanismo exacto no se pudo confirmar sin reproducirlo en vivo:

1. "Posiciones" muestra un jugador con 28% de partidos como DEL cuando nunca jugó de delantero.
2. "Score por posición" muestra dos filas con la misma etiqueta ("EXT 6 PJ 6.1" y "EXT 7 PJ 5.4") en vez de una sola.
3. "Historial de partidos" muestra muchos menos partidos de los que el jugador realmente jugó, y los más recientes faltan.
4. El Score GG principal de la ficha a veces muestra un número visiblemente bajo para un jugador de nivel alto.
5. (Informes) El rating auto-completado al armar un informe de Julián Palacios mostró 5.9, cuando su Score GG real (visible en Scouting Interno) es 7.1.

Investigación empírica contra datos reales de producción (vía anon key, solo lectura):

- **Síntomas 1 y 3 confirmados con Santiago Montiel (Independiente, id 265973).** Sus últimos 25 partidos en `player_match_stats` muestran un patrón clarísimo: **todas** sus apariciones marcadas `DEL` son entradas de banco de pocos minutos (15, 15, 19, 26, 30, 38, 66 min); **todas** sus apariciones como titular con casi todo el partido (49-90 min) están bien marcadas `EXT`/`VI`. La causa: `sync-player-stats/index.ts` resuelve la posición de cada partido con `mapGridToPosition(formation, grid)` (usa la grilla táctica real, correcta cuando hay dato) y, si no hay grid — típico en suplentes que entran desde el banco, donde API-Football no publica una casilla de formación — cae a `fallbackPosition(stats.games.position)`, que para el código genérico `'F'` (Forward) de API-Football devuelve siempre `'DEL'` sin importar si el jugador es realmente extremo. `position-mapper.ts` en sí (la lógica de grilla) está bien: el problema es específicamente el adivine a ciegas cuando no hay grilla.
- **Síntomas 2 y 4 confirmados leyendo `recalc-scores/index.ts` línea por línea.** La función agrupa los partidos de un jugador por posición **dentro de cada liga/competencia por separado** (bucle `for (const league of leaguesForSeason)`), y aunque después consolida a cada jugador en su posición primaria (`bestPos`, la de más partidos), esa consolidación solo compara el **string de posición**, no fusiona las filas: si un jugador jugó de EXT tanto en la liga doméstica como en una copa esa temporada, quedan **dos filas separadas** con la misma posición pero distinto `matches_played`/`avg_score` (`player_season_scores` tiene PK `(player_id, season, position, league_id)` — el `league_id` extra es justamente lo que permite la duplicación). Ningún punto de lectura (ficha, Informes) las fusiona; cada uno elige "una" de las dos según el orden en que Postgres las devuelve, sin garantía de elegir la mejor.
- **Síntoma 5 investigado con los datos reales de Julián Palacios (id 167652) y no se pudo confirmar el mecanismo.** Sus dos filas en `player_season_scores` son `(2026, VI, 18 PJ, 7.1)` y `(2025, VC, 9 PJ, 4.0)`. El RPC `fetch_players_list` (ya corregido en una auditoría previa del 2026-08-01) prioriza la fila que coincide con `primary_position` (`VI`), así que **hoy** elegiría correctamente 7.1 — no 5.9 ni 4.0. El auto-completado del rating en Informes (`Step1Archivo.tsx: selectDbPlayer`) usa ese mismo RPC, así que con los datos actuales debería auto-completar 7.1. El 5.9 no coincide con ninguna fila real del jugador, lo que sugiere que vino de otro lugar: la tabla "últimos 5 partidos" de Informes (`useInformeEnrichment.ts`) sí usa un dato distinto — el rating crudo de un partido puntual de API-Football (`player_match_stats.rating`), no el Score GG — y es candidato a haberse confundido visualmente con "el rating". No se descarta tampoco que el informe se haya armado antes de que la fila 2026/VI existiera. Este punto se audita en vivo durante la implementación (Tarea final de este plan) en vez de asumir una causa.

## Alcance

Este arreglo toca **solo** el pipeline de scoring basado en API-Football/Supabase (`player_match_stats`, `player_season_scores`, las Edge Functions `sync-player-stats` y `recalc-scores`), que alimenta Scouting Externo, Búsqueda de Talento e Informes. **No toca** el scoring de Scouting Interno (Google Sheets/CSV, `src/utils/scoring.ts` vía `DataContext.tsx`), que es un sistema completamente separado y que el propio usuario confirmó que ya muestra el número correcto.

## 1. Fusionar fragmentos de score por competencia

**Dónde (ACTUALIZADO durante la implementación, ver nota abajo):** `supabase/functions/recalc-scores/index.ts`, sobre `allSeasonRows` **antes** de calcular `bestPos`/`primaryRows` — no después, como decía la primera versión de esta spec.

> **Nota post-implementación (Tarea 4, revisión de rama):** la primera versión de este documento fusionaba fragmentos recién en `primaryRows`, DESPUÉS de que `bestPos` ya hubiera elegido la posición primaria de cada jugador comparando fragmentos individuales sin sumar. Un jugador con 6+7 partidos de EXT repartidos en dos ligas (13 en total) podía perder su posición primaria real frente a una posición distinta con un solo fragmento más grande (ej. 8 partidos de DEL en una tercera competencia) — el mismo bug de fragmentación, pero afectando qué posición se elige, no solo qué fila se muestra. Se corrigió fusionando `allSeasonRows` completo ANTES de `bestPos`, así la comparación de posiciones ya ve el total real por posición. El código de fusión en sí (más abajo) no cambió, solo el momento en que se llama.

Hoy `allSeasonRows` puede contener más de una fila por `player_id + position` (una por cada `league_id` en la que jugó esa posición esa temporada). Se agrega un paso de fusión que las colapsa en una sola fila **antes** de elegir la posición primaria y de rankear (`calculateSeasonScores`), promediando cada métrica numérica ponderada por `matches_played` (no solo `avg_score`: también los p90/pct que ya vienen calculados por fila, para que el resto de la ficha — radar, etc. — quede consistente):

```ts
// Fusionar fragmentos: un jugador puede tener más de una fila de la misma
// posición-primaria si jugó esa posición en más de una liga/competencia esta
// temporada (liga doméstica + copa, por ejemplo). Sin este paso quedan dos
// filas "iguales" (mismo player_id+position) con distinto avg_score/matches_played.
const NUMERIC_FIELDS = [
  'avg_score', 'avg_rating', 'tackles_p90', 'interceptions_p90', 'blocks_p90',
  'duels_won_pct', 'passes_accuracy', 'passes_key_p90', 'passes_total_p90',
  'dribbles_success_p90', 'dribbles_pct', 'shots_on_p90', 'shots_pct',
  'goals_p90', 'assists_p90', 'fouls_drawn_p90', 'saves_p90',
  'goals_conceded_p90', 'penalty_saved_avg', 'clean_sheet_pct',
];

const fragmentsByKey = new Map<string, any[]>();
for (const r of primaryRows) {
  const key = `${r.player_id}|${r.position}`;
  if (!fragmentsByKey.has(key)) fragmentsByKey.set(key, []);
  fragmentsByKey.get(key)!.push(r);
}

const mergedPrimaryRows: any[] = [];
for (const fragments of fragmentsByKey.values()) {
  if (fragments.length === 1) { mergedPrimaryRows.push(fragments[0]); continue; }

  const totalMatches = fragments.reduce((s, f) => s + (f.matches_played ?? 0), 0);
  const weightedAvg = (field: string) => {
    if (totalMatches === 0) return null;
    const weighted = fragments.reduce((s, f) => s + (f[field] ?? 0) * (f.matches_played ?? 0), 0);
    return Math.round((weighted / totalMatches) * 100) / 100;
  };
  // La liga con más partidos queda como league_id de referencia (informativo:
  // ya no forma parte de la clave única, ver migración más abajo).
  const mainFragment = [...fragments].sort((a, b) => (b.matches_played ?? 0) - (a.matches_played ?? 0))[0];

  mergedPrimaryRows.push({
    ...mainFragment,
    matches_played: totalMatches,
    total_goals: fragments.reduce((s, f) => s + (f.total_goals ?? 0), 0),
    total_assists: fragments.reduce((s, f) => s + (f.total_assists ?? 0), 0),
    ...Object.fromEntries(NUMERIC_FIELDS.map(f => [f, weightedAvg(f)])),
  });
}
```

El resto de la función (`byPos`, `calculateSeasonScores`, el upsert final) pasa a usar `mergedPrimaryRows` en vez de `primaryRows`. `calculateSeasonScores` no depende de `league_id` (confirmado leyendo `_shared/scoring.ts`), así que rankear sobre filas ya fusionadas es seguro y da un ranking más justo (compara el rendimiento combinado real del jugador, no un fragmento).

**Migración de esquema** (nueva, `supabase/migrations/20260811_merge_season_score_fragments.sql`): la clave primaria de `player_season_scores` pasa de `(player_id, season, position, league_id)` a `(player_id, season, position)`. `league_id` se conserva como columna informativa (ya no es NOT NULL para la unicidad, sigue existiendo con el valor de la liga principal). Antes de angostar la clave hay que dejar como máximo una fila por `(player_id, season, position)` para no chocar con la nueva restricción — se conserva la fila con más partidos de cada grupo (el próximo `recalc-scores`, automático cada 6h, la recalcula bien de todas formas):

```sql
DELETE FROM public.player_season_scores t
WHERE ctid NOT IN (
  SELECT DISTINCT ON (player_id, season, position) ctid
  FROM public.player_season_scores
  ORDER BY player_id, season, position, matches_played DESC
);

ALTER TABLE public.player_season_scores DROP CONSTRAINT player_season_scores_pkey;
ALTER TABLE public.player_season_scores ADD PRIMARY KEY (player_id, season, position);
```

Y el upsert final en `recalc-scores/index.ts` cambia su `onConflict` de `'player_id,season,position,league_id'` a `'player_id,season,position'`.

**Efecto:** "Score por posición" deja de mostrar filas duplicadas para la misma posición; el Score GG principal de la ficha (que hoy elige "una" fila con `.find(s => s.position === activePosition)`, código ya existente en `SupabasePlayerDetail.tsx`/`PlayerDetailPage.tsx`, sin cambios necesarios ahí) pasa a encontrar una única fila combinada y correcta.

## 2. No adivinar la posición cuando no hay dato de grilla

**Dónde:** nueva función SQL `backfill_ungridded_positions()` (migración `supabase/migrations/20260811_backfill_ungridded_positions.sql`), invocada desde `recalc-scores/index.ts` al principio de cada corrida (antes del cálculo de temporada, para que la corrección alimente tanto la distribución de posiciones como los scores de esa misma corrida).

`sync-player-stats/index.ts` **no cambia** — sigue guardando su mejor estimación por partido tal como hoy (incluido el fallback a ciegas cuando no hay grilla). La corrección se aplica después, en base a lo que el jugador demuestra en sus partidos con grilla confirmada: cada fila de `player_match_stats` ya guarda `grid_position` (la grilla cruda de ese partido específico, `NULL` cuando no hubo dato y por lo tanto se usó el fallback). Se corrige retroactiva y continuamente cualquier fila sin grilla, reemplazando su `detected_position` adivinado por la posición mayoritaria del jugador entre sus partidos **con** grilla confirmada:

```sql
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

Notas:
- Solo toca filas sin grilla (`grid_position IS NULL`) — nunca sobreescribe una posición que sí vino de la grilla real.
- Usa la mayoría histórica completa del jugador (no por temporada) como mejor estimación disponible — su posición real no suele cambiar de una temporada a otra.
- Un jugador sin ningún partido con grilla confirmada (nunca titular, o liga sin datos de alineación) no tiene `grid_majority` y sus filas quedan como están hoy (no hay nada mejor con qué corregirlas).
- Arquero no necesita este tratamiento (`G → ARQ` es siempre inequívoco), pero tampoco lo rompe: si por algún motivo hubiera una fila `ARQ` sin grilla, se "corregiría" a la mayoría del jugador, que para un arquero también será `ARQ`.

**Efecto:** el jugador que entra de cambio deja de aparecer adivinado como delantero — pasa a contar en su posición real, tanto en el % de "Posiciones" como (al ya no quedar filtrado afuera por `detected_position` en `usePlayerMatchHistory`) en "Historial de partidos", que hoy filtra estrictamente por una sola posición detectada.

## 3. Informes: auditoría en vivo antes de tocar código

No se escribe un fix a ciegas para el síntoma 5. Como tarea del plan de implementación, se reproduce el flujo real en el navegador (`npm run dev`) armando/revisando un informe de Julián Palacios después de aplicar los puntos 1 y 2, comparando:
- El valor auto-completado al elegir el jugador en Step1 (`ratingFromGG`, debería ser 7.1).
- El contenido de la tabla "últimos 5 partidos" (rating crudo de partido, campo distinto — confirmar que no se esté mostrando/confundiendo como si fuera el Score GG en el PDF final).

Si se confirma que la tabla de últimos partidos se presenta de forma ambigua (por ejemplo, sin dejar claro que es un rating de partido y no el Score GG), se le agrega una aclaración visual (etiqueta, tooltip, o encabezado de columna más explícito) — cambio menor y de scope pequeño. Si en cambio se confirma que el problema fue un informe armado antes de que el score actual existiera, no hace falta cambio de código: es dato ya guardado en ese informe puntual, editable a mano por el usuario.

## Testing

- `position-mapper.test.ts` (existente): sin cambios, la lógica de grilla no se toca.
- Nuevo test unitario o de integración liviano para la función de fusión de fragmentos (punto 1): dado un array de filas con el mismo `player_id+position` y distinto `league_id`/`matches_played`/`avg_score`, verifica que el resultado sea una sola fila con `matches_played` sumado y `avg_score` como promedio ponderado correcto (caso de ejemplo: fragmento A 6 PJ/6.1, fragmento B 7 PJ/5.4 → esperado 13 PJ, avg_score ≈ (6·6.1 + 7·5.4)/13 ≈ 5.72).
- Verificación manual post-deploy con Santiago Montiel (posición e historial) y con al menos un jugador real que tenga fragmentos multi-liga confirmados en la base (a identificar durante la implementación con una consulta de auditoría, mismo método usado en esta investigación).
- Correr `recalc-scores` manualmente contra producción (vía su URL de función) después de aplicar las migraciones, y confirmar en `sync_log` que terminó con `status: 'success'` antes de dar el trabajo por hecho — no depender de esperar el cron de 6h para verificar.

## Rollout

**El orden importa, y es al revés de lo intuitivo: primero el deploy, después las migraciones.** Ver nota de riesgo abajo para el porqué.

1. Deploy de `recalc-scores` **primero**, con las migraciones todavía sin correr (sin cambios funcionales en `sync-player-stats`, pero por completitud del deploy también se puede redeployar).
2. Migraciones, **en este orden**:
   1. `20260811_merge_season_score_fragments.sql`
   2. `20260811_backfill_ungridded_positions.sql`
3. Disparar una corrida manual de `recalc-scores` para los dos años vigentes (ya cubre ambos por defecto, sin `body.season`) en vez de esperar el cron.
4. Confirmar en `sync_log` que esa corrida quedó `status: 'success'` **y** que `player_season_scores` tiene filas (`count(*) > 0`) para la temporada actual — no alcanza con mirar `sync_log`, ver nota de riesgo.
5. Verificar visualmente en el navegador: Montiel (posición/historial), un caso multi-liga real (score por posición), y Julián Palacios en Informes (punto 3).

**Nota de riesgo — por qué el deploy va antes que las migraciones:** el cron de 6h de `recalc-scores` sigue corriendo con lo que esté deployado en cada momento, y la ventana entre el paso 1 y el paso 2 (o entre migraciones) importa.

- **Orden seguro (el de arriba):** con la función nueva ya deployada pero las migraciones todavía sin correr, lo primero que hace la función nueva en cada corrida es `supabase.rpc('backfill_ungridded_positions')` (antes de tocar `player_season_scores`). Esa RPC todavía no existe hasta que corre la migración 2, así que la llamada falla de inmediato con un error controlado, `sync_log` queda en `status: 'error'`, y no se ejecuta ningún `delete`/`upsert` — cero filas tocadas. Falla segura y visible. Una vez corridas ambas migraciones, la corrida siguiente ya encuentra todo lo que necesita y funciona de punta a punta.
- **Orden peligroso (el que NO hay que usar):** correr la migración 1 (que angosta la primary key de `player_season_scores` a `player_id,season,position`) mientras el código VIEJO de `recalc-scores` sigue deployado. El código viejo hace `delete()` de la temporada (que sí funciona, la tabla queda vacía) y después `upsert(..., { onConflict: 'player_id,season,position,league_id' })` con la PK vieja de 4 columnas — ese `upsert` falla contra la PK ya angostada, pero el código viejo (anterior a este plan) nunca revisaba el error de ese `upsert`, así que la corrida sigue de largo y `sync_log` queda en `status: 'success'` con la tabla vacía. Los scores de la temporada quedan borrados en silencio hasta la próxima corrida exitosa.

Por eso el deploy va primero: deja a la función *nueva* (que sí revisa errores) fallando de forma segura y visible durante la ventana de transición, en vez de dejar a la función *vieja* (que no los revisa) borrando datos en silencio. Aun así, no confiar solo en `sync_log` tras la primera corrida completa (con ambas migraciones ya aplicadas): confirmar que la tabla realmente tiene filas. Separado: en la primera corrida, `backfill_ungridded_positions()` tiene que corregir potencialmente muchas filas históricas de una sola vez, así que si el rol de base de datos tiene un `statement_timeout` bajo, esa primera corrida podría fallar por tiempo — no es necesariamente un bug del código; correrla de nuevo (es idempotente, corrige solo lo que falte) suele resolverlo.
