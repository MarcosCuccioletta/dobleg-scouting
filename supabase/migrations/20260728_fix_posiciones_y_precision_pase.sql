-- Arregla dos errores de carga que venían corrompiendo el Score GG.
-- Correr en el SQL editor de Supabase, de arriba hacia abajo, un bloque por vez.
--
-- ─── Qué se arregla ──────────────────────────────────────────────────────────
--
-- 1. PRECISIÓN DE PASE mal cargada (74.708 filas).
--    API-Football manda en `passes.accuracy` la CANTIDAD de pases acertados, no
--    el porcentaje. El sync lo guardaba crudo, así que un lateral con 20 pases
--    acertados de 28 quedaba con "20% de precisión". Hay filas con 107 sobre 123
--    pases, que como porcentaje es imposible.
--    Sofascore sí guarda porcentaje, así que esas filas NO se tocan.
--    El discriminador es el id del fixture: API-Football usa ids de ~1,5M y
--    Sofascore de ~36M, sin solapamiento (0 fixtures entre 5M y 30M).
--
-- 2. CARRILEROS clasificados como volantes interiores (1.197 filas).
--    En formaciones con línea de 3 (3-4-2-1, 3-4-3, 3-5-2) los jugadores de los
--    costados del mediocampo son carrileros, o sea laterales. El mapeo los
--    mandaba a VI, y como el Score GG es un ranking DENTRO de la posición, los
--    comparaba contra enganches: un carrilero sin remates ni pases clave queda
--    último de ese grupo.
--
-- ─── Orden de ejecución ──────────────────────────────────────────────────────
-- Paso 0 (backup) → Paso 1 (dry run, sólo mira) → Paso 2 y 3 (corrigen) →
-- Paso 4 (verifica) → después hay que RECALCULAR los scores (ver el final).


-- ═══ PASO 0 — Backup. No saltear. ════════════════════════════════════════════
-- Guarda las columnas que se van a tocar. Permite volver atrás con el paso 5.

CREATE TABLE IF NOT EXISTS player_match_stats_bak_20260728 AS
SELECT id, player_id, fixture_id, detected_position, passes_accuracy, match_score
FROM player_match_stats;

-- Debe devolver 121145 (o el total actual de la tabla).
SELECT count(*) AS filas_respaldadas FROM player_match_stats_bak_20260728;


-- ═══ PASO 1 — Dry run. Sólo mira, no cambia nada. ════════════════════════════
-- Revisá que los números den parecido a los comentarios de arriba antes de seguir.

SELECT 'precision de pase a convertir' AS caso, count(*) AS filas
FROM player_match_stats
WHERE fixture_id < 10000000 AND passes_accuracy > 0
UNION ALL
SELECT 'carrileros mal clasificados', count(*)
FROM player_match_stats
WHERE formation LIKE '3-%'
  AND detected_position = 'VI'
  AND grid_position ~ '^[0-9]+:[0-9]+$'
  AND split_part(grid_position, ':', 1) = '3'
  AND formation ~ '^3-[0-9]'
  AND split_part(formation, '-', 2)::int >= 4
  AND split_part(grid_position, ':', 2)::int
      IN (1, split_part(formation, '-', 2)::int);

-- Muestra de cómo quedaría la precisión de pase (10 filas de ejemplo).
SELECT passes_total,
       passes_accuracy AS antes,
       round((passes_accuracy / passes_total::numeric) * 100, 2) AS despues
FROM player_match_stats
WHERE fixture_id < 10000000 AND passes_accuracy > 0 AND passes_total > 0
ORDER BY passes_total DESC
LIMIT 10;


-- ═══ PASO 2 — Precisión de pase: conteo → porcentaje ═════════════════════════
-- Sólo filas de API-Football (fixture_id < 10M). Las de Sofascore ya vienen en %.

UPDATE player_match_stats
SET passes_accuracy = round((passes_accuracy / passes_total::numeric) * 100, 2)
WHERE fixture_id < 10000000
  AND passes_total > 0
  AND passes_accuracy > 0;

-- Las filas sin pases no pueden tener precisión.
UPDATE player_match_stats
SET passes_accuracy = 0
WHERE fixture_id < 10000000
  AND passes_total = 0
  AND passes_accuracy <> 0;


-- ═══ PASO 3 — Carrileros: VI → lateral ═══════════════════════════════════════
-- Columna 1 = izquierda, última = derecha. Verificado contra jugadores de
-- posición conocida: Milton Casco (lateral izquierdo) juega siempre en 2:1 y
-- Gonzalo Montiel (lateral derecho) siempre en 2:4.

UPDATE player_match_stats
SET detected_position = CASE
      WHEN split_part(grid_position, ':', 2)::int = 1 THEN 'LI'
      ELSE 'LD'
    END
WHERE formation LIKE '3-%'
  AND detected_position = 'VI'
  AND grid_position ~ '^[0-9]+:[0-9]+$'
  AND split_part(grid_position, ':', 1) = '3'
  AND formation ~ '^3-[0-9]'
  AND split_part(formation, '-', 2)::int >= 4
  AND split_part(grid_position, ':', 2)::int
      IN (1, split_part(formation, '-', 2)::int);


-- ═══ PASO 4 — Verificación. Las tres consultas tienen que dar 0. ═════════════

SELECT 'precision imposible (>100)' AS control, count(*) AS deberia_ser_cero
FROM player_match_stats WHERE passes_accuracy > 100
UNION ALL
SELECT 'precision mayor que los pases dados', count(*)
FROM player_match_stats
WHERE passes_total > 0 AND passes_accuracy > 100
UNION ALL
SELECT 'carrileros todavia como VI', count(*)
FROM player_match_stats
WHERE formation LIKE '3-%'
  AND detected_position = 'VI'
  AND grid_position ~ '^[0-9]+:[0-9]+$'
  AND split_part(grid_position, ':', 1) = '3'
  AND formation ~ '^3-[0-9]'
  AND split_part(formation, '-', 2)::int >= 4
  AND split_part(grid_position, ':', 2)::int
      IN (1, split_part(formation, '-', 2)::int);

-- Control puntual: Gonzalo González vs Tigre debe quedar LD y 71.43.
SELECT detected_position, passes_total, passes_accuracy
FROM player_match_stats
WHERE player_id = 369957 AND fixture_id = 1493007;


-- ═══ PASO 5 — Vuelta atrás, sólo si algo salió mal ═══════════════════════════
-- UPDATE player_match_stats p
-- SET detected_position = b.detected_position,
--     passes_accuracy   = b.passes_accuracy,
--     match_score       = b.match_score
-- FROM player_match_stats_bak_20260728 b
-- WHERE p.id = b.id;


-- ═══ DESPUÉS DE ESTO: FALTA RECALCULAR LOS SCORES ════════════════════════════
--
-- Este script corrige los DATOS de entrada, no los scores. `match_score` y la
-- tabla `player_season_scores` siguen calculados sobre los valores viejos, así
-- que hasta recalcular, los scores no reflejan la corrección.
--
-- OJO ANTES DE RECALCULAR: el rework del Score GG se aplicó a mano por SQL y la
-- función `recalc-scores` deployada todavía tiene la lógica vieja. Si se corre
-- así como está, revierte el rework. El orden seguro es:
--   1. deployar `recalc-scores` con el código actual del repo,
--   2. deployar `sync-player-stats` (ya trae la precisión de pase normalizada),
--   3. recién ahí correr el recálculo.
-- Backup de los scores viejos: player_season_scores_bak2026.
