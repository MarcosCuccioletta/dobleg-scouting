# Membresías Multi-Club (una cuenta, varios clubes) — Design Spec

## Contexto y problema

Hoy `public.user_profiles` guarda **un solo `club_id` por cuenta** (`user_id` es su PK). Cada plataforma de club (Doble G en `primer-appcloud`, Independiente en `independiente-platform`, y las que vengan) es un repo/deploy separado que comparte el mismo proyecto Supabase (misma Auth, mismas tablas). Como el `club_id` vive en la cuenta y no en la app, una cuenta que se loguea en dos plataformas distintas resuelve siempre al mismo club en las dos — no hay forma de que la cuenta de Marcos sea "dobleg" en la agencia e "independiente" en el clon a la vez.

Esto causó el bug reportado: la cuenta `marcoscucho99@gmail.com` quedó con `club_id = 'independiente'` (de cuando se armó el clon) y nunca se le sumó `'dobleg'`, así que en la agencia no veía nada (el Seguimiento GG real es todo `club_id='dobleg'`), y cualquier cosa que cargara desde Independiente quedaba en el mismo balde `'independiente'` que veía en ambas plataformas — dando la sensación de "mezcla" cuando en realidad ambas plataformas mostraban el mismo recorte de su única cuenta.

A futuro va a haber más clubes/academias, todas compartiendo el mismo backend, y las mismas cuentas (empezando por la de Marcos) van a necesitar pertenecer a varios clubes a la vez, en pestañas simultáneas.

## Objetivo

Que una cuenta pueda pertenecer a **N clubes simultáneamente**, que cada plataforma (repo) siga sabiendo de fábrica a qué club pertenece y sólo muestre/grabe datos de ESE club, y que dar de alta el acceso de una cuenta a un club sea una operación explícita, auditable y sin margen para el typo que causó este bug (`club_id` pasa de texto libre a un catálogo con integridad referencial).

## Fuera de alcance

- Selector de "club activo" dentro de una sola app — cada plataforma sigue siendo su propio deploy con su club fijo (decisión ya tomada).
- Admins por club (Gabriel gestionando accesos de Doble G) — sólo `marcoscucho99@gmail.com` administra accesos por ahora. Se deja la puerta abierta (ver "Extensiones futuras") pero no se construye ahora.
- Cambiar el branding/dominio por plataforma — no se toca.
- Cualquier UI de auto-registro/onboarding para que un club nuevo se dé de alta solo — el alta de clubes también la hace el super-admin.

## Modelo de datos

### Tablas nuevas

```sql
-- Catálogo de clubes. Reemplaza el texto libre 'dobleg'/'independiente' tipeado a mano.
create table public.clubs (
  id         text primary key,   -- slug estable, ej. 'dobleg', 'independiente'
  name       text not null,      -- nombre para mostrar en el admin
  created_at timestamptz not null default now()
);

-- A qué club(es) pertenece cada cuenta. Reemplaza a user_profiles (1 club por cuenta).
create table public.user_club_memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  club_id    text not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);

-- Quién puede administrar accesos. Hoy: solo Marcos.
create table public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

Ninguna de las tres tiene policies para `authenticated` — RLS queda habilitado con **cero policies** (deny-by-default). El único acceso de lectura/escritura pasa por:
- las funciones `SECURITY DEFINER` de abajo (para el chequeo de pertenencia que hace cada app), o
- las funciones serverless con `service_role` que usa la pantalla de admin (nunca el cliente del browser directo).

### Funciones RLS

```sql
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
```

`public.current_club_id()` se elimina (ya no tiene sentido: una cuenta puede tener varios clubes, no hay un único "el club del usuario").

### Tablas existentes afectadas (22)

Mismo patrón para las 22 tablas que hoy filtran por `club_id = public.current_club_id()`:

`agency_classifications`, `agency_classification_history`, `agency_players`, `agency_coaches`, `agency_manual_fixtures`, `coach_future_squads`, `coach_match_notes`, `coach_match_team_stats`, `coach_tactical_boards`, `coach_training_sessions`, `coach_video_analysis_buckets`, `coach_video_analysis_matches`, `market_negotiations`, `market_negotiation_notes`, `market_club_needs`, `market_need_candidates`, `market_team_members`, `gps_entries`, `player_videos`, `club_squads`, `scout_players`, `scout_players_status`.

Para cada una:
1. `alter table ... add constraint ..._club_id_fkey foreign key (club_id) references public.clubs(id)` — integridad referencial nueva (hoy es texto libre).
2. `alter table ... alter column club_id drop default` — ya no hay un club "default" válido para una cuenta multi-club; cada app debe mandarlo explícito (ver contrato de frontend).
3. Reemplazar las policies `USING (club_id = public.current_club_id())` por `USING (public.is_club_member(club_id))` (mismo cambio en `WITH CHECK`).

`user_profiles` y su policy `read_own_profile` se eliminan (su único dato, `club_id`, ya vive en `user_club_memberships`).

### Migración de datos

```sql
insert into public.clubs (id, name) values
  ('dobleg', 'Doble G Sports Group'),
  ('independiente', 'Independiente')
