-- Seguimiento GG: vincular el CLUB directamente, independiente del jugador.
-- Varios jugadores en seguimiento no están en la API (ascenso, reserva, etc.)
-- y nunca se van a poder vincular como jugador — pero el club sí puede estar
-- en `teams`, así que vincularlo aparte permite mostrar el escudo real igual.
-- Admin-only (Matías/Marcos), mismo criterio que el resto de los vínculos.

alter table scout_players
  add column if not exists club_team_id bigint references teams(id) on delete set null;

create index if not exists scout_players_club_team_id_idx on scout_players(club_team_id);
