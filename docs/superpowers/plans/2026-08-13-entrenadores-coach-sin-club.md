# Entrenadores: ficha de entrenador sin club — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La ficha de un entrenador `sin_club` (caso real: Leandro Stillitano) deja de mostrar una tarjeta vacía y en su lugar muestra Resumen (bio + trayectoria vía API-Football), Entrenamientos y Pizarra — las únicas pestañas que no dependen de un equipo real.

**Architecture:** `CoachTrainingTab` y `CoachTacticalBoardTab` ya toleran `apiTeamId: null` (no bloquean, solo pierden el auto-relleno de datos del equipo) — no requieren cambios. El trabajo real es: (1) una función nueva `fetchCoachProfile` en `footballApiService.ts` que trae bio + trayectoria del endpoint `/coachs` de API-Football, siguiendo el mismo patrón de `fetchLeagueStandings`/`mapStandingsResponse` ya existente en el archivo; (2) un componente nuevo `CoachBioTab` que reemplaza a `CoachSummaryTab` cuando no hay equipo; (3) `CoachDetailPage.tsx` deja de cortar el render para `sin_club` y en su lugar filtra la barra de pestañas dinámicamente.

**Tech Stack:** React 18 + TypeScript, Vitest (TDD para la función pura de mapeo), Tailwind CSS.

## Global Constraints

- Nunca usar emoji crudo como ícono — SVG dibujado a mano (convención ya establecida en toda la rama).
- Cada commit, mensaje en español, mismo estilo que el resto del repo.
- Las llamadas a API-Football pasan siempre por el proxy `/api/football` (nunca `fetch` directo a `v3.football.api-sports.io`) — mismo mecanismo que toda función existente en `footballApiService.ts`.
- No tocar `CoachTrainingTab.tsx` ni `CoachTacticalBoardTab.tsx` — ya funcionan sin `apiTeamId`, no necesitan cambios para este plan.
- Notas de partido (`CoachNotesTab`), Plantel, Liga, Calendario y Plantel futuro quedan fuera de alcance: no se muestran para `sin_club` (decisión de producto ya tomada, ver spec).

---

### Task 1: `fetchCoachProfile` — bio y trayectoria desde API-Football

**Files:**
- Modify: `src/services/footballApiService.ts`
- Create: `src/services/__fixtures__/coach-profile-sample.json`
- Modify: `src/services/footballApiService.test.ts`

**Interfaces:**
- Produces: `export interface CoachCareerEntry { teamId: number; teamName: string; teamLogo: string; start: string | null; end: string | null }`, `export interface CoachProfile { age: number | null; nationality: string | null; birthPlace: string | null; birthCountry: string | null; career: CoachCareerEntry[] }`, `export function mapCoachProfileResponse(raw: any): CoachProfile | null`, `export async function fetchCoachProfile(coachKey: string, fullName: string, apiId?: number | null): Promise<CoachProfile | null>`.

- [ ] **Step 1: Crear el fixture JSON con una respuesta real de `/coachs`**

Crear `src/services/__fixtures__/coach-profile-sample.json`:

```json
{
  "get": "coachs",
  "parameters": { "search": "Stillitano" },
  "errors": [],
  "results": 1,
  "paging": { "current": 1, "total": 1 },
  "response": [
    {
      "id": 12345,
      "name": "L. Stillitano",
      "firstname": "Leandro",
      "lastname": "Stillitano",
      "age": 47,
      "birth": {
        "date": "1978-03-10",
        "place": "Ramos Mejía",
        "country": "Argentina"
      },
      "nationality": "Argentina",
      "height": null,
      "weight": null,
      "photo": "https://media.api-sports.io/football/coachs/12345.png",
      "team": null,
      "career": [
        {
          "team": { "id": 435, "name": "Vélez Sarsfield", "logo": "https://media.api-sports.io/football/teams/435.png" },
          "start": "2022-06-01",
          "end": "2023-05-01"
        },
        {
          "team": { "id": 451, "name": "Talleres", "logo": "https://media.api-sports.io/football/teams/451.png" },
          "start": "2019-01-01",
          "end": "2021-12-01"
        },
        {
          "team": { "id": 435, "name": "Vélez Sarsfield", "logo": "https://media.api-sports.io/football/teams/435.png" },
          "start": "2016-07-01",
          "end": "2018-11-01"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Escribir los tests de `mapCoachProfileResponse` (van a fallar, la función no existe todavía)**

Agregar al final de `src/services/footballApiService.test.ts`:

```ts
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mapStandingsResponse, mapCoachProfileResponse } from './footballApiService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const coachFixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'coach-profile-sample.json'), 'utf-8'),
)

