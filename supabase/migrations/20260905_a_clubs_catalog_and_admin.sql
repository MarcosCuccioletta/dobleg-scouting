-- Se suma sobre el esquema de 20260904_a_multi_club_membership.sql
-- (independiente-platform), ya aplicado y en uso: user_profiles sigue siendo
-- el "club de siempre" de la cuenta, user_club_memberships las membresias
-- extra, current_club_id() sigue resolviendo por el header x-app-club. Nada
-- de eso se toca.
--
-- Esto agrega solamente: un catalogo real de clubes (en vez de un texto libre
-- tipeado a mano -- si a mano tipeas 'independinete' con una letra de mas, te
-- queda un club fantasma sin datos y sin aviso) y una tabla de super-admins
-- para la pantalla /admin/accesos (Tasks siguientes), que da de alta el club
-- de siempre y las membresias extra de una cuenta sin escribir SQL.

create table public.clubs (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;
-- Sin policies para `authenticated`: se lee/escribe solo via las Netlify
-- Functions de admin (service_role), nunca directo desde el browser.

create table public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid())
$$;

-- Seed: los clubes que ya existen hoy (usados en user_profiles.club_id /
-- user_club_memberships.club_id).
insert into public.clubs (id, name) values
  ('dobleg', 'Doble G Sports Group'),
  ('independiente', 'Independiente')
on conflict do nothing;

-- marcoscucho99@gmail.com es el unico super-admin por ahora.
insert into public.super_admins (user_id)
select id from auth.users where email = 'marcoscucho99@gmail.com'
on conflict do nothing;

-- Integridad: club_id en user_club_memberships y en user_profiles debe
-- existir en el catalogo (evita el typo que este comentario menciona arriba).
alter table public.user_club_memberships
  add constraint user_club_memberships_club_id_fkey foreign key (club_id) references public.clubs(id);
alter table public.user_profiles
  add constraint user_profiles_club_id_fkey foreign key (club_id) references public.clubs(id);
