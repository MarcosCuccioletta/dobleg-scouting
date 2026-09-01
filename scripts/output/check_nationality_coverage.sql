select
  count(*) as total_players,
  count(*) filter (where nationality is not null) as with_nationality,
  count(*) filter (where nationality is null) as without_nationality,
  count(*) filter (where nationality is null and id < 20000000) as missing_api_football,
  count(*) filter (where nationality is null and id >= 20000000 and id < 99000000) as missing_sofascore,
  count(*) filter (where nationality is null and id >= 99000000) as missing_legacy
from players;
