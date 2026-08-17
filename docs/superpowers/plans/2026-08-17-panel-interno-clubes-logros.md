# Panel Interno: Clubes y Copas + Logros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two agency-wide sections to the end of Panel Interno (`src/pages/DashboardPage.tsx`): "Clubes y Copas" (pick a Doble G player's team, see its league table and cup progress) and "Logros" (trophy gallery + year-over-year evolution chart), matching the existing Apple-dark visual style.

**Architecture:** Two new self-contained dashboard components, each mounted once at the bottom of `DashboardPage.tsx`. Clubes y Copas resolves a team's competitions live from API-Football (`GET /leagues?team=`) using the `apiTeamId` already stored per player in `agencyPlayers.ts` — no new manual per-player league/cup curation. Logros reads from a new git-tracked constants file (`agencyAchievements.ts`, same pattern as `agencyPlayers.ts`), populated by hand over time; trophy images are pre-generated static PNGs already committed to `public/trophies/`. A shared `StandingsTable` component is extracted from the existing Entrenadores feature so both consumers render the same table.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, Recharts, Vitest (pure-function tests only — this codebase has no component-level test convention; components are verified manually in the browser).

**Spec:** `docs/superpowers/specs/2026-08-17-panel-interno-clubes-logros-design.md`

## Global Constraints

- No emojis anywhere in UI copy or code — professional, clean SVG line icons only (per user feedback during design).
- New sections go at the end of the existing `DashboardPage.tsx` scroll — no new tabs, no restructuring of the page into a tabbed layout.
- Reuse existing visual patterns exactly: `Section` card wrapper for compact blocks, the icon-square + heading pattern used by "Análisis de Ligas y Oportunidades" for full-width feature sections, `brand-green` for active/positive state, `apple-gray-*` scale for neutral text/borders.
- Achievements are entered by the agent (Claude) directly into `src/constants/agencyAchievements.ts` when the user reports a title by chat — no in-app admin form.
- Trophy images already exist at `public/trophies/{liga,copa,copa_liga,continental,otro}.png` (transparent background, dark chrome + emerald green render, 400x400). `copa_liga.png` is currently a copy of `copa.png` (placeholder) — replace it later when a distinct render is available; no task in this plan regenerates it.

---

### Task 1: Extract shared `StandingsTable` component

**Files:**
- Create: `src/components/shared/StandingsTable.tsx`
- Create: `src/components/shared/StandingsTable.test.ts`
- Modify: `src/features/coaches/components/CoachLeagueTab.tsx`

**Interfaces:**
- Consumes: `StandingRow` from `src/services/footballApiService.ts` (existing: `{ rank, teamId, teamName, teamLogo, points, goalsDiff, form, played, win, draw, lose, goalsFor, goalsAgainst, group }`).
- Produces: `export type SortKey = 'points' | 'goalsFor' | 'goalsAgainst'`, `export function sortStandingRows(rows: StandingRow[], sortKey: SortKey): StandingRow[]`, `export default function StandingsTable({ groups, highlightTeamId }: { groups: StandingRow[][]; highlightTeamId?: number | null })`. Task 3 (Clubes y Copas) renders `<StandingsTable groups={...} highlightTeamId={...} />`.

- [ ] **Step 1: Write the failing test for `sortStandingRows`**

Create `src/components/shared/StandingsTable.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mapStandingsResponse } from '@/services/footballApiService'
import { sortStandingRows } from './StandingsTable'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', 'services', '__fixtures__', 'primera-nacional-standings-2026-08-08.json'),
    'utf-8',
  ),
)

describe('sortStandingRows', () => {
  const zoneOne = mapStandingsResponse(fixture)[0]

  it('ordena por puntos descendente', () => {
    const sorted = sortStandingRows(zoneOne, 'points')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].points).toBeGreaterThanOrEqual(sorted[i].points)
    }
    expect(sorted[0].teamName).toBe('Ferro Carril Oeste')
  })

  it('ordena por goles a favor descendente', () => {
    const sorted = sortStandingRows(zoneOne, 'goalsFor')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].goalsFor).toBeGreaterThanOrEqual(sorted[i].goalsFor)
    }
  })

  it('ordena por goles en contra ascendente', () => {
    const sorted = sortStandingRows(zoneOne, 'goalsAgainst')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].goalsAgainst).toBeLessThanOrEqual(sorted[i].goalsAgainst)
    }
  })

  it('no muta el array original', () => {
    const original = [...zoneOne]
    sortStandingRows(zoneOne, 'points')
    expect(zoneOne).toEqual(original)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/StandingsTable.test.ts`
