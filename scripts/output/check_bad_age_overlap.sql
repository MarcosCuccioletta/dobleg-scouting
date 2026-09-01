with bad as (
  select id from players
  where birth_date is not null and birth_date < current_date - interval '50 years'
)
select b.id, p.name, p.birth_date, p.transfermarkt_id, pi.confidence,
  (select count(*) from player_external_ids x where x.player_identity_id = peid.player_identity_id) as group_size
from bad b
join players p on p.id = b.id
join player_external_ids peid on peid.players_row_id = b.id
join player_identities pi on pi.id = peid.player_identity_id
where pi.confidence = 'confirmed'
order by group_size desc;
