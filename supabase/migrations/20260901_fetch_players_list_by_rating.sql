-- Rating reemplaza a Score GG (ver
-- docs/superpowers/specs/2026-09-01-rating-reemplaza-score-gg-design.md): desde
-- que recalc-scores dejo de escribir `avg_score` (Task 6/8 de ese plan,
-- deployado 2026-09-01), toda fila de player_season_scores recalculada desde
-- entonces tiene avg_score = NULL. Esta funcion nunca fue migrada junto con
-- recalc_percentiles/fetch_recent_form (Task 7 del mismo plan) y su filtro
-- `WHERE pss.avg_score IS NOT NULL` empezo a excluir esas filas -- en la
-- practica, TODO el dataset recalculado -- dejando fetch_players_list
-- devolviendo count=0/players=[] con cualquier combinacion de filtros. Esto
-- rompia en produccion Comparacion (ComparisonPage), Grafico de Dispersion
-- (ScatterChartPage) y LinkPlayerModal, todos consumidores de
-- usePlayersList/fetchPlayersList. Fix: mismo criterio que las otras dos RPCs
-- ya migradas -- filtrar, ordenar y armar `primary_score` sobre `avg_rating`.
-- `p_min_score` mantiene su nombre (no rompe la firma que ya llama el
-- frontend) pero ahora compara contra avg_rating.
CREATE OR REPLACE FUNCTION fetch_players_list(
  p_seasons             int[],
  p_positions           text[]  DEFAULT NULL,
  p_league_id           int     DEFAULT NULL,
  p_team_id             int     DEFAULT NULL,
  p_min_score           numeric DEFAULT NULL,
  p_min_matches         int     DEFAULT NULL,
  p_min_age             int     DEFAULT NULL,
  p_max_age             int     DEFAULT NULL,
  p_min_market_value    bigint  DEFAULT NULL,
  p_max_market_value    bigint  DEFAULT NULL,
  p_max_contract_months int     DEFAULT NULL,
  p_agents              text[]  DEFAULT NULL,
  p_search              text    DEFAULT NULL,
  p_page                int     DEFAULT 0,
  p_page_size           int     DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      pss.player_id, pss.season, pss.position, pss.league_id,
      pss.matches_played, pss.avg_score, pss.avg_rating,
      pss.total_goals, pss.total_assists, pss.percentile, pss.global_percentile,
      pss.tackles_p90, pss.interceptions_p90, pss.blocks_p90, pss.duels_won_pct,
      pss.passes_accuracy, pss.passes_key_p90, pss.passes_total_p90,
      pss.dribbles_success_p90, pss.dribbles_pct, pss.shots_on_p90, pss.shots_pct,
      pss.goals_p90, pss.assists_p90, pss.fouls_drawn_p90, pss.saves_p90,
      pss.goals_conceded_p90, pss.penalty_saved_avg, pss.clean_sheet_pct,
      pl.name, pl.photo, pl.birth_date, pl.nationality, pl.preferred_foot,
      pl.height_cm, pl.primary_position, pl.position_distribution,
      pl.current_team_id, pl.market_value_eur, pl.contract_end_date,
      pl.agent, pl.transfermarkt_url, pl.transfermarkt_id,
      tm.id AS team_id, tm.name AS team_name, tm.logo AS team_logo,
      tm.league_id AS team_league_id,
      lg.id AS league_pk, lg.name AS league_name, lg.country AS league_country,
      lg.tier AS league_tier, lg.season AS league_season
    FROM player_season_scores pss
    JOIN players pl ON pl.id = pss.player_id
    LEFT JOIN teams tm ON tm.id = pl.current_team_id
    LEFT JOIN leagues lg ON lg.id = pss.league_id
    WHERE pss.season = ANY(p_seasons)
      AND pss.avg_rating IS NOT NULL
      AND (p_positions IS NULL OR pss.position = ANY(p_positions))
      AND (p_league_id IS NULL OR tm.league_id = p_league_id)
      AND (p_team_id  IS NULL OR pl.current_team_id = p_team_id)
      AND (p_min_score   IS NULL OR pss.avg_rating >= p_min_score)
      AND (p_min_matches IS NULL OR pss.matches_played >= p_min_matches)
      AND (p_min_age IS NULL OR pl.birth_date <= (now() - make_interval(years => p_min_age))::date)
      AND (p_max_age IS NULL OR pl.birth_date >= (now() - make_interval(years => p_max_age))::date)
      AND (p_min_market_value IS NULL OR pl.market_value_eur >= p_min_market_value)
      AND (p_max_market_value IS NULL OR pl.market_value_eur <= p_max_market_value)
      AND (p_max_contract_months IS NULL
           OR (pl.contract_end_date >= now()::date
               AND pl.contract_end_date <= (now() + make_interval(months => p_max_contract_months))::date))
      AND (p_agents IS NULL OR pl.agent = ANY(p_agents))
      AND (p_search IS NULL OR pl.name ILIKE '%' || p_search || '%')
  ),
  by_player AS (
    SELECT DISTINCT ON (player_id) *
    FROM filtered
    ORDER BY player_id, (position = primary_position) DESC, matches_played DESC, season DESC, avg_rating DESC
  ),
  -- Un mismo futbolista puede tener dos filas en `players`: la de API-Football y la
  -- de Sofascore (misma persona, ids distintos). Se agrupan por transfermarkt_id,
  -- que es la identidad real, y gana la de API-Football (id < 20000000) porque es la
  -- que trae traspasos y lesiones, y es la que abre la ficha. Sin transfermarkt_id
  -- se cae a nombre + club, el criterio anterior.
  by_identity AS (
    SELECT DISTINCT ON (
      COALESCE(transfermarkt_id::text, lower(name) || '|' || COALESCE(current_team_id::text, ''))
    ) *
    FROM by_player
    ORDER BY
      COALESCE(transfermarkt_id::text, lower(name) || '|' || COALESCE(current_team_id::text, '')),
      (player_id < 20000000) DESC,
      matches_played DESC
  ),
  total AS (SELECT count(*)::int AS c FROM by_identity),
  paged AS (
    SELECT *
    FROM by_identity
    ORDER BY avg_rating DESC NULLS LAST, matches_played DESC, player_id ASC
    LIMIT GREATEST(p_page_size, 0)
    OFFSET GREATEST(p_page, 0) * GREATEST(p_page_size, 0)
  )
  SELECT jsonb_build_object(
    'count', (SELECT c FROM total),
    'players', COALESCE(
      (SELECT jsonb_agg(player_obj ORDER BY avg_rating DESC NULLS LAST, matches_played DESC, player_id ASC)
       FROM (
         SELECT
           avg_rating, matches_played, player_id,
           jsonb_build_object(
             'id', player_id,
             'name', name,
             'photo', photo,
             'birth_date', birth_date,
             'nationality', nationality,
             'preferred_foot', preferred_foot,
             'height_cm', height_cm,
             'primary_position', primary_position,
             'position_distribution', position_distribution,
             'current_team_id', current_team_id,
             'market_value_eur', market_value_eur,
             'contract_end_date', contract_end_date,
             'agent', agent,
             'transfermarkt_url', transfermarkt_url,
             'transfermarkt_id', transfermarkt_id,
             'team', CASE WHEN team_id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', team_id, 'name', team_name, 'logo', team_logo, 'league_id', team_league_id
             ) END,
             'league', CASE WHEN league_pk IS NULL THEN NULL ELSE jsonb_build_object(
               'id', league_pk, 'name', league_name, 'country', league_country,
               'tier', league_tier, 'season', league_season
             ) END,
             'season_scores', jsonb_build_array(jsonb_build_object(
               'player_id', player_id, 'season', season, 'position', position,
               'league_id', league_id, 'matches_played', matches_played,
               'avg_score', avg_score, 'avg_rating', avg_rating,
               'total_goals', total_goals, 'total_assists', total_assists,
               'percentile', percentile, 'global_percentile', global_percentile,
               'tackles_p90', tackles_p90, 'interceptions_p90', interceptions_p90,
               'blocks_p90', blocks_p90, 'duels_won_pct', duels_won_pct,
               'passes_accuracy', passes_accuracy, 'passes_key_p90', passes_key_p90,
               'passes_total_p90', passes_total_p90, 'dribbles_success_p90', dribbles_success_p90,
               'dribbles_pct', dribbles_pct, 'shots_on_p90', shots_on_p90,
               'shots_pct', shots_pct, 'goals_p90', goals_p90, 'assists_p90', assists_p90,
               'fouls_drawn_p90', fouls_drawn_p90, 'saves_p90', saves_p90,
               'goals_conceded_p90', goals_conceded_p90, 'penalty_saved_avg', penalty_saved_avg,
               'clean_sheet_pct', clean_sheet_pct
             )),
             'primary_score', avg_rating,
             'primary_percentile', percentile
           ) AS player_obj
         FROM paged
       ) sub),
      '[]'::jsonb)
  );
$$;
