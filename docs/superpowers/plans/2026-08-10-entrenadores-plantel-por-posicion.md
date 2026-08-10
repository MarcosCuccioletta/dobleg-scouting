# Entrenadores — Plantel por posición con jugadores clickeables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el tab Plantel de la ficha de un entrenador, agrupar a los jugadores por posición (con encabezados) y hacer que cada jugador sea clickeable: si es de Doble G lleva a su ficha interna, si ya está en Scouting Externo lleva a esa ficha, y si no existe en ningún lado se le crea una ficha mínima al vuelo (en una tabla nueva de Supabase, sin tocar el Google Sheet legacy) y se navega directo a ella.

**Architecture:** Overlay de Supabase (`manual_external_players`) fusionado en `external` dentro de `DataContext.tsx`, mismo patrón ya usado para `agencyPlayers`/`internal`. Lógica pura de mapeo de posición y de conversión a `EnrichedPlayer` en un módulo separado y testeado (`src/features/coaches/manualExternalPlayer.ts`), igual que el agrupado del plantel (`src/features/coaches/squadGrouping.ts`). `TeamRosterPanel.tsx` se reescribe para usar ambos y resolver, por jugador, a qué ficha (o creación) linkear.

**Tech Stack:** React 18 + TypeScript, Supabase, React Router (`Link`/`useNavigate`), Vitest (`.test.ts` de lógica pura).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-10-entrenadores-plantel-por-posicion-design.md`.
- No se toca el Google Sheet legacy de Scouting Externo — las fichas creadas al vuelo viven en la tabla nueva de Supabase.
- De-dupe de fichas manuales por `api_player_id` (upsert) — un click doble o el mismo jugador visto desde dos entrenadores no debe duplicar filas.
- Si el Sheet legacy ya tiene a un jugador por nombre, esa fila gana sobre cualquier ficha manual con el mismo nombre (se filtra al fusionar en `DataContext`).
- Sin diálogo de confirmación al crear una ficha — un click y ya, con un spinner en la tarjeta mientras se crea.
- Tests son solo de lógica pura (`.test.ts`). Funciones que solo envuelven una llamada a Supabase (sin lógica propia) no se testean — mismo criterio ya usado en `coachService.ts`.
- Seguir el estilo visual y las clases Tailwind ya usadas en `TeamRosterPanel.tsx`/`CoachSummaryTab.tsx` — no introducir un sistema de diseño nuevo.

---

## Task 1: Migración de Supabase — `manual_external_players`

**Files:**
- Create: `supabase/migrations/20260810_manual_external_players.sql`

**Interfaces:**
- Produces: tabla `manual_external_players(id, api_player_id, full_name, team, position, age, photo, created_at)`, único por `api_player_id`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Fichas creadas al vuelo desde el plantel de un entrenador, cuando un jugador
-- no tiene fila todavia en el Sheet legacy de Scouting Externo (de solo lectura
-- desde el browser). Se fusiona con `external` en DataContext.tsx, mismo patron
-- que el overlay de agencyPlayers sobre `internal`.
CREATE TABLE IF NOT EXISTS public.manual_external_players (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  api_player_id   BIGINT NOT NULL,
  full_name       TEXT NOT NULL,
  team            TEXT NOT NULL,
  position        TEXT NOT NULL,
  age             INTEGER,
  photo           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_manual_external_players_api_id ON public.manual_external_players(api_player_id);

ALTER TABLE public.manual_external_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_manual_external_players" ON public.manual_external_players;
CREATE POLICY "read_manual_external_players" ON public.manual_external_players FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_manual_external_players" ON public.manual_external_players;
CREATE POLICY "write_manual_external_players" ON public.manual_external_players
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Verificar que el archivo quedó bien formado**

Run: `cat supabase/migrations/20260810_manual_external_players.sql`
Expected: el contenido exacto de arriba, sin errores de sintaxis SQL visibles a simple vista (paréntesis balanceados, `;` al final de cada statement).

No se corre en una base de datos real desde acá — el usuario la corre a mano en Supabase (mismo flujo que las migraciones anteriores de esta rama). No requiere Docker/Supabase local para este paso.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260810_manual_external_players.sql
git commit -m "feat(entrenadores): migracion de manual_external_players para fichas creadas al vuelo"
```

