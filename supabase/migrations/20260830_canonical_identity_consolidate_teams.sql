-- Fase 3/6 para clubes: consolida SOLO los grupos de alta confianza — mismo
-- nombre normalizado (sin tildes) Y misma `league_id`. Two clubes con el
-- mismo nombre en ligas distintas (ej. dos "River Plate" de países
-- distintos) NO caen acá — la condición de liga los mantiene separados a
-- propósito. No se toca `teams` en ningún momento, solo la capa canónica.

create table if not exists _backup_20260830_team_external_ids as
  select * from team_external_ids;

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

update team_identities set confidence = 'confirmed'
where id in (
  select team_identity_id from team_external_ids
  group by team_identity_id having count(*) > 1
);

delete from team_identities ti
where not exists (select 1 from team_external_ids teid where teid.team_identity_id = ti.id);
