# Membresías Multi-Club Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una cuenta pueda pertenecer a varios clubes a la vez (Doble G, Independiente, y los que sigan), sin que las plataformas mezclen datos entre clubes — arregla el bug de Seguimiento GG vacío/mezclado de `marcoscucho99@gmail.com` y deja el modelo listo para sumar clubes nuevos sin repetir el problema.

**Architecture:** `user_club_memberships` (muchos-a-muchos) reemplaza el `club_id` único de `user_profiles`. RLS pasa de "filtra por el club del usuario" a "permite si el usuario es miembro de ESE club" (`is_club_member(club_id)`). Cada plataforma (repo) sigue declarando su propio club de fábrica (`CLUB_ID`) y un wrapper `db(table)` centraliza el filtro/campo `club_id` explícito en cada query — así ninguna pantalla puede olvidarse de scopear por club, ni una cuenta multi-club ve sus clubes mezclados. Una pantalla `/admin/accesos`, sólo en la plataforma de la agencia, administra qué cuenta pertenece a qué club.

**Tech Stack:** Supabase (Postgres + RLS + Auth), React 18 + TypeScript, Vitest (mock de `@/lib/supabase`, patrón ya usado en `agencyCoachesService.test.ts`), Netlify Functions con `service_role` (patrón ya usado en `netlify/functions/delete-account.js`).

**Spec:** `docs/superpowers/specs/2026-09-05-multi-club-memberships-design.md`

## Global Constraints

- Este plan toca DOS repos: `primer-appcloud` (agencia, `CLUB_ID = 'dobleg'`) e `independiente-platform` (`CLUB_ID = 'independiente'`), ambos apuntando al mismo proyecto Supabase (`qgwmxjjumauortbwvivu`).
- Ninguna lectura/escritura de una tabla "de club" puede depender sólo de RLS para decidir qué mostrar — siempre pasa por el wrapper `db(table)`, que agrega `.eq('club_id', CLUB_ID)` (lecturas) o `club_id: CLUB_ID` (escrituras) explícito.
- **Orden de despliegue no negociable:** las migraciones que tocan RLS (Task 18, el "corte") NO se aplican hasta que el frontend de LOS DOS repos (Tasks 1-16) esté desplegado en producción — las apps están en uso real todos los días. Task 17 es el checkpoint de esto.
- Las 22 tablas "de club" son: `agency_classifications`, `agency_classification_history`, `agency_players`, `agency_coaches`, `agency_manual_fixtures`, `coach_future_squads`, `coach_match_notes`, `coach_match_team_stats`, `coach_tactical_boards`, `coach_training_sessions`, `coach_video_analysis_buckets`, `coach_video_analysis_matches`, `market_negotiations`, `market_negotiation_notes`, `market_club_needs`, `market_need_candidates`, `market_team_members`, `gps_entries`, `player_videos`, `club_squads`, `scout_players`, `scout_players_status`.
- Las migraciones SQL se aplican a mano en el SQL Editor de Supabase (no hay `supabase db push` en el flujo de este proyecto) — cada task de migración termina pidiéndole al usuario que la corra y confirme el resultado, no hay forma de automatizarlo desde acá (sólo hay la `anon key` en `.env.local`, no la `service_role`).

---

### Task 1: Migración aditiva — clubes, membresías, super-admin

**Files:**
- Create: `supabase/migrations/20260905_a_multi_club_memberships.sql`

**Interfaces:**
- Produces: tablas `public.clubs`, `public.user_club_memberships`, `public.super_admins`; funciones `public.is_club_member(target_club_id text) returns boolean` y `public.is_super_admin() returns boolean` — consumidas por todas las tasks siguientes (frontend vía RPC, RLS del Task 18 directamente).
- Consumes: nada — es aditivo, no toca tablas ni policies existentes.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260905_a_multi_club_memberships.sql
--
-- Fundamento de membresías multi-club: reemplaza el club_id unico por cuenta
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
```

- [ ] **Step 2: Pedirle al usuario que la corra en el SQL Editor de Supabase**

No hay forma de aplicarla desde acá (sólo tenemos la `anon key`). Pedirle a Marcos que pegue el contenido de arriba en el SQL Editor del proyecto (`qgwmxjjumauortbwvivu`) y lo corra.

- [ ] **Step 3: Verificar el resultado — pedirle que corra esta consulta y comparta el resultado**

```sql
select u.email, m.club_id
from public.user_club_memberships m
join auth.users u on u.id = m.user_id
order by u.email, m.club_id;
```

Expected: `marcoscucho99@gmail.com` aparece dos veces (`dobleg` e `independiente`); el resto del staff aparece una vez con `dobleg`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260905_a_multi_club_memberships.sql
git commit -m "feat(multi-club): membresias muchos-a-muchos (clubs, user_club_memberships, super_admins)"
```

---

### Task 2: Wrapper `db()` y constante `CLUB_ID` — primer-appcloud

**Files:**
- Create: `src/constants/club.ts`
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: nada de Supabase todavía en runtime — sólo el import de `@/lib/supabase` (ya existente).
- Produces: `CLUB_ID: string` (Task 3 en adelante lo usa); `db(table: ClubScopedTable)` con métodos `select`/`insert`/`upsert`/`update`/`delete` — consumido por todas las conversiones de servicios (Tasks 5, 10-13).

- [ ] **Step 1: Escribir el test (falla primero)**

```ts
// src/lib/db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { db } from './db'

function chain() {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = vi.fn(self)
  builder.eq = vi.fn(self)
  builder.insert = vi.fn(self)
  builder.upsert = vi.fn(self)
  builder.update = vi.fn(self)
  builder.delete = vi.fn(self)
  return builder
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('db', () => {
  it('select agrega el filtro club_id explicito', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').select('*')

    expect(mockFrom).toHaveBeenCalledWith('scout_players')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('club_id', 'dobleg')
  })

  it('insert agrega club_id explicito a un objeto', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').insert({ full_name: 'L. Messi' })

    expect(builder.insert).toHaveBeenCalledWith({ full_name: 'L. Messi', club_id: 'dobleg' }, undefined)
  })

  it('insert agrega club_id explicito a cada fila de un array', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').insert([{ full_name: 'A' }, { full_name: 'B' }])

    expect(builder.insert).toHaveBeenCalledWith(
      [{ full_name: 'A', club_id: 'dobleg' }, { full_name: 'B', club_id: 'dobleg' }],
      undefined
    )
  })

  it('update agrega el filtro club_id explicito', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').update({ status: 'x' })

    expect(builder.update).toHaveBeenCalledWith({ status: 'x' })
    expect(builder.eq).toHaveBeenCalledWith('club_id', 'dobleg')
  })

  it('delete agrega el filtro club_id explicito', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').delete()

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('club_id', 'dobleg')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/db.test.ts`
Expected: FAIL — `src/lib/db.ts` todavía no existe.

- [ ] **Step 3: Crear la constante de club**

```ts
// src/constants/club.ts
// Club de fábrica de ESTA plataforma. Cada repo/deploy (agencia, Independiente,
// los que sigan) tiene su propio valor fijo acá — nunca se infiere de la cuenta
// logueada, porque una cuenta puede pertenecer a varios clubes a la vez.
export const CLUB_ID = 'dobleg'
```

