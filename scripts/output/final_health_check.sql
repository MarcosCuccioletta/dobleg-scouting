select 'players_total' as check_name, count(*)::text as value from players
union all
select 'teams_total', count(*)::text from teams
union all
select 'player_identities', count(*)::text from player_identities
union all
select 'player_ext_ids', count(*)::text from player_external_ids
union all
select 'player_orphans (players sin external_id)', count(*)::text from players p
  where not exists (select 1 from player_external_ids x where x.players_row_id = p.id)
union all
select 'team_orphans (teams sin external_id)', count(*)::text from teams t
  where not exists (select 1 from team_external_ids x where x.teams_row_id = t.id)
union all
select 'players con current_team_id roto (FK-like)', count(*)::text from players p
  where p.current_team_id is not null and not exists (select 1 from teams t where t.id = p.current_team_id)
union all
select 'impossible_ages_remaining', count(*)::text from players
  where birth_date is not null and (birth_date > current_date - interval '14 years' or birth_date < current_date - interval '55 years')
union all
select 'transfermarkt_id duplicado sin resolver (categoria B restante)', count(distinct transfermarkt_id)::text from (
  select transfermarkt_id from players where transfermarkt_id is not null group by transfermarkt_id having count(*) > 1
) x
union all
select 'confirmed_player_identities', count(*)::text from player_identities where confidence='confirmed'
union all
select 'confirmed_team_identities', count(*)::text from team_identities where confidence='confirmed'
union all
select 'nationality_filled_pct', round(100.0 * count(*) filter (where nationality is not null) / count(*), 1)::text from players
union all
select 'teams_league_id_null', count(*)::text from teams where league_id is null;
