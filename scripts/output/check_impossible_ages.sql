select id, name, birth_date, transfermarkt_id,
  extract(year from age(current_date, birth_date)) as edad
from players
where birth_date is not null
  and (
    birth_date > current_date - interval '14 years'
    or birth_date < current_date - interval '50 years'
  )
order by birth_date desc;
