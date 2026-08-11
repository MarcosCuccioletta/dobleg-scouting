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