---

## Task 2: Servicio `manualExternalPlayersService.ts`

**Files:**
- Create: `src/services/manualExternalPlayersService.ts`

**Interfaces:**
- Produces: `interface ManualExternalPlayerRow { api_player_id: number; full_name: string; team: string; position: string; age: number | null; photo: string | null }`, `listManualExternalPlayers(): Promise<ManualExternalPlayerRow[]>`, `createManualExternalPlayer(row: ManualExternalPlayerRow): Promise<ManualExternalPlayerRow>`.

- [ ] **Step 1: Implementar el servicio**

```ts
// src/services/manualExternalPlayersService.ts
import { supabase } from '@/lib/supabase'

export interface ManualExternalPlayerRow {
  api_player_id: number
  full_name: string
  team: string
  position: string
  age: number | null
  photo: string | null
}

export async function listManualExternalPlayers(): Promise<ManualExternalPlayerRow[]> {
  const { data, error } = await supabase
    .from('manual_external_players')
    .select('api_player_id, full_name, team, position, age, photo')

  if (error || !data) {
    console.error('Error listando fichas manuales de Externo:', error)
    return []
  }
  return data
}

export async function createManualExternalPlayer(row: ManualExternalPlayerRow): Promise<ManualExternalPlayerRow> {
  const { data, error } = await supabase
    .from('manual_external_players')
    .upsert(row, { onConflict: 'api_player_id' })
    .select('api_player_id, full_name, team, position, age, photo')
    .single()

  if (error || !data) {
    console.error('Error creando ficha manual de Externo:', error)
    return row
  }
  return data
}
```

Sin test propio — es un envoltorio fino sobre Supabase (I/O), mismo criterio ya usado para las funciones de `coachService.ts` que solo hacen `select`/`upsert` sin lógica.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/services/manualExternalPlayersService.ts
git commit -m "feat(entrenadores): servicio de fichas manuales de Externo (list/create)"
```

---

## Task 3: Mapeo de posición y conversión a `EnrichedPlayer`

**Files:**
- Create: `src/features/coaches/manualExternalPlayer.ts`
- Create: `src/features/coaches/manualExternalPlayer.test.ts`

**Interfaces:**
- Consumes: `ManualExternalPlayerRow` (Task 2), `POSITION_MAP` (`@/constants/scoring`, ya existe), `formatMarketValue`/`parseMarketValue` (`@/utils/scoring`, ya existen), `EnrichedPlayer` (`@/types`, ya existe).
- Produces: `mapSquadPositionToSpanish(position: string | null): string`, `manualExternalToEnriched(row: ManualExternalPlayerRow, ggScore: number | null): EnrichedPlayer`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/manualExternalPlayer.test.ts
import { describe, it, expect } from 'vitest'
import { mapSquadPositionToSpanish, manualExternalToEnriched } from './manualExternalPlayer'
import type { ManualExternalPlayerRow } from '@/services/manualExternalPlayersService'

describe('mapSquadPositionToSpanish', () => {
  it('mapea las 4 posiciones genericas de API-Football', () => {
    expect(mapSquadPositionToSpanish('Goalkeeper')).toBe('Arquero')
    expect(mapSquadPositionToSpanish('Defender')).toBe('Defensor Central')
    expect(mapSquadPositionToSpanish('Midfielder')).toBe('Volante central')
    expect(mapSquadPositionToSpanish('Attacker')).toBe('Delantero')
  })

  it('devuelve string vacio para una posicion desconocida o null, sin crashear', () => {
    expect(mapSquadPositionToSpanish('Wingback')).toBe('')
    expect(mapSquadPositionToSpanish(null)).toBe('')
  })
})

function mkRow(over: Partial<ManualExternalPlayerRow> = {}): ManualExternalPlayerRow {
  return {
    api_player_id: 123,
    full_name: 'Juan Pérez',
    team: 'Temperley',
    position: 'Defensor Central',
    age: 22,
    photo: 'https://example.com/foto.png',
    ...over,
  }
}

describe('manualExternalToEnriched', () => {
  it('llena los campos disponibles y deja el resto en blanco/0', () => {
    const player = manualExternalToEnriched(mkRow(), 6.2)
    expect(player.Jugador).toBe('Juan Pérez')
    expect(player.Equipo).toBe('Temperley')
    expect(player['Posición']).toBe('Defensor Central')
    expect(player.Edad).toBe('22')
    expect(player.ageNum).toBe(22)
    expect(player.Imagen).toBe('https://example.com/foto.png')
    expect(player.source).toBe('externo')
    expect(player.ggScore).toBe(6.2)
    expect(player.Liga).toBe('')
    expect(player.marketValueRaw).toBe(0)
    expect(player['Partidos jugados']).toBe('')
  })

  it('no crashea con age y photo null, y ggScore null', () => {
    const player = manualExternalToEnriched(mkRow({ age: null, photo: null }), null)
    expect(player.Edad).toBe('')
    expect(player.ageNum).toBe(0)
    expect(player.Imagen).toBe('')
    expect(player.ggScore).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/manualExternalPlayer.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `manualExternalPlayer.ts`**

```ts
// src/features/coaches/manualExternalPlayer.ts
import { POSITION_MAP } from '@/constants/scoring'
import { formatMarketValue, parseMarketValue } from '@/utils/scoring'
import type { EnrichedPlayer } from '@/types'
import type { ManualExternalPlayerRow } from '@/services/manualExternalPlayersService'

