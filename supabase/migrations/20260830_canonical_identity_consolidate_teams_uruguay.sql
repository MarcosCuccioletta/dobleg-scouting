-- Fase 6 continuación: 16 pares de Uruguay (league_id=268) desbloqueados por
-- el backfill de league_id de este mismo día (antes tenían league_id NULL en
-- el lado API-Football y por eso la consolidación original los saltaba).
--
-- Parte A: re-corre la MISMA lógica de nombre-normalizado + misma liga que
-- ya usó 20260830_canonical_identity_consolidate_teams.sql — ahora que estos
-- 16 clubes tienen league_id=268, atrapa automáticamente los 8 pares con
-- nombre normalizado idéntico entre providers (Albion FC, Boston River,
-- Central Español, Cerro Largo, Danubio, Defensor Sporting, Deportivo
-- Maldonado, Progreso). Es un no-op para todo lo ya consolidado antes.
--
-- Parte B: los otros 8 pares tienen nombres distintos entre providers
-- (ej. "Penarol" vs "Club Atlético Peñarol") y no normalizan igual, así que
-- no los agarra el matching automático. Verificados manualmente uno por uno
-- (mismo club real, mismo league_id=268) — se fusionan con una lista
-- explícita, mismo patrón ganador=min(id).

create table if not exists _backup_20260830_team_external_ids_uruguay as
  select * from team_external_ids;

-- Parte A
with norm as (
  select id, league_id,
    lower(translate(trim(name), 'áéíóúàèìòùãõâêîôûäëïöüçñÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇÑ', 'aeiouaeiouaoaeiouaeioucnAEIOUAEIOUAOAEIOUAEIOUCN')) as nname
  from teams
),
group_stats as (
  select nname, league_id, count(*) n
  from norm
  where league_id is not null
  group by nname, league_id
  having count(*) > 1
),
winners as (
  select nrm.nname, nrm.league_id, min(nrm.id) as winner_teams_id
  from norm nrm
  join group_stats gs on gs.nname = nrm.nname and gs.league_id = nrm.league_id
  group by nrm.nname, nrm.league_id
),
winner_identity as (
  select w.nname, w.league_id, w.winner_teams_id, teid.team_identity_id
  from winners w
  join team_external_ids teid on teid.teams_row_id = w.winner_teams_id
)
update team_external_ids teid
set team_identity_id = wi.team_identity_id
from winner_identity wi
join norm nrm on nrm.nname = wi.nname and nrm.league_id = wi.league_id
where teid.teams_row_id = nrm.id
  and teid.teams_row_id != wi.winner_teams_id;

-- Parte B: pares verificados manualmente (mismo club, mismo league_id=268,
-- nombre-variante entre providers)
with pairs(loser_id, winner_id) as (
  values
    (20174972, 2365),  -- Montevideo City Torque -> Atletico Torque
    (20022011, 2362),  -- CA Cerro -> Cerro
    (20003227, 2348),  -- Club Atlético Peñarol -> Penarol
    (20003230, 2356),  -- Nacional -> Club Nacional
    (20003224, 2353),  -- Juventud de Las Piedras -> Juventud
    (20006879, 2358),  -- Liverpool UY -> Liverpool Montevideo
    (20003240, 2360),  -- Montevideo Wanderers -> Wanderers
    (20025010, 2359)   -- Racing de Montevideo -> Racing Montevideo
),
winner_identity as (
  select p.loser_id, p.winner_id, teid.team_identity_id
  from pairs p
  join team_external_ids teid on teid.teams_row_id = p.winner_id
)
update team_external_ids teid
set team_identity_id = wi.team_identity_id
from winner_identity wi
where teid.teams_row_id = wi.loser_id;

update team_identities set confidence = 'confirmed'
where id in (
  select team_identity_id from team_external_ids
  group by team_identity_id having count(*) > 1
);

delete from team_identities ti
where not exists (select 1 from team_external_ids teid where teid.team_identity_id = ti.id);
