# Sección Entrenadores: Domingo y Stillitano — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página nueva por entrenador (Nicolás Domingo en Temperley, Leandro Stillitano sin club) con plantel, resultados, próximo partido, tabla de posiciones de su liga, calendario del equipo, agenda de entrenamientos y notas de partidos — todo dentro de la app existente, mismo login compartido.

**Architecture:** Datos de plantel/fixtures/tabla de posiciones se piden en vivo a API-Football (mismo proxy `/api/football` que ya usa el resto de la app), cacheados en `localStorage`. Solo 2 tablas nuevas en Supabase (`coach_training_sessions`, `coach_match_notes`) para lo que genuinamente no existe en ninguna API: agenda de entrenamientos y notas. Sin roles/auth nuevos.

**Tech Stack:** React 18 + TypeScript, React Router, Supabase (Postgres + RLS), Vitest, Tailwind CSS.

## Global Constraints

- Mismo login compartido para todo el staff — no se agregan roles ni tablas de permisos.
- No se sincroniza plantel/fixtures/standings a Supabase — todo se pide en vivo a API-Football con cache en `localStorage` (igual patrón que `fetchAllAgencyFixtures` ya usa).
- RLS de las 2 tablas nuevas: lectura pública (`FOR SELECT USING (true)`), escritura para `authenticated` (`FOR ALL TO authenticated USING (true) WITH CHECK (true)`) — mismo patrón que `gps_entries` (`supabase/migrations/20260729_gps_upload.sql:54-75`).
- `coach_match_notes`: **una** nota editable por partido por entrenador (`upsert` con `onConflict: 'coach_key,fixture_id'`), no un hilo de comentarios.
- Fuera de alcance explícito (no construir nada de esto): roles/login individual, lesiones/suspensiones de todo el plantel, asistencia jugador-por-jugador a entrenamientos, drag-and-drop en el calendario, goleadores/asistencias/tarjetas de liga, posesión/remates/córners por equipo (ninguno de estos 2 últimos está cubierto por API-Football para esta liga/temporada — verificado en vivo).
- `apiTeamId` de Temperley = **454**, `leagueApiId` de Primera Nacional = **129**, `leagueSeason` = **2026** — verificados en vivo el 2026-08-08 (ver fixture `src/services/__fixtures__/primera-nacional-standings-2026-08-08.json`).
- **Diseño visual de toda página/componente nuevo de este plan: usar la skill `frontend-design`** (pedido explícito del usuario) — no dejar el look genérico por defecto. Se invoca al empezar cada tarea de UI (Tasks 9 en adelante), antes de escribir el JSX final.
- **Responsive real en mobile, tablet y desktop — no opcional.** Esta plataforma corre además como app nativa (Capacitor, "Doble G Scout", ver `[[mobile_app_capacitor]]` en memoria) y los propios entrenadores pueden llegar a usar esto desde el celular en la cancha. Cada tarea de UI (Tasks 9-16) tiene que probarse en los 3 anchos, no solo desktop: tablas con `overflow-x-auto` (ya así en Task 13), grillas con breakpoints `sm:`/`md:` (ya así en Task 12), tabs en fila horizontal con scroll (`overflow-x-auto`) en vez de recortarse, y ningún botón/target táctil por debajo de ~40px de alto. El smoke test de Task 17 se hace en los 3 tamaños de viewport, no solo desktop.

---

### Task 1: Registro de entrenadores (`agencyCoaches.ts`)

**Files:**
- Create: `src/constants/agencyCoaches.ts`
- Test: `src/constants/agencyCoaches.test.ts`

**Interfaces:**
- Produces: `AgencyCoach` interface, `AGENCY_COACHES: AgencyCoach[]`, `getCoachByKey(key: string): AgencyCoach | undefined` — usados por todas las tareas de UI (Tasks 9-16).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/constants/agencyCoaches.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getCoachByKey } from './agencyCoaches'

