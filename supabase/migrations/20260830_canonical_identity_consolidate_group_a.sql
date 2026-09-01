-- Fase 3, consolidación real (primera mutación no trivial, pero acotada y
-- reversible): fusiona SOLO los grupos "A — alta confianza" (mismo
-- transfermarkt_id, mismo nombre normalizado sin tildes, misma fecha de
-- nacimiento o desconocida en el resto). Los grupos "B — dudoso" (nombre
-- incompatible) NO se tocan acá — quedan con una identidad canónica propia
-- por fila, como estaban desde el bootstrap.
--
-- Ganador del grupo = el `players.id` más chico (siempre cae en API-Football,
-- <20M, por el propio esquema de rangos) — mismo criterio de desempate que
-- ya usa `dedupeTeamsByName` en la app. Se REPUNTAN los `player_external_ids`
-- de los demás miembros hacia la identidad del ganador — no se borra, mueve
-- ni modifica ninguna fila de `players`. Las `player_identities` que quedan
-- sin ningún `external_id` apuntándoles (las de los perdedores, que ya se
-- redirigieron) se eliminan por ser puro andamiaje del bootstrap, sin dato
-- real adentro.
--
-- Backup previo: snapshot completo de `player_external_ids` antes de tocar
-- nada, para poder revertir exactamente a este punto.

create table if not exists _backup_20260830_player_external_ids as
  select * from player_external_ids;

with norm as (
  select id, transfermarkt_id, birth_date,
    lower(translate(trim(name), 'áéíóúàèìòùãõâêîôûäëïöüçñÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇÑ', 'aeiouaeiouaoaeiouaeioucnAEIOUAEIOUAOAEIOUAEIOUCN')) as nname
  from players where transfermarkt_id is not null
),
group_stats as (
  select transfermarkt_id, count(*) n,
    count(distinct nname) name_variety,
    count(distinct birth_date) filter (where birth_date is not null) dob_variety
  from norm group by transfermarkt_id having count(*) > 1
),
category_a as (
  select transfermarkt_id from group_stats where name_variety = 1 and dob_variety <= 1
),
winners as (
  select transfermarkt_id, min(id) as winner_players_id
  from players
  where transfermarkt_id in (select transfermarkt_id from category_a)
  group by transfermarkt_id
),
winner_identity as (
  select w.transfermarkt_id, w.winner_players_id, peid.player_identity_id
  from winners w
  join player_external_ids peid on peid.players_row_id = w.winner_players_id
)
update player_external_ids peid
set player_identity_id = wi.player_identity_id
from winner_identity wi
join players p on p.transfermarkt_id = wi.transfermarkt_id
where peid.players_row_id = p.id
  and peid.players_row_id != wi.winner_players_id;

-- Agregar el vínculo a transfermarkt para la identidad ya consolidada
-- (recién ahora, con el match validado por nombre+DOB — no antes).
-- CTEs no se comparten entre statements, así que se repiten acá.
with norm as (
  select id, transfermarkt_id, birth_date,
    lower(translate(trim(name), 'áéíóúàèìòùãõâêîôûäëïöüçñÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇÑ', 'aeiouaeiouaoaeiouaeioucnAEIOUAEIOUAOAEIOUAEIOUCN')) as nname
  from players where transfermarkt_id is not null
),
group_stats as (
  select transfermarkt_id, count(*) n,
    count(distinct nname) name_variety,
    count(distinct birth_date) filter (where birth_date is not null) dob_variety
  from norm group by transfermarkt_id having count(*) > 1
),
category_a as (
  select transfermarkt_id from group_stats where name_variety = 1 and dob_variety <= 1
)
insert into player_external_ids (player_identity_id, source, external_id, players_row_id)
select distinct peid.player_identity_id, 'transfermarkt', p.transfermarkt_id::bigint, null::integer
from players p
join player_external_ids peid on peid.players_row_id = p.id
where p.transfermarkt_id in (select transfermarkt_id from category_a)
  and not exists (
    select 1 from player_external_ids x
    where x.player_identity_id = peid.player_identity_id and x.source = 'transfermarkt'
  );

-- Limpieza: identidades del bootstrap que quedaron sin ningún external_id
-- apuntándoles (los "perdedores" ya redirigidos) — no tenían dato propio,
-- eran solo el 1:1 inicial.
delete from player_identities pi
where not exists (select 1 from player_external_ids peid where peid.player_identity_id = pi.id);

update player_identities set confidence = 'confirmed'
where id in (select distinct player_identity_id from player_external_ids where source = 'transfermarkt');
