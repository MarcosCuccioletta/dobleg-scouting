-- Fundamento de membresias multi-club: reemplaza el club_id unico por cuenta
-- (user_profiles) por una relacion muchos-a-muchos, para que una cuenta pueda
-- pertenecer a varios clubes a la vez (ej. marcoscucho99@gmail.com en Doble G
-- Y en Independiente). Puramente aditivo: no toca las tablas/policies viejas
-- todavia (eso es el Task 18, despues de que el frontend este desplegado).
-- Ver docs/superpowers/specs/2026-09-05-multi-club-memberships-design.md.

create table public.clubs (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.user_club_memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  club_id    text not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);

create table public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS habilitado, CERO policies para `authenticated`: nadie lee/escribe estas
-- tres tablas directo desde el browser. El unico acceso es via las funciones
-- SECURITY DEFINER de abajo (chequeo de pertenencia) o via Netlify Functions
-- con service_role (pantalla de admin, Tasks 20-21).
alter table public.clubs enable row level security;
alter table public.user_club_memberships enable row level security;
alter table public.super_admins enable row level security;

create or replace function public.is_club_member(target_club_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_club_memberships
    where user_id = auth.uid() and club_id = target_club_id
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid())
$$;

-- Seed: los dos clubes que ya existen.
insert into public.clubs (id, name) values
  ('dobleg', 'Doble G Sports Group'),
  ('independiente', 'Independiente')
on conflict do nothing;

-- marcoscucho99@gmail.com es el unico super-admin por ahora.
insert into public.super_admins (user_id)
select id from auth.users where email = 'marcoscucho99@gmail.com'
on conflict do nothing;

-- Backfill: cada fila de user_profiles (club_id unico de hoy) se convierte en
-- una membresia.
insert into public.user_club_memberships (user_id, club_id, created_at)
select user_id, club_id, created_at from public.user_profiles
on conflict do nothing;

-- Fix del bug reportado + pedido explicito del usuario: su cuenta pertenece a
-- los dos clubes (hoy solo tenia 'independiente' en user_profiles).
insert into public.user_club_memberships (user_id, club_id)
select id, 'dobleg' from auth.users where email = 'marcoscucho99@gmail.com'
union all
select id, 'independiente' from auth.users where email = 'marcoscucho99@gmail.com'
on conflict do nothing;
