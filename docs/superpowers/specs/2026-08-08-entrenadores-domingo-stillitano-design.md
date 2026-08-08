# Sección Entrenadores: Domingo y Stillitano

## Contexto

La agencia representa a 2 entrenadores: Nicolás Domingo (activo, Temperley) y Leandro Stillitano (sin club actualmente). Hoy la plataforma no tiene ningún concepto de "entrenador" — todo es scouting de jugadores. El pedido es una sección nueva donde cada uno (y cualquiera del staff, mismo login compartido — no hay roles individuales) pueda ver: plantel, últimos resultados, próximo partido, calendario del equipo (partidos + entrenamientos + viajes), agenda de entrenamientos, y notas por partido.

Pensado desde la óptica de un entrenador (qué necesita saber día a día y para el próximo partido): disponibilidad de plantel, calendario de la semana, y conclusiones de partidos anteriores. Alcance explícitamente **fuera** de este v1: login/roles individuales, sync propio de plantel/fixtures a Supabase (se pide en vivo), lesiones/suspensiones de todo el plantel (requeriría un llamado a la API por jugador), asistencia jugador-por-jugador a entrenamientos.

## 1. Registro de entrenadores

Nuevo `src/constants/agencyCoaches.ts`, mismo espíritu que `src/constants/agencyPlayers.ts`:

```ts
export interface AgencyCoach {
  key: string                    // 'domingo' | 'stillitano', slug para URL y para las tablas nuevas
  fullName: string
  photo: string | null
  status: 'activo' | 'sin_club'
  club: string | null
  apiTeamId: number | null       // null si status === 'sin_club'
  reserveApiTeamId?: number | null  // opcional, solo si el club tiene reserva como equipo separado en API-Football
}

export const AGENCY_COACHES: AgencyCoach[] = [
  { key: 'domingo', fullName: 'Nicolás Domingo', photo: '/coaches/domingo.png', status: 'activo', club: 'Temperley', apiTeamId: 454 },  // verificado 2026-08-08 vía /teams?search=Temperley
  { key: 'stillitano', fullName: 'Leandro Stillitano', photo: '/coaches/stillitano.png', status: 'sin_club', club: null, apiTeamId: null },
]

export function getCoachByKey(key: string): AgencyCoach | undefined {
  return AGENCY_COACHES.find(c => c.key === key)
}
```

Agregar un tercer entrenador en el futuro es una línea nueva acá, no una feature nueva. `apiTeamId` de Temperley se busca una sola vez (búsqueda manual en API-Football, como ya se hace para `agencyPlayers.ts`) y se hardcodea.

## 2. Datos en vivo: extender `footballApiService.ts`

Hoy `getTeamFixtures` y `fetchSquadCached` existen pero **no están exportados** y `fetchSquadCached` solo devuelve `{ id, name }` (sin foto/posición/dorsal). Cambios:

**a) Exportar fetch de fixtures por equipo individual** (nueva función, no reemplaza `fetchAllAgencyFixtures` que sigue usando el Home/Calendario general):

```ts
const TEAM_FIXTURES_CACHE_PREFIX = 'dg-team-fixtures-cache'
const TEAM_FIXTURES_CACHE_TTL = 4 * 60 * 60 * 1000  // 4h, igual que el cache existente

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

(`getCachedGeneric`/`setCacheGeneric` son un pequeño refactor de `getCached`/`setCache` para aceptar una `cacheKey` en vez de la constante fija `CACHE_KEY` — hoy están atadas al cache único de `fetchAllAgencyFixtures`. Cambio chico y aislado.)

**b) Extender el shape del plantel** — `fetchSquadCached` pasa a devolver también `position`, `number`, `photo` (ya vienen en la respuesta cruda de `/players/squads`, solo no se mapeaban):

```ts
export interface SquadPlayer { id: number; name: string; age: number | null; number: number | null; position: string | null; photo: string | null }

export async function fetchSquadCached(teamId: number): Promise<SquadPlayer[]> { /* mismo cuerpo, mapeo extendido */ }
```

**c) Reusar tal cual, sin cambios:** `fetchPlayerInjuries(playerId)` — no se llama por todo el plantel en v1 (costo de N llamados), pero queda disponible para v2 si se decide agregar "lesionados del plantel" con un botón manual ("cargar estado físico") en vez de automático en cada carga de página.

## 3. Datos nuevos en Supabase

Dos tablas, mismo patrón de RLS que `gps_entries` (lectura pública, escritura para `authenticated`):

```sql
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
  fixture_id  BIGINT NOT NULL,     -- id de fixture de API-Football (no FK: el fixture no vive en nuestras tablas)
  note        TEXT NOT NULL,
  author      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_match_notes ON public.coach_match_notes(coach_key, fixture_id);
-- 1 nota editable por partido por entrenador (bitácora, no hilo de comentarios)

