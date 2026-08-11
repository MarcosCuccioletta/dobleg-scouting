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