describe('mapCoachProfileResponse', () => {
  it('mapea edad, nacionalidad y lugar de nacimiento', () => {
    const profile = mapCoachProfileResponse(coachFixture)
    expect(profile).toMatchObject({
      age: 47,
      nationality: 'Argentina',
      birthPlace: 'Ramos Mejía',
      birthCountry: 'Argentina',
    })
  })

  it('ordena la trayectoria del club más reciente al más antiguo', () => {
    const profile = mapCoachProfileResponse(coachFixture)
    expect(profile?.career.map(c => c.start)).toEqual(['2022-06-01', '2019-01-01', '2016-07-01'])
  })

  it('mapea escudo y nombre de cada club de la trayectoria', () => {
    const profile = mapCoachProfileResponse(coachFixture)
    expect(profile?.career[0]).toMatchObject({
      teamId: 435,
      teamName: 'Vélez Sarsfield',
      teamLogo: 'https://media.api-sports.io/football/teams/435.png',
      start: '2022-06-01',
      end: '2023-05-01',
    })
  })

  it('un club actual sin fecha de fin queda con end: null', () => {
    const raw = {
      response: [{
        age: 40, nationality: 'Argentina', birth: { place: 'CABA', country: 'Argentina' },
        career: [{ team: { id: 1, name: 'Club Actual', logo: 'logo.png' }, start: '2025-01-01', end: null }],
      }],
    }
    const profile = mapCoachProfileResponse(raw)
    expect(profile?.career[0].end).toBeNull()
  })

  it('devuelve null si la respuesta no tiene resultados', () => {
    const raw = { response: [] }
    expect(mapCoachProfileResponse(raw)).toBeNull()
  })
})
```

- [ ] **Step 3: Correr los tests para confirmar que fallan**

Run: `npx vitest run src/services/footballApiService.test.ts`
Expected: FAIL — `mapCoachProfileResponse is not a function` (o import error).

- [ ] **Step 4: Implementar `mapCoachProfileResponse` y `fetchCoachProfile`**

Agregar en `src/services/footballApiService.ts`, después de `fetchLeagueStandings` (cerca de la línea 534, mismo bloque de STANDINGS puede quedar como está — este código va en una sección nueva `// ─── COACH PROFILE ──` justo debajo):

```ts
// ─── COACH PROFILE ──────────────────────────────────────────────────────────

export interface CoachCareerEntry {
  teamId: number
  teamName: string
  teamLogo: string
  start: string | null
  end: string | null
}

export interface CoachProfile {
  age: number | null
  nationality: string | null
  birthPlace: string | null
  birthCountry: string | null
  career: CoachCareerEntry[]
}

export function mapCoachProfileResponse(raw: any): CoachProfile | null {
  const entry = raw?.response?.[0]
  if (!entry) return null

  const career: CoachCareerEntry[] = (entry.career ?? [])
    .filter((c: any) => c?.team?.id)
    .map((c: any): CoachCareerEntry => ({
      teamId: c.team.id,
      teamName: c.team.name,
      teamLogo: c.team.logo,
      start: c.start ?? null,
      end: c.end ?? null,
    }))
    .sort((a: CoachCareerEntry, b: CoachCareerEntry) => (b.start ?? '').localeCompare(a.start ?? ''))

  return {
    age: entry.age ?? null,
    nationality: entry.nationality ?? null,
    birthPlace: entry.birth?.place ?? null,
    birthCountry: entry.birth?.country ?? null,
    career,
  }
}

const COACH_PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h: bio/trayectoria casi no cambian

export async function fetchCoachProfile(
  coachKey: string,
  fullName: string,
  apiId?: number | null,
): Promise<CoachProfile | null> {
  const cacheKey = `dg-coach-profile-cache:${coachKey}`
  const cached = getCachedGeneric<CoachProfile>(cacheKey, COACH_PROFILE_CACHE_TTL)
  if (cached) return cached

  const params = apiId ? { id: String(apiId) } : { search: fullName }
  const raw = await apiFetch<any>('/coachs', params).catch(() => null)
  if (!raw) return null

  const profile = mapCoachProfileResponse(raw)
  if (profile) setCacheGeneric(cacheKey, profile)
  return profile
}
```

- [ ] **Step 5: Correr los tests de nuevo, deben pasar**

