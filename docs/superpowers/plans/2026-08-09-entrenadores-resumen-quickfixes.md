# Entrenadores — Resumen: racha, 10 resultados, detalle de partido, rival y navegación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir el tab Resumen de la sección Entrenadores: racha de 10 partidos con color, lista de 10 resultados (no 5) con todas las competencias, partidos clickeables a una página de detalle nueva (alineaciones + goles/hechos + nota del DT), reemplazo del botón roto "Cargar informe del próximo rival" por un panel inline con plantel y racha del rival, y navegación que recuerda el tab activo al volver atrás.

**Architecture:** Todo vive dentro de `src/features/coaches/` (lógica compartida + componentes) y `src/pages/` (la página nueva de detalle de partido). Se extiende `footballApiService.ts` con dos funciones nuevas (`fetchFixtureLineups`, `fetchFixtureEvents`) cacheadas en `localStorage` igual que el resto del servicio. No hay cambios de base de datos ni de Supabase — todo sale de API-Football (ya integrada) y de `coach_match_notes` (ya existe).

**Tech Stack:** React 18 + TypeScript, React Router (rutas + `useSearchParams`), Tailwind CSS, Vitest (`environment: 'node'`, solo `.test.ts` — sin tests de render de componentes, no hay React Testing Library en el proyecto).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-09-entrenadores-resumen-quickfixes-design.md`.
- Sin gráfico de momentum, sin análisis táctico completo del rival, sin formación con coordenadas exactas — no hay dato disponible en API-Football para esta liga (verificado en vivo antes de este plan).
- Los tests son solo de lógica pura (`.test.ts`), nunca de render de componentes.
- Seguir el estilo visual y las clases Tailwind ya usadas en `CoachSummaryTab.tsx` (`apple-gray-*`, `brand-green`, `rounded-apple-lg`, `text-2xs`, etc.) — no introducir un sistema de diseño nuevo.
- Cachear en `localStorage` con el mismo patrón que ya usa `footballApiService.ts` (`getCachedGeneric`/`setCacheGeneric`).

---

## Task 1: Extraer `matchResult.ts` compartido (outcome + racha)

**Files:**
- Create: `src/features/coaches/matchResult.ts`
- Create: `src/features/coaches/matchResult.test.ts`
- Modify: `src/features/coaches/components/CoachSummaryTab.tsx` (elimina `RESULT_STYLES`/`matchOutcome` locales, importa del módulo nuevo)

**Interfaces:**
- Produces: `MatchResult = 'G' | 'E' | 'P'`, `RESULT_STYLES: Record<MatchResult, string>`, `matchOutcome(f: AgencyFixture): { result: MatchResult | null; scoreLabel: string }`, `buildStreak(fixtures: AgencyFixture[], size?: number): { fixtureId: number; result: MatchResult | null }[]`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/matchResult.test.ts
import { describe, it, expect } from 'vitest'
import { matchOutcome, buildStreak } from './matchResult'
import type { AgencyFixture } from '@/types/footballApi'

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-15T18:00:00+00:00', timestamp: 0,
    venue: 'Estadio', city: 'Temperley', status: 'Match Finished', statusShort: 'FT', elapsed: null,
    leagueName: 'Primera Nacional', leagueLogo: '', leagueCountry: 'Argentina', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1, name: 'Rival', logo: '' },
    goalsHome: null, goalsAway: null, isHome: true, players: [], ...over,
  }
}

describe('matchOutcome', () => {
  it('gana de local', () => {
    const f = mkFixture({ isHome: true, goalsHome: 2, goalsAway: 1 })
    expect(matchOutcome(f)).toEqual({ result: 'G', scoreLabel: '2 - 1' })
  })

  it('pierde de visitante', () => {
    const f = mkFixture({ isHome: false, goalsHome: 3, goalsAway: 1 })
    expect(matchOutcome(f)).toEqual({ result: 'P', scoreLabel: '1 - 3' })
  })

  it('empata', () => {
    const f = mkFixture({ isHome: true, goalsHome: 1, goalsAway: 1 })
    expect(matchOutcome(f)).toEqual({ result: 'E', scoreLabel: '1 - 1' })
  })

  it('partido sin jugar todavia da result null', () => {
    const f = mkFixture({ goalsHome: null, goalsAway: null })
    expect(matchOutcome(f)).toEqual({ result: null, scoreLabel: '-' })
  })
})

describe('buildStreak', () => {
  it('ordena de mas viejo a mas nuevo y corta en el tamano pedido', () => {
    const fixtures = [
      mkFixture({ fixtureId: 3, timestamp: 300, statusShort: 'FT', isHome: true, goalsHome: 1, goalsAway: 0 }),
      mkFixture({ fixtureId: 1, timestamp: 100, statusShort: 'FT', isHome: true, goalsHome: 0, goalsAway: 1 }),
      mkFixture({ fixtureId: 2, timestamp: 200, statusShort: 'FT', isHome: true, goalsHome: 1, goalsAway: 1 }),
    ]
    const streak = buildStreak(fixtures, 2)
    expect(streak.map(s => s.fixtureId)).toEqual([2, 3])
  })

  it('ignora partidos no finalizados', () => {
    const fixtures = [
      mkFixture({ fixtureId: 1, timestamp: 100, statusShort: 'FT', goalsHome: 1, goalsAway: 0 }),
      mkFixture({ fixtureId: 2, timestamp: 200, statusShort: 'NS', goalsHome: null, goalsAway: null }),
    ]
    const streak = buildStreak(fixtures, 10)
    expect(streak.map(s => s.fixtureId)).toEqual([1])
  })

  it('devuelve racha parcial si hay menos partidos que el tamano pedido', () => {
    const fixtures = [mkFixture({ fixtureId: 1, timestamp: 100, statusShort: 'FT', goalsHome: 1, goalsAway: 0 })]
    const streak = buildStreak(fixtures, 10)
    expect(streak).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/matchResult.test.ts`
