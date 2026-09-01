insert into players (id, name) values (88888888, '__TEST_TRIGGER_PLAYER__');
insert into teams (id, name) values (88888888, '__TEST_TRIGGER_TEAM__');

select 'player' as kind, peid.source, peid.external_id, peid.players_row_id, pi.confidence
from player_external_ids peid join player_identities pi on pi.id = peid.player_identity_id
where peid.players_row_id = 88888888
union all
select 'team', teid.source, teid.external_id, teid.teams_row_id, ti.confidence
from team_external_ids teid join team_identities ti on ti.id = teid.team_identity_id
where teid.teams_row_id = 88888888;