Run: `npx vitest run src/services/footballApiService.test.ts`
Expected: PASS, los 5 tests de `mapCoachProfileResponse` en verde (más los tests preexistentes de `mapStandingsResponse` sin romperse).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/services/footballApiService.ts src/services/footballApiService.test.ts src/services/__fixtures__/coach-profile-sample.json
git commit -m "feat(entrenadores): fetchCoachProfile trae bio y trayectoria desde API-Football"
```

---

### Task 2: `CoachBioTab` — panel de bio y trayectoria

**Files:**
- Create: `src/features/coaches/components/CoachBioTab.tsx`
- Modify: `src/constants/agencyCoaches.ts`

**Interfaces:**
- Consumes: `fetchCoachProfile(coachKey: string, fullName: string, apiId?: number | null): Promise<CoachProfile | null>`, `CoachProfile`, `CoachCareerEntry` (Task 1, `@/services/footballApiService`); `AgencyCoach` (`@/constants/agencyCoaches`); `LoadingSpinner` (`@/components/ui/LoadingSpinner`).
- Produces: `export default function CoachBioTab({ coach }: { coach: AgencyCoach }): JSX.Element`, campo `coachApiId?: number | null` en `AgencyCoach`.

- [ ] **Step 1: Agregar el campo `coachApiId` a `AgencyCoach`**

En `src/constants/agencyCoaches.ts`, agregar el campo a la interfaz (sin asignarlo a ningún entrenador todavía — se completa a mano solo si la búsqueda por nombre de Stillitano resulta ambigua en la verificación visual del Task 3):

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
  coachApiId?: number | null
}
```

- [ ] **Step 2: Crear `CoachBioTab.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { fetchCoachProfile, type CoachProfile } from '@/services/footballApiService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function formatMonthYear(iso: string | null): string {
  if (!iso) return 'Actualidad'
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

export default function CoachBioTab({ coach }: { coach: AgencyCoach }) {
  const [profile, setProfile] = useState<CoachProfile | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    fetchCoachProfile(coach.key, coach.fullName, coach.coachApiId).then(p => {
      if (active) setProfile(p)
    })
    return () => {
      active = false
    }
  }, [coach.key, coach.fullName, coach.coachApiId])

  if (profile === undefined) return <LoadingSpinner message="Cargando perfil..." />

  if (profile === null) {
    return <EmptyState message="No encontramos el perfil de este entrenador en la base de datos." />
  }

  const bioFacts = [
    profile.age !== null && { label: 'Edad', value: `${profile.age} años` },
    profile.nationality && { label: 'Nacionalidad', value: profile.nationality },
    profile.birthPlace && { label: 'Lugar de nacimiento', value: `${profile.birthPlace}${profile.birthCountry ? `, ${profile.birthCountry}` : ''}` },
  ].filter((f): f is { label: string; value: string } => Boolean(f))

  return (
    <div className="space-y-6 animate-fade-in">
      {bioFacts.length > 0 && (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {bioFacts.map(fact => (
            <div key={fact.label}>
              <p className="text-2xs font-semibold uppercase text-apple-gray-400 mb-0.5">{fact.label}</p>
              <p className="text-sm font-semibold text-apple-gray-800 dark:text-white">{fact.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Trayectoria</h2>
        {profile.career.length === 0 && <EmptyState message="No hay trayectoria registrada para este entrenador." />}
        {profile.career.map((entry, i) => (
          <div
            key={`${entry.teamId}-${entry.start ?? i}`}
            className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4"
          >
            <img src={entry.teamLogo} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{entry.teamName}</p>
              <p className="text-xs text-apple-gray-400">
                {formatMonthYear(entry.start)} — {formatMonthYear(entry.end)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/features/coaches/components/CoachBioTab.tsx src/constants/agencyCoaches.ts
git commit -m "feat(entrenadores): CoachBioTab muestra edad, nacionalidad y trayectoria sin club"
```

---

### Task 3: `CoachDetailPage` — sacar el bloqueo total para `sin_club`

**Files:**
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `CoachBioTab` (Task 2, `@/features/coaches/components/CoachBioTab`); `TABS`, `CoachTab`, y el resto de los componentes de pestaña ya importados en el archivo (sin cambios de firma).

- [ ] **Step 1: Reemplazar el bloqueo de `sin_club` y filtrar la barra de pestañas**

En `src/pages/CoachDetailPage.tsx`:

1. Agregar el import al tope del archivo, junto a los demás imports de pestañas:

```tsx
import CoachBioTab from '@/features/coaches/components/CoachBioTab'
```

