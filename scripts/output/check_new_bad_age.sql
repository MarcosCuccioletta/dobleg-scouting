select id, name, birth_date, transfermarkt_id, created_at
from players
where birth_date is not null and (birth_date > current_date - interval '14 years' or birth_date < current_date - interval '55 years');