- [ ] **Step 4: Implementar el wrapper**

```ts
// src/lib/db.ts
import { supabase } from './supabase'
import { CLUB_ID } from '@/constants/club'

// Tablas "de club": cada club ve y escribe sólo sus propias filas. Si agregás
// una tabla nueva con columna club_id, sumala acá — si te olvidás, sus queries
// quedan sin scopear (el mismo bug que mezcló Seguimiento GG entre plataformas).
// Ver docs/superpowers/specs/2026-09-05-multi-club-memberships-design.md.
const CLUB_SCOPED_TABLES = [
  'agency_classifications',
  'agency_classification_history',
  'agency_players',
  'agency_coaches',
  'agency_manual_fixtures',
  'coach_future_squads',
  'coach_match_notes',
  'coach_match_team_stats',
  'coach_tactical_boards',
  'coach_training_sessions',
  'coach_video_analysis_buckets',
  'coach_video_analysis_matches',
  'market_negotiations',
  'market_negotiation_notes',
  'market_club_needs',
  'market_need_candidates',
  'market_team_members',
  'gps_entries',
  'player_videos',
  'club_squads',
  'scout_players',
  'scout_players_status',
] as const

export type ClubScopedTable = typeof CLUB_SCOPED_TABLES[number]

function withClubId<T extends Record<string, unknown>>(row: T) {
  return { ...row, club_id: CLUB_ID }
}

/**
 * Reemplazo de `supabase.from(table)` para las tablas "de club": inyecta el
 * filtro/campo club_id en cada operación, para que ningún call site pueda
 * olvidarse de scopear por club.
 */
export function db(table: ClubScopedTable) {
  const qb = supabase.from(table)
  return {
    select: (...args: any[]) => (qb.select as any)(...args).eq('club_id', CLUB_ID),
    insert: (values: any, options?: any) =>
      (qb.insert as any)(Array.isArray(values) ? values.map(withClubId) : withClubId(values), options),
    upsert: (values: any, options?: any) =>
      (qb.upsert as any)(Array.isArray(values) ? values.map(withClubId) : withClubId(values), options),
    update: (values: any) => (qb.update as any)(values).eq('club_id', CLUB_ID),
    delete: () => qb.delete().eq('club_id', CLUB_ID),
  }
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/db.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/constants/club.ts src/lib/db.ts src/lib/db.test.ts
git commit -m "feat(multi-club): wrapper db() que scopea explicito por CLUB_ID"
```

---

### Task 3: `clubAccessService` — primer-appcloud

**Files:**
- Create: `src/services/clubAccessService.ts`
- Test: `src/services/clubAccessService.test.ts`

**Interfaces:**
- Consumes: RPC `is_club_member` (Task 1), `CLUB_ID` (Task 2).
- Produces: `hasClubAccess(): Promise<boolean>` — consumido por `AuthContext` (Task 4).

- [ ] **Step 1: Escribir el test (falla primero)**

```ts
// src/services/clubAccessService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { hasClubAccess } from './clubAccessService'

beforeEach(() => {
  mockRpc.mockReset()
})

describe('hasClubAccess', () => {
  it('devuelve true cuando is_club_member responde true', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    expect(await hasClubAccess()).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('is_club_member', { target_club_id: 'dobleg' })
  })

  it('devuelve false cuando is_club_member responde false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    expect(await hasClubAccess()).toBe(false)
  })

  it('devuelve false si Supabase devuelve error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('boom') })
    expect(await hasClubAccess()).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/services/clubAccessService.test.ts`
Expected: FAIL — el archivo todavía no existe.

- [ ] **Step 3: Implementar el servicio**

```ts
// src/services/clubAccessService.ts
import { supabase } from '@/lib/supabase'
import { CLUB_ID } from '@/constants/club'

export async function hasClubAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_club_member', { target_club_id: CLUB_ID })
  if (error) return false
  return !!data
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/services/clubAccessService.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/clubAccessService.ts src/services/clubAccessService.test.ts
git commit -m "feat(multi-club): clubAccessService.hasClubAccess reemplaza getMyClubId"
```

---

### Task 4: `AuthContext` + `Layout` — gate de acceso por membresía (primer-appcloud)

**Files:**
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Delete: `src/services/userProfileService.ts`
- Delete: `src/services/userProfileService.test.ts`

**Interfaces:**
- Consumes: `hasClubAccess()` (Task 3).
- Produces: `useAuth().hasAccess: boolean | undefined` — reemplaza `clubId`. No hay más consumidores de `clubId`/`getMyClubId` en el repo después de esta task (era sólo `Layout.tsx`).

- [ ] **Step 1: Reemplazar `clubId` por `hasAccess` en `AuthContext.tsx`**

En `src/context/AuthContext.tsx`, reemplazar el import:

```ts
import { getMyClubId } from '@/services/userProfileService'
```
por
```ts
import { hasClubAccess } from '@/services/clubAccessService'
```

Reemplazar en la interfaz `AuthState`:
```ts
  /** undefined = todavía resolviendo tras el login; null = sin fila en user_profiles (sin acceso); string = club_id real. */
  clubId: string | null | undefined
```
por
```ts
  /** undefined = todavía resolviendo tras el login; false = sin membresía a este club; true = con acceso. */
  hasAccess: boolean | undefined
```

Reemplazar el estado:
```ts
  const [clubId, setClubId] = useState<string | null | undefined>(undefined)
```
por
```ts
  const [hasAccess, setHasAccess] = useState<boolean | undefined>(undefined)
```

Reemplazar las CUATRO ocurrencias de:
```ts
      if (session?.user) {
        getMyClubId(session.user.id).then(setClubId)
      } else {
        setClubId(undefined)
      }
```
por:
```ts
      if (session?.user) {
        hasClubAccess().then(setHasAccess)
      } else {
        setHasAccess(undefined)
      }
```

(aparecen dos veces en el `useEffect` — una para `getSession()`, otra para `onAuthStateChange` — reemplazar las dos).

Reemplazar el value del provider:
```tsx
    <AuthContext.Provider value={{ user, session, loading, clubId, signIn, signUp, signInWithGoogle, signInWithApple, signOut, deleteAccount, userDisplayName }}>
```
por
```tsx
    <AuthContext.Provider value={{ user, session, loading, hasAccess, signIn, signUp, signInWithGoogle, signInWithApple, signOut, deleteAccount, userDisplayName }}>
```

- [ ] **Step 2: Actualizar `Layout.tsx`**

Reemplazar:
```ts
  const { user, loading, clubId, signOut } = useAuth()
```
por
```ts
  const { user, loading, hasAccess, signOut } = useAuth()
```

Reemplazar:
```tsx
  // Sesión resuelta pero el club todavía no se resolvió — mismo spinner que el loading inicial.
  if (clubId === undefined) {
```
por
```tsx
  // Sesión resuelta pero el acceso todavía no se resolvió — mismo spinner que el loading inicial.
  if (hasAccess === undefined) {
```

Reemplazar:
```tsx
  // Usuario logueado sin fila en user_profiles: sin acceso a esta plataforma.
  if (clubId === null) {
```
por
```tsx
  // Usuario logueado sin membresía a este club: sin acceso a esta plataforma.
  if (hasAccess === false) {
```

