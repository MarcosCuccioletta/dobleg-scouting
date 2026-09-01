-- Saneamiento de datos: identidad canónica de jugadores/clubes, agregada
-- ARRIBA de `players`/`teams` sin tocarlas — ningún ID existente cambia,
-- ninguna FK existente se rompe. `players.id`/`teams.id` dejan de ser "la
-- identidad" pero siguen funcionando para todo lo que ya depende de ellos.
--
-- Etapa A del plan de migración: crear estructura nueva sin eliminar la
-- vieja. 100% aditivo — ni una fila de `players`/`teams` se toca acá.
-- Reversible con un simple DROP de estas 4 tablas si algo sale mal.

create table if not exists player_identities (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Estado de confianza de la identidad consolidada, no del jugador en sí.
  -- 'single' = todavía no se fusionó con nada (default, la gran mayoría al
  -- principio). 'confirmed' = se consolidaron 2+ external_ids con evidencia
  -- fuerte (mismo transfermarkt_id + nombre/DOB compatibles). Nunca se pasa
  -- a 'confirmed' automáticamente sin ese chequeo.
  confidence text not null default 'single' check (confidence in ('single', 'confirmed'))
);

create table if not exists player_external_ids (
  id bigint generated always as identity primary key,
  player_identity_id bigint not null references player_identities(id) on delete cascade,
  source text not null check (source in ('api_football', 'sofascore', 'legacy_agency', 'transfermarkt')),
  external_id bigint not null,
  -- El `players.id` real de esa fila, cuando source no es 'transfermarkt'
  -- (transfermarkt no tiene fila propia en `players`, es solo el tm_id).
  players_row_id integer references players(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Todavía SIN unique(source, external_id) — se agrega recién en la Etapa D,
-- después de confirmar que los datos ya la cumplen (ver plan).
create index if not exists player_external_ids_source_idx on player_external_ids(source, external_id);
create index if not exists player_external_ids_identity_idx on player_external_ids(player_identity_id);
create index if not exists player_external_ids_players_row_idx on player_external_ids(players_row_id);

create table if not exists team_identities (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confidence text not null default 'single' check (confidence in ('single', 'confirmed'))
);

create table if not exists team_external_ids (
  id bigint generated always as identity primary key,
  team_identity_id bigint not null references team_identities(id) on delete cascade,
  source text not null check (source in ('api_football', 'sofascore', 'legacy_agency')),
  external_id bigint not null,
  teams_row_id integer references teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists team_external_ids_source_idx on team_external_ids(source, external_id);
create index if not exists team_external_ids_identity_idx on team_external_ids(team_identity_id);
create index if not exists team_external_ids_teams_row_idx on team_external_ids(teams_row_id);