describe('getCoachByKey', () => {
  it('encuentra a Domingo por key, activo en Temperley', () => {
    const d = getCoachByKey('domingo')
    expect(d?.fullName).toBe('Nicolás Domingo')
    expect(d?.status).toBe('activo')
    expect(d?.apiTeamId).toBe(454)
    expect(d?.leagueApiId).toBe(129)
    expect(d?.leagueSeason).toBe(2026)
  })

  it('encuentra a Stillitano por key, sin club', () => {
    const s = getCoachByKey('stillitano')
    expect(s?.fullName).toBe('Leandro Stillitano')
    expect(s?.status).toBe('sin_club')
    expect(s?.apiTeamId).toBeNull()
  })

  it('devuelve undefined si la key no existe', () => {
    expect(getCoachByKey('inexistente')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run agencyCoaches.test.ts`
Expected: FAIL — `./agencyCoaches` no existe todavía.

- [ ] **Step 3: Implementar**

Crear `src/constants/agencyCoaches.ts`:

```ts
export interface AgencyCoach {
  key: string
  fullName: string
  photo: string | null
  status: 'activo' | 'sin_club'
  club: string | null
  apiTeamId: number | null
  reserveApiTeamId?: number | null
  leagueApiId?: number | null
  leagueName?: string | null
  leagueSeason?: number | null
}

export const AGENCY_COACHES: AgencyCoach[] = [
  {
    key: 'domingo',
    fullName: 'Nicolás Domingo',
    photo: '/coaches/domingo.png',
    status: 'activo',
    club: 'Temperley',
    apiTeamId: 454,
    leagueApiId: 129,
    leagueName: 'Primera Nacional',
    leagueSeason: 2026,
  },
  {
    key: 'stillitano',
    fullName: 'Leandro Stillitano',
    photo: '/coaches/stillitano.png',
    status: 'sin_club',
    club: null,
    apiTeamId: null,
  },
]

export function getCoachByKey(key: string): AgencyCoach | undefined {
  return AGENCY_COACHES.find(c => c.key === key)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run agencyCoaches.test.ts`
Expected: PASS, 3 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add src/constants/agencyCoaches.ts src/constants/agencyCoaches.test.ts
git commit -m "feat(entrenadores): registro de entrenadores de la agencia"
```

---

### Task 2: Cache genérico + `fetchTeamFixtures` en `footballApiService.ts`

**Files:**
- Modify: `src/services/footballApiService.ts:93-112` (helpers de cache), `:114-118` (usa el cache), `:150-154` (usa el cache)

**Interfaces:**
- Consumes: `AgencyFixture` (`@/types/footballApi`), `mapFixture` y `getTeamFixtures` (ya existen en el archivo, sin exportar).
- Produces: `export async function fetchTeamFixtures(teamId: number, forceRefresh?: boolean): Promise<AgencyFixture[]>` — usado por Task 11 (Resumen), Task 13 (Liga usa standings, no esto), Task 14 (Calendario).

- [ ] **Step 1: Reemplazar los helpers de cache fijos por versiones genéricas**

En `src/services/footballApiService.ts`, reemplazar (líneas 93-112):

```ts
function getCached(): AgencyFixture[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedData = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached.fixtures
  } catch {
    return null
  }
}

function setCache(fixtures: AgencyFixture[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fixtures, timestamp: Date.now() }))
  } catch { /* quota exceeded */ }
}
```

por:

```ts
function getCachedGeneric<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const cached: { data: T; timestamp: number } = JSON.parse(raw)
    if (Date.now() - cached.timestamp > ttl) {
      localStorage.removeItem(key)
      return null
    }
    return cached.data
  } catch {
    return null
  }
}

function setCacheGeneric<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* quota exceeded */ }
}
```

- [ ] **Step 2: Actualizar los 2 call sites existentes**

En `fetchAllAgencyFixtures` (línea ~116), cambiar:

```ts
    const cached = getCached()
```

por:

```ts
    const cached = getCachedGeneric<AgencyFixture[]>(CACHE_KEY, CACHE_TTL)
```

Y (línea ~154), cambiar:

```ts
  setCache(merged)
```

por:

```ts
  setCacheGeneric(CACHE_KEY, merged)
```

- [ ] **Step 3: Agregar `fetchTeamFixtures`**

Agregar después de `fetchAllAgencyFixtures` (después de la línea que hace `return merged` / cierre de esa función):

```ts
const TEAM_FIXTURES_CACHE_PREFIX = 'dg-team-fixtures-cache'
const TEAM_FIXTURES_CACHE_TTL = 4 * 60 * 60 * 1000 // 4h, igual que el cache general

export async function fetchTeamFixtures(teamId: number, forceRefresh = false): Promise<AgencyFixture[]> {
  const cacheKey = `${TEAM_FIXTURES_CACHE_PREFIX}:${teamId}`
  if (!forceRefresh) {
    const cached = getCachedGeneric<AgencyFixture[]>(cacheKey, TEAM_FIXTURES_CACHE_TTL)
    if (cached) return cached
  }
  const raw = await getTeamFixtures(teamId)
  const fixtures = raw.map(f => mapFixture(f, teamId))
  setCacheGeneric(cacheKey, fixtures)
  return fixtures
}
```

- [ ] **Step 4: Verificar que compila y que la suite existente sigue en verde**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

Run: `npm test`
Expected: PASS, misma cantidad de tests que antes (este cambio no agrega tests propios — `footballApiService.ts` no tiene tests de red, se verifica manualmente en Task 17).

- [ ] **Step 5: Commit**

```bash
git add src/services/footballApiService.ts
git commit -m "feat(entrenadores): fetchTeamFixtures — fixtures por equipo individual"
```

---

### Task 3: Extender y exportar `fetchSquadCached`

**Files:**
- Modify: `src/services/footballApiService.ts:319-338`

**Interfaces:**
- Produces: `export interface SquadPlayer { id: number; name: string; age: number | null; number: number | null; position: string | null; photo: string | null }`, `export async function fetchSquadCached(teamId: number): Promise<SquadPlayer[]>` — usado por Task 12 (Plantel/Reserva).
- Nota: `resolvePlayerInSquad` (línea 340) sigue funcionando sin cambios — solo usa `.name`/`.id`, que se mantienen.

- [ ] **Step 1: Reemplazar la función**

En `src/services/footballApiService.ts`, reemplazar (líneas 319-338):

```ts
async function fetchSquadCached(teamId: number): Promise<Array<{ id: number; name: string }>> {
  const cacheKey = `${SQUAD_CACHE_KEY}:${teamId}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.timestamp < SQUAD_CACHE_TTL) return cached.data
    }
  } catch { /* ignore */ }

  try {
    const res = await apiFetch<any>('/players/squads', { team: String(teamId) })
    const squad = res.response?.[0]
    const players: Array<{ id: number; name: string }> = (squad?.players ?? []).map((p: any) => ({ id: p.id as number, name: (p.name ?? '') as string }))
    try { localStorage.setItem(cacheKey, JSON.stringify({ data: players, timestamp: Date.now() })) } catch { /* quota */ }
    return players
  } catch {
    return []
  }
}
```

por:

```ts
export interface SquadPlayer {
  id: number
  name: string
  age: number | null
  number: number | null
  position: string | null
  photo: string | null
}

export async function fetchSquadCached(teamId: number): Promise<SquadPlayer[]> {
  const cacheKey = `${SQUAD_CACHE_KEY}:${teamId}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.timestamp < SQUAD_CACHE_TTL) return cached.data
    }
  } catch { /* ignore */ }

  try {
    const res = await apiFetch<any>('/players/squads', { team: String(teamId) })
    const squad = res.response?.[0]
    const players: SquadPlayer[] = (squad?.players ?? []).map((p: any) => ({
      id: p.id as number,
      name: (p.name ?? '') as string,
      age: (p.age ?? null) as number | null,
      number: (p.number ?? null) as number | null,
      position: (p.position ?? null) as string | null,
      photo: (p.photo ?? null) as string | null,
    }))
    try { localStorage.setItem(cacheKey, JSON.stringify({ data: players, timestamp: Date.now() })) } catch { /* quota */ }
    return players
  } catch {
    return []
  }
}
```

(`resolvePlayerInSquad` en la línea 340 no cambia — sigue tipando su parámetro `squad: Array<{ id: number; name: string }>`, que `SquadPlayer[]` sigue satisfaciendo por tener esos 2 campos de más.)

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (en particular, revisar que `searchApiPlayerId`, que llama a `fetchSquadCached` internamente, sigue tipando bien).

- [ ] **Step 3: Commit**

```bash
git add src/services/footballApiService.ts
git commit -m "feat(entrenadores): fetchSquadCached expone posición/dorsal/foto y se exporta"
```

---

### Task 4: `fetchLeagueStandings` + mapeo testeado con fixture real

**Files:**
- Modify: `src/services/footballApiService.ts` (agregar al final del archivo)
- Create: `src/services/footballApiService.test.ts`
- Ya existe: `src/services/__fixtures__/primera-nacional-standings-2026-08-08.json` (capturado en vivo el 2026-08-08, respuesta real de `/standings?league=129&season=2026`)

**Interfaces:**
- Produces: `export interface StandingRow { rank: number; teamId: number; teamName: string; teamLogo: string; points: number; goalsDiff: number; form: string; played: number; win: number; draw: number; lose: number; goalsFor: number; goalsAgainst: number; group: string }`, `export function mapStandingsResponse(raw: any): StandingRow[][]` (pura, testeada), `export async function fetchLeagueStandings(leagueId: number, season: number, forceRefresh?: boolean): Promise<StandingRow[][]>` — usados por Task 13 (Liga).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/services/footballApiService.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mapStandingsResponse } from './footballApiService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'primera-nacional-standings-2026-08-08.json'), 'utf-8'),
)

describe('mapStandingsResponse', () => {
  it('devuelve un array por zona', () => {
    const groups = mapStandingsResponse(fixture)
    expect(groups).toHaveLength(2)
  })

  it('cada zona tiene 18 equipos', () => {
    const groups = mapStandingsResponse(fixture)
    expect(groups[0]).toHaveLength(18)
    expect(groups[1]).toHaveLength(18)
  })

  it('mapea Temperley correctamente en la zona 2', () => {
    const groups = mapStandingsResponse(fixture)
    const temperley = groups[1].find(t => t.teamName === 'Temperley')
    expect(temperley).toBeDefined()
    expect(temperley?.rank).toBe(4)
    expect(temperley?.points).toBe(37)
    expect(temperley?.form).toBe('LWWDW')
    expect(temperley?.goalsFor).toBe(24)
    expect(temperley?.goalsAgainst).toBe(20)
    expect(temperley?.played).toBe(23)
  })

  it('el líder de la zona 1 es Ferro Carril Oeste con 43 puntos', () => {
    const groups = mapStandingsResponse(fixture)
    expect(groups[0][0].teamName).toBe('Ferro Carril Oeste')
    expect(groups[0][0].points).toBe(43)
    expect(groups[0][0].rank).toBe(1)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run footballApiService.test.ts`
Expected: FAIL — `mapStandingsResponse` no existe todavía.

- [ ] **Step 3: Implementar**

Agregar al final de `src/services/footballApiService.ts`:

```ts
export interface StandingRow {
  rank: number
  teamId: number
  teamName: string
  teamLogo: string
  points: number
  goalsDiff: number
  form: string
  played: number
  win: number
  draw: number
  lose: number
  goalsFor: number
  goalsAgainst: number
  group: string
}

export function mapStandingsResponse(raw: any): StandingRow[][] {
  const groups: any[][] = raw?.response?.[0]?.league?.standings ?? []
  return groups.map(group =>
    group.map((row: any): StandingRow => ({
      rank: row.rank,
      teamId: row.team.id,
      teamName: row.team.name,
      teamLogo: row.team.logo,
      points: row.points,
      goalsDiff: row.goalsDiff,
      form: row.form ?? '',
      played: row.all.played,
      win: row.all.win,
      draw: row.all.draw,
      lose: row.all.lose,
      goalsFor: row.all.goals.for,
      goalsAgainst: row.all.goals.against,
      group: row.group,
    })),
  )
}

const STANDINGS_CACHE_PREFIX = 'dg-standings-cache'
const STANDINGS_CACHE_TTL = 6 * 60 * 60 * 1000 // 6h

export async function fetchLeagueStandings(leagueId: number, season: number, forceRefresh = false): Promise<StandingRow[][]> {
  const cacheKey = `${STANDINGS_CACHE_PREFIX}:${leagueId}:${season}`
  if (!forceRefresh) {
    const cached = getCachedGeneric<StandingRow[][]>(cacheKey, STANDINGS_CACHE_TTL)
    if (cached) return cached
  }
  const raw = await apiFetch<any>('/standings', { league: String(leagueId), season: String(season) })
  const groups = mapStandingsResponse(raw)
  setCacheGeneric(cacheKey, groups)
  return groups
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run footballApiService.test.ts`
Expected: PASS, 4 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add src/services/footballApiService.ts src/services/footballApiService.test.ts
git commit -m "feat(entrenadores): fetchLeagueStandings — tabla de posiciones vía API-Football"
```

---

### Task 5: Tablas nuevas en Supabase

**Files:**
- Create: `supabase/migrations/20260808120000_coach_tables.sql`

**Interfaces:**
- Produces: tablas `coach_training_sessions` y `coach_match_notes` en Supabase — consumidas por `coachService.ts` (Task 6).

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260808120000_coach_tables.sql`:

```sql
-- Agenda de entrenamientos y notas de partidos por entrenador (sección Entrenadores).
CREATE TABLE IF NOT EXISTS public.coach_training_sessions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key    TEXT NOT NULL,
  session_date DATE NOT NULL,
  session_time TIME,
  type         TEXT NOT NULL CHECK (type IN ('tactico','fisico','recuperacion','set_pieces','pre_rival','otro')),
  title        TEXT NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_training_sessions_coach_date ON public.coach_training_sessions(coach_key, session_date);

CREATE TABLE IF NOT EXISTS public.coach_match_notes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  fixture_id  BIGINT NOT NULL,
  note        TEXT NOT NULL,
  author      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_match_notes ON public.coach_match_notes(coach_key, fixture_id);

ALTER TABLE public.coach_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_match_notes       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "read_coach_training_sessions" ON public.coach_training_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "write_coach_training_sessions" ON public.coach_training_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "read_coach_match_notes" ON public.coach_match_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "write_coach_match_notes" ON public.coach_match_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Avisar al usuario que hay que correr esta migración a mano**

Igual que otras migraciones de este proyecto (ver `[[oportunidades-metricas-evolutivas]]` en memoria), **el usuario debe correr este SQL en el SQL Editor de Supabase** — no se hace `db push` automático desde acá. Confirmar con el usuario antes de avanzar a Task 6, que depende de que estas tablas existan.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260808120000_coach_tables.sql
git commit -m "feat(entrenadores): migración coach_training_sessions + coach_match_notes"
```

---

### Task 6: `coachService.ts` — CRUD de sesiones y notas

**Files:**
- Create: `src/services/coachService.ts`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`).
- Produces: `CoachTrainingSession`, `CoachTrainingSessionInput`, `CoachMatchNote` types; `listTrainingSessions(coachKey: string): Promise<CoachTrainingSession[]>`, `upsertTrainingSession(input: CoachTrainingSessionInput): Promise<{ success: boolean; error?: string }>`, `deleteTrainingSession(id: number): Promise<{ success: boolean; error?: string }>`, `getMatchNote(coachKey: string, fixtureId: number): Promise<string | null>`, `upsertMatchNote(coachKey: string, fixtureId: number, note: string): Promise<{ success: boolean; error?: string }>`, `fetchSquadMinutes(playerIds: number[], sinceDays?: number): Promise<Record<number, { minutes: number; matches: number }>>` — usados por Tasks 12, 15, 16.

Nota: sin tests unitarios para estas funciones — este proyecto no mockea el cliente de Supabase en ningún service existente (`src/lib/supabase.ts` tampoco tiene tests); se verifican manualmente en Task 17, igual que el resto de las funciones que tocan la base.

- [ ] **Step 1: Implementar**

Crear `src/services/coachService.ts`:

```ts
import { supabase } from '@/lib/supabase'

export type TrainingSessionType = 'tactico' | 'fisico' | 'recuperacion' | 'set_pieces' | 'pre_rival' | 'otro'

export interface CoachTrainingSession {
  id: number
  coach_key: string
  session_date: string
  session_time: string | null
  type: TrainingSessionType
  title: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CoachTrainingSessionInput {
  id?: number
  coach_key: string
  session_date: string
  session_time?: string | null
  type: TrainingSessionType
  title: string
  notes?: string | null
}

export interface CoachMatchNote {
  id: number
  coach_key: string
  fixture_id: number
  note: string
  author: string | null
  created_at: string
  updated_at: string
}

export async function listTrainingSessions(coachKey: string): Promise<CoachTrainingSession[]> {
  const { data, error } = await supabase
    .from('coach_training_sessions')
    .select('*')
    .eq('coach_key', coachKey)
    .order('session_date', { ascending: true })

  if (error) {
    console.error('Error listando entrenamientos:', error)
    return []
  }
  return data || []
}

export async function upsertTrainingSession(input: CoachTrainingSessionInput): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_training_sessions').upsert({
    ...(input.id ? { id: input.id } : {}),
    coach_key: input.coach_key,
    session_date: input.session_date,
    session_time: input.session_time ?? null,
    type: input.type,
    title: input.title,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Error guardando entrenamiento:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteTrainingSession(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_training_sessions').delete().eq('id', id)

  if (error) {
    console.error('Error borrando entrenamiento:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function getMatchNote(coachKey: string, fixtureId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('coach_match_notes')
    .select('note')
    .eq('coach_key', coachKey)
    .eq('fixture_id', fixtureId)
    .maybeSingle()

  if (error || !data) return null
  return data.note
}

export async function upsertMatchNote(coachKey: string, fixtureId: number, note: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('coach_match_notes').upsert({
    coach_key: coachKey,
    fixture_id: fixtureId,
    note,
    author: user?.user_metadata?.full_name || user?.email || null,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'coach_key,fixture_id',
  })

  if (error) {
    console.error('Error guardando nota de partido:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function fetchSquadMinutes(
  playerIds: number[],
  sinceDays = 30,
): Promise<Record<number, { minutes: number; matches: number }>> {
  if (playerIds.length === 0) return {}

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('player_match_stats')
    .select('player_id, minutes, fixtures!inner(date)')
    .in('player_id', playerIds)
    .gte('fixtures.date', since)

  if (error || !data) {
    console.error('Error buscando minutos de plantel:', error)
    return {}
  }

  const result: Record<number, { minutes: number; matches: number }> = {}
  for (const row of data as unknown as Array<{ player_id: number; minutes: number }>) {
    if (!result[row.player_id]) result[row.player_id] = { minutes: 0, matches: 0 }
    result[row.player_id].minutes += row.minutes
    result[row.player_id].matches += 1
  }
  return result
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/services/coachService.ts
git commit -m "feat(entrenadores): coachService — CRUD de entrenamientos y notas de partido"
```

---

### Task 7: `coachCalendar.ts` — fusión de partidos + entrenamientos

**Files:**
- Create: `src/utils/coachCalendar.ts`
- Test: `src/utils/coachCalendar.test.ts`

**Interfaces:**
- Consumes: `AgencyFixture` (`@/types/footballApi`), `toArDateKey` (`@/services/footballApiService`), `CoachTrainingSession` (`@/services/coachService`).
- Produces: `export interface CoachCalendarDay { date: string; fixtures: AgencyFixture[]; sessions: CoachTrainingSession[]; isAbroad: boolean }`, `export function mergeCalendarEvents(fixtures: AgencyFixture[], sessions: CoachTrainingSession[]): Map<string, CoachCalendarDay>` — usado por Task 14. `export function isMatchFinished(statusShort: string): boolean` — helper compartido, usado por Task 11 y Task 16 (evita duplicar la misma función en 2 archivos).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/utils/coachCalendar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mergeCalendarEvents } from './coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-15T18:00:00+00:00', timestamp: 0,
    venue: 'Estadio', city: 'Temperley', status: 'Not Started', statusShort: 'NS', elapsed: null,
    leagueName: 'Primera Nacional', leagueLogo: '', leagueCountry: 'Argentina', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1, name: 'Rival', logo: '' },
    goalsHome: null, goalsAway: null, isHome: true, players: [], ...over,
  }
}

function mkSession(over: Partial<CoachTrainingSession> = {}): CoachTrainingSession {
  return {
    id: 1, coach_key: 'domingo', session_date: '2026-08-14', session_time: '10:00',
    type: 'tactico', title: 'Táctico pre-rival', notes: null,
    created_at: '', updated_at: '', ...over,
  }
}

describe('mergeCalendarEvents', () => {
  it('agrupa partidos y entrenamientos en el mismo día por fecha', () => {
    const fixtures = [mkFixture({ date: '2026-08-15T18:00:00+00:00' })]
    const sessions = [mkSession({ session_date: '2026-08-15' })]
    const merged = mergeCalendarEvents(fixtures, sessions)
    const day = merged.get('2026-08-15')
    expect(day?.fixtures).toHaveLength(1)
    expect(day?.sessions).toHaveLength(1)
  })

  it('días distintos quedan en entradas separadas', () => {
    const fixtures = [mkFixture({ date: '2026-08-15T18:00:00+00:00' })]
    const sessions = [mkSession({ session_date: '2026-08-14' })]
    const merged = mergeCalendarEvents(fixtures, sessions)
    expect(merged.get('2026-08-15')?.fixtures).toHaveLength(1)
    expect(merged.get('2026-08-15')?.sessions).toHaveLength(0)
    expect(merged.get('2026-08-14')?.sessions).toHaveLength(1)
    expect(merged.get('2026-08-14')?.fixtures).toHaveLength(0)
  })

  it('marca isAbroad cuando la liga no es de Argentina', () => {
    const fixtures = [mkFixture({ date: '2026-08-20T18:00:00+00:00', leagueCountry: 'Paraguay' })]
    const merged = mergeCalendarEvents(fixtures, [])
    expect(merged.get('2026-08-20')?.isAbroad).toBe(true)
  })

  it('isAbroad es false para partidos en Argentina', () => {
    const fixtures = [mkFixture({ date: '2026-08-20T18:00:00+00:00', leagueCountry: 'Argentina' })]
    const merged = mergeCalendarEvents(fixtures, [])
    expect(merged.get('2026-08-20')?.isAbroad).toBe(false)
  })
})

describe('isMatchFinished', () => {
  it('FT, AET y PEN cuentan como terminado', () => {
    expect(isMatchFinished('FT')).toBe(true)
    expect(isMatchFinished('AET')).toBe(true)
    expect(isMatchFinished('PEN')).toBe(true)
  })
  it('NS (not started) no cuenta como terminado', () => {
    expect(isMatchFinished('NS')).toBe(false)
  })
})
```

Y actualizar el import del principio del archivo de test de:

```ts
import { mergeCalendarEvents } from './coachCalendar'
```

a:

```ts
import { mergeCalendarEvents, isMatchFinished } from './coachCalendar'
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run coachCalendar.test.ts`
Expected: FAIL — `./coachCalendar` no existe todavía.

- [ ] **Step 3: Implementar**

Crear `src/utils/coachCalendar.ts`:

```ts
import { toArDateKey } from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'

export interface CoachCalendarDay {
  date: string
  fixtures: AgencyFixture[]
  sessions: CoachTrainingSession[]
  isAbroad: boolean
}

function isAbroad(fixture: AgencyFixture): boolean {
  return fixture.leagueCountry !== 'Argentina'
}

export function isMatchFinished(statusShort: string): boolean {
  return ['FT', 'AET', 'PEN'].includes(statusShort)
}

function getOrCreate(map: Map<string, CoachCalendarDay>, date: string): CoachCalendarDay {
  let day = map.get(date)
  if (!day) {
    day = { date, fixtures: [], sessions: [], isAbroad: false }
    map.set(date, day)
  }
  return day
}

export function mergeCalendarEvents(
  fixtures: AgencyFixture[],
  sessions: CoachTrainingSession[],
): Map<string, CoachCalendarDay> {
  const map = new Map<string, CoachCalendarDay>()

  for (const f of fixtures) {
    const key = toArDateKey(f.date)
    const day = getOrCreate(map, key)
    day.fixtures.push(f)
    if (isAbroad(f)) day.isAbroad = true
  }

  for (const s of sessions) {
    const day = getOrCreate(map, s.session_date)
    day.sessions.push(s)
  }

  return map
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run coachCalendar.test.ts`
Expected: PASS, 6 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add src/utils/coachCalendar.ts src/utils/coachCalendar.test.ts
git commit -m "feat(entrenadores): mergeCalendarEvents — fusiona partidos y entrenamientos por fecha"
```

---

### Task 8: Nav item "Entrenadores"

**Files:**
- Modify: `src/components/layout/Navbar.tsx:37-40` (`directLinks`), `:71-89` (`NavIcon`)

**Interfaces:**
- Produces: entrada `{ to: '/entrenadores', label: 'Entrenadores', icon: 'whistle' }` visible en desktop y mobile (ambos ya iteran `directLinks`, sin más cambios de render).

- [ ] **Step 1: Agregar el ícono `whistle`**

En `src/components/layout/Navbar.tsx`, dentro del objeto `icons` de `NavIcon` (línea ~72-88), agregar una entrada nueva junto a las existentes:

```ts
    whistle: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h3m6-13H9a4 4 0 00-4 4v2a7 7 0 007 7h1a7 7 0 007-7v-1a5 5 0 00-5-5zM6 8a2 2 0 11-4 0 2 2 0 014 0z" />,
```

- [ ] **Step 2: Agregar el link**

En `directLinks` (línea 37-40), agregar la entrada nueva:

```ts
const directLinks: NavItem[] = [
  { to: '/scouting', label: 'Scout Externo', icon: 'globe' },
  { to: '/interno', label: 'Scout Interno', icon: 'users' },
  { to: '/entrenadores', label: 'Entrenadores', icon: 'whistle' },
]
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores (la ruta `/entrenadores` todavía no existe en `App.tsx` — se agrega en Task 9 — así que el link temporalmente 404earía si se navegara; no bloquea el build porque `NavLink to` es un string).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat(entrenadores): item de menú Entrenadores"
```

---

### Task 9: Rutas + `CoachesListPage.tsx`

**Files:**
- Modify: `src/App.tsx` (agregar import lazy + `<Route>`)
- Create: `src/pages/CoachesListPage.tsx`

**Interfaces:**
- Consumes: `AGENCY_COACHES` (`@/constants/agencyCoaches`, Task 1).
- Produces: página montada en `/entrenadores`, cada card linkea a `/entrenadores/:coachKey` (ruta que se agrega en Task 10).

- [ ] **Step 1: Invocar la skill de diseño**

Antes de escribir el JSX de esta página, invocar la skill `frontend-design` para definir el tratamiento visual de esta sección nueva (pedido explícito del usuario — no usar el look genérico por defecto). Usar sus lineamientos para el diseño de las cards de esta página y de las páginas de las Tasks 10-16.

- [ ] **Step 2: Crear la página**

Crear `src/pages/CoachesListPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { AGENCY_COACHES } from '@/constants/agencyCoaches'

export default function CoachesListPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-apple-gray-800 dark:text-white mb-6">Entrenadores</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {AGENCY_COACHES.map(coach => (
          <Link
            key={coach.key}
            to={`/entrenadores/${coach.key}`}
            className="flex items-center gap-4 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-5 hover:shadow-apple-md transition-all"
          >
            {coach.photo
              ? <img src={coach.photo} alt="" className="w-16 h-16 rounded-full object-cover bg-apple-gray-100 dark:bg-apple-gray-700" />
              : <div className="w-16 h-16 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700" />}
            <div>
              <h2 className="text-base font-bold text-apple-gray-800 dark:text-white">{coach.fullName}</h2>
              <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
                {coach.status === 'activo' ? coach.club : 'Sin club actualmente'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Registrar la ruta**

En `src/App.tsx`, agregar el import lazy junto a los demás (cerca de la línea 44, después de `OpportunitiesPage`):

```ts
const CoachesListPage = lazy(() => import('@/pages/CoachesListPage'))
```

Y la ruta, junto a las demás (cerca de la línea 44):

```tsx
            <Route path="/entrenadores" element={<CoachesListPage />} />
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CoachesListPage.tsx src/App.tsx
git commit -m "feat(entrenadores): página /entrenadores con listado"
```

---

### Task 10: `CoachDetailPage.tsx` — shell con tabs

**Files:**
- Modify: `src/App.tsx` (import lazy + `<Route>`)
- Create: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `getCoachByKey` (Task 1).
- Produces: componente `CoachDetailPage`, montado en `/entrenadores/:coachKey`, con estado `activeTab` y placeholder para `status === 'sin_club'`. Los tabs concretos (Resumen, Plantel, Calendario, Entrenamientos, Notas, Liga) se completan en las Tasks 11-16 — este shell los deja como secciones vacías condicionadas por `activeTab` para que cada Task siguiente solo agregue su bloque.

- [ ] **Step 1: Invocar la skill de diseño**

Igual que en Task 9 — usar `frontend-design` para el layout de tabs y el placeholder de "sin club" antes de escribir el JSX final.

- [ ] **Step 2: Crear la página**

Crear `src/pages/CoachDetailPage.tsx`:

```tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCoachByKey } from '@/constants/agencyCoaches'

type CoachTab = 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'reserva'

const TABS: { id: CoachTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'plantel', label: 'Plantel' },
  { id: 'liga', label: 'Liga' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'entrenamientos', label: 'Entrenamientos' },
  { id: 'notas', label: 'Notas de partidos' },
]

