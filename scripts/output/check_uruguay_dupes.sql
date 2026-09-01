with normed as (
  select id, name, league_id,
    translate(lower(trim(name)),
      'áéíóúñàèìòùäëïöüâêîôû','aeiounaeiouaeiouaeiou'
    ) as norm
  from teams where league_id = 268
)
select norm, league_id, count(*), array_agg(id order by id) as ids, array_agg(name order by id) as names
from normed
group by norm, league_id
having count(*) > 1
order by norm;
