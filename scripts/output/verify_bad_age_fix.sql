select
  (select count(*) from players) as players_total,
  (select count(*) from players where birth_date is not null and birth_date < current_date - interval '50 years') as still_impossible,
  (select count(*) from player_identities) as identities_now,
  (select count(*) from player_identities where confidence='confirmed') as confirmed_now,
  (select count(*) from player_external_ids) as ext_ids_total,
  (select count(distinct players_row_id) from player_external_ids) as distinct_players_covered,
  (select count(*) from _backup_20260830_players_bad_age) as backup_rows;
