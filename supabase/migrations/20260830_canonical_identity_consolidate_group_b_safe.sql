-- Fase 3 continuación: revisión manual de los 104 grupos "Categoría B"
-- (dudosos, nunca fusionados automáticamente por el nombre normalizado no
-- coincidir exacto). De esos 104, se identificaron 38 con evidencia
-- combinada suficiente para fusionar con confianza:
--   1) mismo transfermarkt_id (ya lo tenían)
--   2) fecha de nacimiento EXACTA idéntica en todas las filas del grupo
--      (o desconocida en alguna, nunca en conflicto)
--   3) el nombre más corto está contenido, token por token — incluidas
--      iniciales — dentro del nombre más largo (ej. "Gustavo" dentro de
--      "Luiz Gustavo"; "H. Gonzalez" fue justamente el caso que este chequeo
--      excluye, porque la inicial "H" no aparece en el otro nombre)
-- Revisados uno por uno a simple vista antes de fusionar (lista completa en
-- el chat). El único grupo con fecha de nacimiento en conflicto real
-- (transfermarkt_id 808509: "Danilo" 1999-04-07 vs "Danilo Santos"
-- 2001-04-29) NO se toca — es un error de dato real (probablemente un match
-- viejo incorrecto de antes de subir MIN_AUTO_MATCH_SCORE), queda marcado
-- para revisión aparte. Los otros 65 grupos restantes quedan sin tocar por
-- no tener nombre compatible ni evidencia suficiente.
--
-- Mismo patrón que Categoría A: ganador = min(id), solo se repuntan
-- player_external_ids, no se borra/modifica ninguna fila de `players`.

create table if not exists _backup_20260830_player_external_ids_group_b as
  select * from player_external_ids;

with target_tm_ids(transfermarkt_id) as (
  values
    (218),(10471),(17563),(53180),(104505),(131505),(144236),(283398),
    (503343),(533738),(537382),(654818),(668546),(680514),(739443),(799707),
    (814970),(851121),(871468),(880216),(911963),(948278),(962185),(984072),
    (987126),(987238),(1011266),(1031393),(1064936),(1094389),(1104653),
    (1107415),(1133813),(1148790),(1151379),(1152258),(1203761),(1354944)
),
winners as (
  select t.transfermarkt_id, min(p.id) as winner_players_id
  from target_tm_ids t
  join players p on p.transfermarkt_id = t.transfermarkt_id
  group by t.transfermarkt_id
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

-- Vínculo a transfermarkt para la identidad ya consolidada de este batch
with target_tm_ids(transfermarkt_id) as (
  values
    (218),(10471),(17563),(53180),(104505),(131505),(144236),(283398),
    (503343),(533738),(537382),(654818),(668546),(680514),(739443),(799707),
    (814970),(851121),(871468),(880216),(911963),(948278),(962185),(984072),
    (987126),(987238),(1011266),(1031393),(1064936),(1094389),(1104653),
    (1107415),(1133813),(1148790),(1151379),(1152258),(1203761),(1354944)
)
insert into player_external_ids (player_identity_id, source, external_id, players_row_id)
select distinct peid.player_identity_id, 'transfermarkt', p.transfermarkt_id::bigint, null::integer
from target_tm_ids t
join players p on p.transfermarkt_id = t.transfermarkt_id
join player_external_ids peid on peid.players_row_id = p.id
where not exists (
  select 1 from player_external_ids x
  where x.player_identity_id = peid.player_identity_id and x.source = 'transfermarkt'
);

delete from player_identities pi
where not exists (select 1 from player_external_ids peid where peid.player_identity_id = pi.id);

update player_identities set confidence = 'confirmed'
where id in (select distinct player_identity_id from player_external_ids where source = 'transfermarkt');