El resto del bloque (ícono, textos, botón de cerrar sesión) no cambia.

- [ ] **Step 3: Borrar el servicio viejo**

```bash
git rm src/services/userProfileService.ts src/services/userProfileService.test.ts
```

- [ ] **Step 4: Verificar que compila y pasan los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores de tipos, todos los tests en verde (los 3 de `userProfileService.test.ts` desaparecen, no los reemplaza ninguno nuevo — su lógica ya está cubierta por `clubAccessService.test.ts` del Task 3).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(multi-club): AuthContext/Layout usan hasClubAccess en vez de club_id unico"
```

---

### Task 5: Convertir `scoutPlayersService.ts` a `db()` (primer-appcloud)

**Files:**
- Modify: `src/services/scoutPlayersService.ts`

**Interfaces:**
- Consumes: `db()` (Task 2).
- Produces: nada nuevo — mismo API público del archivo, ahora scopeado por club.

- [ ] **Step 1: Agregar el import**

Al principio del archivo, junto a los imports existentes:

```ts
import { db } from '@/lib/db'
```

- [ ] **Step 2: Reemplazar cada `supabase.from('scout_players')` / `.from('scout_players')` por `db('scout_players')`, y `supabase.from('scout_players_status')` / `.from('scout_players_status')` por `db('scout_players_status')`**

Hay 25 ocurrencias en este archivo (todas las que dicen `scout_players` o `scout_players_status`). El cambio es siempre el mismo patrón — quitar `supabase` como receptor y llamar a `db(...)` en su lugar:

```ts
// Antes (llamada directa, ej. línea 42):
  const { data } = await supabase
    .from('scout_players')
    .select('id, in_datos_list, in_scouts_gg_list, player_db_id, supabase_player_id')
    .eq('supabase_player_id', player.supabase_player_id)
    .maybeSingle()

// Después:
  const { data } = await db('scout_players')
    .select('id, in_datos_list, in_scouts_gg_list, player_db_id, supabase_player_id')
    .eq('supabase_player_id', player.supabase_player_id)
    .maybeSingle()
```

```ts
// Antes (ej. línea 121, update):
    const { data, error } = await supabase
      .from('scout_players')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()

// Después:
    const { data, error } = await db('scout_players')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()