2. Eliminar por completo el bloque `if (coach.status === 'sin_club') { return (...) }` (líneas 103-121 actuales).

3. Reemplazar la línea `const tabs = coach.reserveApiTeamId ? [...TABS, { id: 'reserva' as CoachTab, label: 'Reserva' }] : TABS` por una que también filtre para `sin_club`:

```tsx
const SIN_CLUB_TAB_IDS: CoachTab[] = ['resumen', 'entrenamientos', 'pizarra']

const tabs = isActive
  ? (coach.reserveApiTeamId ? [...TABS, { id: 'reserva' as CoachTab, label: 'Reserva' }] : TABS)
  : TABS.filter(t => SIN_CLUB_TAB_IDS.includes(t.id))
```

(`isActive` ya existe en el archivo, definido como `const isActive = coach.status === 'activo'` antes del bloque eliminado.)

4. Reemplazar el subtítulo del header — donde hoy dice:

```tsx
<span className="inline-flex items-center gap-1.5 mt-1 text-sm font-medium text-brand-green">
  <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse-soft flex-shrink-0" />
  <span className="truncate">{coach.club}</span>
</span>
```

por una versión que también contemple `sin_club` (mismo estilo que tenía la tarjeta vacía: punto gris, sin pulso):

```tsx
<span
  className={`inline-flex items-center gap-1.5 mt-1 text-sm font-medium ${
    isActive ? 'text-brand-green' : 'text-apple-gray-500 dark:text-apple-gray-400'
  }`}
>
  <span
    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
      isActive ? 'bg-brand-green animate-pulse-soft' : 'bg-apple-gray-300 dark:bg-apple-gray-600'
    }`}
  />
  <span className="truncate">{isActive ? coach.club : 'Sin club actualmente'}</span>
</span>
```

5. Reemplazar la línea del Resumen:

```tsx
{activeTab === 'resumen' && <CoachSummaryTab coach={coach} />}
```

por:

```tsx
{activeTab === 'resumen' && (coach.apiTeamId ? <CoachSummaryTab coach={coach} /> : <CoachBioTab coach={coach} />)}
```

Las líneas de `plantel`, `reserva`, `liga`, `calendario`, `notas`, `plantel_futuro` quedan igual — sus propias condiciones (`coach.apiTeamId &&`, `coach.reserveApiTeamId &&`, `coach.leagueApiId &&`) ya evitan que rendericen sin equipo, y ahora tampoco van a aparecer como botón en la barra de pestañas.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Correr toda la suite**

Run: `npx vitest run`
Expected: todos los tests en verde (no debería haber tests que dependan del bloque eliminado — es JSX de página, no hay `CoachDetailPage.test.tsx` en el repo).

- [ ] **Step 4: Commit**

```bash
git add src/pages/CoachDetailPage.tsx
git commit -m "fix(entrenadores): ficha sin club muestra Resumen, Entrenamientos y Pizarra en vez de tarjeta vacia"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npx vitest run`
Expected: todos los tests en verde, incluidos los nuevos de `footballApiService.test.ts` (`mapCoachProfileResponse`).

- [ ] **Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Verificación visual completa en el navegador, con `npm run dev`:**
  - Entrar a la ficha de Leandro Stillitano (`/entrenadores/stillitano`): la barra de pestañas muestra solo Resumen, Entrenamientos, Pizarra (no Plantel/Liga/Calendario/Notas/Plantel futuro). El header dice "Sin club actualmente" con punto gris.
  - Resumen: si la búsqueda por nombre en API-Football encuentra a Stillitano, se ven edad/nacionalidad/lugar de nacimiento y la trayectoria de clubes con fechas, más reciente primero. Si no lo encuentra, se ve el mensaje de "no encontramos el perfil" en vez de una pantalla en blanco o un error.
    - Si el resultado de la búsqueda trae a un entrenador distinto (nombre ambiguo), completar `coachApiId` en `src/constants/agencyCoaches.ts` con el id correcto de API-Football y volver a verificar.
  - Entrenamientos: se puede navegar semanas, cargar una sesión de entrenamiento y se guarda — igual que para Nicolás Domingo, sin errores en consola por la falta de equipo.
  - Pizarra: entra en blanco (sin prellenado de 11 propios, porque no hay plantel real), pero se pueden agregar fichas genéricas y dibujar sin problema.
  - Entrar a la ficha de Nicolás Domingo (`/entrenadores/domingo`) y confirmar que no cambió nada: sigue viendo las 7 pestañas de siempre con datos reales de Temperley (regresión).
