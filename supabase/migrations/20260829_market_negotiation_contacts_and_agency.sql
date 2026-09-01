-- Simplificacion del formulario "Nueva negociacion": un club real casi
-- siempre tiene mas de un contacto util (el que atendio el llamado no
-- siempre es quien decide), asi que el contacto pasa de "un nombre suelto"
-- a una lista por club. Tambien se agrega "el jugador pertenece a Doble G"
-- como pregunta explicita en vez de asumirlo de la presencia de un agente
-- externo (somos una agencia de representacion y a veces intermediamos sin
-- ser el representante).

alter table market_negotiations
  add column if not exists target_club_contacts jsonb not null default '[]'::jsonb,
  add column if not exists current_club_contacts jsonb not null default '[]'::jsonb,
  add column if not exists belongs_to_agency boolean;

-- Backfill: los contactos sueltos que ya existen se migran a la lista nueva
-- (nada se pierde). `belongs_to_agency` queda en null para lo viejo — no se
-- asume retroactivamente algo que nadie cargo.
update market_negotiations
set target_club_contacts = jsonb_build_array(
  jsonb_build_object('name', target_club_contact_name, 'role', target_club_contact_role)
)
where target_club_contact_name is not null and target_club_contact_name != '';

update market_negotiations
set current_club_contacts = jsonb_build_array(
  jsonb_build_object('name', current_club_contact_name, 'role', null)
)
where current_club_contact_name is not null and current_club_contact_name != '';

alter table market_negotiations
  drop column if exists target_club_contact_name,
  drop column if exists target_club_contact_role,
  drop column if exists current_club_contact_name;
