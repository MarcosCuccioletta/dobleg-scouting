-- Datos de ejemplo para probar Mercado (negociaciones/objetivos) en local.
-- No tocar en produccion sin confirmar con el usuario.

insert into public.market_team_members (name, active) values ('Franco', true)
  on conflict do nothing;

-- 1. Boca Juniors — recien empezada, seguimiento "proximo" en 2 dias
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (451, 'Boca Juniors', 'https://media.api-sports.io/football/teams/451.png', 'Nahuel Genez', null, null, 'Raúl Cascini', 'Coordinador de fútbol', 'contactado', 2, 'Marcos', current_date + 2, null, 'Marcos', now(), now());

-- 2. River Plate — recien empezada, sin fecha de seguimiento (sin alerta)
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (435, 'River Plate', 'https://media.api-sports.io/football/teams/435.png', 'Tomás Belmonte', null, null, null, null, 'contactado', 2, 'Marcos', null, null, 'Marcos', now() - interval '1 day', now() - interval '1 day');

-- 3. Racing Club — con reuniones, seguimiento vencido hace 3 dias
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (436, 'Racing Club', 'https://media.api-sports.io/football/teams/436.png', 'Agustín Cardozo', null, null, 'Diego Milito', 'Director deportivo', 'reunion', (select id from public.market_team_members where name='Franco'), 'Franco', current_date - 3, null, 'Franco', now() - interval '12 days', now() - interval '8 days')
returning id;

-- 4. Independiente — con reuniones avanzadas, oferta enviada, seguimiento "proximo" en 1 dia
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (453, 'Independiente', 'https://media.api-sports.io/football/teams/453.png', 'Bruno Zapelli', null, null, 'Sebastián Lameiro', 'Gerente deportivo', 'oferta_enviada', 2, 'Marcos', current_date + 1, null, 'Marcos', now() - interval '20 days', now() - interval '3 days');

-- 5. San Lorenzo — estancada en espera, vencida hace 15 dias
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (460, 'San Lorenzo', 'https://media.api-sports.io/football/teams/460.png', 'Elián Giménez', null, null, 'Marcelo Moretti', 'Manager', 'en_espera', (select id from public.market_team_members where name='Franco'), 'Franco', current_date - 15, null, 'Franco', now() - interval '30 days', now() - interval '25 days');

-- 6. Rosario Central — terminada y completada (seguimiento vencido pero excluido por estar cerrada)
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (437, 'Rosario Central', 'https://media.api-sports.io/football/teams/437.png', 'Ignacio Rodríguez', null, null, 'Alejandro Basile', 'Coordinador', 'cerrado_exitoso', 2, 'Marcos', current_date - 20, null, 'Marcos', now() - interval '25 days', now() - interval '18 days');

-- 7. Velez Sarsfield — terminada y caida
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (438, 'Velez Sarsfield', 'https://media.api-sports.io/football/teams/438.png', 'Ramiro Sosa', null, null, 'Pablo Cavallero', 'Director deportivo', 'cerrado_rechazado', (select id from public.market_team_members where name='Franco'), 'Franco', current_date - 10, null, 'Franco', now() - interval '15 days', now() - interval '8 days');

-- 8. Argentinos Juniors — recien empezada, con jugador ya vinculado a la API (foto)
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (20003216, 'Argentinos Juniors', 'https://api.sofascore.com/api/v1/team/3216/image', 'Gianluca Prestianni', 5917, 'externo', 'Cristian Malaspina', 'Representante', 'contactado', 2, 'Marcos', null, null, 'Marcos', now(), now());

-- 9. Boca Juniors (2da negociacion) — reunion reciente, sin fecha de seguimiento
insert into public.market_negotiations
  (team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (451, 'Boca Juniors', 'https://media.api-sports.io/football/teams/451.png', 'Valentín Barco', null, null, 'Marcelo Delgado', 'Representante', 'reunion', 2, 'Marcos', null, null, 'Marcos', now() - interval '5 days', now() - interval '5 days');

-- Notas / reuniones para las negociaciones con historial (usamos subconsultas por team_name+player_name, unicos en este seed)

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Primera reunión con el gerente deportivo, interesados en el perfil.', true, false, 'Franco', now() - interval '12 days'
from public.market_negotiations where player_name = 'Agustín Cardozo';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Segunda reunión: piden préstamo con opción de compra.', true, false, 'Franco', now() - interval '8 days'
from public.market_negotiations where player_name = 'Agustín Cardozo';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Contacto inicial con el representante del jugador.', false, false, 'Marcos', now() - interval '20 days'
from public.market_negotiations where player_name = 'Bruno Zapelli';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Reunión en Avellaneda con el Consejo Directivo.', true, false, 'Marcos', now() - interval '15 days'
from public.market_negotiations where player_name = 'Bruno Zapelli';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Reunión de seguimiento: piden bajar la pretensión económica.', true, false, 'Marcos', now() - interval '10 days'
from public.market_negotiations where player_name = 'Bruno Zapelli';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Enviamos oferta formal por escrito.', false, false, 'Marcos', now() - interval '3 days'
from public.market_negotiations where player_name = 'Bruno Zapelli';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Contacto inicial, evaluando la salida del jugador.', false, false, 'Franco', now() - interval '30 days'
from public.market_negotiations where player_name = 'Elián Giménez';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Nos piden tiempo, lo están evaluando internamente.', false, false, 'Franco', now() - interval '25 days'
from public.market_negotiations where player_name = 'Elián Giménez';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Primer contacto con el club.', false, false, 'Marcos', now() - interval '25 days'
from public.market_negotiations where player_name = 'Ignacio Rodríguez';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Reunión para cerrar condiciones del préstamo.', true, false, 'Marcos', now() - interval '20 days'
from public.market_negotiations where player_name = 'Ignacio Rodríguez';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Acuerdo cerrado: pase a préstamo por 1 temporada, opción de compra fijada en U$D 1.5M.', false, false, 'Marcos', now() - interval '18 days'
from public.market_negotiations where player_name = 'Ignacio Rodríguez';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Primer contacto, el club busca refuerzo en esa posición.', false, false, 'Franco', now() - interval '15 days'
from public.market_negotiations where player_name = 'Ramiro Sosa';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Reunión: no llegamos a un acuerdo económico.', true, false, 'Franco', now() - interval '12 days'
from public.market_negotiations where player_name = 'Ramiro Sosa';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'El club decide no avanzar, priorizan otro perfil.', false, false, 'Franco', now() - interval '8 days'
from public.market_negotiations where player_name = 'Ramiro Sosa';

insert into public.market_negotiation_notes (negotiation_id, body, is_meeting, is_system, author_name, created_at)
select id, 'Reunión con el padre del jugador y su representante.', true, false, 'Marcos', now() - interval '5 days'
from public.market_negotiations where player_name = 'Valentín Barco';

-- Objetivos (2 ejemplos)

insert into public.market_club_needs
  (team_id, team_name, team_logo, position_label, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)
values
  (460, 'San Lorenzo', 'https://media.api-sports.io/football/teams/460.png', 'Lateral izquierdo', 'abierto', 2, 'Marcos', current_date + 2, null, 'Marcos', now() - interval '4 days', now() - interval '4 days'),
  (435, 'River Plate', 'https://media.api-sports.io/football/teams/435.png', 'Centrodelantero de área', 'cerrado', (select id from public.market_team_members where name='Franco'), 'Franco', current_date - 30, null, 'Franco', now() - interval '40 days', now() - interval '30 days');

select 'seed ok' as status;