export default function CoachDetailPage() {
  const { coachKey } = useParams<{ coachKey: string }>()
  const coach = coachKey ? getCoachByKey(coachKey) : undefined
  const [activeTab, setActiveTab] = useState<CoachTab>('resumen')

  if (!coach) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-apple-gray-500 dark:text-apple-gray-400">Entrenador no encontrado.</p>
        <Link to="/entrenadores" className="text-brand-green font-medium mt-2 inline-block">Volver</Link>
      </div>
    )
  }

  if (coach.status === 'sin_club') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <img
          src={coach.photo ?? undefined}
          alt=""
          className="w-24 h-24 rounded-full object-cover mx-auto mb-4 bg-apple-gray-100 dark:bg-apple-gray-800"
        />
        <h1 className="text-xl font-bold text-apple-gray-800 dark:text-white mb-1">{coach.fullName}</h1>
        <p className="text-apple-gray-500 dark:text-apple-gray-400">Sin club actualmente.</p>
      </div>
    )
  }

  const tabs = coach.reserveApiTeamId ? [...TABS, { id: 'reserva' as CoachTab, label: 'Reserva' }] : TABS

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-4 mb-6">
        <img
          src={coach.photo ?? undefined}
          alt=""
          className="w-16 h-16 rounded-full object-cover bg-apple-gray-100 dark:bg-apple-gray-800"
        />
        <div>
          <h1 className="text-xl font-bold text-apple-gray-800 dark:text-white">{coach.fullName}</h1>
          <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">{coach.club}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-thin">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              tab.id === activeTab
                ? 'bg-brand-green text-apple-gray-900'
                : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cada Task 11-16 agrega su bloque acá, condicionado por activeTab === 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'reserva' */}
    </div>
  )
}
```

- [ ] **Step 3: Registrar la ruta**

En `src/App.tsx`, agregar el import lazy junto a `CoachesListPage`:

```ts
const CoachDetailPage = lazy(() => import('@/pages/CoachDetailPage'))
```

Y la ruta, justo después de `/entrenadores`:

```tsx
            <Route path="/entrenadores/:coachKey" element={<CoachDetailPage />} />
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CoachDetailPage.tsx src/App.tsx
git commit -m "feat(entrenadores): shell de /entrenadores/:coachKey con tabs y placeholder sin club"
```

---

### Task 11: Tab Resumen

**Files:**
- Create: `src/features/coaches/components/CoachSummaryTab.tsx`
- Modify: `src/pages/CoachDetailPage.tsx` (montar el tab)

**Interfaces:**
- Consumes: `fetchTeamFixtures` (Task 2), `AgencyCoach` (Task 1), `isMatchFinished` (Task 7, `@/utils/coachCalendar`).
- Produces: componente `CoachSummaryTab({ coach: AgencyCoach })`, montado cuando `activeTab === 'resumen'`.

- [ ] **Step 1: Invocar la skill de diseño**

Usar `frontend-design` para el tratamiento visual de la tarjeta de "próximo partido" y la lista de últimos resultados antes de escribir el JSX final.

- [ ] **Step 2: Crear el componente**

Crear `src/features/coaches/components/CoachSummaryTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchTeamFixtures } from '@/services/footballApiService'
import { isMatchFinished } from '@/utils/coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function CoachSummaryTab({ coach }: { coach: AgencyCoach }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)

  useEffect(() => {
    if (!coach.apiTeamId) return
    let active = true
    fetchTeamFixtures(coach.apiTeamId).then(f => { if (active) setFixtures(f) })
    return () => { active = false }
  }, [coach.apiTeamId])

  if (fixtures === null) return <LoadingSpinner message="Cargando resumen..." />

  const sorted = [...fixtures].sort((a, b) => a.timestamp - b.timestamp)
  const next = sorted.find(f => !isMatchFinished(f.statusShort))
  const lastFive = [...sorted].filter(f => isMatchFinished(f.statusShort)).reverse().slice(0, 5)

  return (
    <div className="space-y-6">
      {next && (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-5">
          <p className="text-xs font-semibold text-apple-gray-400 mb-2">Próximo partido</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={next.homeTeam.logo} alt="" className="w-8 h-8" />
              <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{next.homeTeam.name}</span>
            </div>
            <span className="text-xs text-apple-gray-400">vs</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{next.awayTeam.name}</span>
              <img src={next.awayTeam.logo} alt="" className="w-8 h-8" />
            </div>
          </div>
          <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mt-2">
            {new Date(next.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · {next.venue}
          </p>
          <Link to="/scouting" className="inline-block mt-3 text-sm font-medium text-brand-green hover:text-emerald-600">
            Cargar informe del próximo rival →
          </Link>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-apple-gray-400 mb-2">Últimos 5 resultados</p>
        <div className="space-y-2">
          {lastFive.map(f => (
            <div key={f.fixtureId} className="flex items-center justify-between bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-4 py-2.5 text-sm">
              <span className="text-apple-gray-800 dark:text-white">{f.homeTeam.name} {f.goalsHome} - {f.goalsAway} {f.awayTeam.name}</span>
              <span className="text-xs text-apple-gray-400">{new Date(f.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
          {lastFive.length === 0 && <p className="text-sm text-apple-gray-400">Sin resultados recientes.</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Montar el tab en `CoachDetailPage.tsx`**

En `src/pages/CoachDetailPage.tsx`, agregar el import:

```ts
import CoachSummaryTab from '@/features/coaches/components/CoachSummaryTab'
```

Y reemplazar el comentario `{/* Cada Task 11-16 agrega su bloque... */}` por:

```tsx
      {activeTab === 'resumen' && <CoachSummaryTab coach={coach} />}
```

(Este mismo bloque se extiende en las Tasks 12-16 agregando más líneas `{activeTab === '...' && <... />}` justo debajo, sin tocar esta.)

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/CoachSummaryTab.tsx src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): tab Resumen — próximo partido y últimos 5 resultados"
```

---

### Task 12: `TeamRosterPanel.tsx` (Plantel y Reserva)

**Files:**
- Create: `src/features/coaches/components/TeamRosterPanel.tsx`
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `fetchSquadCached`, `SquadPlayer` (Task 3), `fetchSquadMinutes` (Task 6).
- Produces: componente `TeamRosterPanel({ teamId: number })`, reusado para `activeTab === 'plantel'` (con `coach.apiTeamId`) y `activeTab === 'reserva'` (con `coach.reserveApiTeamId`).

- [ ] **Step 1: Invocar la skill de diseño**

Usar `frontend-design` para la grilla de jugadores (foto, dorsal, posición, badge de minutos) antes de escribir el JSX final.

- [ ] **Step 2: Crear el componente**

Crear `src/features/coaches/components/TeamRosterPanel.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { fetchSquadCached, type SquadPlayer } from '@/services/footballApiService'
import { fetchSquadMinutes } from '@/services/coachService'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: 'Arquero',
  Defender: 'Defensor',
  Midfielder: 'Mediocampista',
  Attacker: 'Delantero',
}

export default function TeamRosterPanel({ teamId }: { teamId: number }) {
  const [squad, setSquad] = useState<SquadPlayer[] | null>(null)
  const [minutes, setMinutes] = useState<Record<number, { minutes: number; matches: number }>>({})

  useEffect(() => {
    let active = true
    fetchSquadCached(teamId).then(async players => {
      if (!active) return
      setSquad(players)
      const ids = players.map(p => p.id)
      const m = await fetchSquadMinutes(ids)
      if (active) setMinutes(m)
    })
    return () => { active = false }
  }, [teamId])

  if (squad === null) return <LoadingSpinner message="Cargando plantel..." />
  if (squad.length === 0) return <p className="text-sm text-apple-gray-400">No se pudo cargar el plantel.</p>

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {squad.map(player => {
        const stats = minutes[player.id]
        return (
          <div
            key={player.id}
            className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-3 flex flex-col items-center text-center"
          >
            {player.photo
              ? <img src={player.photo} alt="" className="w-14 h-14 rounded-full object-cover mb-2" />
              : <div className="w-14 h-14 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700 mb-2" />}
            <p className="text-sm font-semibold text-apple-gray-800 dark:text-white leading-tight">{player.name}</p>
            <p className="text-xs text-apple-gray-400">
              {player.number ? `#${player.number} · ` : ''}{player.position ? POSITION_LABEL[player.position] ?? player.position : ''}
            </p>
            {stats && (
              <span className="mt-1.5 text-2xs font-medium px-1.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green">
                {stats.minutes}' / {stats.matches} PJ (30d)
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Montar Plantel y Reserva en `CoachDetailPage.tsx`**

Agregar el import:

```ts
import TeamRosterPanel from '@/features/coaches/components/TeamRosterPanel'
```

Y agregar, debajo del bloque de `resumen` agregado en Task 11:

```tsx
      {activeTab === 'plantel' && coach.apiTeamId && <TeamRosterPanel teamId={coach.apiTeamId} />}
      {activeTab === 'reserva' && coach.reserveApiTeamId && <TeamRosterPanel teamId={coach.reserveApiTeamId} />}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/TeamRosterPanel.tsx src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): tab Plantel (reusado para Reserva) con badge de minutos"
```

---

### Task 13: Tab Liga (tabla de posiciones)

**Files:**
- Create: `src/features/coaches/components/CoachLeagueTab.tsx`
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `fetchLeagueStandings`, `StandingRow` (Task 4), `AgencyCoach` (Task 1).
- Produces: componente `CoachLeagueTab({ coach: AgencyCoach })`, montado cuando `activeTab === 'liga'`.

- [ ] **Step 1: Invocar la skill de diseño**

Usar `frontend-design` para la tabla de posiciones (selector de zona, fila resaltada de Temperley, racha con iconos W/D/L) antes de escribir el JSX final.

- [ ] **Step 2: Crear el componente**

Crear `src/features/coaches/components/CoachLeagueTab.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { fetchLeagueStandings, type StandingRow } from '@/services/footballApiService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type SortKey = 'points' | 'goalsFor' | 'goalsAgainst'

const FORM_COLOR: Record<string, string> = {
  W: 'bg-brand-green text-apple-gray-900',
  D: 'bg-apple-gray-300 dark:bg-apple-gray-600 text-apple-gray-800 dark:text-white',
  L: 'bg-red-400 text-white',
}

export default function CoachLeagueTab({ coach }: { coach: AgencyCoach }) {
  const [groups, setGroups] = useState<StandingRow[][] | null>(null)
  const [activeGroup, setActiveGroup] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('points')

  useEffect(() => {
    if (!coach.leagueApiId || !coach.leagueSeason) return
    let active = true
    fetchLeagueStandings(coach.leagueApiId, coach.leagueSeason).then(g => {
      if (!active) return
      setGroups(g)
      const ownGroupIndex = g.findIndex(group => group.some(row => row.teamId === coach.apiTeamId))
      if (ownGroupIndex >= 0) setActiveGroup(ownGroupIndex)
    })
    return () => { active = false }
  }, [coach.leagueApiId, coach.leagueSeason, coach.apiTeamId])

  const sortedRows = useMemo(() => {
    if (!groups) return []
    const rows = [...groups[activeGroup]]
    if (sortKey === 'points') return rows.sort((a, b) => b.points - a.points)
    if (sortKey === 'goalsFor') return rows.sort((a, b) => b.goalsFor - a.goalsFor)
    return rows.sort((a, b) => a.goalsAgainst - b.goalsAgainst)
  }, [groups, activeGroup, sortKey])

  if (groups === null) return <LoadingSpinner message="Cargando tabla de posiciones..." />

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2">
          {groups.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveGroup(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                i === activeGroup
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400'}`}
            >
              Zona {i === 0 ? 'A' : 'B'}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="text-xs font-medium rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-2 py-1.5 text-apple-gray-700 dark:text-apple-gray-200"
        >
          <option value="points">Ordenar por puntos</option>
          <option value="goalsFor">Ordenar por goles a favor</option>
          <option value="goalsAgainst">Ordenar por goles en contra</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase text-apple-gray-400 border-b border-apple-gray-200 dark:border-apple-gray-700">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Equipo</th>
              <th className="py-2 px-1 text-center">PJ</th>
              <th className="py-2 px-1 text-center">PG</th>
              <th className="py-2 px-1 text-center">PE</th>
              <th className="py-2 px-1 text-center">PP</th>
              <th className="py-2 px-1 text-center">GF</th>
              <th className="py-2 px-1 text-center">GC</th>
              <th className="py-2 px-1 text-center">DG</th>
              <th className="py-2 px-1 text-center">Pts</th>
              <th className="py-2 pl-2">Racha</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => (
              <tr
                key={row.teamId}
                className={`border-b border-apple-gray-100 dark:border-apple-gray-800 ${
                  row.teamId === coach.apiTeamId ? 'bg-brand-green/10 font-semibold' : ''}`}
              >
                <td className="py-2 pr-2 text-apple-gray-400">{row.rank}</td>
                <td className="py-2 pr-2 flex items-center gap-2 text-apple-gray-800 dark:text-white">
                  <img src={row.teamLogo} alt="" className="w-5 h-5" />
                  {row.teamName}
                </td>
                <td className="py-2 px-1 text-center">{row.played}</td>
                <td className="py-2 px-1 text-center">{row.win}</td>
                <td className="py-2 px-1 text-center">{row.draw}</td>
                <td className="py-2 px-1 text-center">{row.lose}</td>
                <td className="py-2 px-1 text-center">{row.goalsFor}</td>
                <td className="py-2 px-1 text-center">{row.goalsAgainst}</td>
                <td className="py-2 px-1 text-center">{row.goalsDiff}</td>
                <td className="py-2 px-1 text-center text-apple-gray-800 dark:text-white">{row.points}</td>
                <td className="py-2 pl-2">
                  <div className="flex gap-0.5">
                    {row.form.split('').map((r, i) => (
                      <span key={i} className={`w-4 h-4 rounded-sm text-2xs flex items-center justify-center ${FORM_COLOR[r] ?? ''}`}>{r}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Montar el tab en `CoachDetailPage.tsx`**

Agregar el import:

```ts
import CoachLeagueTab from '@/features/coaches/components/CoachLeagueTab'
```

Y agregar, debajo de los bloques anteriores, condicionado a que exista `leagueApiId`:

```tsx
      {activeTab === 'liga' && coach.leagueApiId && <CoachLeagueTab coach={coach} />}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/CoachLeagueTab.tsx src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): tab Liga — tabla de posiciones con zonas y orden por goles"
```

---

### Task 14: Tab Calendario

**Files:**
- Create: `src/features/coaches/components/CoachCalendarTab.tsx`
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `fetchTeamFixtures` (Task 2), `listTrainingSessions` (Task 6), `mergeCalendarEvents`, `CoachCalendarDay` (Task 7).
- Produces: componente `CoachCalendarTab({ coach: AgencyCoach })`, montado cuando `activeTab === 'calendario'`.

- [ ] **Step 1: Invocar la skill de diseño**

Usar `frontend-design` para la vista de calendario (íconos de partido/entrenamiento/viaje por día) antes de escribir el JSX final.

- [ ] **Step 2: Crear el componente**

Crear `src/features/coaches/components/CoachCalendarTab.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { fetchTeamFixtures, toArDateKey } from '@/services/footballApiService'
import { listTrainingSessions } from '@/services/coachService'
import { mergeCalendarEvents } from '@/utils/coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function CoachCalendarTab({ coach }: { coach: AgencyCoach }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)
  const [sessions, setSessions] = useState<CoachTrainingSession[] | null>(null)

  useEffect(() => {
    if (!coach.apiTeamId) return
    let active = true
    Promise.all([
      fetchTeamFixtures(coach.apiTeamId),
      listTrainingSessions(coach.key),
    ]).then(([f, s]) => {
      if (active) { setFixtures(f); setSessions(s) }
    })
    return () => { active = false }
  }, [coach.apiTeamId, coach.key])

  const days = useMemo(() => {
    if (!fixtures || !sessions) return null
    const merged = mergeCalendarEvents(fixtures, sessions)
    const next14: string[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      next14.push(toArDateKey(d))
    }
    return next14.map(key => merged.get(key) ?? { date: key, fixtures: [], sessions: [], isAbroad: false })
  }, [fixtures, sessions])

  if (days === null) return <LoadingSpinner message="Cargando calendario..." />

  return (
    <div className="space-y-2">
      {days.map(day => (
        <div
          key={day.date}
          className="flex items-center gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-4 py-3"
        >
          <span className="text-sm font-semibold text-apple-gray-800 dark:text-white w-24 shrink-0">
            {new Date(day.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <div className="flex flex-wrap gap-2 flex-1">
            {day.fixtures.map(f => (
              <span key={f.fixtureId} className="inline-flex items-center gap-1.5 text-xs bg-brand-green/10 text-brand-green px-2 py-1 rounded-full">
                <img src={f.isHome ? f.awayTeam.logo : f.homeTeam.logo} alt="" className="w-4 h-4" />
                vs {f.isHome ? f.awayTeam.name : f.homeTeam.name}
              </span>
            ))}
            {day.sessions.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-xs bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300 px-2 py-1 rounded-full">
                🏋️ {s.title}
              </span>
            ))}
            {day.isAbroad && (
              <span className="inline-flex items-center text-xs text-apple-gray-400" title="Viaje al exterior">✈️</span>
            )}
            {day.fixtures.length === 0 && day.sessions.length === 0 && (
              <span className="text-xs text-apple-gray-300 dark:text-apple-gray-600">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Montar el tab en `CoachDetailPage.tsx`**

Agregar el import:

```ts
import CoachCalendarTab from '@/features/coaches/components/CoachCalendarTab'
```

Y agregar:

```tsx
      {activeTab === 'calendario' && <CoachCalendarTab coach={coach} />}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/CoachCalendarTab.tsx src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): tab Calendario — próximos 14 días con partidos, entrenamientos y viajes"
```

---

### Task 15: Tab Entrenamientos (agenda)

**Files:**
- Create: `src/features/coaches/components/CoachTrainingTab.tsx`
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `listTrainingSessions`, `upsertTrainingSession`, `deleteTrainingSession`, `CoachTrainingSession`, `TrainingSessionType` (Task 6).
- Produces: componente `CoachTrainingTab({ coach: AgencyCoach })`, montado cuando `activeTab === 'entrenamientos'`.

- [ ] **Step 1: Invocar la skill de diseño**

Usar `frontend-design` para el formulario de alta y la lista de sesiones antes de escribir el JSX final.

- [ ] **Step 2: Crear el componente**

Crear `src/features/coaches/components/CoachTrainingTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  listTrainingSessions, upsertTrainingSession, deleteTrainingSession,
  type CoachTrainingSession, type TrainingSessionType,
} from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const TYPE_LABEL: Record<TrainingSessionType, string> = {
  tactico: 'Táctico', fisico: 'Físico', recuperacion: 'Recuperación',
  set_pieces: 'Pelota parada', pre_rival: 'Pre-rival', otro: 'Otro',
}

export default function CoachTrainingTab({ coach }: { coach: AgencyCoach }) {
  const [sessions, setSessions] = useState<CoachTrainingSession[] | null>(null)
  const [date, setDate] = useState('')
  const [type, setType] = useState<TrainingSessionType>('tactico')
  const [title, setTitle] = useState('')

  async function reload() {
    setSessions(await listTrainingSessions(coach.key))
  }

  useEffect(() => { reload() }, [coach.key])

  async function handleAdd() {
    if (!date || !title.trim()) return
    await upsertTrainingSession({ coach_key: coach.key, session_date: date, type, title: title.trim() })
    setDate(''); setTitle('')
    await reload()
  }

  async function handleDelete(id: number) {
    await deleteTrainingSession(id)
    await reload()
  }

  if (sessions === null) return <LoadingSpinner message="Cargando entrenamientos..." />

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2.5 py-1.5 text-sm"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value as TrainingSessionType)}
          className="rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2.5 py-1.5 text-sm"
        >
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título de la sesión"
          className="flex-1 min-w-[160px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2.5 py-1.5 text-sm"
        />
        <button
          onClick={handleAdd}
          className="px-3.5 py-1.5 rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold"
        >
          Agregar
        </button>
      </div>

      <div className="space-y-2">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-apple-gray-800 dark:text-white">{s.title}</p>
              <p className="text-xs text-apple-gray-400">
                {new Date(s.session_date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} · {TYPE_LABEL[s.type]}
              </p>
            </div>
            <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 font-medium">Borrar</button>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-sm text-apple-gray-400">Sin entrenamientos agendados.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Montar el tab en `CoachDetailPage.tsx`**

Agregar el import:

```ts
import CoachTrainingTab from '@/features/coaches/components/CoachTrainingTab'
```

Y agregar:

```tsx
      {activeTab === 'entrenamientos' && <CoachTrainingTab coach={coach} />}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/CoachTrainingTab.tsx src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): tab Entrenamientos — agenda con alta/borrado"
```

---

### Task 16: Tab Notas de partidos

**Files:**
- Create: `src/features/coaches/components/CoachNotesTab.tsx`
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `fetchTeamFixtures` (Task 2), `getMatchNote`, `upsertMatchNote` (Task 6), `isMatchFinished` (Task 7, `@/utils/coachCalendar`).
- Produces: componente `CoachNotesTab({ coach: AgencyCoach })`, montado cuando `activeTab === 'notas'`.

- [ ] **Step 1: Invocar la skill de diseño**

Usar `frontend-design` para la lista de partidos con textarea de nota antes de escribir el JSX final.

- [ ] **Step 2: Crear el componente**

Crear `src/features/coaches/components/CoachNotesTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { fetchTeamFixtures } from '@/services/footballApiService'
import { getMatchNote, upsertMatchNote } from '@/services/coachService'
import { isMatchFinished } from '@/utils/coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function NoteRow({ coach, fixture }: { coach: AgencyCoach; fixture: AgencyFixture }) {
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getMatchNote(coach.key, fixture.fixtureId).then(n => setNote(n ?? ''))
  }, [coach.key, fixture.fixtureId])

  async function handleSave() {
    await upsertMatchNote(coach.key, fixture.fixtureId, note)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
      <p className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">
        {fixture.homeTeam.name} {fixture.goalsHome} - {fixture.goalsAway} {fixture.awayTeam.name}
      </p>
      <p className="text-xs text-apple-gray-400 mb-2">
        {new Date(fixture.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
      </p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Qué funcionó, qué no, conclusiones para el próximo partido..."
        rows={3}
        className="w-full rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 py-2 text-sm"
      />
      <button
        onClick={handleSave}
        className="mt-2 px-3 py-1.5 rounded-lg bg-brand-green text-apple-gray-900 text-xs font-semibold"
      >
        {saved ? 'Guardado ✓' : 'Guardar nota'}
      </button>
    </div>
  )
}

export default function CoachNotesTab({ coach }: { coach: AgencyCoach }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)

  useEffect(() => {
    if (!coach.apiTeamId) return
    let active = true
    fetchTeamFixtures(coach.apiTeamId).then(f => { if (active) setFixtures(f) })
    return () => { active = false }
  }, [coach.apiTeamId])

  if (fixtures === null) return <LoadingSpinner message="Cargando partidos..." />

  const played = [...fixtures]
    .filter(f => isMatchFinished(f.statusShort))
    .sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="space-y-3">
      {played.map(f => <NoteRow key={f.fixtureId} coach={coach} fixture={f} />)}
      {played.length === 0 && <p className="text-sm text-apple-gray-400">Sin partidos jugados todavía.</p>}
    </div>
  )
}
```

- [ ] **Step 3: Montar el tab en `CoachDetailPage.tsx`**

Agregar el import:

```ts
import CoachNotesTab from '@/features/coaches/components/CoachNotesTab'
```

Y agregar:

```tsx
      {activeTab === 'notas' && <CoachNotesTab coach={coach} />}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/CoachNotesTab.tsx src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): tab Notas de partidos — bitácora editable por partido"
```

---

### Task 17: Verificación final

**Files:** ninguno nuevo — corre la suite completa y hace un smoke test manual.

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm test`
Expected: PASS — incluye los tests nuevos de `agencyCoaches.test.ts`, `footballApiService.test.ts` y `coachCalendar.test.ts`, sin regresiones en el resto.

- [ ] **Step 2: Typecheck y build completo**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Confirmar que la migración de Supabase (Task 5) ya se corrió**

Sin las tablas `coach_training_sessions` y `coach_match_notes`, los tabs Entrenamientos y Notas van a fallar silenciosamente (arrays vacíos, `console.error` en consola). Confirmar con el usuario antes de este smoke test.

- [ ] **Step 4: Smoke test manual en el navegador**

Run: `npm run dev`, abrir `http://localhost:5173`.

- Nav: aparece "Entrenadores" en el menú (desktop y mobile).
- `/entrenadores`: muestra las 2 cards (Domingo con foto y club, Stillitano con foto y "Sin club actualmente").
- `/entrenadores/domingo`: cargan los 6 tabs. Resumen muestra próximo partido real de Temperley y últimos 5 resultados. Plantel muestra ~31 jugadores con foto/dorsal/posición. Liga muestra la tabla de Primera Nacional con la Zona B abierta por default y Temperley resaltado en 4° lugar. Calendario muestra los próximos 14 días. Entrenamientos permite agregar una sesión de prueba y borrarla. Notas permite escribir y guardar una nota en un partido jugado, recargar la página y confirmar que la nota persiste.
- `/entrenadores/stillitano`: muestra el placeholder "Sin club actualmente", sin tabs.
- Confirmar look and feel: no debe verse genérico — si algo quedó con estilos por defecto sin pasar por `frontend-design`, ajustar ahí antes de cerrar.
- **Repetir el recorrido de arriba en 3 anchos de viewport**: mobile (~390px), tablet (~768px) y desktop (~1440px). Puntos concretos a revisar en cada uno: los tabs de `CoachDetailPage` no se cortan (scrollean horizontal); la tabla de posiciones de Task 13 no rompe el layout en mobile (`overflow-x-auto` scrollea, no desborda la página); la grilla de plantel de Task 12 pasa de 2 a 4 columnas según ancho sin superponerse; los botones de Entrenamientos/Notas son tocables con el dedo (alto ≥ ~40px). Si algo falla en algún ancho, corregirlo ahí mismo antes de cerrar la tarea.

- [ ] **Step 5: Commit final si hubo ajustes del smoke test**

Solo si el Step 4 encontró algo para corregir — de lo contrario no hay nada que commitear en esta tarea.