on conflict do nothing;

insert into public.super_admins (user_id)
select id from auth.users where email = 'marcoscucho99@gmail.com'
on conflict do nothing;

insert into public.user_club_memberships (user_id, club_id, created_at)
select user_id, club_id, created_at from public.user_profiles
on conflict do nothing;

-- Fix del bug + pedido explícito de Marcos: su cuenta pertenece a los dos clubes.
insert into public.user_club_memberships (user_id, club_id)
select id, 'dobleg' from auth.users where email = 'marcoscucho99@gmail.com'
union all
select id, 'independiente' from auth.users where email = 'marcoscucho99@gmail.com'
on conflict do nothing;
```

## Contrato de frontend (por plataforma/repo)

Cada repo declara su club de fábrica una sola vez:

```ts
// src/constants/club.ts
export const CLUB_ID = 'dobleg' // 'independiente' en el clon, etc.
```

**Regla dura, sin excepciones:** ninguna lectura ni escritura de las 22 tablas de arriba puede depender del filtrado implícito de RLS solamente. Todo `select` agrega `.eq('club_id', CLUB_ID)`; todo `insert` manda `club_id: CLUB_ID` explícito. RLS deja de ser "el filtro que decide qué ves" y pasa a ser "el candado que evita que veas/grabes un club al que no pertenecés" — la app sigue siendo la que decide *cuál* club mostrar.

Motivo: con una cuenta que pertenece a varios clubes, `is_club_member(club_id)` sin un filtro explícito de la app dejaría pasar CUALQUIER fila cuyo club sea uno de los tuyos — mezclando de nuevo los clubes de una cuenta multi-club dentro de una misma pantalla si no se filtra a mano.

### Gate de acceso (pantalla "no autorizado")

Reemplaza `getMyClubId`/`clubId` de `AuthContext`:

```ts
// src/services/clubAccessService.ts
export async function hasClubAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_club_member', { target_club_id: CLUB_ID })
  if (error) return false
  return !!data
}
```

`AuthContext` expone `hasAccess: boolean | undefined` (`undefined` = resolviendo, igual que hoy). `Layout.tsx` muestra la pantalla de "no autorizado" cuando `hasAccess === false` — mismo componente visual que ya existe, cambia sólo de dónde sale el booleano.

### Servicios a actualizar (ambos repos)

Todo servicio que hace `.from(<una de las 22 tablas>)` sin filtro de club hoy. La lista exacta de archivos se releva en el plan de implementación (vía grep por tabla), no se enumera acá — el contrato de arriba aplica parejo a todos.

## Pantalla de administración de accesos

Nueva ruta `/admin/accesos` **sólo en `primer-appcloud`** (la agencia) — administra accesos a TODOS los clubes desde un único lugar, no se repite por repo. Sólo se renderiza si `is_super_admin()` devuelve `true`; si no, la ruta se comporta como 404 (mismo componente que `NotFoundPage`).

Funciones:
1. Buscar cuenta por email → ver sus membresías actuales.
2. Sumar/quitar una membresía (club existente) a esa cuenta.
3. Dar de alta un club nuevo (id/slug + nombre).
4. Listar clubes existentes.

El browser nunca puede leer `auth.users` ni escribir en `user_club_memberships`/`clubs`/`super_admins` directamente (cero policies, ver arriba). Estas operaciones van por **Netlify Functions con `service_role`**, mismo patrón que ya usa `netlify/functions/delete-account.js`:

- `admin-search-user.js` — recibe email, devuelve `{ id, email }` (via `supabaseAdmin.auth.admin.listUsers` filtrado) + sus membresías actuales.
- `admin-list-clubs.js` — lista `clubs`.
- `admin-create-club.js` — inserta en `clubs`.
- `admin-set-membership.js` — agrega o quita una fila de `user_club_memberships`.

Todas verifican `Authorization: Bearer <token>` del que llama: decodifican el usuario con `supabaseAdmin.auth.getUser(token)` y chequean que su `id` esté en `super_admins` (con `service_role`, bypaseando RLS) antes de hacer nada. Si no es super-admin: 403.

## Orden de despliegue (para no romper producción en vivo)

Las apps están en uso real todos los días — el corte hay que hacerlo sin ventana de downtime visible.

1. **Aditivo, sin tocar nada existente:** crear `clubs`, `user_club_memberships`, `super_admins`, `is_club_member()`, `is_super_admin()`; backfillear datos (incluida la membresía doble de Marcos). Las policies viejas (`current_club_id()`) siguen intactas y funcionando — cero impacto visible todavía.
2. **Deploy de frontend en los dos repos:** `CLUB_ID` explícito + filtros `.eq('club_id', CLUB_ID)` en cada query + gate nuevo (`hasClubAccess`/RPC `is_club_member`). Esto funciona igual de bien contra las policies VIEJAS (para cuentas de un solo club, que son todas menos Marcos, el resultado es idéntico) — es un deploy seguro de hacer antes del corte de RLS, con ventana de rollback simple.
3. **Corte de RLS:** recién ahí se reemplazan las 22 policies por `is_club_member(club_id)`, se agregan las FK a `clubs`, se sacan los `DEFAULT`, se borra `current_club_id()` y `user_profiles`.
4. **Verificación:** loguear a Marcos en la agencia (ve el Seguimiento GG real) y en Independiente (ve el plantel real) — en simultáneo, en dos pestañas. Loguear a Gabriel — sin cambios visibles.
5. **Admin UI:** se puede construir y desplegar en cualquier momento después del paso 1 (depende sólo del esquema nuevo) — se deja al final porque no bloquea el fix del bug.

## Testing

- **Servicios de frontend** (`clubAccessService`, y cada service actualizado): tests unitarios con el mock de `@/lib/supabase` ya usado en el proyecto (patrón de `agencyCoachesService.test.ts` / `userProfileService.test.ts`), verificando que cada query manda `club_id: CLUB_ID` / `.eq('club_id', CLUB_ID)`.
- **RLS**: no hay framework de test SQL en el repo (no pgTAP). Verificación manual documentada en el plan: correr las políticas nuevas contra casos concretos (cuenta de un club, cuenta de dos clubes, cuenta sin ninguno) desde el SQL Editor simulando `auth.uid()`, más el smoke test real del paso 4 de arriba.
- **Netlify functions de admin**: tests de que rechazan (403) a un caller que no está en `super_admins`, siguiendo el patrón de test que ya exista (si lo hay) para `delete-account.js`; si no existe patrón de test para funciones serverless en el repo, se documenta como verificación manual en el plan.

## Extensiones futuras (no ahora, sólo para no cerrar puertas)

- Admins por club (hoy sólo super-admin global): agregar un rol `club_admin` en `user_club_memberships` (columna `role`) sin romper lo de arriba.
- Auto-alta de cuentas nuevas por club (invitaciones): hoy sigue siendo 100% manual vía la pantalla de admin.