Expected: FAIL — `./matchResult` no existe todavía.

- [ ] **Step 3: Implementar `matchResult.ts`**

```ts
// src/features/coaches/matchResult.ts
import type { AgencyFixture } from '@/types/footballApi'
import { isMatchFinished } from '@/utils/coachCalendar'

export type MatchResult = 'G' | 'E' | 'P'

export const RESULT_STYLES: Record<MatchResult, string> = {
  G: 'bg-brand-green/15 text-brand-green',
  E: 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400',
  P: 'bg-brand-red/10 text-brand-red',
}

export function matchOutcome(f: AgencyFixture): { result: MatchResult | null; scoreLabel: string } {
  const teamGoals = f.isHome ? f.goalsHome : f.goalsAway
  const oppGoals = f.isHome ? f.goalsAway : f.goalsHome
  if (teamGoals === null || oppGoals === null) return { result: null, scoreLabel: '-' }
  const result: MatchResult = teamGoals > oppGoals ? 'G' : teamGoals < oppGoals ? 'P' : 'E'
  return { result, scoreLabel: `${teamGoals} - ${oppGoals}` }
}

export function buildStreak(
  fixtures: AgencyFixture[],
  size = 10,
): { fixtureId: number; result: MatchResult | null }[] {
  return [...fixtures]
    .filter(f => isMatchFinished(f.statusShort))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-size)
    .map(f => ({ fixtureId: f.fixtureId, result: matchOutcome(f).result }))
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/matchResult.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Actualizar `CoachSummaryTab.tsx` para usar el módulo compartido**

Reemplazar en `src/features/coaches/components/CoachSummaryTab.tsx`:
- Borrar las líneas 9-23 (`type MatchResult`, `RESULT_STYLES`, `matchOutcome`) — se importan en vez de redefinirse.
- Agregar al inicio del archivo: `import { matchOutcome, RESULT_STYLES } from '../matchResult'`

- [ ] **Step 6: Correr el typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a este archivo.

- [ ] **Step 7: Commit**

```bash
git add src/features/coaches/matchResult.ts src/features/coaches/matchResult.test.ts src/features/coaches/components/CoachSummaryTab.tsx
git commit -m "refactor(entrenadores): extrae matchOutcome y agrega buildStreak a un modulo compartido"
```

---

## Task 2: `CoachStreakStrip` — tira de racha con color

**Files:**
- Create: `src/features/coaches/components/CoachStreakStrip.tsx`

**Interfaces:**
- Consumes: `buildStreak`, `RESULT_STYLES` de `../matchResult` (Task 1).
- Produces: `CoachStreakStrip({ fixtures }: { fixtures: AgencyFixture[] })` — componente default export, sin estado propio, no renderiza nada si no hay partidos finalizados.

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/CoachStreakStrip.tsx
import { buildStreak, RESULT_STYLES } from '../matchResult'
import type { AgencyFixture } from '@/types/footballApi'

export default function CoachStreakStrip({ fixtures }: { fixtures: AgencyFixture[] }) {
  const streak = buildStreak(fixtures)
  if (streak.length === 0) return null

  return (
    <div className="flex items-center gap-1" aria-label="Racha de los últimos partidos, de más viejo a más nuevo">
      {streak.map(s => (
        <span
          key={s.fixtureId}
          className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
            s.result ? RESULT_STYLES[s.result] : RESULT_STYLES.E
          }`}
        >
          {s.result ?? '–'}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/CoachStreakStrip.tsx
