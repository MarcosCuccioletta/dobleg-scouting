select 'player_external_ids' as tbl, source, external_id, count(*) from player_external_ids group by source, external_id having count(*) > 1
union all
select 'team_external_ids', source, external_id, count(*) from team_external_ids group by source, external_id having count(*) > 1;
