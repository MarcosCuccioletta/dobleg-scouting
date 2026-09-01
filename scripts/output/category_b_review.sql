with norm as (
  select id, transfermarkt_id, birth_date, name, current_team_id,
    lower(translate(trim(name), 'áéíóúàèìòùãõâêîôûäëïöüçñÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇÑ', 'aeiouaeiouaoaeiouaeioucnAEIOUAEIOUAOAEIOUAEIOUCN')) as nname
  from players where transfermarkt_id is not null
),
group_stats as (
  select transfermarkt_id, count(*) n,
    count(distinct nname) name_variety,
    count(distinct birth_date) filter (where birth_date is not null) dob_variety
  from norm group by transfermarkt_id having count(*) > 1
),
category_b as (
  select transfermarkt_id from group_stats where not (name_variety = 1 and dob_variety <= 1)
)
select n.transfermarkt_id, n.id, n.name, n.birth_date, n.current_team_id
from norm n
where n.transfermarkt_id in (select transfermarkt_id from category_b)
order by n.transfermarkt_id, n.id;