git commit -m "feat(entrenadores): agrega CoachStreakStrip, tira de racha con color"
```

---

## Task 3: Resumen — 10 resultados + racha integrada + filas clickeables

**Files:**
- Modify: `src/features/coaches/components/CoachSummaryTab.tsx`

**Interfaces:**
- Consumes: `CoachStreakStrip` (Task 2), `matchOutcome`/`RESULT_STYLES` (Task 1, ya importados en Task 1).
- Produces: cada fila de resultado navega a `/entrenadores/${coach.key}/partido/${fixtureId}` (ruta que crea la Task 6).

- [ ] **Step 1: Cambiar de 5 a 10 resultados y agregar la racha**

En `CoachSummaryTab.tsx`, reemplazar:

```tsx
  const lastFive = [...sorted]
    .filter(f => isMatchFinished(f.statusShort))
    .reverse()
    .slice(0, 5)
```

por:

```tsx
  const lastTen = [...sorted]
    .filter(f => isMatchFinished(f.statusShort))
    .reverse()
    .slice(0, 10)
```

Y agregar el import: `import CoachStreakStrip from './CoachStreakStrip'` junto a los demás imports del archivo.

- [ ] **Step 2: Renderizar la racha arriba de la lista y renombrar el título**

Reemplazar el bloque:

```tsx
      <div>
        <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-3">
          Últimos 5 resultados
        </p>
        {lastFive.length === 0 ? (
```

por:

```tsx
      <div>
        <div className="mb-3">
          <CoachStreakStrip fixtures={sorted} />
        </div>
        <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-3">
          Últimos 10 resultados
        </p>
        {lastTen.length === 0 ? (
```

Y reemplazar los dos usos restantes de `lastFive` en ese bloque (`.map(f => ...)` y el chequeo de longitud) por `lastTen`.

- [ ] **Step 3: Hacer cada fila clickeable**

Reemplazar el `<div key={f.fixtureId} className="flex items-center gap-3 ...">` de cada resultado (el que envuelve escudo/nombre/marcador) por un `<Link to={...}>` con las mismas clases más `hover:border-brand-green/30 transition-colors`:

```tsx
                <Link
                  key={f.fixtureId}
                  to={`/entrenadores/${coach.key}/partido/${f.fixtureId}`}
                  className="flex items-center gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 hover:border-brand-green/30 transition-colors px-3 sm:px-4 py-3"
                >
```

(cerrar con `</Link>` en vez de `</div>` al final de ese bloque). `Link` ya está importado en el archivo (se usa en el botón de "Cargar informe").

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores (la ruta `/entrenadores/:coachKey/partido/:fixtureId` todavía no existe pero eso no rompe el build, solo el link no navega hasta la Task 6).

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/CoachSummaryTab.tsx
git commit -m "feat(entrenadores): resumen muestra 10 resultados con racha y filas clickeables"
```

---

## Task 4: `fetchFixtureLineups` / `fetchFixtureEvents` en `footballApiService.ts`

**Files:**
- Modify: `src/types/footballApi.ts` (agrega `ApiFixtureLineupPlayer`, `ApiFixtureLineup`, `ApiFixtureEvent`)
- Modify: `src/services/footballApiService.ts` (agrega las dos funciones nuevas)

**Interfaces:**
- Produces: `fetchFixtureLineups(fixtureId: number): Promise<ApiFixtureLineup[]>`, `fetchFixtureEvents(fixtureId: number): Promise<ApiFixtureEvent[]>`.

- [ ] **Step 1: Agregar los tipos**

Agregar al final de `src/types/footballApi.ts`:

```ts
export interface ApiFixtureLineupPlayer {
  player: {
    id: number
    name: string
    number: number | null
    pos: string | null
    grid: string | null
  }
}

export interface ApiFixtureLineup {
  team: { id: number; name: string; logo: string }
  coach: { id: number; name: string; photo: string | null } | null
  formation: string | null
  startXI: ApiFixtureLineupPlayer[]
  substitutes: ApiFixtureLineupPlayer[]
}

export interface ApiFixtureEvent {
  time: { elapsed: number; extra: number | null }
  team: { id: number; name: string; logo: string }
  player: { id: number | null; name: string | null }
  assist: { id: number | null; name: string | null }
  type: string
  detail: string
  comments: string | null
}
```

- [ ] **Step 2: Agregar el import de los tipos nuevos en `footballApiService.ts`**

Cambiar la línea 1 de:

```ts
import type { ApiResponse, ApiFixture, AgencyFixture } from '@/types/footballApi'
```

a:

```ts
import type { ApiResponse, ApiFixture, AgencyFixture, ApiFixtureLineup, ApiFixtureEvent } from '@/types/footballApi'
```

- [ ] **Step 3: Implementar las dos funciones**

Agregar al final de `footballApiService.ts`:

```ts
const FIXTURE_DETAIL_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // partido ya jugado no cambia: cache largo

export async function fetchFixtureLineups(fixtureId: number): Promise<ApiFixtureLineup[]> {
  const cacheKey = `dg-fixture-lineups-cache:${fixtureId}`
  const cached = getCachedGeneric<ApiFixtureLineup[]>(cacheKey, FIXTURE_DETAIL_CACHE_TTL)
  if (cached) return cached
  const res = await apiFetch<ApiFixtureLineup[]>('/fixtures/lineups', { fixture: String(fixtureId) }).catch(() => null)
  const lineups = res?.response ?? []
  if (lineups.length > 0) setCacheGeneric(cacheKey, lineups)
  return lineups
}

export async function fetchFixtureEvents(fixtureId: number): Promise<ApiFixtureEvent[]> {
  const cacheKey = `dg-fixture-events-cache:${fixtureId}`
  const cached = getCachedGeneric<ApiFixtureEvent[]>(cacheKey, FIXTURE_DETAIL_CACHE_TTL)
  if (cached) return cached
  const res = await apiFetch<ApiFixtureEvent[]>('/fixtures/events', { fixture: String(fixtureId) }).catch(() => null)
  const events = res?.response ?? []
  if (events.length > 0) setCacheGeneric(cacheKey, events)
  return events
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/types/footballApi.ts src/services/footballApiService.ts
git commit -m "feat(entrenadores): agrega fetchFixtureLineups y fetchFixtureEvents"
```

---

## Task 5: `groupLineupByPosition` — agrupar alineación cruzando con el plantel

**Files:**
- Create: `src/features/coaches/lineupGrouping.ts`
- Create: `src/features/coaches/lineupGrouping.test.ts`

**Interfaces:**
- Consumes: `ApiFixtureLineupPlayer` (Task 4), `SquadPlayer` (ya existe en `footballApiService.ts`, tiene `{ id, name, age, number, position, photo }`).
- Produces: `LineupPositionGroup = 'Arqueros' | 'Defensores' | 'Mediocampistas' | 'Delanteros' | 'Otros'`, `LINEUP_GROUP_ORDER: LineupPositionGroup[]`, `GroupedLineupPlayer { id, name, number }`, `groupLineupByPosition(players, squad): Record<LineupPositionGroup, GroupedLineupPlayer[]>`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/lineupGrouping.test.ts
import { describe, it, expect } from 'vitest'
import { groupLineupByPosition } from './lineupGrouping'
import type { ApiFixtureLineupPlayer } from '@/types/footballApi'
import type { SquadPlayer } from '@/services/footballApiService'

function mkLineupPlayer(id: number, name: string, number: number | null = null): ApiFixtureLineupPlayer {
  return { player: { id, name, number, pos: null, grid: null } }
}

function mkSquadPlayer(id: number, position: string | null): SquadPlayer {
  return { id, name: '', age: null, number: null, position, photo: null }
}

describe('groupLineupByPosition', () => {
  it('agrupa jugadores segun la posicion del plantel', () => {
    const players = [mkLineupPlayer(1, 'Arquero'), mkLineupPlayer(2, 'Defensor')]
    const squad = [mkSquadPlayer(1, 'Goalkeeper'), mkSquadPlayer(2, 'Defender')]
    const grouped = groupLineupByPosition(players, squad)
    expect(grouped.Arqueros).toHaveLength(1)
    expect(grouped.Defensores).toHaveLength(1)
    expect(grouped.Mediocampistas).toHaveLength(0)
  })

  it('jugador sin match en el plantel cae en Otros', () => {
    const players = [mkLineupPlayer(99, 'Desconocido')]
    const grouped = groupLineupByPosition(players, [])
    expect(grouped.Otros).toHaveLength(1)
    expect(grouped.Otros[0].name).toBe('Desconocido')
  })

  it('jugador del plantel con position null cae en Otros', () => {
    const players = [mkLineupPlayer(1, 'Sin Posicion')]
    const squad = [mkSquadPlayer(1, null)]
    const grouped = groupLineupByPosition(players, squad)
    expect(grouped.Otros).toHaveLength(1)
  })

  it('conserva el numero de camiseta', () => {
    const players = [mkLineupPlayer(1, 'Con Numero', 7)]
    const squad = [mkSquadPlayer(1, 'Attacker')]
    const grouped = groupLineupByPosition(players, squad)
    expect(grouped.Delanteros[0].number).toBe(7)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/lineupGrouping.test.ts`
Expected: FAIL — `./lineupGrouping` no existe.

- [ ] **Step 3: Implementar**

```ts
// src/features/coaches/lineupGrouping.ts
import type { ApiFixtureLineupPlayer } from '@/types/footballApi'
import type { SquadPlayer } from '@/services/footballApiService'

export type LineupPositionGroup = 'Arqueros' | 'Defensores' | 'Mediocampistas' | 'Delanteros' | 'Otros'

export const LINEUP_GROUP_ORDER: LineupPositionGroup[] = [
  'Arqueros', 'Defensores', 'Mediocampistas', 'Delanteros', 'Otros',
]

const API_POSITION_TO_GROUP: Record<string, LineupPositionGroup> = {
  Goalkeeper: 'Arqueros',
  Defender: 'Defensores',
  Midfielder: 'Mediocampistas',
  Attacker: 'Delanteros',
}

export interface GroupedLineupPlayer {
  id: number
  name: string
  number: number | null
}

export function groupLineupByPosition(
  players: ApiFixtureLineupPlayer[],
  squad: SquadPlayer[],
): Record<LineupPositionGroup, GroupedLineupPlayer[]> {
  const squadById = new Map(squad.map(s => [s.id, s]))
  const groups: Record<LineupPositionGroup, GroupedLineupPlayer[]> = {
    Arqueros: [], Defensores: [], Mediocampistas: [], Delanteros: [], Otros: [],
  }
  for (const { player } of players) {
    const squadPlayer = squadById.get(player.id)
    const group = (squadPlayer?.position && API_POSITION_TO_GROUP[squadPlayer.position]) || 'Otros'
    groups[group].push({ id: player.id, name: player.name, number: player.number })
  }
  return groups
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/lineupGrouping.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/lineupGrouping.ts src/features/coaches/lineupGrouping.test.ts
git commit -m "feat(entrenadores): agrupa alineacion por posicion cruzando con el plantel"
```

---

## Task 6: `CoachMatchDetailPage` — página de detalle de partido

**Files:**
- Create: `src/pages/CoachMatchDetailPage.tsx`
- Modify: `src/App.tsx` (import lazy + ruta nueva)

**Interfaces:**
- Consumes: `getCoachByKey` (`@/constants/agencyCoaches`), `fetchTeamFixtures`/`fetchFixtureLineups`/`fetchFixtureEvents`/`fetchSquadCached` (Task 4 + ya existentes en `footballApiService.ts`), `getMatchNote` (`@/services/coachService`, ya existe), `matchOutcome` (Task 1), `groupLineupByPosition`/`LINEUP_GROUP_ORDER` (Task 5).
- Produces: página en la ruta `/entrenadores/:coachKey/partido/:fixtureId`.

- [ ] **Step 1: Implementar la página**

```tsx
// src/pages/CoachMatchDetailPage.tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCoachByKey } from '@/constants/agencyCoaches'
import {
  fetchTeamFixtures,
  fetchFixtureLineups,
  fetchFixtureEvents,
  fetchSquadCached,
  type SquadPlayer,
} from '@/services/footballApiService'
import { getMatchNote } from '@/services/coachService'
import { groupLineupByPosition, LINEUP_GROUP_ORDER } from '@/features/coaches/lineupGrouping'
import { matchOutcome } from '@/features/coaches/matchResult'
import type { AgencyFixture, ApiFixtureLineup, ApiFixtureEvent } from '@/types/footballApi'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

const EVENT_ICON: Record<string, string> = {
  Goal: '⚽',
  subst: '🔁',
}

function eventIcon(e: ApiFixtureEvent): string {
  if (e.detail === 'Yellow Card') return '🟨'
  if (e.detail === 'Red Card') return '🟥'
  return EVENT_ICON[e.type] ?? ''
}

function LineupGroupList({ grouped }: { grouped: ReturnType<typeof groupLineupByPosition> }) {
  return (
    <div className="space-y-2">
      {LINEUP_GROUP_ORDER.filter(g => grouped[g].length > 0).map(group => (
        <div key={group}>
          <p className="text-[10px] font-bold text-apple-gray-300 dark:text-apple-gray-600 uppercase tracking-wide">
            {group}
          </p>
          <p className="text-xs text-apple-gray-700 dark:text-apple-gray-300 leading-relaxed">
            {grouped[group].map(p => (p.number ? `#${p.number} ${p.name}` : p.name)).join(' · ')}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function CoachMatchDetailPage() {
  const { coachKey, fixtureId } = useParams<{ coachKey: string; fixtureId: string }>()
  const coach = coachKey ? getCoachByKey(coachKey) : undefined
  const [fixture, setFixture] = useState<AgencyFixture | null | undefined>(undefined)
  const [lineups, setLineups] = useState<ApiFixtureLineup[] | null>(null)
  const [events, setEvents] = useState<ApiFixtureEvent[] | null>(null)
  const [squads, setSquads] = useState<Record<number, SquadPlayer[]>>({})
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!coach?.apiTeamId || !fixtureId) return
    let active = true
    fetchTeamFixtures(coach.apiTeamId).then(fixtures => {
      if (active) setFixture(fixtures.find(f => f.fixtureId === Number(fixtureId)) ?? null)
    })
    fetchFixtureLineups(Number(fixtureId)).then(l => { if (active) setLineups(l) })
    fetchFixtureEvents(Number(fixtureId)).then(e => { if (active) setEvents(e) })
    getMatchNote(coach.key, Number(fixtureId)).then(n => { if (active) setNote(n) })
    return () => { active = false }
  }, [coach, fixtureId])

  useEffect(() => {
    if (!lineups || lineups.length === 0) return
    let active = true
    Promise.all(lineups.map(l => fetchSquadCached(l.team.id).then(squad => [l.team.id, squad] as const))).then(
      pairs => {
        if (active) setSquads(Object.fromEntries(pairs))
      },
    )
    return () => { active = false }
  }, [lineups])

  if (!coach || !fixtureId) {
    return <EmptyState message="No pudimos encontrar este partido." />
  }

  if (fixture === undefined) return <LoadingSpinner message="Cargando partido..." />
  if (fixture === null) return <EmptyState message="No pudimos encontrar este partido." />

  const { scoreLabel } = matchOutcome(fixture)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <Link
        to={`/entrenadores/${coach.key}?tab=resumen`}
        className="inline-flex items-center gap-2 text-sm text-apple-gray-500 dark:text-apple-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a {coach.fullName}
      </Link>

      <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 shadow-apple dark:shadow-apple-dark p-5 sm:p-6 mb-6">
        <p className="text-2xs sm:text-xs font-medium text-apple-gray-400 text-center mb-3">
          {fixture.leagueName} ·{' '}
          {new Date(fixture.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center gap-2 min-w-0">
            <img src={fixture.homeTeam.logo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
            <span className="text-xs sm:text-sm font-semibold text-apple-gray-800 dark:text-white text-center truncate w-full">
              {fixture.homeTeam.name}
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-bold text-apple-gray-800 dark:text-white flex-shrink-0">
            {scoreLabel}
          </span>
          <div className="flex flex-col items-center gap-2 min-w-0">
            <img src={fixture.awayTeam.logo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
            <span className="text-xs sm:text-sm font-semibold text-apple-gray-800 dark:text-white text-center truncate w-full">
              {fixture.awayTeam.name}
            </span>
          </div>
        </div>
        {fixture.venue && <p className="text-2xs text-apple-gray-400 text-center mt-3">{fixture.venue}</p>}
      </div>

      {note && (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide">Nota del DT</p>
            <Link
              to={`/entrenadores/${coach.key}?tab=notas`}
              className="text-2xs font-semibold text-brand-green hover:underline"
            >
              Editar en Notas de partidos
            </Link>
          </div>
          <p className="text-sm text-apple-gray-700 dark:text-apple-gray-300 whitespace-pre-wrap">{note}</p>
        </div>
      )}

      <div className="mb-6">
        <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-3">Goles y hechos</p>
        {events === null ? (
          <LoadingSpinner message="Cargando hechos..." />
        ) : events.length === 0 ? (
          <EmptyState message="No hay eventos registrados para este partido." />
        ) : (
          <div className="space-y-2">
            {[...events]
              .sort((a, b) => a.time.elapsed - b.time.elapsed)
              .map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-3 sm:px-4 py-2.5"
                >
                  <span className="text-2xs font-bold text-apple-gray-400 w-8 flex-shrink-0">{e.time.elapsed}'</span>
                  <img src={e.team.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate">
                      {eventIcon(e)} {e.player.name ?? e.detail}
                    </p>
                    {e.assist.name && <p className="text-2xs text-apple-gray-400">Asistencia: {e.assist.name}</p>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-3">Alineaciones</p>
        {lineups === null ? (
          <LoadingSpinner message="Cargando alineaciones..." />
        ) : lineups.length === 0 ? (
          <EmptyState message="No hay alineaciones disponibles para este partido." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lineups.map(lineup => {
              const squad = squads[lineup.team.id] ?? []
              const startersGrouped = groupLineupByPosition(lineup.startXI, squad)
              const subsGrouped = groupLineupByPosition(lineup.substitutes, squad)
              return (
                <div
                  key={lineup.team.id}
                  className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <img src={lineup.team.logo} alt="" className="w-6 h-6 object-contain" />
                    <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">
                      {lineup.team.name}
                    </span>
                  </div>
                  {lineup.coach?.name && <p className="text-2xs text-apple-gray-400 mb-3">DT: {lineup.coach.name}</p>}
                  <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-1.5">
                    Titulares
                  </p>
                  <LineupGroupList grouped={startersGrouped} />
                  <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mt-3 mb-1.5">
                    Suplentes
                  </p>
                  <LineupGroupList grouped={subsGrouped} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que `fetchSquadCached` y `SquadPlayer` estén exportados**

`SquadPlayer` ya es `export interface` en `footballApiService.ts:332` y `fetchSquadCached` ya es `export async function` en la línea 341 — no requiere cambios ahí, solo confirmar con:

Run: `grep -n "^export interface SquadPlayer\|^export async function fetchSquadCached" src/services/footballApiService.ts`
Expected: dos líneas de match.

- [ ] **Step 3: Agregar la ruta en `App.tsx`**

Agregar el import lazy junto a los otros de `entrenadores` (después de la línea de `CoachDetailPage`):

```ts
const CoachMatchDetailPage = lazy(() => import('@/pages/CoachMatchDetailPage'))
```

Agregar la ruta junto a las otras de `/entrenadores`:

```tsx
<Route path="/entrenadores/:coachKey/partido/:fixtureId" element={<CoachMatchDetailPage />} />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build exitoso, sin warnings de import roto.

- [ ] **Step 6: Commit**

```bash
git add src/pages/CoachMatchDetailPage.tsx src/App.tsx
git commit -m "feat(entrenadores): pagina de detalle de partido con alineaciones, hechos y nota del DT"
```

---

## Task 7: `CoachRivalPanel` — reemplaza el botón roto por un panel inline

**Files:**
- Create: `src/features/coaches/components/CoachRivalPanel.tsx`
- Modify: `src/features/coaches/components/CoachSummaryTab.tsx`

**Interfaces:**
- Consumes: `CoachStreakStrip` (Task 2), `TeamRosterPanel` (ya existe en `src/features/coaches/components/TeamRosterPanel.tsx`, prop `{ teamId: number }`), `fetchTeamFixtures` (ya existe).
- Produces: `CoachRivalPanel({ teamId }: { teamId: number })`.

- [ ] **Step 1: Implementar el panel**

```tsx
// src/features/coaches/components/CoachRivalPanel.tsx
import { useEffect, useState } from 'react'
import TeamRosterPanel from './TeamRosterPanel'
import CoachStreakStrip from './CoachStreakStrip'
import { fetchTeamFixtures } from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'

export default function CoachRivalPanel({ teamId }: { teamId: number }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)

  useEffect(() => {
    let active = true
    fetchTeamFixtures(teamId).then(f => {
      if (active) setFixtures(f)
    })
    return () => {
      active = false
    }
  }, [teamId])

  return (
    <div className="mt-4 pt-4 border-t border-apple-gray-200/60 dark:border-apple-gray-700/40">
      <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">Racha reciente</p>
      {fixtures && <CoachStreakStrip fixtures={fixtures} />}
      <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mt-4 mb-2">Plantel</p>
      <TeamRosterPanel teamId={teamId} />
    </div>
  )
}
```

- [ ] **Step 2: Reemplazar el botón "Cargar informe del próximo rival" en `CoachSummaryTab.tsx`**

Agregar `useState` al import de React ya existente (`import { useEffect, useState } from 'react'` — `useState` puede ya estar si Task 1-3 no lo tocaron; si falta, agregarlo) y el import `import CoachRivalPanel from './CoachRivalPanel'`.

Dentro del componente, junto a la declaración de `fixtures`, agregar:

```tsx
  const [showRival, setShowRival] = useState(false)
```

Reemplazar el bloque:

```tsx
          <div className="flex justify-center mt-4">
            <Link
              to="/scouting"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-sm font-semibold transition-transform duration-200 ease-apple hover:-translate-y-0.5"
            >
              Cargar informe del próximo rival
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
```

por:

```tsx
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowRival(v => !v)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-sm font-semibold transition-transform duration-200 ease-apple hover:-translate-y-0.5"
            >
              {showRival ? 'Ocultar rival' : 'Ver rival'}
              <svg
                className={`w-4 h-4 transition-transform ${showRival ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {showRival && <CoachRivalPanel teamId={next.isHome ? next.awayTeam.id : next.homeTeam.id} />}
```

(El `Link` a `/scouting` deja de usarse en este bloque; si `Link` queda sin otros usos en el archivo, mantener el import igual porque las filas de resultados de la Task 3 ya lo usan.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/features/coaches/components/CoachRivalPanel.tsx src/features/coaches/components/CoachSummaryTab.tsx
git commit -m "feat(entrenadores): reemplaza boton roto por panel inline de plantel y racha del rival"
```

---

## Task 8: Navegación — recordar tab activo y scroll al volver

**Files:**
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Ninguna nueva expuesta a otros archivos — cambio interno de manejo de estado.

- [ ] **Step 1: Reemplazar `useState` por `useSearchParams` para `activeTab`**

Cambiar el import (línea 1-2) de:

```tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
```

a:

```tsx
import { useParams, Link, useSearchParams } from 'react-router-dom'
```

Reemplazar (línea 34):

```tsx
  const [activeTab, setActiveTab] = useState<CoachTab>('resumen')
```

por:

```tsx
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as CoachTab) || 'resumen'
  const setActiveTab = (tab: CoachTab) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    next.set('tab', tab)
    return next
  })
```

- [ ] **Step 2: Verificar que el botón de cada tab siga llamando a `setActiveTab(tab.id)`**

No requiere cambios — `onClick={() => setActiveTab(tab.id)}` (línea 135) ya usa la función, que ahora escribe en la URL en vez de estado local.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Probar a mano en el dev server**

Run: `npm run dev`, abrir `/entrenadores/domingo`, click en "Plantel", click en un jugador (va a `/jugador/:id`), click en "volver" del navegador.
Expected: vuelve a `/entrenadores/domingo?tab=plantel` con el tab Plantel activo, no Resumen.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CoachDetailPage.tsx
git commit -m "fix(entrenadores): el tab activo vive en la URL, volver atras ya no resetea a Resumen"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 11 nuevos de este plan (7 de `matchResult.test.ts` + 4 de `lineupGrouping.test.ts`).

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`):
  - Racha de hasta 10 cuadraditos con color arriba de "Últimos 10 resultados".
  - 10 filas de resultados, clickeables, llevan al detalle del partido.
  - Detalle de partido: marcador, alineaciones agrupadas por posición, goles/hechos con minuto, nota del DT si existe.
  - Botón "Ver rival" despliega plantel + racha del rival sin navegar a otra página.
  - Ir a Plantel, entrar a un jugador, volver: sigue en Plantel.