Expected: FAIL — `./StandingsTable` has no exported member `sortStandingRows` (file doesn't exist yet).

- [ ] **Step 3: Create `StandingsTable.tsx` with the extracted component**

Create `src/components/shared/StandingsTable.tsx` with this exact content (identical markup/logic to the table currently inline in `CoachLeagueTab.tsx`, parameterized by `groups`/`highlightTeamId` instead of a `coach` prop):

```tsx
import { useMemo, useState } from 'react'
import type { StandingRow } from '@/services/footballApiService'

export type SortKey = 'points' | 'goalsFor' | 'goalsAgainst'

const SORT_LABEL: Record<SortKey, string> = {
  points: 'Ordenar por puntos',
  goalsFor: 'Ordenar por goles a favor',
  goalsAgainst: 'Ordenar por goles en contra',
}

// Paleta alineada con Task 11 (RESULT_STYLES): verde = ganado, gris = empate, rojo = perdido.
const FORM_COLOR: Record<string, string> = {
  W: 'bg-brand-green text-apple-gray-900',
  D: 'bg-apple-gray-300 dark:bg-apple-gray-600 text-apple-gray-800 dark:text-white',
  L: 'bg-brand-red text-white',
}

/** La API de Primera Nacional devuelve `group` como "Group 1" / "Group 2" (sin
 *  traducir), así que el label mostrado se arma directamente por posición en el
 *  array: Zona A, Zona B, Zona C... */
function zoneLabel(index: number): string {
  return `Zona ${String.fromCharCode(65 + index)}`
}

export function sortStandingRows(rows: StandingRow[], sortKey: SortKey): StandingRow[] {
  const sorted = [...rows]
  if (sortKey === 'points') return sorted.sort((a, b) => b.points - a.points)
  if (sortKey === 'goalsFor') return sorted.sort((a, b) => b.goalsFor - a.goalsFor)
  return sorted.sort((a, b) => a.goalsAgainst - b.goalsAgainst)
}

export interface StandingsTableProps {
  groups: StandingRow[][]
  highlightTeamId?: number | null
}

export default function StandingsTable({ groups, highlightTeamId = null }: StandingsTableProps) {
  const [activeGroup, setActiveGroup] = useState(() => {
    if (highlightTeamId == null) return 0
    const idx = groups.findIndex(group => group.some(row => row.teamId === highlightTeamId))
    return idx >= 0 ? idx : 0
  })
  const [sortKey, setSortKey] = useState<SortKey>('points')

  const sortedRows = useMemo(() => {
    if (!groups[activeGroup]) return []
    return sortStandingRows(groups[activeGroup], sortKey)
  }, [groups, activeGroup, sortKey])

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {groups.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveGroup(i)}
              className={`min-h-[40px] px-3 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-apple ${
                i === activeGroup
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'
              }`}
            >
              {zoneLabel(i)}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="min-h-[40px] text-xs font-medium rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-2.5 py-2 text-apple-gray-700 dark:text-apple-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map(key => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-wide text-apple-gray-400 bg-apple-gray-50 dark:bg-apple-gray-800/50 border-b border-apple-gray-200 dark:border-apple-gray-700">
              <th className="py-2.5 pl-3 pr-2 font-semibold">#</th>
              <th className="py-2.5 pr-2 font-semibold">Equipo</th>
              <th className="py-2.5 px-1 text-center font-semibold">PJ</th>
              <th className="py-2.5 px-1 text-center font-semibold">PG</th>
              <th className="py-2.5 px-1 text-center font-semibold">PE</th>
              <th className="py-2.5 px-1 text-center font-semibold">PP</th>
              <th className="py-2.5 px-1 text-center font-semibold">GF</th>
              <th className="py-2.5 px-1 text-center font-semibold">GC</th>
              <th className="py-2.5 px-1 text-center font-semibold">DG</th>
              <th className="py-2.5 px-1 text-center font-semibold">Pts</th>
              <th className="py-2.5 pl-2 pr-3 font-semibold">Racha</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => {
              const isOwnTeam = row.teamId === highlightTeamId
              return (
                <tr
                  key={row.teamId}
                  className={`border-b border-apple-gray-100 dark:border-apple-gray-800 last:border-b-0 ${
                    isOwnTeam
                      ? 'bg-brand-green/10 font-semibold'
                      : 'hover:bg-apple-gray-50 dark:hover:bg-apple-gray-800/40'
                  }`}
                >
                  <td className="py-2.5 pl-3 pr-2 text-apple-gray-400">{row.rank}</td>
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2 min-w-[9rem]">
                      {isOwnTeam && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-green flex-shrink-0" aria-hidden="true" />
                      )}
                      <img src={row.teamLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                      <span className="text-apple-gray-800 dark:text-white truncate">{row.teamName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.played}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.win}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.draw}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.lose}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.goalsFor}</td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-600 dark:text-apple-gray-300">{row.goalsAgainst}</td>
                  <td
                    className={`py-2.5 px-1 text-center ${
                      row.goalsDiff > 0
                        ? 'text-brand-green'
                        : row.goalsDiff < 0
                          ? 'text-brand-red'
                          : 'text-apple-gray-500 dark:text-apple-gray-400'
                    }`}
                  >
                    {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                  </td>
                  <td className="py-2.5 px-1 text-center text-apple-gray-800 dark:text-white">{row.points}</td>
                  <td className="py-2.5 pl-2 pr-3">
                    <div className="flex gap-0.5">
                      {row.form
                        .split('')
                        .filter(Boolean)
                        .map((r, i) => (
                          <span
                            key={i}
                            className={`w-4 h-4 rounded-sm text-2xs font-bold flex items-center justify-center flex-shrink-0 ${FORM_COLOR[r] ?? 'bg-apple-gray-200 dark:bg-apple-gray-700 text-apple-gray-500'}`}
                          >
                            {r}
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shared/StandingsTable.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Update `CoachLeagueTab.tsx` to use the shared component**

Replace the full content of `src/features/coaches/components/CoachLeagueTab.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { fetchLeagueStandings, type StandingRow } from '@/services/footballApiService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StandingsTable from '@/components/shared/StandingsTable'

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

export default function CoachLeagueTab({ coach }: { coach: AgencyCoach }) {
  const [groups, setGroups] = useState<StandingRow[][] | null>(null)

  useEffect(() => {
    if (!coach.leagueApiId || !coach.leagueSeason) return
    let active = true
    fetchLeagueStandings(coach.leagueApiId, coach.leagueSeason)
      .then(g => {
        if (active) setGroups(g)
      })
      .catch(() => {
        if (active) setGroups([])
      })
    return () => {
      active = false
    }
  }, [coach.leagueApiId, coach.leagueSeason])

  if (!coach.leagueApiId || !coach.leagueSeason) {
    return <EmptyState message="No hay datos de liga disponibles para este entrenador todavía." />
  }

  if (groups === null) return <LoadingSpinner message="Cargando tabla de posiciones..." />
  if (groups.length === 0) return <EmptyState message="No se pudo cargar la tabla de posiciones." />

  return <StandingsTable groups={groups} highlightTeamId={coach.apiTeamId} />
}
```

This preserves existing behavior exactly: same loading/empty states, and the active zone still auto-selects to the coach's team (now computed inside `StandingsTable`'s lazy `useState` initializer instead of via `findIndex` in the fetch callback).

- [ ] **Step 6: Typecheck and run the full test suite**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: no type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/StandingsTable.tsx src/components/shared/StandingsTable.test.ts src/features/coaches/components/CoachLeagueTab.tsx
git commit -m "refactor(entrenadores): extrae StandingsTable a componente compartido"
```

---

### Task 2: Team competitions & fixtures API layer

**Files:**
- Create: `src/services/__fixtures__/bhayangkara-fc-leagues-2026-08-17.json`
- Modify: `src/services/footballApiService.ts`
- Modify: `src/services/footballApiService.test.ts`

**Interfaces:**
- Consumes: `apiFetch<T>`, `getCachedGeneric`, `setCacheGeneric`, `mapFixture`, `CACHE_TTL` (all existing, private to this file), `AgencyFixture`/`ApiFixture` types (existing).
- Produces: `export interface TeamCompetition { leagueId: number; leagueName: string; leagueLogo: string; type: 'League' | 'Cup'; season: number; hasStandings: boolean; country: string }`, `export function mapCompetitionsResponse(raw: any): TeamCompetition[]`, `export async function fetchTeamCompetitions(teamId: number, forceRefresh?: boolean): Promise<TeamCompetition[]>`, `export async function fetchTeamCompetitionFixtures(teamId: number, leagueId: number, season: number, forceRefresh?: boolean): Promise<AgencyFixture[]>`. Task 3 (Clubes y Copas component) imports all four.

- [ ] **Step 1: Add the real API-Football fixture**

Create `src/services/__fixtures__/bhayangkara-fc-leagues-2026-08-17.json` (real response from `GET /leagues?team=2443`, captured 2026-08-17 — used to verify Mauricio Vera's new club, Bhayangkara FC):

```json
{"get":"leagues","parameters":{"team":"2443"},"errors":[],"results":5,"paging":{"current":1,"total":1},"response":[{"league":{"id":274,"name":"Liga 1","type":"League","logo":"https://media.api-sports.io/football/leagues/274.png"},"country":{"name":"Indonesia","code":"ID","flag":"https://media.api-sports.io/flags/id.svg"},"seasons":[{"year":2025,"start":"2025-08-08","end":"2026-05-23","current":false,"coverage":{"fixtures":{"events":true,"lineups":true,"statistics_fixtures":false,"statistics_players":false},"standings":true,"players":true,"top_scorers":true,"top_assists":true,"top_cards":true,"injuries":true,"predictions":true,"odds":false}},{"year":2026,"start":"2026-09-04","end":"2027-06-05","current":true,"coverage":{"fixtures":{"events":false,"lineups":false,"statistics_fixtures":false,"statistics_players":false},"standings":true,"players":false,"top_scorers":false,"top_assists":false,"top_cards":false,"injuries":false,"predictions":true,"odds":false}}]},{"league":{"id":718,"name":"Piala Indonesia","type":"Cup","logo":"https://media.api-sports.io/football/leagues/718.png"},"country":{"name":"Indonesia","code":"ID","flag":"https://media.api-sports.io/flags/id.svg"},"seasons":[{"year":2018,"start":"2018-05-08","end":"2019-08-06","current":true,"coverage":{"fixtures":{"events":false,"lineups":false,"statistics_fixtures":false,"statistics_players":false},"standings":false,"players":true,"top_scorers":true,"top_assists":true,"top_cards":true,"injuries":false,"predictions":true,"odds":false}}]},{"league":{"id":924,"name":"Piala Presiden","type":"Cup","logo":"https://media.api-sports.io/football/leagues/924.png"},"country":{"name":"Indonesia","code":"ID","flag":"https://media.api-sports.io/flags/id.svg"},"seasons":[{"year":2022,"start":"2022-06-11","end":"2022-07-17","current":false,"coverage":{"fixtures":{"events":true,"lineups":false,"statistics_fixtures":false,"statistics_players":false},"standings":false,"players":true,"top_scorers":true,"top_assists":true,"top_cards":true,"injuries":false,"predictions":true,"odds":false}}]},{"league":{"id":275,"name":"Liga 2","type":"League","logo":"https://media.api-sports.io/football/leagues/275.png"},"country":{"name":"Indonesia","code":"ID","flag":"https://media.api-sports.io/flags/id.svg"},"seasons":[{"year":2024,"start":"2024-09-07","end":"2025-02-28","current":false,"coverage":{"fixtures":{"events":true,"lineups":false,"statistics_fixtures":false,"statistics_players":false},"standings":true,"players":true,"top_scorers":true,"top_assists":true,"top_cards":true,"injuries":false,"predictions":true,"odds":false}}]},{"league":{"id":667,"name":"Friendlies Clubs","type":"Cup","logo":"https://media.api-sports.io/football/leagues/667.png"},"country":{"name":"World","code":null,"flag":null},"seasons":[{"year":2026,"start":"2026-01-03","end":"2026-09-30","current":true,"coverage":{"fixtures":{"events":true,"lineups":true,"statistics_fixtures":false,"statistics_players":false},"standings":false,"players":false,"top_scorers":false,"top_assists":false,"top_cards":false,"injuries":false,"predictions":true,"odds":true}}]}]}
```

- [ ] **Step 2: Write the failing tests**

Append to `src/services/footballApiService.test.ts` (add the import at the top alongside the existing ones, and a new `describe` block at the end of the file):

Change the import line:

```ts
import { mapStandingsResponse, mapCoachProfileResponse, surnameOf, mapCompetitionsResponse } from './footballApiService'
```

Add near the other fixture reads at the top:

```ts
const competitionsFixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'bhayangkara-fc-leagues-2026-08-17.json'), 'utf-8'),
)
```

Add at the end of the file:

```ts
describe('mapCompetitionsResponse', () => {
  it('descarta competencias sin temporada vigente', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    expect(result.find(c => c.leagueId === 924)).toBeUndefined() // Piala Presiden, última temporada 2022, current: false
    expect(result.find(c => c.leagueId === 275)).toBeUndefined() // Liga 2, última temporada 2024, current: false
  })

  it('mapea la liga vigente con hasStandings true', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    const liga1 = result.find(c => c.leagueId === 274)
    expect(liga1).toMatchObject({
      leagueName: 'Liga 1',
      type: 'League',
      season: 2026,
      hasStandings: true,
      country: 'Indonesia',
    })
  })

  it('mapea copas vigentes con hasStandings false', () => {
    const result = mapCompetitionsResponse(competitionsFixture)
    const piala = result.find(c => c.leagueId === 718)
    expect(piala).toMatchObject({ leagueName: 'Piala Indonesia', type: 'Cup', hasStandings: false })
  })

  it('devuelve 3 competencias vigentes para Bhayangkara FC', () => {
    expect(mapCompetitionsResponse(competitionsFixture)).toHaveLength(3)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/services/footballApiService.test.ts`
Expected: FAIL — `mapCompetitionsResponse` is not exported.

- [ ] **Step 4: Implement in `footballApiService.ts`**

Add after `fetchLeagueStandings` (after the closing brace that currently ends the "STANDINGS" section, before the "FIXTURE DETAIL" comment block):

```ts
// ─── TEAM COMPETITIONS ──────────────────────────────────────────────────────

export interface TeamCompetition {
  leagueId: number
  leagueName: string
  leagueLogo: string
  type: 'League' | 'Cup'
  season: number
  hasStandings: boolean
  country: string
}

export function mapCompetitionsResponse(raw: any): TeamCompetition[] {
  const entries: any[] = raw?.response ?? []
  const result: TeamCompetition[] = []
  for (const entry of entries) {
    const season = (entry.seasons ?? []).find((s: any) => s.current)
    if (!season) continue
    result.push({
      leagueId: entry.league.id,
      leagueName: entry.league.name,
      leagueLogo: entry.league.logo,
      type: entry.league.type,
      season: season.year,
      hasStandings: !!season.coverage?.standings,
      country: entry.country?.name ?? '',
    })
  }
  return result
}

const TEAM_COMPETITIONS_CACHE_PREFIX = 'dg-team-competitions-cache'
const TEAM_COMPETITIONS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h: las competencias vigentes de un equipo no cambian de un día para el otro

export async function fetchTeamCompetitions(teamId: number, forceRefresh = false): Promise<TeamCompetition[]> {
  const cacheKey = `${TEAM_COMPETITIONS_CACHE_PREFIX}:${teamId}`
  if (!forceRefresh) {
    const cached = getCachedGeneric<TeamCompetition[]>(cacheKey, TEAM_COMPETITIONS_CACHE_TTL)
    if (cached) return cached
  }
  const raw = await apiFetch<any>('/leagues', { team: String(teamId) })
  const competitions = mapCompetitionsResponse(raw)
  setCacheGeneric(cacheKey, competitions)
  return competitions
}

const COMPETITION_FIXTURES_CACHE_PREFIX = 'dg-competition-fixtures-cache'

export async function fetchTeamCompetitionFixtures(
  teamId: number,
  leagueId: number,
  season: number,
  forceRefresh = false,
): Promise<AgencyFixture[]> {
  const cacheKey = `${COMPETITION_FIXTURES_CACHE_PREFIX}:${teamId}:${leagueId}:${season}`
  if (!forceRefresh) {
    const cached = getCachedGeneric<AgencyFixture[]>(cacheKey, CACHE_TTL)
    if (cached) return cached
  }
  const res = await apiFetch<ApiFixture[]>('/fixtures', {
    team: String(teamId),
    league: String(leagueId),
    season: String(season),
  }).catch(() => null)
  const fixtures = (res?.response ?? []).map(f => mapFixture(f, teamId))
  if (fixtures.length > 0) setCacheGeneric(cacheKey, fixtures)
  return fixtures
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/footballApiService.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/services/footballApiService.ts src/services/footballApiService.test.ts src/services/__fixtures__/bhayangkara-fc-leagues-2026-08-17.json
git commit -m "feat(api-football): resuelve ligas y copas vigentes de un equipo via /leagues"
```

---

### Task 3: `ClubsAndCupsSection` component + wire into Panel Interno

**Files:**
- Create: `src/components/dashboard/Section.tsx`
- Create: `src/components/dashboard/ClubsAndCupsSection.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `getUniqueTeamIds`, `getPlayersByTeamId` (existing, from `@/constants/agencyPlayers`), `fetchTeamCompetitions`, `fetchTeamCompetitionFixtures`, `fetchLeagueStandings`, `TeamCompetition`, `StandingRow`, `AgencyFixture` (from Task 2 / existing), `StandingsTable` (from Task 1), `LoadingSpinner` (existing).
- Produces: `export default function Section({ title, children, action }: SectionProps)` (moved from `DashboardPage.tsx`, same props as before), `export default function ClubsAndCupsSection()` — no props, self-contained, mounted once in `DashboardPage.tsx`.

- [ ] **Step 1: Extract `Section` into its own file**

Create `src/components/dashboard/Section.tsx`:

```tsx
interface SectionProps {
  title: string
  children: React.ReactNode
  action?: { label: string; onClick: () => void }
}

export default function Section({ title, children, action }: SectionProps) {
  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-apple-gray-100 dark:border-apple-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-apple-gray-800 dark:text-white">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-medium text-brand-green hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
```

In `src/pages/DashboardPage.tsx`:

1. Remove the local `SectionProps` interface and `Section` function (currently lines 102-127 — the block starting `interface SectionProps {` and ending with the closing `}` of the `Section` function, immediately before `function ProgressBar`).
2. Add an import near the top, after the `LoadingSpinner` import: `import Section from '@/components/dashboard/Section'`.

No other change — every existing `<Section ...>` usage in the file keeps working unchanged since the import now resolves to the same component.

- [ ] **Step 2: Typecheck to confirm the extraction didn't break anything**

Run: `npx tsc --noEmit -p .`
Expected: no errors. `DashboardPage.tsx` must not still declare `Section` locally (duplicate identifier) and must not have any remaining unresolved `Section` reference.

- [ ] **Step 3: Commit the extraction**

```bash
git add src/components/dashboard/Section.tsx src/pages/DashboardPage.tsx
git commit -m "refactor(dashboard): extrae Section a componente compartido"
```

- [ ] **Step 4: Create `ClubsAndCupsSection.tsx`**

Create `src/components/dashboard/ClubsAndCupsSection.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import {
  fetchTeamCompetitions,
  fetchTeamCompetitionFixtures,
  fetchLeagueStandings,
  type TeamCompetition,
  type StandingRow,
  type AgencyFixture,
} from '@/services/footballApiService'
import { getUniqueTeamIds, getPlayersByTeamId } from '@/constants/agencyPlayers'
import StandingsTable from '@/components/shared/StandingsTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface TeamOption {
  teamId: number
  teamName: string
  playerNames: string[]
}

function buildTeamOptions(): TeamOption[] {
  return getUniqueTeamIds()
    .map(teamId => {
      const players = getPlayersByTeamId(teamId)
      return { teamId, teamName: players[0]?.team ?? '', playerNames: players.map(p => p.shortName) }
    })
    .filter(t => t.teamName)
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
}

function CompetitionStandings({ teamId, leagueId, season }: { teamId: number; leagueId: number; season: number }) {
  const [groups, setGroups] = useState<StandingRow[][] | null>(null)

  useEffect(() => {
    let active = true
    setGroups(null)
    fetchLeagueStandings(leagueId, season)
      .then(g => {
        if (active) setGroups(g)
      })
      .catch(() => {
        if (active) setGroups([])
      })
    return () => {
      active = false
    }
  }, [leagueId, season])

  if (groups === null) return <LoadingSpinner message="Cargando tabla de posiciones..." />
  if (groups.length === 0) {
    return (
      <p className="text-sm text-apple-gray-500 text-center py-8">No se pudo cargar la tabla de posiciones.</p>
    )
  }
  return <StandingsTable groups={groups} highlightTeamId={teamId} />
}

function CompetitionFixtures({ teamId, leagueId, season }: { teamId: number; leagueId: number; season: number }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)

  useEffect(() => {
    let active = true
    setFixtures(null)
    fetchTeamCompetitionFixtures(teamId, leagueId, season)
      .then(f => {
        if (active) setFixtures(f)
      })
      .catch(() => {
        if (active) setFixtures([])
      })
    return () => {
      active = false
    }
  }, [teamId, leagueId, season])

  if (fixtures === null) return <LoadingSpinner message="Cargando partidos..." />
  if (fixtures.length === 0) {
    return (
      <p className="text-sm text-apple-gray-500 text-center py-8">
        No hay partidos disponibles para esta competencia.
      </p>
    )
  }

  const sorted = [...fixtures].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)

  return (
    <div className="space-y-1">
      {sorted.map(f => {
        const isFinished = ['FT', 'AET', 'PEN'].includes(f.statusShort)
        const opponent = f.isHome ? f.awayTeam : f.homeTeam
        return (
          <div
            key={f.fixtureId}
            className="flex items-center gap-3 p-3 rounded-lg bg-apple-gray-50 dark:bg-apple-gray-700/30"
          >
            <img src={opponent.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-apple-gray-800 dark:text-white truncate">
                {f.isHome ? 'vs' : '@'} {opponent.name}
              </p>
              <p className="text-xs text-apple-gray-500 truncate">{f.round}</p>
            </div>
            <span className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-200 tabular-nums flex-shrink-0">
              {isFinished ? `${f.goalsHome ?? '-'}-${f.goalsAway ?? '-'}` : new Date(f.date).toLocaleDateString('es-AR')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function ClubsAndCupsSection() {
  const options = useMemo(buildTeamOptions, [])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(options[0]?.teamId ?? null)
  const [competitions, setCompetitions] = useState<TeamCompetition[] | null>(null)
  const [activeCompetitionIdx, setActiveCompetitionIdx] = useState(0)

  useEffect(() => {
    if (selectedTeamId == null) return
    let active = true
    setCompetitions(null)
    setActiveCompetitionIdx(0)
    fetchTeamCompetitions(selectedTeamId)
      .then(c => {
        if (active) setCompetitions(c)
      })
      .catch(() => {
        if (active) setCompetitions([])
      })
    return () => {
      active = false
    }
  }, [selectedTeamId])

  if (options.length === 0) return null

  const selected = options.find(o => o.teamId === selectedTeamId)
  const activeCompetition = competitions?.[activeCompetitionIdx] ?? null

  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-apple-gray-800 dark:text-white">Clubes y Copas</h2>
          <p className="text-sm text-apple-gray-500">
            Posición en la liga y progreso en copas de los clubes del roster
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={selectedTeamId ?? ''}
            onChange={e => setSelectedTeamId(Number(e.target.value))}
            className="min-h-[40px] text-sm font-medium rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-3 py-2 text-apple-gray-700 dark:text-apple-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green"
          >
            {options.map(o => (
              <option key={o.teamId} value={o.teamId}>
                {o.teamName}
              </option>
            ))}
          </select>
          {selected && (
            <span className="text-xs text-apple-gray-500 truncate">{selected.playerNames.join(', ')}</span>
          )}
        </div>

        {competitions === null ? (
          <LoadingSpinner message="Cargando competencias..." />
        ) : competitions.length === 0 ? (
          <p className="text-sm text-apple-gray-500 text-center py-8">
            No se encontraron competencias vigentes para este equipo.
          </p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin mb-4">
              {competitions.map((c, i) => (
                <button
                  key={c.leagueId}
                  onClick={() => setActiveCompetitionIdx(i)}
                  className={`min-h-[40px] px-3 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-apple ${
                    i === activeCompetitionIdx
                      ? 'bg-brand-green text-apple-gray-900'
                      : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'
                  }`}
                >
                  {c.leagueName}
                </button>
              ))}
            </div>

            {activeCompetition && selectedTeamId != null && (
              activeCompetition.hasStandings ? (
                <CompetitionStandings
                  key={`${selectedTeamId}-${activeCompetition.leagueId}`}
                  teamId={selectedTeamId}
                  leagueId={activeCompetition.leagueId}
                  season={activeCompetition.season}
                />
              ) : (
                <CompetitionFixtures
                  key={`${selectedTeamId}-${activeCompetition.leagueId}`}
                  teamId={selectedTeamId}
                  leagueId={activeCompetition.leagueId}
                  season={activeCompetition.season}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire into `DashboardPage.tsx`**

Add the import near the other component imports (after `import AgencyTransferHistory from '@/components/dashboard/AgencyTransferHistory'`):

```ts
import ClubsAndCupsSection from '@/components/dashboard/ClubsAndCupsSection'
```

Mount it right after the "Recomendaciones de Fichaje" block and before the closing `</div>` of the page. The exact tail of the file today (last 15 lines) is:

```tsx
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-apple-gray-500 text-center py-6">
                  No hay oportunidades de contrato
                </p>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}
```

Replace the last 4 lines (`      )}`, `    </div>`, `  )`, `}`) with:

```tsx
      )}

      <ClubsAndCupsSection />
    </div>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 7: Manual browser verification**

Run the dev server (`npm run dev`), open Panel Interno, scroll to "Clubes y Copas": confirm the team dropdown lists agency teams, switching teams reloads competitions, league tabs show the standings table with the selected team highlighted, and cup tabs (no standings) show a fixtures list instead. Confirm no emoji anywhere and the section matches the dark/light theme of the rest of the page.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/ClubsAndCupsSection.tsx src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): agrega seccion Clubes y Copas a Panel Interno"
```

---

### Task 4: Achievements data model + pure aggregation functions

**Files:**
- Create: `src/constants/agencyAchievements.ts`
- Create: `src/constants/agencyAchievements.test.ts`

**Interfaces:**
- Consumes: `normalizeName` from `@/utils/scoring` (existing), `AgencyPlayer` type from `./agencyPlayers` (existing, same file's sibling).
- Produces: `export type AchievementType = 'liga' | 'copa' | 'copa_liga' | 'continental' | 'otro'`, `export interface AgencyAchievement { playerName: string; type: AchievementType; competition: string; club: string; year: number; dateLabel?: string }`, `export const AGENCY_ACHIEVEMENTS: AgencyAchievement[]`, `export const ACHIEVEMENT_TYPE_LABEL: Record<AchievementType, string>`, `export const ACHIEVEMENT_TYPE_ORDER: AchievementType[]`, `export interface YearlyAchievementCount { year: number; total: number; byType: Record<AchievementType, number> }`, `export function aggregateAchievementsByYear(achievements: AgencyAchievement[]): YearlyAchievementCount[]`, `export function resolveAchievementPlayer(achievement: AgencyAchievement, players: AgencyPlayer[]): AgencyPlayer | null`. Task 6 (`AchievementsSection`) imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `src/constants/agencyAchievements.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aggregateAchievementsByYear, resolveAchievementPlayer, type AgencyAchievement } from './agencyAchievements'
import type { AgencyPlayer } from './agencyPlayers'

describe('aggregateAchievementsByYear', () => {
  it('devuelve vacío sin logros', () => {
    expect(aggregateAchievementsByYear([])).toEqual([])
  })

  it('rellena con cero los años sin logros en el medio del rango', () => {
    const withGap: AgencyAchievement[] = [
      { playerName: 'A', type: 'liga', competition: 'X', club: 'Y', year: 2022 },
      { playerName: 'B', type: 'copa', competition: 'X', club: 'Y', year: 2024 },
    ]
    const result = aggregateAchievementsByYear(withGap)
    expect(result.map(r => r.year)).toEqual([2022, 2023, 2024])
    expect(result[1].total).toBe(0)
    expect(result[1].byType).toMatchObject({ liga: 0, copa: 0, copa_liga: 0, continental: 0, otro: 0 })
  })

  it('cuenta total y desglose por tipo en el mismo año', () => {
    const sample: AgencyAchievement[] = [
      { playerName: 'Mauricio Vera', type: 'liga', competition: 'Liga Uruguaya', club: 'Nacional', year: 2023 },
      { playerName: 'Gianluca Prestianni', type: 'copa', competition: 'Copa de Portugal', club: 'Benfica', year: 2023 },
      { playerName: 'Gianluca Prestianni', type: 'continental', competition: 'Champions League', club: 'Benfica', year: 2024 },
    ]
    const result = aggregateAchievementsByYear(sample)
    const y2023 = result.find(r => r.year === 2023)!
    expect(y2023.total).toBe(2)
    expect(y2023.byType).toMatchObject({ liga: 1, copa: 1, copa_liga: 0, continental: 0, otro: 0 })
    const y2024 = result.find(r => r.year === 2024)!
    expect(y2024.total).toBe(1)
    expect(y2024.byType.continental).toBe(1)
  })
})

describe('resolveAchievementPlayer', () => {
  const players: AgencyPlayer[] = [
    {
      shortName: 'M. Vera',
      fullName: 'Mauricio Vera',
      image: null,
      contractEnd: null,
      marketValue: null,
      team: 'Bhayangkara FC',
      apiTeamId: 2443,
      isReserve: false,
    },
  ]

  it('matchea por nombre completo tolerando acentos/mayúsculas', () => {
    const achievement: AgencyAchievement = {
      playerName: 'MÁURICIO VÉRA',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementPlayer(achievement, players)?.shortName).toBe('M. Vera')
  })

  it('devuelve null si no hay match en el roster', () => {
    const achievement: AgencyAchievement = {
      playerName: 'Jugador Inexistente',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementPlayer(achievement, players)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/constants/agencyAchievements.test.ts`
Expected: FAIL — cannot find module `./agencyAchievements`.

- [ ] **Step 3: Implement `agencyAchievements.ts`**

Create `src/constants/agencyAchievements.ts`:

```ts
import { normalizeName } from '@/utils/scoring'
import type { AgencyPlayer } from './agencyPlayers'

export type AchievementType = 'liga' | 'copa' | 'copa_liga' | 'continental' | 'otro'

export interface AgencyAchievement {
  playerName: string // fullName, matcheado contra AgencyPlayer.fullName
  type: AchievementType
  competition: string // ej. "Liga Profesional Argentina"
  club: string // club con el que lo ganó
  year: number // temporada, para el gráfico evolutivo
  dateLabel?: string // ej. "Apertura 2025", opcional
}

export const ACHIEVEMENT_TYPE_LABEL: Record<AchievementType, string> = {
  liga: 'Liga',
  copa: 'Copa',
  copa_liga: 'Copa de Liga',
  continental: 'Continental',
  otro: 'Otro',
}

export const ACHIEVEMENT_TYPE_ORDER: AchievementType[] = ['liga', 'copa', 'copa_liga', 'continental', 'otro']

// Cargado a mano por Claude cuando el usuario reporta un título por chat (jugador,
// torneo, tipo, año, club). Sin pantalla de carga en la app — ver spec
// docs/superpowers/specs/2026-08-17-panel-interno-clubes-logros-design.md.
export const AGENCY_ACHIEVEMENTS: AgencyAchievement[] = []

export interface YearlyAchievementCount {
  year: number
  total: number
  byType: Record<AchievementType, number>
}

function emptyTypeCounts(): Record<AchievementType, number> {
  return { liga: 0, copa: 0, copa_liga: 0, continental: 0, otro: 0 }
}

export function aggregateAchievementsByYear(achievements: AgencyAchievement[]): YearlyAchievementCount[] {
  if (achievements.length === 0) return []

  const years = achievements.map(a => a.year)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  const result: YearlyAchievementCount[] = []
  for (let year = minYear; year <= maxYear; year++) {
    const inYear = achievements.filter(a => a.year === year)
    const byType = emptyTypeCounts()
    for (const a of inYear) byType[a.type]++
    result.push({ year, total: inYear.length, byType })
  }
  return result
}

export function resolveAchievementPlayer(
  achievement: AgencyAchievement,
  players: AgencyPlayer[],
): AgencyPlayer | null {
  const target = normalizeName(achievement.playerName)
  return players.find(p => normalizeName(p.fullName) === target) ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/constants/agencyAchievements.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/constants/agencyAchievements.ts src/constants/agencyAchievements.test.ts
git commit -m "feat(agencia): agrega modelo de datos de Logros con agregacion por año"
```

---

### Task 5: Verify trophy assets

**Files:**
- Verify (already committed to the repo before this plan was written): `public/trophies/liga.png`, `public/trophies/copa.png`, `public/trophies/copa_liga.png`, `public/trophies/continental.png`, `public/trophies/otro.png`

**Interfaces:**
- Produces: five static image files at `/trophies/{type}.png`, referenced directly by `<img src="/trophies/{type}.png">` in Task 6.

- [ ] **Step 1: Confirm the files exist and are transparent PNGs**

Run: `ls -la public/trophies/ && npx --yes  file public/trophies/*.png 2>/dev/null || python3 -c "from PIL import Image; import glob; [print(f, Image.open(f).mode) for f in glob.glob('public/trophies/*.png')]"`
Expected: 5 files, each `RGBA` (has an alpha/transparency channel). If any file is missing or not `RGBA`, stop and flag it — do not proceed to Task 6 with a broken asset.

- [ ] **Step 2: No commit needed**

These files were generated and committed as part of the design/approval process for this feature (AI-rendered trophies, background made transparent via local post-processing since the generation model didn't honor the transparent-background instruction on its own). If `git status` shows them as already committed, skip straight to Task 6.

---

### Task 6: `AchievementsSection` component + wire into Panel Interno

**Files:**
- Create: `src/components/dashboard/AchievementsSection.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `AGENCY_ACHIEVEMENTS`, `AchievementType`, `ACHIEVEMENT_TYPE_LABEL`, `ACHIEVEMENT_TYPE_ORDER`, `aggregateAchievementsByYear`, `resolveAchievementPlayer` (from Task 4), `getAgencyPlayersList` (existing, from `@/constants/agencyPlayers`), `LineChart`/`Line`/`XAxis`/`YAxis`/`CartesianGrid`/`Tooltip`/`Legend`/`ResponsiveContainer` from `recharts` (existing dependency, already used by `PortfolioValueChart`/`MarketValueChart`).
- Produces: `export default function AchievementsSection()` — no props, self-contained, mounted once in `DashboardPage.tsx`.

- [ ] **Step 1: Create `AchievementsSection.tsx`**

Create `src/components/dashboard/AchievementsSection.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  AGENCY_ACHIEVEMENTS,
  ACHIEVEMENT_TYPE_LABEL,
  ACHIEVEMENT_TYPE_ORDER,
  aggregateAchievementsByYear,
  resolveAchievementPlayer,
  type AchievementType,
} from '@/constants/agencyAchievements'
import { getAgencyPlayersList } from '@/constants/agencyPlayers'

const TYPE_LINE_COLOR: Record<AchievementType, string> = {
  liga: '#22C55E', // brand-green
  copa: '#3B82F6',
  copa_liga: '#A855F7',
  continental: '#F59E0B',
  otro: '#6B7280',
}

const TYPE_FILTER_ALL = 'todos' as const
type TypeFilter = AchievementType | typeof TYPE_FILTER_ALL

export default function AchievementsSection() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(TYPE_FILTER_ALL)
  const [yearFilter, setYearFilter] = useState<number | null>(null)

  const players = useMemo(() => getAgencyPlayersList(), [])
  const yearlyCounts = useMemo(() => aggregateAchievementsByYear(AGENCY_ACHIEVEMENTS), [])

  const years = useMemo(
    () => Array.from(new Set(AGENCY_ACHIEVEMENTS.map(a => a.year))).sort((a, b) => b - a),
    [],
  )

  const filtered = useMemo(() => {
    return AGENCY_ACHIEVEMENTS.filter(a => {
      if (typeFilter !== TYPE_FILTER_ALL && a.type !== typeFilter) return false
      if (yearFilter !== null && a.year !== yearFilter) return false
      return true
    }).sort((a, b) => b.year - a.year)
  }, [typeFilter, yearFilter])

  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-apple-gray-800 dark:text-white">Logros</h2>
          <p className="text-sm text-apple-gray-500">Títulos ganados por jugadores representados por la agencia</p>
        </div>
      </div>

      <div className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-5">
        {AGENCY_ACHIEVEMENTS.length === 0 ? (
          <p className="text-sm text-apple-gray-500 text-center py-10">
            Todavía no hay logros cargados. Se suman a medida que se van reportando.
          </p>
        ) : (
          <>
            {yearlyCounts.length > 1 && (
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyCounts}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-apple-gray-200 dark:stroke-apple-gray-700" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Total" stroke="#22C55E" strokeWidth={2.5} dot />
                    {ACHIEVEMENT_TYPE_ORDER.map(type => (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={(row: (typeof yearlyCounts)[number]) => row.byType[type]}
                        name={ACHIEVEMENT_TYPE_LABEL[type]}
                        stroke={TYPE_LINE_COLOR[type]}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setTypeFilter(TYPE_FILTER_ALL)}
                className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === TYPE_FILTER_ALL
                    ? 'bg-brand-green text-apple-gray-900'
                    : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
                }`}
              >
                Todos los tipos
              </button>
              {ACHIEVEMENT_TYPE_ORDER.map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
                    typeFilter === type
                      ? 'bg-brand-green text-apple-gray-900'
                      : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
                  }`}
                >
                  {ACHIEVEMENT_TYPE_LABEL[type]}
                </button>
              ))}
              <select
                value={yearFilter ?? ''}
                onChange={e => setYearFilter(e.target.value ? Number(e.target.value) : null)}
                className="min-h-[36px] text-xs font-medium rounded-full border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-3 text-apple-gray-700 dark:text-apple-gray-200"
              >
                <option value="">Todos los años</option>
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-apple-gray-500 text-center py-8">
                No hay logros que coincidan con el filtro elegido.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((achievement, i) => {
                  const player = resolveAchievementPlayer(achievement, players)
                  return (
                    <button
                      key={i}
                      onClick={() => player && navigate(`/jugador/${encodeURIComponent(player.fullName)}?source=interno`)}
                      disabled={!player}
                      className="flex items-center gap-3 p-4 bg-apple-gray-50 dark:bg-apple-gray-700/50 rounded-xl text-left hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors disabled:hover:bg-apple-gray-50 dark:disabled:hover:bg-apple-gray-700/50"
                    >
                      <img
                        src={`/trophies/${achievement.type}.png`}
                        alt=""
                        className="w-14 h-14 object-contain flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-apple-gray-800 dark:text-white text-sm truncate">
                          {achievement.playerName}
                        </p>
                        <p className="text-xs text-apple-gray-500 truncate">{achievement.competition}</p>
                        <p className="text-2xs text-apple-gray-400 truncate">
                          {achievement.club} · {achievement.dateLabel ?? achievement.year}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `DashboardPage.tsx`**

Add the import next to the `ClubsAndCupsSection` import added in Task 3:

```ts
import AchievementsSection from '@/components/dashboard/AchievementsSection'
```

Mount it right after `<ClubsAndCupsSection />`:

```tsx
      <ClubsAndCupsSection />
      <AchievementsSection />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Manual browser verification**

Run the dev server (`npm run dev`), open Panel Interno, scroll to "Logros": confirm the empty state renders correctly (since `AGENCY_ACHIEVEMENTS` is still `[]` at this point). To verify the populated state, temporarily add one or two entries to `AGENCY_ACHIEVEMENTS` in `src/constants/agencyAchievements.ts`, reload, confirm the line chart renders, filters work, and gallery cards show the right trophy image with no emoji anywhere — then revert that temporary edit (the array must stay `[]` at commit time — real entries get added later, one per chat report from the user, per the spec).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/AchievementsSection.tsx src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): agrega seccion Logros a Panel Interno"
```

---

### Task 7: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new ones from Tasks 1, 2, and 4.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds (catches anything typecheck alone might miss, e.g. unused-import lint-level failures depending on `tsconfig` strictness).

- [ ] **Step 4: Full manual browser pass**

Run the dev server, open Panel Interno end to end:
- KPIs, Score GG, contratos, top rendimiento, análisis de ligas — unchanged, still render as before Task 1-6 (extraction of `Section`/`StandingsTable` must not have visibly changed anything above the new sections).
- Clubes y Copas: switch between at least two different agency teams, confirm both a league tab (table) and a cup tab (fixtures list) render correctly for teams that have both.
- Logros: confirm empty state (no fabricated placeholder data left over from Task 6's manual check).
- Open Entrenadores → cualquier entrenador con liga cargada → confirm the standings tab still works identically to before the `StandingsTable` extraction.
- Open Mauricio Vera's ficha (`/jugador/Mauricio%20Vera?source=interno`) — confirm it now shows Bhayangkara FC as his club, not Nacional.

- [ ] **Step 5: Commit if any fixes were needed**

If Step 4 surfaced any issue, fix it, re-run Steps 1-3, and commit with a message describing the fix. If everything passed cleanly, no commit is needed for this task.