// Posicion generica que trae /players/squads de API-Football -> valor canonico
// de POSITION_MAP. Es una posicion "gruesa", no especifica -- se puede afinar
// despues a mano, igual que cualquier jugador recien scouteado sin detalle fino.
const SQUAD_POSITION_TO_SPANISH: Record<string, string> = {
  Goalkeeper: 'Arquero',
  Defender: 'Defensor Central',
  Midfielder: 'Volante central',
  Attacker: 'Delantero',
}

export function mapSquadPositionToSpanish(position: string | null): string {
  if (!position) return ''
  return SQUAD_POSITION_TO_SPANISH[position] ?? ''
}

/** Ficha minima de Externo a partir de una fila creada al vuelo desde un plantel. */
export function manualExternalToEnriched(row: ManualExternalPlayerRow, ggScore: number | null): EnrichedPlayer {
  const position = POSITION_MAP[row.position] ?? row.position
  const marketValueRaw = parseMarketValue('')
  return {
    Jugador: row.full_name,
    Liga: '',
    Equipo: row.team,
    'Posición': position,
    Edad: row.age != null ? String(row.age) : '',
    'País de nacimiento': '',
    Pie: '',
    Altura: '',
    'Valor de mercado (Transfermarkt)': '',
    'Vencimiento contrato': '',
    'Partidos jugados': '',
    'Minutos jugados': '',
    Goles: '',
    xG: '',
    Asistencias: '',
    xA: '',
    'Posición específica': position,
    id: '',
    Transfermkt: '',
    Representante: '',
    Imagen: row.photo ?? '',
    ggScore,
    ggScorePercentile: null,
    source: 'externo',
    contractStatus: 'ok',
    monthsRemaining: null,
    marketValueFormatted: formatMarketValue(marketValueRaw),
    marketValueRaw,
    minutesPlayed: 0,
    ageNum: row.age ?? 0,
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/manualExternalPlayer.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/manualExternalPlayer.ts src/features/coaches/manualExternalPlayer.test.ts
git commit -m "feat(entrenadores): mapeo de posicion y conversion de fichas manuales a EnrichedPlayer"
```

---

## Task 4: Agrupado del plantel por posición

**Files:**
- Create: `src/features/coaches/squadGrouping.ts`
- Create: `src/features/coaches/squadGrouping.test.ts`

**Interfaces:**
- Consumes: `SquadPlayer` (`@/services/footballApiService`, ya existe: `{ id, name, age, number, position, photo }`).
- Produces: `POSITION_LABEL: Record<string, string>` (singular, para el label debajo del nombre de cada jugador), `interface SquadPositionGroup { positionKey: string; label: string; players: SquadPlayer[] }`, `groupSquadByPosition(squad: SquadPlayer[]): SquadPositionGroup[]`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/squadGrouping.test.ts
import { describe, it, expect } from 'vitest'
import { groupSquadByPosition } from './squadGrouping'
import type { SquadPlayer } from '@/services/footballApiService'

function mkPlayer(over: Partial<SquadPlayer> = {}): SquadPlayer {
  return { id: 1, name: 'Jugador', age: 25, number: 10, position: 'Midfielder', photo: null, ...over }
}

describe('groupSquadByPosition', () => {
  it('agrupa en el orden arquero -> defensor -> mediocampista -> delantero', () => {
    const squad = [
      mkPlayer({ id: 1, position: 'Attacker' }),
      mkPlayer({ id: 2, position: 'Goalkeeper' }),
      mkPlayer({ id: 3, position: 'Defender' }),
      mkPlayer({ id: 4, position: 'Midfielder' }),
    ]
    const groups = groupSquadByPosition(squad)
    expect(groups.map(g => g.positionKey)).toEqual(['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'])
  })

  it('omite posiciones sin jugadores en vez de mostrar una seccion vacia', () => {
    const squad = [mkPlayer({ id: 1, position: 'Goalkeeper' })]
    const groups = groupSquadByPosition(squad)
    expect(groups).toHaveLength(1)
    expect(groups[0].positionKey).toBe('Goalkeeper')
  })

  it('ordena los jugadores de cada grupo por dorsal', () => {
    const squad = [
      mkPlayer({ id: 1, position: 'Defender', number: 6 }),
      mkPlayer({ id: 2, position: 'Defender', number: 2 }),
      mkPlayer({ id: 3, position: 'Defender', number: null }),
    ]
    const groups = groupSquadByPosition(squad)
    expect(groups[0].players.map(p => p.id)).toEqual([2, 1, 3])
  })

  it('agrupa posiciones desconocidas o nulas al final bajo "Otros"', () => {
    const squad = [
      mkPlayer({ id: 1, position: 'Attacker' }),
      mkPlayer({ id: 2, position: null }),
    ]
    const groups = groupSquadByPosition(squad)
    expect(groups.map(g => g.positionKey)).toEqual(['Attacker', 'Unknown'])
    expect(groups[1].label).toBe('Otros')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/squadGrouping.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `squadGrouping.ts`**

```ts
// src/features/coaches/squadGrouping.ts
import type { SquadPlayer } from '@/services/footballApiService'

// Label singular, para el texto chico debajo del nombre de cada jugador.
export const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: 'Arquero',
  Defender: 'Defensor',
  Midfielder: 'Mediocampista',
  Attacker: 'Delantero',
}

// Label plural, para el encabezado de cada seccion del plantel.
const SECTION_LABEL: Record<string, string> = {
  Goalkeeper: 'Arqueros',
  Defender: 'Defensores',
  Midfielder: 'Mediocampistas',
  Attacker: 'Delanteros',
}

// Orden futbolistico habitual: arqueros, defensores, mediocampistas, delanteros.
const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Attacker: 3,
}