ALTER TABLE public.coach_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_match_notes       ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_coach_training_sessions" ON public.coach_training_sessions FOR SELECT USING (true);
CREATE POLICY "write_coach_training_sessions" ON public.coach_training_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "read_coach_match_notes" ON public.coach_match_notes FOR SELECT USING (true);
CREATE POLICY "write_coach_match_notes" ON public.coach_match_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

`coach_match_notes.note` es un único texto editable por partido (se hace `upsert` con `onConflict: 'coach_key,fixture_id'`), no una lista de comentarios — mantiene la UI simple (un textarea + guardar por partido).

Servicio nuevo `src/services/coachService.ts` con las funciones CRUD sobre estas 2 tablas (`listTrainingSessions`, `upsertTrainingSession`, `deleteTrainingSession`, `getMatchNote`, `upsertMatchNote`).

**Fotos:** ya generadas y en el repo — `public/coaches/domingo.png` y `public/coaches/stillitano.png`, recorte de sujeto con fondo transparente (verificado canal alfa real, 0-255).

## 4. Navegación y páginas

**Diseño visual:** al implementar la UI de estas páginas se usa la skill `frontend-design` (no el look genérico por defecto) — mismo criterio ya aplicado en el resto de la plataforma, pero vale la pena repetirlo acá porque es una sección nueva de punta a punta.


- Nuevo item de menú "Entrenadores" (mismo lugar que Scout Externo/Interno).
- `/entrenadores` — listado de `AGENCY_COACHES` en cards (foto, nombre, club o "Sin club").
- `/entrenadores/:coachKey` — página del entrenador, componente `CoachDetailPage.tsx`. Si `status === 'sin_club'`: placeholder simple ("Sin club actualmente") y nada más — se activa solo el día que se le cargue `apiTeamId`.

Si `status === 'activo'`, tabs (mismo patrón visual de tabs que ya usa `PlayerDetailPage.tsx`):

1. **Resumen** — próximo partido destacado (rival, fecha, venue, cuenta regresiva) tomado de `fetchTeamFixtures`; últimos 5 resultados; botón "Cargar informe del próximo rival" que es un link simple a la página de Scouting Externo ya existente (sin pre-cargar el rival ni tocar ese flujo — el objetivo es evitar que alguien tenga que buscar el menú, no integrar los dos flujos).
2. **Plantel** — grilla desde `fetchSquadCached(apiTeamId)`: foto, nombre, dorsal, posición. Si el `id` del jugador aparece en `player_match_stats` (join simple), se muestra un badge de minutos jugados en los últimos 30 días; si no, sin badge (no se pide ese dato a la API por jugador).
3. **Calendario** — reusa el componente de calendario mensual de `CalendarPage.tsx` (extraído a un componente reusable si hoy está inline en la página), alimentado por `fetchTeamFixtures(apiTeamId)` en vez del agregado de toda la agencia, fusionado en el mismo `Map` por fecha con los `coach_training_sessions` del entrenador. Cada día muestra: escudo si hay partido, ícono de entrenamiento si hay sesión agendada, ícono de avión si `leagueCountry !== 'Argentina'` (mismo criterio que `isAbroad` del Home).
4. **Entrenamientos** — lista/agenda de `coach_training_sessions`, con alta/edición/borrado (fecha, hora, tipo, título, notas). Sin calendario de arrastrar-soltar en v1 — formulario simple + lista ordenada por fecha.
5. **Notas de partidos** — lista de los últimos resultados (de `fetchTeamFixtures`, los que ya se jugaron) con un textarea de nota por partido, `upsertMatchNote` al guardar.
6. **Reserva** — solo si `reserveApiTeamId` está cargado: mismos sub-tabs de Plantel y Resultados apuntando a ese id. Si no está cargado, el tab ni aparece.

## 5. Testing

- `agencyCoaches.ts`: `getCoachByKey` (casos: existe, no existe).
- `coachService.ts`: CRUD de sesiones y notas contra un mock de Supabase (mismo patrón que tests existentes de otros services, ej. `gpsService.test.ts`).
- Fusión calendario partidos+entrenamientos: función pura que combina `AgencyFixture[]` + `CoachTrainingSession[]` en el `Map<string, DayEvent[]>` — testeable sin red ni DB.
- `fetchSquadCached`/`fetchTeamFixtures`: no se testean contra la API real (igual que el resto de `footballApiService.ts`, que no tiene tests de red hoy — se prueba manualmente).

## Fuera de alcance (v1)

- Roles/login individual por entrenador — mismo login compartido para todos.
- Sync propio a Supabase de plantel/fixtures — todo se pide en vivo con cache de localStorage.
- Lesiones/suspensiones de todo el plantel — requeriría un llamado a la API por jugador; queda para v2 si hace falta.
- Asistencia jugador-por-jugador a entrenamientos — la agenda es a nivel sesión, no lista de presentes.
- Drag-and-drop en el calendario de entrenamientos — alta por formulario simple.
