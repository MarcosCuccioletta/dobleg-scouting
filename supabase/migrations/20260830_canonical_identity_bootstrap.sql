-- Etapa B (parcial, segura): backfill 1:1 — una identidad canónica por cada
-- fila EXISTENTE de `players`/`teams`, sin fusionar nada todavía. Cero riesgo
-- de falso merge: es puramente mecánico (cada fila → su propia identidad).
-- La consolidación real (fusionar 2+ external_ids en una sola identidad
-- cuando hay evidencia fuerte) es la Fase 3, deliberada, caso por caso —
-- nunca automática acá.
--
-- `source` se deriva del rango de ID (api_football <20M, sofascore <99M,
-- legacy_agency >=99M) — esto es un hecho verificable, no una inferencia.
-- NO se crean filas `source='transfermarkt'` en este paso: el
-- `transfermarkt_id` actual es justamente el campo bajo sospecha (107 grupos
-- con nombres incompatibles) — vincularlo acá sería la fusión automática que
-- el plan prohíbe. Se agrega recién en la Fase 3, solo para matches
-- confirmados.

-- Jugadores
alter table player_identities add column if not exists bootstrap_players_row_id integer;

insert into player_identities (bootstrap_players_row_id)
select id from players;

insert into player_external_ids (player_identity_id, source, external_id, players_row_id)
select
  pi.id,
  case
    when p.id < 20000000 then 'api_football'
    when p.id < 99000000 then 'sofascore'
    else 'legacy_agency'
  end,
  p.id,
  p.id
from player_identities pi
join players p on p.id = pi.bootstrap_players_row_id;

alter table player_identities drop column bootstrap_players_row_id;

-- Clubes
alter table team_identities add column if not exists bootstrap_teams_row_id integer;

insert into team_identities (bootstrap_teams_row_id)
select id from teams;

insert into team_external_ids (team_identity_id, source, external_id, teams_row_id)
select
  ti.id,
  case
    when t.id < 20000000 then 'api_football'
    when t.id < 99000000 then 'sofascore'
    else 'legacy_agency'
  end,
  t.id,
  t.id
from team_identities ti
join teams t on t.id = ti.bootstrap_teams_row_id;

alter table team_identities drop column bootstrap_teams_row_id;