const UNKNOWN_KEY = 'Unknown'
const UNKNOWN_ORDER = 99
const UNKNOWN_LABEL = 'Otros'

export interface SquadPositionGroup {
  positionKey: string
  label: string
  players: SquadPlayer[]
}

export function groupSquadByPosition(squad: SquadPlayer[]): SquadPositionGroup[] {
  const buckets = new Map<string, SquadPlayer[]>()
  for (const player of squad) {
    const key = player.position ?? UNKNOWN_KEY
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(player)
  }

  const groups: SquadPositionGroup[] = []
  for (const [key, players] of buckets) {
    const sorted = [...players].sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
    groups.push({
      positionKey: key,
      label: SECTION_LABEL[key] ?? UNKNOWN_LABEL,
      players: sorted,
    })
  }

  groups.sort((a, b) => (POSITION_ORDER[a.positionKey] ?? UNKNOWN_ORDER) - (POSITION_ORDER[b.positionKey] ?? UNKNOWN_ORDER))
  return groups
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/squadGrouping.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/squadGrouping.ts src/features/coaches/squadGrouping.test.ts
git commit -m "feat(entrenadores): agrupado del plantel por posicion"
```

---

## Task 5: Integración en `DataContext.tsx`

**Files:**
- Modify: `src/types/index.ts` (interfaz `AppData`)
- Modify: `src/context/DataContext.tsx`

**Interfaces:**
- Consumes: `listManualExternalPlayers`, `createManualExternalPlayer`, `ManualExternalPlayerRow` (Task 2), `manualExternalToEnriched` (Task 3), `normalizeName` (`@/utils/scoring`, ya existe), `mergeAgencyIntoInternal` (ya existe en este mismo archivo).
- Produces: campo nuevo en `AppData`: `createManualPlayerAndRefresh: (row: ManualExternalPlayerRow) => Promise<EnrichedPlayer>`. `data.external` (y por lo tanto `internal`, via `mergeAgencyIntoInternal`) incluye desde la carga inicial las fichas manuales que ya existan en Supabase, sin duplicar contra el Sheet legacy por nombre.

- [ ] **Step 1: Agregar el campo a `AppData` en `src/types/index.ts`**

Ubicar la interfaz `AppData` (línea ~239) y agregar el campo nuevo junto a `refreshAgencyPlayers`:

```ts
export interface AppData {
  external: EnrichedPlayer[]
  internal: EnrichedPlayer[]
  monitoring: MonitoringPlayer[]
  normalized: NormalizedPlayer[]
  evolution: EvolutionEntry[]
  subjectiveMetrics: SubjectiveMetric[]
  marketValueHistory: MarketValueHistoryEntry[]
  gpsData: GPSEntry[]
  gpsEntries: import('@/features/gps/types').GpsEntryRow[]
  gpsMetrics: import('@/features/gps/types').GpsMetric[]
  refreshGps: () => Promise<void>
  positionAverages: Record<string, number>
  agencyPlayers: import('@/constants/agencyPlayers').AgencyPlayer[]
  refreshAgencyPlayers: () => Promise<void>
  createManualPlayerAndRefresh: (row: import('@/services/manualExternalPlayersService').ManualExternalPlayerRow) => Promise<EnrichedPlayer>
  playerVideos: import('@/types/videos').PlayerVideo[]
  refreshPlayerVideos: () => Promise<void>
  videoFreshnessByKey: Map<string, import('@/types/videos').VideoFreshness>
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}
```

- [ ] **Step 2: Agregar los imports nuevos en `DataContext.tsx`**

Al inicio del archivo, junto a los imports de servicios existentes:

```ts
import { listManualExternalPlayers, createManualExternalPlayer, type ManualExternalPlayerRow } from '@/services/manualExternalPlayersService'
import { manualExternalToEnriched } from '@/features/coaches/manualExternalPlayer'
```

- [ ] **Step 3: Placeholder en el `useState` inicial de `data`**

Ubicar el `useState<AppData>({ ... })` inicial (línea ~1117) y agregar, junto a `refreshAgencyPlayers: async () => {}`:

```ts
    refreshAgencyPlayers: async () => {},
    createManualPlayerAndRefresh: async () => { throw new Error('Los datos todavía no cargaron') },
```

- [ ] **Step 4: Ref para el score lookup**

Junto a `baseInternalRef`/`externalRef` (línea ~1141), agregar una tercera ref para poder scorear una ficha manual creada después de la carga inicial (fuera del efecto donde vive `scoreLookup`):

```ts
  const baseInternalRef = useRef<EnrichedPlayer[]>([])
  const externalRef = useRef<EnrichedPlayer[]>([])
  const scoreLookupRef = useRef<Map<string, ScoreLookupEntry>>(new Map())
```

- [ ] **Step 5: `createManualPlayerAndRefresh`**

Junto a `refreshAgencyPlayers`/`refreshPlayerVideos` (después de `refreshPlayerVideos`, línea ~1157), agregar:

```ts
  const createManualPlayerAndRefresh = useCallback(async (row: ManualExternalPlayerRow): Promise<EnrichedPlayer> => {
    const saved = await createManualExternalPlayer(row)
    const score = scoreLookupRef.current.get(normalizeName(saved.full_name))?.score ?? null
    const enriched = manualExternalToEnriched(saved, score)
    externalRef.current = [...externalRef.current, enriched]
    setData(prev => ({
      ...prev,
      external: [...prev.external, enriched],
      internal: mergeAgencyIntoInternal(baseInternalRef.current, externalRef.current, prev.agencyPlayers),
    }))
    return enriched
  }, [])
```

- [ ] **Step 6: Guardar el score lookup en la ref**

Ubicar, dentro del efecto de carga, la línea (línea ~1196):

```ts
        const scoreLookup = await fetchScoreLookup().catch(() => new Map<string, ScoreLookupEntry>())
        if (cancelled) return
```

y agregar justo debajo del `if (cancelled) return`:

```ts
        scoreLookupRef.current = scoreLookup
```

- [ ] **Step 7: Fusionar las fichas manuales en `external`**

Ubicar el bloque (línea ~1199-1202):

```ts
        // Score and enrich external players with Transfermarkt data + Más Datos + Estimated values
        const externalScored = applyScoreGG(raw.external, 'externo', scoreLookup)
        const external = externalScored.map(p =>
          enrichWithEstimatedValue(enrichWithMasDatos(enrichWithTransfermarkt(p, tmMap), masDatosMap))
        )
```

y reemplazarlo por (renombra la variable intermedia a `externalBase` y arma `external` fusionando con las fichas manuales — el resto del archivo sigue usando el nombre `external` sin más cambios):

```ts
        // Score and enrich external players with Transfermarkt data + Más Datos + Estimated values
        const externalScored = applyScoreGG(raw.external, 'externo', scoreLookup)
        const externalBase = externalScored.map(p =>
          enrichWithEstimatedValue(enrichWithMasDatos(enrichWithTransfermarkt(p, tmMap), masDatosMap))
        )

        // Fichas creadas al vuelo desde el plantel de un entrenador (overlay en
        // Supabase, mismo espiritu que agencyPlayers para `internal`). Si el
        // Sheet legacy ya tiene a ese jugador por nombre, gana el Sheet.
        const manualRows = await listManualExternalPlayers().catch(() => [])
        const existingExternalNames = new Set(externalBase.map(p => normalizeName(p.Jugador)))
        const manualPlayers = manualRows
          .filter(r => !existingExternalNames.has(normalizeName(r.full_name)))
          .map(r => manualExternalToEnriched(r, scoreLookup.get(normalizeName(r.full_name))?.score ?? null))
        const external = [...externalBase, ...manualPlayers]
```

- [ ] **Step 8: Incluir la función nueva en el `setData` final**

Ubicar el objeto pasado a `setData({...})` al final del `.then()` de carga (línea ~1256) y agregar, junto a `refreshAgencyPlayers,`:

```ts
          refreshAgencyPlayers,
          createManualPlayerAndRefresh,
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 10: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 11: Commit**

```bash
git add src/types/index.ts src/context/DataContext.tsx
git commit -m "feat(entrenadores): fusiona fichas manuales de Externo en DataContext y agrega createManualPlayerAndRefresh"
```

---

## Task 6: `TeamRosterPanel.tsx` — secciones + jugadores clickeables

**Files:**
- Modify: `src/features/coaches/components/TeamRosterPanel.tsx`
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `groupSquadByPosition`, `POSITION_LABEL` (Task 4), `mapSquadPositionToSpanish` (Task 3), `useData` (`@/context/DataContext`, ya existe, ahora expone `createManualPlayerAndRefresh`), `makeAgencyMatcher` (`@/utils/agencyFilter`, ya existe), `normalizeName` (`@/utils/scoring`, ya existe).
- Produces: `TeamRosterPanel({ teamId, teamName }: { teamId: number; teamName: string })` — la prop `teamName` es nueva, la pasa `CoachDetailPage`.

- [ ] **Step 1: Reescribir `TeamRosterPanel.tsx`**

```tsx
// src/features/coaches/components/TeamRosterPanel.tsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchSquadCached, type SquadPlayer } from '@/services/footballApiService'
import { fetchSquadMinutes } from '@/services/coachService'
import { useData } from '@/context/DataContext'
import { makeAgencyMatcher } from '@/utils/agencyFilter'
import { normalizeName } from '@/utils/scoring'
import { groupSquadByPosition, POSITION_LABEL } from '@/features/coaches/squadGrouping'
import { mapSquadPositionToSpanish } from '@/features/coaches/manualExternalPlayer'
import type { EnrichedPlayer } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

interface PlayerLink {
  source: 'interno' | 'externo'
  name: string
}

const CARD_CLASSNAME = 'bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-3 sm:p-4 flex flex-col items-center text-center transition-transform duration-200 ease-apple hover:-translate-y-0.5 w-full'

function RosterPlayerCard({
  player,
  stats,
  link,
  creating,
  onCreateClick,
}: {
  player: SquadPlayer
  stats?: { minutes: number; matches: number }
  link: PlayerLink | null
  creating: boolean
  onCreateClick: () => void
}) {
  const content = (
    <>
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2 flex-shrink-0">
        {player.photo ? (
          <img
            src={player.photo}
            alt=""
            className="w-full h-full rounded-full object-cover ring-2 ring-apple-gray-200/60 dark:ring-apple-gray-700/40"
          />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-sm bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400 ring-2 ring-apple-gray-200/60 dark:ring-apple-gray-700/40">
            {initialsOf(player.name)}
          </div>
        )}
        {player.number != null && (
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-green text-apple-gray-900 text-2xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-apple-gray-800">
            {player.number}
          </span>
        )}
        {creating && (
          <div className="absolute inset-0 rounded-full bg-white/70 dark:bg-apple-gray-900/70 flex items-center justify-center">
            <span className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-apple-gray-800 dark:text-white leading-tight truncate w-full">
        {player.name}
      </p>
      <p className="text-2xs font-medium uppercase tracking-wide text-apple-gray-400 mt-0.5">
        {player.position ? POSITION_LABEL[player.position] ?? player.position : '—'}
      </p>
      {stats && (
        <span className="mt-1.5 text-2xs font-medium px-1.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green">
          {stats.minutes}' · {stats.matches} PJ (30d)
        </span>
      )}
    </>
  )

  if (link) {
    return (
      <Link to={`/jugador/${encodeURIComponent(link.name)}?source=${link.source}`} className={CARD_CLASSNAME}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onCreateClick}
      disabled={creating}
      className={`${CARD_CLASSNAME} disabled:cursor-wait`}
    >
      {content}
    </button>
  )
}

export default function TeamRosterPanel({ teamId, teamName }: { teamId: number; teamName: string }) {
  const [squad, setSquad] = useState<SquadPlayer[] | null>(null)
  const [minutes, setMinutes] = useState<Record<number, { minutes: number; matches: number }>>({})
  const [creatingId, setCreatingId] = useState<number | null>(null)
  const { internal, external, agencyPlayers, createManualPlayerAndRefresh } = useData()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    setSquad(null)
    setMinutes({})
    fetchSquadCached(teamId).then(async players => {
      if (!active) return
      setSquad(players)
      const ids = players.map(p => p.id)
      const m = await fetchSquadMinutes(ids)
      if (active) setMinutes(m)
    })
    return () => {
      active = false
    }
  }, [teamId])

  if (squad === null) return <LoadingSpinner message="Cargando plantel..." />
  if (squad.length === 0) return <EmptyState message="No se pudo cargar el plantel." />

  const isAgencyPlayer = makeAgencyMatcher(agencyPlayers)

  const resolveLink = (player: SquadPlayer): PlayerLink | null => {
    if (isAgencyPlayer(player.name)) {
      const match = internal.find((p: EnrichedPlayer) => normalizeName(p.Jugador) === normalizeName(player.name))
      if (match) return { source: 'interno', name: match.Jugador }
    }
    const extMatch = external.find((p: EnrichedPlayer) => normalizeName(p.Jugador) === normalizeName(player.name))
    if (extMatch) return { source: 'externo', name: extMatch.Jugador }
    return null
  }

  const handleCreate = async (player: SquadPlayer) => {
    if (creatingId !== null) return
    setCreatingId(player.id)
    try {
      const created = await createManualPlayerAndRefresh({
        api_player_id: player.id,
        full_name: player.name,
        team: teamName,
        position: mapSquadPositionToSpanish(player.position),
        age: player.age,
        photo: player.photo,
      })
      navigate(`/jugador/${encodeURIComponent(created.Jugador)}?source=externo`)
    } finally {
      setCreatingId(null)
    }
  }

  const groups = groupSquadByPosition(squad)

  return (
    <div className="space-y-6 animate-fade-in">
      {groups.map(group => (
        <div key={group.positionKey}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-apple-gray-400 mb-3">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {group.players.map(player => (
              <RosterPlayerCard
                key={player.id}
                player={player}
                stats={minutes[player.id]}
                link={resolveLink(player)}
                creating={creatingId === player.id}
                onCreateClick={() => void handleCreate(player)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Pasar `teamName` desde `CoachDetailPage.tsx`**

En `src/pages/CoachDetailPage.tsx`, ubicar las dos líneas que usan `TeamRosterPanel` (línea ~157-158):

```tsx
      {activeTab === 'plantel' && coach.apiTeamId && <TeamRosterPanel teamId={coach.apiTeamId} />}
      {activeTab === 'reserva' && coach.reserveApiTeamId && <TeamRosterPanel teamId={coach.reserveApiTeamId} />}
```

y reemplazarlas por (el plantel de reserva no tiene nombre propio en `AgencyCoach` — se arma a partir de `coach.club`, alcanza para el campo "Equipo" de una ficha creada al vuelo, no se usa para nada más):

```tsx
      {activeTab === 'plantel' && coach.apiTeamId && <TeamRosterPanel teamId={coach.apiTeamId} teamName={coach.club ?? ''} />}
      {activeTab === 'reserva' && coach.reserveApiTeamId && (
        <TeamRosterPanel teamId={coach.reserveApiTeamId} teamName={coach.club ? `${coach.club} (Reserva)` : 'Reserva'} />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/TeamRosterPanel.tsx src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): plantel agrupado por posicion con jugadores clickeables"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 12 nuevos de este plan (4 de `manualExternalPlayer.test.ts` + 4 de `squadGrouping.test.ts` + 4 heredados de la suite existente sin romperse).

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Avisar al usuario que corra la migración de Supabase**

`supabase/migrations/20260810_manual_external_players.sql` (Task 1) todavía no corrió en la base real — sin eso, `listManualExternalPlayers`/`createManualExternalPlayer` van a fallar en runtime (tabla inexistente). Mismo flujo que las migraciones anteriores de esta rama: el usuario la corre a mano en el SQL editor de Supabase.

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`, tab Plantel), con la migración ya corrida:
  - El plantel se ve agrupado en 4 secciones con encabezado (Arqueros/Defensores/Mediocampistas/Delanteros).
  - Clickear un jugador que es de Doble G lleva a su ficha interna.
  - Clickear un jugador que ya existe en Scouting Externo lleva a esa ficha.
  - Clickear un jugador sin match muestra un spinner breve en la tarjeta y navega a una ficha nueva en Externo con nombre/equipo/posición/edad/foto cargados y el resto vacío.
  - Volver al plantel y clickear ese mismo jugador de nuevo navega directo (ya no dispara una creación nueva).