```

```ts
// Antes (ej. línea 133, insert — con .insert({ ...player, ... })):
  const { data, error } = await supabase
    .from('scout_players')
    .insert({
      ...player,
      full_name: player.full_name.trim(),
      ...

// Después (el spread ...player se mantiene igual — db() agrega club_id solo):
  const { data, error } = await db('scout_players')
    .insert({
      ...player,
      full_name: player.full_name.trim(),
      ...
```

```ts
// Antes (delete, línea 451):
    const { error } = await supabase.from('scout_players').delete().eq('id', id)

// Después:
    const { error } = await db('scout_players').delete().eq('id', id)
```

```ts
// Antes (scout_players_status insert, línea 473):
  const { data, error } = await supabase
    .from('scout_players_status')
    .insert({
      player_id: playerId,
      ...

// Después:
  const { data, error } = await db('scout_players_status')
    .insert({
      player_id: playerId,
      ...
```

Aplicar el mismo patrón (borrar `supabase` + `.` antes de `from(...)`, llamar `db(...)`) en el resto de las líneas que dicen `.from('scout_players')` o `.from('scout_players_status')`: son las funciones `findExistingScoutPlayer` (3 sitios más), `fetchScoutPlayers`, `fetchScoutPlayersWithScores`, `linkScoutPlayerToDb`, `linkScoutPlayerClub`, `updateScoutPlayer`, `removeScoutPlayerFromList` (2 sitios), `fetchScoutPlayerStatuses`, `uploadScoutPlayerFile` (2 sitios), `fetchScoutPlayerRecord` (3 sitios), `fetchScoutsGGPlayers`, `fetchTrackedPlayerNames`, `removeScoutPlayerFile` (2 sitios). Ninguna de estas cambia su lógica interna (los `.eq(...)`, `.order(...)`, `.select(...)`, `.ilike(...)`, `.maybeSingle(...)`, `.single(...)` que ya tenían se mantienen igual, encadenados después de `db('scout_players')`).

**No tocar** las llamadas a `supabase.from('scout_evaluations')`, `supabase.from('players')` ni `supabase.from('teams')` de este mismo archivo — esas tablas no son "de club", quedan como están.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Correr la suite completa**

Run: `npm test`
Expected: PASS (este archivo no tiene test propio hoy; corre para confirmar que no rompió nada en pantallas que lo consumen).

- [ ] **Step 5: Commit**

```bash
git add src/services/scoutPlayersService.ts
git commit -m "fix(multi-club): scoutPlayersService scopea explicito por club_id via db()"
```

---

### Task 6: Wrapper `db()` y constante `CLUB_ID` — independiente-platform

**Files** (en `C:\Users\marcos\Desktop\Proyectos Claude\independiente-platform`):
- Create: `src/constants/club.ts`
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:** iguales a Task 2, con un solo cambio de valor.

- [ ] **Step 1-6: repetir exactamente los Steps 1-6 del Task 2**, con una única diferencia: `src/constants/club.ts` queda:

```ts
// src/constants/club.ts
export const CLUB_ID = 'independiente'
```

Y el test `db.test.ts` usa `'independiente'` en vez de `'dobleg'` en los `toHaveBeenCalledWith` (los 4 lugares que hoy dicen `'dobleg'`).

Commit:
```bash
git add src/constants/club.ts src/lib/db.ts src/lib/db.test.ts
git commit -m "feat(multi-club): wrapper db() que scopea explicito por CLUB_ID"
```

---

### Task 7: `clubAccessService` — independiente-platform

**Files** (en `independiente-platform`):
- Create: `src/services/clubAccessService.ts`
- Test: `src/services/clubAccessService.test.ts`

- [ ] Repetir exactamente los Steps 1-5 del Task 3 (el código de `clubAccessService.ts` es idéntico — usa el `CLUB_ID` del Task 6, que ya vale `'independiente'`; sólo cambia el literal `'dobleg'` → `'independiente'` en la aserción del test `toHaveBeenCalledWith('is_club_member', { target_club_id: 'independiente' })`).

Commit:
```bash
git add src/services/clubAccessService.ts src/services/clubAccessService.test.ts
git commit -m "feat(multi-club): clubAccessService.hasClubAccess reemplaza getMyClubId"
```

---

### Task 8: `AuthContext` + `Layout` — independiente-platform

**Files** (en `independiente-platform`):
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Delete: `src/services/userProfileService.ts`
- Delete: `src/services/userProfileService.test.ts`

- [ ] Repetir exactamente los Steps 1-5 del Task 4. Verificar primero con `Grep`/lectura que `AuthContext.tsx` y `Layout.tsx` en este repo tienen el mismo shape que en `primer-appcloud` (es una copia del mismo clon) — si algún nombre de variable difiere, aplicar el mismo reemplazo conceptual (`clubId`→`hasAccess`, `getMyClubId`→`hasClubAccess`, `clubId === null`→`hasAccess === false`, `clubId === undefined`→`hasAccess === undefined`).

Commit:
```bash
git add -A
git commit -m "feat(multi-club): AuthContext/Layout usan hasClubAccess en vez de club_id unico"
```

---

### Task 9: Convertir `scoutPlayersService.ts` a `db()` (independiente-platform)

**Files** (en `independiente-platform`):
- Modify: `src/services/scoutPlayersService.ts`

- [ ] Repetir exactamente los Steps 1-5 del Task 5 — el archivo es idéntico byte a byte al de `primer-appcloud` en las líneas que llaman a `scout_players`/`scout_players_status` (mismos números de línea, mismo código), sólo cambia el `CLUB_ID` importado (ya resuelve a `'independiente'` por el Task 6).

Commit:
```bash
git add src/services/scoutPlayersService.ts
git commit -m "fix(multi-club): scoutPlayersService scopea explicito por club_id via db()"
```

---

### Task 10: Convertir servicios `agency_*` restantes (primer-appcloud)

**Files:**
- Modify: `src/services/agencyManualFixturesService.ts`
- Modify: `src/services/agencyPlayersService.ts`
- Modify: `src/services/agencyCoachesService.ts`
- Modify: `src/services/agencyClassificationService.ts`

**Interfaces:** consumen `db()` (Task 2); no cambian su API pública.

- [ ] **Step 1: `agencyManualFixturesService.ts` — agregar el import y convertir las 3 llamadas**

```ts
import { db } from '@/lib/db'
```

```ts
// Línea 17 — antes:
  let q = supabase.from('agency_manual_fixtures').select('*').order('match_date')
// después:
  let q = db('agency_manual_fixtures').select('*').order('match_date')
```

```ts
// Línea 28 — antes:
  const { error } = await supabase.from('agency_manual_fixtures').insert({
// después:
  const { error } = await db('agency_manual_fixtures').insert({
```

```ts
// Línea 44 — antes:
  const { error } = await supabase.from('agency_manual_fixtures').delete().eq('id', id)
// después:
  const { error } = await db('agency_manual_fixtures').delete().eq('id', id)
```

- [ ] **Step 2: `agencyPlayersService.ts` — agregar el import y convertir las 3 llamadas**

```ts
import { db } from '@/lib/db'
```

```ts
// Línea 77 — antes:
  const { data, error } = await supabase.from('agency_players').select('*')
// después:
  const { data, error } = await db('agency_players').select('*')
```

```ts
// Líneas 109 y 139 — antes (dos sitios, mismo patrón):
  const { error } = await supabase.from('agency_players').upsert({
// después:
  const { error } = await db('agency_players').upsert({
```

- [ ] **Step 3: `agencyCoachesService.ts` — agregar el import y convertir las 3 llamadas**

```ts
import { db } from '@/lib/db'
```

Líneas 42, 53 y 69 son todas `.from('agency_coaches')` encadenado desde `supabase` en la línea anterior (patrón `supabase\n    .from('agency_coaches')`) — en las 3, borrar `supabase` como receptor y usar `db('agency_coaches')`:

```ts
// Antes:
    .from('agency_coaches')
// (con `supabase` en la línea de arriba del mismo statement)
// después: la línea de arriba pasa a terminar en `= db('agency_coaches')`
// y esta línea con `.from(...)` se borra.
```

Ejemplo concreto de una de las 3 (mismo patrón para las otras dos, sólo cambia lo que sigue después del `.from(...)`):

```ts
// Antes:
  const { data, error } = await supabase
    .from('agency_coaches')
    .select('*')
    .order('full_name')

// Después:
  const { data, error } = await db('agency_coaches')
    .select('*')
    .order('full_name')
```

- [ ] **Step 4: `agencyClassificationService.ts` — agregar el import y convertir las 6 llamadas**

```ts
import { db } from '@/lib/db'
```

Líneas 26, 39, 48, 62 son `.from('agency_classifications')`; líneas 53 y 71 son `.from('agency_classification_history')` — mismo patrón que el Step 3 (la línea `supabase` de arriba pasa a `db('agency_classifications')` o `db('agency_classification_history')` según corresponda, y la línea `.from(...)` se borra).

- [ ] **Step 5: Verificar que compila y pasan los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores; `agencyPlayersService.test.ts` y `agencyCoachesService.test.ts` (los únicos con test de estos 4 archivos) siguen en verde — ninguno de los dos assertea argumentos exactos de `.select()`/`.insert()`, sólo el resultado final, así que el `.eq('club_id', ...)`/`club_id` extra que agrega `db()` no los rompe.

- [ ] **Step 6: Commit**

```bash
git add src/services/agencyManualFixturesService.ts src/services/agencyPlayersService.ts src/services/agencyCoachesService.ts src/services/agencyClassificationService.ts
git commit -m "fix(multi-club): servicios agency_* scopean explicito por club_id via db()"
```

---

### Task 11: Convertir servicios `coach_*` restantes (primer-appcloud)

**Files:**
- Modify: `src/services/coachService.ts`
- Modify: `src/services/futureSquadService.ts`
- Modify: `src/services/tacticalBoardService.ts`
- Modify: `src/services/videoAnalysisService.ts`

- [ ] **Step 1: `coachService.ts` — agregar el import y convertir las 8 llamadas**

```ts
import { db } from '@/lib/db'
```

- Líneas 65, 78, 100 → `coach_training_sessions`
- Líneas 113, 137, 154 → `coach_match_notes`
- Líneas 177, 199 → `coach_match_team_stats`

Mismo patrón en las 8: si es `supabase.from('X').metodo(...)` en una sola línea, queda `db('X').metodo(...)`; si es `supabase` en una línea y `.from('X')` en la siguiente, la primera línea pasa a terminar en `db('X')` y la línea `.from(...)` se borra.

- [ ] **Step 2: `futureSquadService.ts` — agregar el import y convertir las 2 llamadas** (líneas 49 y 70, `coach_future_squads`, mismo patrón).

- [ ] **Step 3: `tacticalBoardService.ts` — agregar el import y convertir las 5 llamadas** (líneas 38, 56, 74, 87, 99, todas `coach_tactical_boards`, mismo patrón).

- [ ] **Step 4: `videoAnalysisService.ts` — agregar el import y convertir las 8 llamadas**

- Líneas 16, 35, 57, 70 → `coach_video_analysis_buckets`
- Líneas 92, 111, 124, 158 → `coach_video_analysis_matches`

- [ ] **Step 5: Verificar que compila y pasan los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores. Ninguno de estos 4 archivos tiene test propio hoy — la verificación es la suite completa (pantallas que los consumen) más el chequeo de tipos.

- [ ] **Step 6: Commit**

```bash
git add src/services/coachService.ts src/services/futureSquadService.ts src/services/tacticalBoardService.ts src/services/videoAnalysisService.ts
git commit -m "fix(multi-club): servicios coach_* scopean explicito por club_id via db()"
```

---

### Task 12: Convertir `playerVideosService.ts` y `gpsService.ts` (primer-appcloud)

**Files:**
- Modify: `src/services/playerVideosService.ts`
- Modify: `src/services/gpsService.ts`

- [ ] **Step 1: `playerVideosService.ts` — agregar el import y convertir las 4 llamadas** (líneas 51, 73, 97, 103, todas `player_videos`, mismo patrón que las tasks anteriores).

- [ ] **Step 2: `gpsService.ts` — agregar el import y convertir las 7 llamadas** (líneas 102, 128, 178, 184, 194, 208, 216, todas `gps_entries`).

Ojo con la línea 178 (`const del = supabase.from('gps_entries').delete()`, con más código después usándola): queda `const del = db('gps_entries').delete()`, el resto de la función no cambia.

- [ ] **Step 3: Verificar que compila y pasan los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores; `gpsService.test.ts` (único con test de los dos) sigue en verde — sólo testea funciones puras (`distinctValues`, `toLegacyGpsEntry`, `resolveGpsPlayerKey`) que no tocan Supabase.

- [ ] **Step 4: Commit**

```bash
git add src/services/playerVideosService.ts src/services/gpsService.ts
git commit -m "fix(multi-club): playerVideosService y gpsService scopean explicito por club_id via db()"
```

---

### Task 13: Convertir `marketService.ts` (primer-appcloud)

**Files:**
- Modify: `src/services/marketService.ts`

- [ ] **Step 1: Agregar el import**

```ts
import { db } from '@/lib/db'
```

- [ ] **Step 2: Convertir las 29 llamadas, agrupadas por tabla**

- `market_club_needs`: líneas 68, 78, 163, 191, 231, 308, 310, 325.
- `market_negotiations`: líneas 109, 172, 221, 238, 289, 335, 337, 352, 465.
- `market_negotiation_notes`: líneas 315, 342, 362, 387.
- `market_team_members`: línea 128.
- `market_need_candidates`: líneas 97, 247, 431, 446, 456, 474, 483.

Mismo patrón que las tasks anteriores en las 29: `supabase.from('X').metodo(...)` en una línea → `db('X').metodo(...)`; `supabase` en una línea + `.from('X')` en la siguiente → la primera línea termina en `db('X')`, la de `.from(...)` se borra. Dos ejemplos representativos de este archivo (uno de cada forma):

```ts
// Línea 97 — antes:
  const { error: candidateErr } = await supabase.from('market_need_candidates').insert({
// después:
  const { error: candidateErr } = await db('market_need_candidates').insert({
```

```ts
// Línea 308 — antes:
  const { data: current } = await supabase.from('market_club_needs').select('assigned_to_id, assigned_to_name').eq('id', id).single()
// después:
  const { data: current } = await db('market_club_needs').select('assigned_to_id, assigned_to_name').eq('id', id).single()
```

- [ ] **Step 3: Verificar que compila y pasan los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores. Este archivo no tiene test propio hoy.

- [ ] **Step 4: Commit**

```bash
git add src/services/marketService.ts
git commit -m "fix(multi-club): marketService scopea explicito por club_id via db()"
```

---

### Task 14: Convertir servicios `agency_*` + `club_squads` restantes (independiente-platform)

**Files** (en `independiente-platform`):
- Modify: `src/services/agencyManualFixturesService.ts`
- Modify: `src/services/agencyPlayersService.ts`
- Modify: `src/services/agencyCoachesService.ts`
- Modify: `src/services/agencyClassificationService.ts`
- Modify: `src/services/clubSquadService.ts`
- Modify: `src/services/homeService.ts`

- [ ] **Step 1-4: repetir exactamente los Steps 1-4 del Task 10** — los 4 archivos `agency_*` de este repo son idénticos a los de `primer-appcloud` en las líneas que llaman a estas tablas (mismos números de línea).

- [ ] **Step 5: `clubSquadService.ts` — agregar el import y convertir la única llamada**

```ts
import { db } from '@/lib/db'
```

```ts
// Línea 51-52 — antes:
  const { data: squad, error: squadError } = await supabase
    .from('club_squads')
    .select('full_name, position, api_player_id, image, category')
    .order('full_name')

// Después:
  const { data: squad, error: squadError } = await db('club_squads')
    .select('full_name, position, api_player_id, image, category')
    .order('full_name')
```

- [ ] **Step 6: `homeService.ts` — agregar el import y convertir la única llamada**

```ts
import { db } from '@/lib/db'
```

```ts
// Línea 193-194 — antes:
  const { data } = await supabase
    .from('club_squads')
    .select('full_name, api_player_id, image')
    .not('api_player_id', 'is', null)

// Después:
  const { data } = await db('club_squads')
    .select('full_name, api_player_id, image')
    .not('api_player_id', 'is', null)
```

- [ ] **Step 7: Verificar que compila y pasan los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores; `agencyPlayersService.test.ts`, `agencyCoachesService.test.ts` y `clubSquadService.test.ts` siguen en verde por la misma razón que en el Task 10 (ninguno assertea argumentos exactos de query). Si `homeService.test.ts` existe y falla, revisar si assertea argumentos exactos de `.select()`/`.from()` — de ser así, agregar la expectativa del `.eq('club_id', 'independiente')` extra que agrega `db()`.

- [ ] **Step 8: Commit**

```bash
git add src/services/agencyManualFixturesService.ts src/services/agencyPlayersService.ts src/services/agencyCoachesService.ts src/services/agencyClassificationService.ts src/services/clubSquadService.ts src/services/homeService.ts
git commit -m "fix(multi-club): servicios agency_* y club_squads scopean explicito por club_id via db()"
```

---

### Task 15: Convertir servicios `coach_*` restantes (independiente-platform)

**Files** (en `independiente-platform`):
- Modify: `src/services/coachService.ts`
- Modify: `src/services/futureSquadService.ts`
- Modify: `src/services/tacticalBoardService.ts`
- Modify: `src/services/videoAnalysisService.ts`

- [ ] Repetir exactamente los Steps 1-6 del Task 11 — los 4 archivos son idénticos a los de `primer-appcloud` en las líneas que llaman a estas tablas (mismos números de línea, confirmado por grep).

Commit:
```bash
git add src/services/coachService.ts src/services/futureSquadService.ts src/services/tacticalBoardService.ts src/services/videoAnalysisService.ts
git commit -m "fix(multi-club): servicios coach_* scopean explicito por club_id via db()"
```

---

### Task 16: Convertir `playerVideosService.ts`, `gpsService.ts` y `marketService.ts` (independiente-platform)

**Files** (en `independiente-platform`):
- Modify: `src/services/playerVideosService.ts`
- Modify: `src/services/gpsService.ts`
- Modify: `src/services/marketService.ts`

- [ ] **Step 1-2: repetir exactamente los Steps 1-2 del Task 12** (mismos números de línea, confirmado por grep).

- [ ] **Step 3: `marketService.ts` — mismo que el Task 13, con estos números de línea de este repo** (difieren levemente de `primer-appcloud` a partir de la línea 191):

- `market_club_needs`: líneas 68, 78, 163, 191, 232, 309, 311, 326.
- `market_negotiations`: líneas 109, 172, 222, 239, 290, 336, 338, 353, 466.
- `market_negotiation_notes`: líneas 316, 343, 363, 388.
- `market_team_members`: línea 128.
- `market_need_candidates`: líneas 97, 248, 432, 447, 457, 475, 484.

Mismo patrón de conversión que el Task 13.

- [ ] **Step 4: Verificar que compila y pasan los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores; `gpsService.test.ts` sigue en verde (sólo testea funciones puras).

- [ ] **Step 5: Commit**

```bash
git add src/services/playerVideosService.ts src/services/gpsService.ts src/services/marketService.ts
git commit -m "fix(multi-club): playerVideosService, gpsService y marketService scopean explicito por club_id via db()"
```

---

### Task 17: Checkpoint de despliegue — frontend en producción antes del corte de RLS

**Files:** ninguno — task de verificación pura, no genera commits.

**Interfaces:** ninguna — gate manual antes del Task 18.

- [ ] **Step 1: Confirmar que las Tasks 1-16 están mergeadas y desplegadas**

Pedirle al usuario que:
1. Buildee y despliegue `primer-appcloud` a producción (Netlify) con los cambios de las Tasks 2-5 y 10-13.
2. Buildee y despliegue `independiente-platform` a producción con los cambios de las Tasks 6-9 y 14-16.
3. Confirme que ambos sitios cargan y el login funciona (todavía contra las policies VIEJAS de `current_club_id()` — el corte es recién en el Task 18, así que el comportamiento visible no cambia todavía para nadie, salvo por el fix puntual de abajo).

- [ ] **Step 2: Parche inmediato (sólo user_profiles, no bloquea el resto del plan)**

Hasta que el Task 18 corte las policies viejas, Marcos sigue viendo Seguimiento GG vacío en la agencia porque las policies VIEJAS todavía leen `user_profiles.club_id` (que sigue en `'independiente'`). Si todavía no se hizo, pedirle al usuario que corra esto para destrabarlo YA, en paralelo mientras se completa el resto del plan (esto queda sobreescrito/es innecesario después del Task 18, que borra `user_profiles`):

```sql
update public.user_profiles
set club_id = 'dobleg'
where user_id = (select id from auth.users where email = 'marcoscucho99@gmail.com');
```

- [ ] **Step 3: No avanzar al Task 18 sin confirmación explícita del usuario de que el Step 1 está hecho**

Este es el único punto de todo el plan donde un despliegue a producción de AMBOS repos es un prerrequisito duro — el Task 18 rompe el login de TODO el mundo (no sólo Marcos) si se aplica antes de que el frontend nuevo esté en producción, porque borra `user_profiles`/`current_club_id()` de los que depende el frontend viejo.

---

### Task 18: Corte de RLS — de `current_club_id()` a `is_club_member()`

**Files:**
- Create: `supabase/migrations/20260905_b_club_scoped_rls_cutover.sql`

**Interfaces:**
- Consumes: `is_club_member()` (Task 1); requiere que el Task 17 esté confirmado.
- Produces: las 22 tablas de club quedan con policies basadas en membresía; se elimina `current_club_id()` y `user_profiles`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260905_b_club_scoped_rls_cutover.sql
--
-- Corte: las 22 tablas de club pasan de "club_id = current_club_id()" (un solo
-- club por cuenta) a "is_club_member(club_id)" (membresia). Aplicar SOLO
-- despues de que el frontend de los dos repos (agencia e Independiente) este
-- desplegado en produccion filtrando/escribiendo club_id explicito via db()
-- (Tasks 1-16 de este plan) -- antes de eso, esto rompe el login de todo el
-- mundo (ver Task 17).

-- FK a clubs + drop default + policies nuevas, tabla por tabla.
do $$
declare
  t text;
begin
  foreach t in array array[
    'agency_classifications', 'agency_classification_history', 'agency_players',
    'agency_coaches', 'agency_manual_fixtures', 'coach_future_squads',
    'coach_match_notes', 'coach_match_team_stats', 'coach_tactical_boards',
    'coach_training_sessions', 'coach_video_analysis_buckets',
    'coach_video_analysis_matches', 'market_negotiations',
    'market_negotiation_notes', 'market_club_needs', 'market_need_candidates',
    'market_team_members', 'gps_entries', 'player_videos', 'club_squads',
    'scout_players', 'scout_players_status'
  ]
  loop
    execute format('alter table public.%I add constraint %I foreign key (club_id) references public.clubs(id)', t, t || '_club_id_fkey');
    execute format('alter table public.%I alter column club_id drop default', t);
  end loop;
end $$;

-- Policies: mismo nombre que ya tenían (read_/write_/insert_), solo cambia la
-- condicion. Se listan explicitas (no en loop) porque los nombres de policy no
-- son uniformes entre tablas (ver migraciones 20260902_d y 20260902_e).

drop policy if exists "read_agency_classifications" on public.agency_classifications;
create policy "read_agency_classifications" on public.agency_classifications
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_agency_classifications" on public.agency_classifications;
create policy "write_agency_classifications" on public.agency_classifications
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_agency_classification_history" on public.agency_classification_history;
create policy "read_agency_classification_history" on public.agency_classification_history
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_agency_classification_history" on public.agency_classification_history;
create policy "write_agency_classification_history" on public.agency_classification_history
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_agency_players" on public.agency_players;
create policy "read_agency_players" on public.agency_players
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_agency_players" on public.agency_players;
create policy "write_agency_players" on public.agency_players
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_agency_coaches" on public.agency_coaches;
create policy "read_agency_coaches" on public.agency_coaches
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_agency_coaches" on public.agency_coaches;
create policy "write_agency_coaches" on public.agency_coaches
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_agency_manual_fixtures" on public.agency_manual_fixtures;
create policy "read_agency_manual_fixtures" on public.agency_manual_fixtures
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_agency_manual_fixtures" on public.agency_manual_fixtures;
create policy "write_agency_manual_fixtures" on public.agency_manual_fixtures
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_coach_future_squads" on public.coach_future_squads;
create policy "read_coach_future_squads" on public.coach_future_squads
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_coach_future_squads" on public.coach_future_squads;
create policy "write_coach_future_squads" on public.coach_future_squads
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_coach_match_notes" on public.coach_match_notes;
create policy "read_coach_match_notes" on public.coach_match_notes
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_coach_match_notes" on public.coach_match_notes;
create policy "write_coach_match_notes" on public.coach_match_notes
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_coach_match_team_stats" on public.coach_match_team_stats;
create policy "read_coach_match_team_stats" on public.coach_match_team_stats
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_coach_match_team_stats" on public.coach_match_team_stats;
create policy "write_coach_match_team_stats" on public.coach_match_team_stats
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_coach_tactical_boards" on public.coach_tactical_boards;
create policy "read_coach_tactical_boards" on public.coach_tactical_boards
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_coach_tactical_boards" on public.coach_tactical_boards;
create policy "write_coach_tactical_boards" on public.coach_tactical_boards
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_coach_training_sessions" on public.coach_training_sessions;
create policy "read_coach_training_sessions" on public.coach_training_sessions
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_coach_training_sessions" on public.coach_training_sessions;
create policy "write_coach_training_sessions" on public.coach_training_sessions
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_cvab" on public.coach_video_analysis_buckets;
create policy "read_cvab" on public.coach_video_analysis_buckets
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_cvab" on public.coach_video_analysis_buckets;
create policy "write_cvab" on public.coach_video_analysis_buckets
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_cvam" on public.coach_video_analysis_matches;
create policy "read_cvam" on public.coach_video_analysis_matches
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_cvam" on public.coach_video_analysis_matches;
create policy "write_cvam" on public.coach_video_analysis_matches
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_market_negotiations" on public.market_negotiations;
create policy "read_market_negotiations" on public.market_negotiations
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_market_negotiations" on public.market_negotiations;
create policy "write_market_negotiations" on public.market_negotiations
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_market_negotiation_notes" on public.market_negotiation_notes;
create policy "read_market_negotiation_notes" on public.market_negotiation_notes
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_market_negotiation_notes" on public.market_negotiation_notes;
create policy "write_market_negotiation_notes" on public.market_negotiation_notes
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_market_club_needs" on public.market_club_needs;
create policy "read_market_club_needs" on public.market_club_needs
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_market_club_needs" on public.market_club_needs;
create policy "write_market_club_needs" on public.market_club_needs
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_market_need_candidates" on public.market_need_candidates;
create policy "read_market_need_candidates" on public.market_need_candidates
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_market_need_candidates" on public.market_need_candidates;
create policy "write_market_need_candidates" on public.market_need_candidates
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_market_team_members" on public.market_team_members;
create policy "read_market_team_members" on public.market_team_members
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_market_team_members" on public.market_team_members;
create policy "write_market_team_members" on public.market_team_members
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_gps_entries" on public.gps_entries;
create policy "read_gps_entries" on public.gps_entries
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_gps_entries" on public.gps_entries;
create policy "write_gps_entries" on public.gps_entries
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_player_videos" on public.player_videos;
create policy "read_player_videos" on public.player_videos
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_player_videos" on public.player_videos;
create policy "write_player_videos" on public.player_videos
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_club_squads" on public.club_squads;
create policy "read_club_squads" on public.club_squads
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_club_squads" on public.club_squads;
create policy "write_club_squads" on public.club_squads
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_scout_players" on public.scout_players;
create policy "read_scout_players" on public.scout_players
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "write_scout_players" on public.scout_players;
create policy "write_scout_players" on public.scout_players
  for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

drop policy if exists "read_scout_players_status" on public.scout_players_status;
create policy "read_scout_players_status" on public.scout_players_status
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists "insert_scout_players_status" on public.scout_players_status;
create policy "insert_scout_players_status" on public.scout_players_status
  for insert to authenticated with check (public.is_club_member(club_id));

-- Ya no hace falta: user_profiles (un club por cuenta) y la funcion que lo
-- exponia, reemplazados por user_club_memberships + is_club_member().
drop policy if exists "read_own_profile" on public.user_profiles;
drop table public.user_profiles;
drop function public.current_club_id();
```

- [ ] **Step 2: Pedirle al usuario que la corra en el SQL Editor de Supabase**

- [ ] **Step 3: Verificar — pedirle al usuario que corra esto y comparta el resultado**

```sql
select count(*) as clubs_sin_fk
from information_schema.table_constraints
where constraint_type = 'FOREIGN KEY' and constraint_name like '%_club_id_fkey';
```

Expected: `22` (una FK por cada tabla de club).

```sql
select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and qual like '%current_club_id%';
```

Expected: 0 filas (ninguna policy quedó referenciando la función vieja).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260905_b_club_scoped_rls_cutover.sql
git commit -m "fix(multi-club): RLS de las 22 tablas de club pasa de current_club_id() a is_club_member()"
```

---

### Task 19: Verificación de regresión post-corte

**Files:** ninguno.

- [ ] **Step 1: Smoke test de Marcos en las dos plataformas a la vez**

Pedirle al usuario que abra dos pestañas simultáneas: una logueado en la agencia (`marcoscucho99@gmail.com`), otra en Independiente, con la misma cuenta. Confirmar:
- Agencia → Seguimiento GG muestra la lista real de Doble G (los 12 registros de `scout_players` con `club_id='dobleg'`).
- Independiente → Seguimiento de Jugadores / plantel muestran los datos reales de Independiente (los 31 registros de `club_squads`).
- Nada agregado en una aparece en la otra.

- [ ] **Step 2: Smoke test de Gabriel (cuenta de un solo club)**

Pedirle al usuario (o a Gabriel) que loguee en la agencia y confirme que la vista es idéntica a antes de este plan — sin cambios visibles.

- [ ] **Step 3: Confirmar en base que no quedaron rastros de la función vieja**

```sql
select proname from pg_proc where proname = 'current_club_id';
```

Expected: 0 filas.

No hay commit en este task — es sólo verificación manual.

---

### Task 20: Netlify Functions de administración de accesos

**Files:**
- Create: `netlify/functions/admin-list-clubs.js`
- Create: `netlify/functions/admin-search-user.js`
- Create: `netlify/functions/admin-create-club.js`
- Create: `netlify/functions/admin-set-membership.js`

**Interfaces:**
- Consumes: `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (ya configuradas en Netlify, usadas por `delete-account.js`); tablas `clubs`, `user_club_memberships`, `super_admins` (Task 1).
- Produces: 4 endpoints HTTP consumidos por la pantalla de admin (Task 21).

- [ ] **Step 1: Función compartida de autorización**

```js
// netlify/functions/_shared/requireSuperAdmin.js
// Verifica el JWT del que llama y confirma que está en super_admins.
// Devuelve { admin, userId } si es válido, o { errorResponse } si no.
const { createClient } = require('@supabase/supabase-js')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function requireSuperAdmin(event) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return { errorResponse: { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Servidor sin configurar (faltan env vars)' }) } }
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return { errorResponse: { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Falta el token de sesión' }) } }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData || !userData.user) {
    return { errorResponse: { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Sesión inválida' }) } }
  }

  const userId = userData.user.id
  const { data: superAdminRow } = await admin.from('super_admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (!superAdminRow) {
    return { errorResponse: { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No autorizado' }) } }
  }

  return { admin, userId }
}

module.exports = { requireSuperAdmin, CORS }
```

- [ ] **Step 2: `admin-list-clubs.js`**

```js
// netlify/functions/admin-list-clubs.js
const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { data, error } = await admin.from('clubs').select('id, name').order('name')
  if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ clubs: data }) }
}
```

- [ ] **Step 3: `admin-search-user.js`**

```js
// netlify/functions/admin-search-user.js
const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { email } = JSON.parse(event.body || '{}')
  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Falta el email' }) }

  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: listErr.message }) }

  const user = usersPage.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())
  if (!user) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'No existe una cuenta con ese email' }) }

  const { data: memberships, error: memErr } = await admin
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
  if (memErr) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: memErr.message }) }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ id: user.id, email: user.email, clubIds: (memberships || []).map(m => m.club_id) }),
  }
}
```

- [ ] **Step 4: `admin-create-club.js`**

```js
// netlify/functions/admin-create-club.js
const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { id, name } = JSON.parse(event.body || '{}')
  if (!id || !name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltan id o name' }) }
  if (!/^[a-z0-9-]+$/.test(id)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'El id sólo puede tener minúsculas, números y guiones' }) }
  }

  const { error } = await admin.from('clubs').insert({ id, name })
  if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
}
```

- [ ] **Step 5: `admin-set-membership.js`**

```js
// netlify/functions/admin-set-membership.js
const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { userId, clubId, action } = JSON.parse(event.body || '{}')
  if (!userId || !clubId || !['add', 'remove'].includes(action)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltan userId, clubId o action inválida' }) }
  }

  if (action === 'add') {
    const { error } = await admin.from('user_club_memberships').upsert({ user_id: userId, club_id: clubId })
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
  } else {
    const { error } = await admin.from('user_club_memberships').delete().eq('user_id', userId).eq('club_id', clubId)
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
}
```

- [ ] **Step 6: Verificación manual (no hay test runner para Netlify Functions en este repo)**

Pedirle al usuario que, tras el deploy, corra (reemplazando `<token>` por un access token de una sesión logueada que NO es super-admin, ej. Gabriel):

```bash
curl -s -X POST https://dobleg-scouting.netlify.app/.netlify/functions/admin-list-clubs \
  -H "Authorization: Bearer <token>"
```

Expected: `403` con `{"error":"No autorizado"}`. Y con un token de `marcoscucho99@gmail.com`: `200` con la lista de clubes.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/_shared/requireSuperAdmin.js netlify/functions/admin-list-clubs.js netlify/functions/admin-search-user.js netlify/functions/admin-create-club.js netlify/functions/admin-set-membership.js
git commit -m "feat(admin): Netlify Functions para administrar clubes y membresias (solo super-admin)"
```

---

### Task 21: Pantalla `/admin/accesos`

**Files:**
- Create: `src/pages/AdminAccesosPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: las 4 Netlify Functions (Task 20); `supabase.auth.getSession()` (ya existente) para el `Authorization` header.
- Produces: nada consumido por otra task — es la última pieza visible del plan.

- [ ] **Step 1: Implementar la página**

```tsx
// src/pages/AdminAccesosPage.tsx
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FUNCTIONS_BASE } from '@/lib/apiBase'

interface Club { id: string; name: string }

async function authedFetch(path: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
  return json
}

export default function AdminAccesosPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [email, setEmail] = useState('')
  const [found, setFound] = useState<{ id: string; email: string; clubIds: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newClubId, setNewClubId] = useState('')
  const [newClubName, setNewClubName] = useState('')

  const loadClubs = () => authedFetch('admin-list-clubs').then(r => setClubs(r.clubs)).catch(e => setError(e.message))

  useEffect(() => { loadClubs() }, [])

  const search = async () => {
    setError(null)
    setFound(null)
    try {
      const result = await authedFetch('admin-search-user', { email })
      setFound(result)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const setMembership = async (clubId: string, action: 'add' | 'remove') => {
    if (!found) return
    try {
      await authedFetch('admin-set-membership', { userId: found.id, clubId, action })
      setFound({
        ...found,
        clubIds: action === 'add' ? [...found.clubIds, clubId] : found.clubIds.filter(c => c !== clubId),
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const createClub = async () => {
    setError(null)
    try {
      await authedFetch('admin-create-club', { id: newClubId, name: newClubName })
      setNewClubId('')
      setNewClubName('')
      loadClubs()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 sm:px-6 py-6 space-y-8">
      <h1 className="text-xl font-bold text-apple-gray-900 dark:text-white">Administración de accesos</h1>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-apple-gray-500 uppercase tracking-wide">Buscar cuenta</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-apple-gray-200 dark:border-apple-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
            placeholder="email@ejemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button onClick={search} className="px-4 py-2 text-sm font-semibold bg-brand-primary text-white rounded-lg">
            Buscar
          </button>
        </div>

        {found && (
          <div className="card-apple p-4 space-y-2">
            <p className="text-sm font-medium">{found.email}</p>
            <div className="flex flex-wrap gap-2">
              {clubs.map(c => {
                const isMember = found.clubIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => setMembership(c.id, isMember ? 'remove' : 'add')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      isMember
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-apple-gray-300 text-apple-gray-500'
                    }`}
                  >
                    {c.name} {isMember ? '✓' : '+'}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-apple-gray-500 uppercase tracking-wide">Clubes existentes</h2>
        <ul className="text-sm space-y-1">
          {clubs.map(c => (
            <li key={c.id}>{c.name} <span className="text-apple-gray-400">({c.id})</span></li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input
            className="w-32 border border-apple-gray-200 dark:border-apple-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
            placeholder="id-slug"
            value={newClubId}
            onChange={e => setNewClubId(e.target.value)}
          />
          <input
            className="flex-1 border border-apple-gray-200 dark:border-apple-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
            placeholder="Nombre del club"
            value={newClubName}
            onChange={e => setNewClubName(e.target.value)}
          />
          <button onClick={createClub} className="px-4 py-2 text-sm font-semibold bg-brand-primary text-white rounded-lg">
            Crear club
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Agregar la ruta en `App.tsx`, gateada por `is_super_admin`**

Agregar el import lazy junto a los demás:

```tsx
const AdminAccesosPage = lazy(() => import('@/pages/AdminAccesosPage'))
```

Envolver la ruta con un chequeo — crear un pequeño componente inline en el mismo `App.tsx` (o en el archivo de la página) que resuelve `supabase.rpc('is_super_admin')` y renderiza `<NotFoundPage />` si no es `true`:

```tsx
function AdminRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    supabase.rpc('is_super_admin').then(({ data }) => setAllowed(!!data))
  }, [])
  if (allowed === undefined) return null
  if (!allowed) return <NotFoundPage />
  return <>{children}</>
}
```

(agregar los imports `useState`, `useEffect` de `react` y `supabase` de `@/lib/supabase` si `App.tsx` todavía no los tiene).

Agregar la ruta:

```tsx
<Route path="/admin/accesos" element={<AdminRoute><AdminAccesosPage /></AdminRoute>} />
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Smoke test manual**

Pedirle al usuario que, ya desplegado, entre a `/admin/accesos` logueado como `marcoscucho99@gmail.com` (ve la pantalla) y que confirme que con otra cuenta (ej. Gabriel) la misma URL devuelve la página de "no encontrado".

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminAccesosPage.tsx src/App.tsx
git commit -m "feat(admin): pantalla /admin/accesos para gestionar clubes y membresias"
```

---

## Self-Review

**Cobertura del spec:** modelo de datos (Task 1), contrato de frontend `db()`/`CLUB_ID` (Tasks 2, 6), gate de acceso (Tasks 3-4, 7-8), las 22 tablas convertidas en ambos repos (Tasks 5, 9-16), orden de despliegue seguro (Task 17), corte de RLS (Task 18), verificación (Task 19), admin UI + Netlify Functions (Tasks 20-21). Sin huecos frente al spec.

**Placeholders:** ninguno — cada task tiene código real, números de línea reales (confirmados por grep) y comandos de verificación concretos.

**Consistencia de tipos/nombres:** `CLUB_ID` (Tasks 2, 6) → consumido igual en `db.ts` y `clubAccessService.ts`; `hasClubAccess()` (Task 3) → consumido como `hasAccess` en `AuthContext`/`Layout` (Task 4); `db(table: ClubScopedTable)` (Task 2) → mismo nombre de función en todas las conversiones de servicios (Tasks 5, 9-16); `is_club_member`/`is_super_admin` (Task 1) → mismos nombres en RLS (Task 18), `clubAccessService` (Task 3) y `requireSuperAdmin.js`/`AdminRoute` (Tasks 20-21).
