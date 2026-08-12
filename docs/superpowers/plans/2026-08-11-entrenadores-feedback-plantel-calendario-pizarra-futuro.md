# Entrenadores: feedback de Plantel, Calendario, Pizarra y Plantel futuro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver el feedback directo del usuario sobre 4 pestañas de la sección Entrenadores: Plantel (cards → lista), Calendario (escudos visibles en la grilla), Pizarra (prellenado automático 11v11 + fichas que no se apilan invisibles + herramientas simplificadas) y Plantel futuro (filtros reales en sugeridos, Score GG visible, texto explicativo en bajas).

**Architecture:** Cambios de presentación puros en Plantel y Calendario (sin tocar datos/lógica). En Pizarra, se extraen dos funciones puras nuevas y testeables (`mirrorFormationForRival`, `nextEmptySlotPosition`) a un archivo nuevo, siguiendo el mismo patrón ya usado por `futureSquadPrefill.ts`, y se reusa el prellenado de Plantel futuro (`fetchSeasonFixtures` + `fetchFixtureLineups` + `mapLineupToSlots`) para poblar la pizarra automáticamente la primera vez. En Plantel futuro, se extiende el picker existente con filtros sobre datos que la plataforma ya expone.

**Tech Stack:** React 18 + TypeScript, Vitest (TDD para las funciones puras nuevas), Tailwind CSS.

## Global Constraints

- Nunca usar emoji crudo como ícono — SVG dibujado a mano (convención ya establecida en toda la rama).
- Cada commit, mensaje en español, mismo estilo que el resto del repo.
- No tocar `tacticalBoardService.ts` más allá de: (a) agregar el campo `shape` a `ZoneAnnotation`, (b) permitir que `createTacticalBoard` reciba markers iniciales opcionales. No se cambia el esquema de `coach_tactical_boards` en Supabase (JSONB libre, sin migración necesaria).
- El sistema de coordenadas de `TacticalBoardPitch` y de `FORMATIONS` es el mismo: porcentaje 0-100 en ambos ejes. No confundir con el viewBox 0-130 que usa `/formacion` para otra cosa.
- La herramienta "Zona" sigue permitiendo rectángulos/elipses libres (no forzados a círculo/cuadrado perfecto) — "círculo o cuadrado" es la forma coloquial en que el usuario pidió elegir entre elipse y rectángulo.

---

### Task 1: Plantel — lista en vez de cards

**Files:**
- Modify: `src/features/coaches/components/TeamRosterPanel.tsx`

**Interfaces:**
- No cambia ninguna interfaz pública del componente (`TeamRosterPanel({ teamId, teamName })` sigue igual) — cambio puramente de presentación interna.

- [ ] **Step 1: Reemplazar `RosterPlayerCard` por `RosterPlayerRow`**

Ubicar el bloque completo de `const CARD_CLASSNAME = ...` hasta el cierre de la función `RosterPlayerCard` (líneas 46-133 actuales) y reemplazarlo por:

```tsx
const ROW_CLASSNAME = 'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-apple-gray-50 dark:hover:bg-apple-gray-800/60 transition-colors border-b border-apple-gray-100 dark:border-apple-gray-700/40 last:border-b-0'

function RosterPlayerRow({
  player,
  stats,
  link,
  creating,
  onCreateClick,
}: {
  player: SquadPlayer
  stats?: { minutes: number; matches: number }
  link: PlayerLink
  creating: boolean
  onCreateClick: () => void
}) {
  const content = (
    <>
      <div className="relative w-10 h-10 flex-shrink-0">
        {player.photo ? (
          <img
            src={player.photo}
            alt=""
            className="w-full h-full rounded-full object-cover ring-1 ring-apple-gray-200/60 dark:ring-apple-gray-700/40"
          />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-2xs bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400 ring-1 ring-apple-gray-200/60 dark:ring-apple-gray-700/40">
            {initialsOf(player.name)}
          </div>
        )}
        {creating && (
          <div className="absolute inset-0 rounded-full bg-white/70 dark:bg-apple-gray-900/70 flex items-center justify-center">
            <span className="w-3.5 h-3.5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{player.name}</p>
        <p className="text-2xs text-apple-gray-400">
          {player.position ? POSITION_LABEL[player.position] ?? player.position : '—'}
          {player.number != null && ` · #${player.number}`}
        </p>
      </div>
      {stats && (
        <span className="flex-shrink-0 text-2xs font-medium px-2 py-1 rounded-full bg-brand-green/10 text-brand-green">
          {stats.minutes}' · {stats.matches} PJ
        </span>
      )}
      {(link.kind === 'internal' || link.kind === 'external' || link.kind === 'supabase' || link.kind === 'create') && (
        <svg className="w-4 h-4 flex-shrink-0 text-apple-gray-300 dark:text-apple-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  )

  if (link.kind === 'internal' || link.kind === 'external') {
    const source = link.kind === 'internal' ? 'interno' : 'externo'
    return (
      <Link to={`/jugador/${encodeURIComponent(link.name)}?source=${source}`} className={ROW_CLASSNAME}>
        {content}
      </Link>
    )
  }

  if (link.kind === 'supabase') {
    return (
      <Link to={`/jugador/${encodeURIComponent(link.name)}?source=externo&apiId=${link.apiId}`} className={ROW_CLASSNAME}>
        {content}
      </Link>
    )
  }

  if (link.kind === 'create') {
    return (
      <button type="button" onClick={onCreateClick} disabled={creating} className={`${ROW_CLASSNAME} disabled:cursor-wait text-left`}>
        {content}
      </button>
    )
  }

  // link.kind === 'none': jugador de agencia sin match confiable, o datos todavía
  // cargando — fila no interactiva, nunca se ofrece crear un stub.
  return <div className={ROW_CLASSNAME}>{content}</div>
}
```

- [ ] **Step 2: Actualizar las referencias a `RosterPlayerCard` y el contenedor de grilla**

Ubicar (línea ~236-256 actuales, el `return` de `TeamRosterPanel`):

```tsx
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

y reemplazarlo por:

```tsx
  return (
    <div className="space-y-5 animate-fade-in">
      {groups.map(group => (
        <div key={group.positionKey}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-apple-gray-400 mb-2 px-1">
            {group.label}
          </h3>
          <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 overflow-hidden">
            {group.players.map(player => (
              <RosterPlayerRow
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

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificar visualmente en el navegador**

`npm run dev`, ir a `/entrenadores/domingo?tab=plantel`. Confirmar: lista de filas agrupada por posición, foto+nombre+dorsal+posición en una línea, hover visible, sigue navegando a la ficha del jugador al clickear (probar al menos un jugador con ficha real).

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/components/TeamRosterPanel.tsx
git commit -m "fix(entrenadores): Plantel como lista en vez de cards"
```

---

### Task 2: Calendario — escudo del rival visible en la grilla

**Files:**
- Modify: `src/features/coaches/components/CoachCalendarTab.tsx`

**Interfaces:**
- Sin cambios de interfaz — solo el contenido de la celda del día.

- [ ] **Step 1: Mostrar el escudo del rival en vez del puntito**

Ubicar (líneas ~213-226 actuales, dentro del `.map(cell => ...)`):

```tsx
              <span>{cell.dayNumber}</span>
              {cell.isCurrentMonth && (hasFixture || hasSession) && (
                <span className="flex items-center gap-0.5">
                  {hasFixture &&
                    (isAbroad ? (
                      <PlaneIcon className={`w-2.5 h-2.5 ${isSelected ? 'text-apple-gray-900' : 'text-brand-green'}`} />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900' : 'bg-brand-green'}`} />
                    ))}
                  {hasSession && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900/60' : 'bg-apple-gray-400'}`} />
                  )}
                </span>
              )}
```

y reemplazarlo por:

```tsx
              <span>{cell.dayNumber}</span>
              {cell.isCurrentMonth && (hasFixture || hasSession) && (
                <span className="flex items-center gap-0.5">
                  {hasFixture && day!.fixtures.length === 1 && (
                    isAbroad ? (
                      <PlaneIcon className={`w-3 h-3 ${isSelected ? 'text-apple-gray-900' : 'text-brand-green'}`} />
                    ) : (
                      <img
                        src={(day!.fixtures[0].isHome ? day!.fixtures[0].awayTeam : day!.fixtures[0].homeTeam).logo}
                        alt=""
                        className="w-3.5 h-3.5 object-contain"
                      />
                    )
                  )}
                  {hasFixture && day!.fixtures.length > 1 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900' : 'bg-brand-green'}`} />
                  )}
                  {hasSession && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900/60' : 'bg-apple-gray-400'}`} />
                  )}
                </span>
              )}
```

(`day` ya está declarado más arriba en el `.map` como `const day = eventsByDate.get(cell.date)` — el `!` es seguro acá porque está dentro del `hasFixture &&`, que ya implica `!!day`.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificar visualmente en el navegador**

`/entrenadores/domingo?tab=calendario`. Confirmar que los días con partido muestran el escudo del rival directo en la celda del calendario, sin tener que clickear. Confirmar que un día con viaje al exterior sigue mostrando el avión, y que el panel de abajo (al clickear un día) sigue funcionando igual que antes.

- [ ] **Step 4: Commit**

```bash
git add src/features/coaches/components/CoachCalendarTab.tsx
git commit -m "fix(entrenadores): escudo del rival visible en la grilla del calendario"
```

---

### Task 3: `tacticalBoardPrefill.ts` — mirror de formación para el rival + próximo slot vacío

**Files:**
- Create: `src/features/coaches/tacticalBoardPrefill.ts`
- Test: `src/features/coaches/tacticalBoardPrefill.test.ts`

**Interfaces:**
- Consumes: `FORMATIONS` (`@/constants/formations`); `BoardMarker`, `MarkerTeam` (`@/services/tacticalBoardService`, tipos).
- Produces: `export function mirrorFormationForRival(formationType: string): { x: number; y: number }[]` — posiciones del rival (mismas `x`, `y: 100 - y`, mismo orden que `FORMATIONS[formationType].positions`); `export function nextMarkerPosition(existingMarkers: { team: MarkerTeam | null; x: number; y: number }[], team: MarkerTeam, formationType: string): { x: number; y: number }` — próxima posición para una ficha nueva del equipo dado: el primer slot de `FORMATIONS[formationType]` (propio) o su espejo (rival) que no tenga ya una ficha de ese equipo a menos de 3% de distancia; si los 11 slots están ocupados, cae a una cascada (`x: 50 + (n % 5) * 6, y: 50 + Math.floor(n / 5) * 6`, con `n` = cantidad de fichas ya existentes de ese equipo).

- [ ] **Step 1: Escribir el test que falla primero**

```ts
// src/features/coaches/tacticalBoardPrefill.test.ts
import { describe, expect, it } from 'vitest'
import { mirrorFormationForRival, nextMarkerPosition } from './tacticalBoardPrefill'

describe('mirrorFormationForRival', () => {
  it('refleja el eje Y de cada posicion de la formacion, mismo orden', () => {
    const mirrored = mirrorFormationForRival('4-3-3')
    // 4-3-3 real: GK es la primera posicion, x:50 y:92 (cerca del arco propio, abajo)
    expect(mirrored[0]).toEqual({ x: 50, y: 8 })
    // ST (delantero) x:50 y:20 (cerca del arco rival, arriba) -> reflejado queda
    // cerca del arco PROPIO (abajo), como corresponde a un delantero rival que ataca.
    const stIndex = 9 // orden de FORMATIONS['4-3-3'].positions: GK,LB,CB1,CB2,RB,CM1,CM2,CM3,LW,ST,RW
    expect(mirrored[stIndex]).toEqual({ x: 50, y: 80 })
  })

  it('formacion desconocida cae a 4-3-3', () => {
    const mirrored = mirrorFormationForRival('4-1-4-1')
    expect(mirrored).toHaveLength(11)
  })
})

describe('nextMarkerPosition', () => {
  it('sin fichas propias, la primera va al primer slot de la formacion (GK)', () => {
    const pos = nextMarkerPosition([], 'propio', '4-3-3')
    expect(pos).toEqual({ x: 50, y: 92 })
  })

  it('con el slot de GK ya ocupado, la siguiente ficha propia va al segundo slot (LB)', () => {
    const existing = [{ team: 'propio' as const, x: 50, y: 92 }]
    const pos = nextMarkerPosition(existing, 'propio', '4-3-3')
    expect(pos).toEqual({ x: 15, y: 72 })
  })

  it('las fichas de rival no bloquean los slots de propio', () => {
    const existing = [{ team: 'rival' as const, x: 50, y: 92 }]
    const pos = nextMarkerPosition(existing, 'propio', '4-3-3')
    expect(pos).toEqual({ x: 50, y: 92 })
  })

  it('con los 11 slots propios ocupados, cae a cascada sin repetir la misma posicion', () => {
    const existing = FORMATIONS_4_3_3_POSITIONS.map(p => ({ team: 'propio' as const, x: p.x, y: p.y }))
    const pos = nextMarkerPosition(existing, 'propio', '4-3-3')
    expect(pos).toEqual({ x: 50, y: 50 })
  })
})

const FORMATIONS_4_3_3_POSITIONS = [
  { x: 50, y: 92 }, { x: 15, y: 72 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 72 },
  { x: 30, y: 50 }, { x: 50, y: 55 }, { x: 70, y: 50 }, { x: 18, y: 25 }, { x: 50, y: 20 }, { x: 82, y: 25 },
]
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/features/coaches/tacticalBoardPrefill.test.ts`
Expected: FAIL con "Cannot find module './tacticalBoardPrefill'"

- [ ] **Step 3: Implementar las funciones**

```ts
// src/features/coaches/tacticalBoardPrefill.ts
import { FORMATIONS } from '@/constants/formations'
import type { MarkerTeam } from '@/services/tacticalBoardService'

export function mirrorFormationForRival(formationType: string): { x: number; y: number }[] {
  const resolved = FORMATIONS[formationType] ? formationType : '4-3-3'
  return FORMATIONS[resolved].positions.map(p => ({ x: p.x, y: 100 - p.y }))
}

const CLOSE_ENOUGH_PCT = 3

export function nextMarkerPosition(
  existingMarkers: { team: MarkerTeam | null; x: number; y: number }[],
  team: MarkerTeam,
  formationType: string,
): { x: number; y: number } {
  const resolved = FORMATIONS[formationType] ? formationType : '4-3-3'
  const ownSlots = FORMATIONS[resolved].positions.map(p => ({ x: p.x, y: p.y }))
  const rivalSlots = mirrorFormationForRival(resolved)
  const slots = team === 'propio' ? ownSlots : rivalSlots

  const sameTeam = existingMarkers.filter(m => m.team === team)

  const isOccupied = (slot: { x: number; y: number }) =>
    sameTeam.some(m => Math.abs(m.x - slot.x) < CLOSE_ENOUGH_PCT && Math.abs(m.y - slot.y) < CLOSE_ENOUGH_PCT)

  const freeSlot = slots.find(slot => !isOccupied(slot))
  if (freeSlot) return freeSlot

  // Los 11 slots de la formacion ya estan ocupados por este equipo: cascada para
  // que nunca dos fichas nuevas caigan exactamente superpuestas (invisibles).
  const n = sameTeam.length
  return { x: 50 + (n % 5) * 6, y: 50 + Math.floor(n / 5) * 6 }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/features/coaches/tacticalBoardPrefill.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/tacticalBoardPrefill.ts src/features/coaches/tacticalBoardPrefill.test.ts
git commit -m "feat(entrenadores): funciones puras de prellenado de pizarra (espejo de formacion + proximo slot libre)"
```

---

### Task 4: Prellenado automático de la Pizarra + fichas que no se apilan invisibles

**Files:**
- Modify: `src/features/coaches/components/CoachTacticalBoardTab.tsx`
- Modify: `src/services/tacticalBoardService.ts` (Step 1)

**Interfaces:**
- Consumes: `mirrorFormationForRival`, `nextMarkerPosition` (Task 3); `mapLineupToSlots`, `LineupPlayerForPrefill` (`@/features/coaches/futureSquadPrefill`, ya existe); `fetchSquadCached`, `fetchSeasonFixtures`, `fetchFixtureLineups` (`@/services/footballApiService`, ya existen, mismo patrón que `CoachFutureSquadTab.tsx`).

- [ ] **Step 1: Permitir que `createTacticalBoard` reciba markers iniciales**

En `src/services/tacticalBoardService.ts`, ubicar:

```ts
export async function createTacticalBoard(coachKey: string, name: string): Promise<TacticalBoard | null> {
  const { data, error } = await supabase
    .from('coach_tactical_boards')
    .insert({ coach_key: coachKey, name, markers: [], annotations: [] })
    .select()
    .single()
```

y reemplazarlo por:

```ts
export async function createTacticalBoard(
  coachKey: string,
  name: string,
  initialMarkers: BoardMarker[] = [],
): Promise<TacticalBoard | null> {
  const { data, error } = await supabase
    .from('coach_tactical_boards')
    .insert({ coach_key: coachKey, name, markers: initialMarkers, annotations: [] })
    .select()
    .single()
```

- [ ] **Step 2: Calcular el prellenado automático y auto-crear la primera pizarra**

En `src/features/coaches/components/CoachTacticalBoardTab.tsx`, agregar los imports nuevos (junto a los existentes):

```ts
import { mirrorFormationForRival, nextMarkerPosition } from '@/features/coaches/tacticalBoardPrefill'
import { mapLineupToSlots, type LineupPlayerForPrefill } from '@/features/coaches/futureSquadPrefill'
import { fetchSeasonFixtures, fetchFixtureLineups } from '@/services/footballApiService'
import { isMatchFinished } from '@/utils/coachCalendar'
import type { BoardMarker } from '@/services/tacticalBoardService'
```

Agregar, antes del componente `CoachTacticalBoardTab`, la función que arma los 22 markers de arranque (mismo patrón de `buildPrefill` en `CoachFutureSquadTab.tsx`, pero devolviendo `BoardMarker[]` con `team`/`kind` en vez de `FutureSquadSlot[]`):

```ts
async function buildDefaultBoardMarkers(coach: AgencyCoach): Promise<BoardMarker[]> {
  const markers: BoardMarker[] = []
  let formationType = '4-3-3'
  let ownStartXI: LineupPlayerForPrefill[] = []

  if (coach.apiTeamId && coach.leagueSeason) {
    const fixtures = await fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason)
    const lastPlayed = fixtures.filter(f => isMatchFinished(f.statusShort)).sort((a, b) => b.timestamp - a.timestamp)[0]
    if (lastPlayed) {
      const lineups = await fetchFixtureLineups(lastPlayed.fixtureId)
      const ownLineup = lineups.find(l => l.team.id === coach.apiTeamId)
      if (ownLineup) {
        formationType = ownLineup.formation ?? '4-3-3'
        ownStartXI = ownLineup.startXI.map(({ player }) => ({ id: player.id, name: player.name, number: player.number }))
      }
    }
  }

  const { formationType: resolvedFormation, slots } = mapLineupToSlots(ownStartXI, formationType)
  for (const slot of slots) {
    if (slot.source !== 'squad' || slot.playerId === null) continue
    markers.push({
      id: crypto.randomUUID(),
      kind: 'player',
      team: 'propio',
      label: slot.playerNumber != null ? String(slot.playerNumber) : (slot.playerName ?? '').split(' ').slice(-1)[0],
      playerId: slot.playerId as number,
      x: FORMATIONS[resolvedFormation].positions.find(p => p.key === slot.slotKey)!.x,
      y: FORMATIONS[resolvedFormation].positions.find(p => p.key === slot.slotKey)!.y,
    })
  }

  const rivalPositions = mirrorFormationForRival(resolvedFormation)
  rivalPositions.forEach((pos, i) => {
    markers.push({
      id: crypto.randomUUID(),
      kind: 'generic',
      team: 'rival',
      label: String(i + 1),
      playerId: null,
      x: pos.x,
      y: pos.y,
    })
  })

  return markers
}
```

Agregar el import de `FORMATIONS` (`@/constants/formations`) junto a los demás.

- [ ] **Step 3: Auto-crear la pizarra por defecto cuando no hay ninguna guardada**

Ubicar el `useEffect` que carga las pizarras (líneas ~98-106 actuales):

```ts
  useEffect(() => {
    let active = true
    listTacticalBoards(coach.key).then(b => {
      if (active) setBoards(b)
    })
    return () => {
      active = false
    }
  }, [coach.key])
```

y reemplazarlo por:

```ts
  useEffect(() => {
    let active = true
    listTacticalBoards(coach.key).then(async b => {
      if (!active) return
      if (b.length > 0) {
        setBoards(b)
        return
      }
      // Primera vez sin ninguna pizarra guardada: se arma y se muestra una por
      // defecto con los 11 propios reales + 11 rivales genericos, sin que el
      // usuario tenga que crear ni nombrar nada primero.
      const markers = await buildDefaultBoardMarkers(coach)
      if (!active) return
      const board = await createTacticalBoard(coach.key, 'Titular', markers)
      if (!active) return
      if (board) {
        setCurrent(board)
        setMarkers(board.markers)
        setAnnotations(board.annotations)
        setSavedSnapshot(JSON.stringify({ markers: board.markers, annotations: board.annotations }))
        setBoards([board])
      } else {
        // No se pudo crear (migracion no corrida, etc.) -- se cae al estado vacio
        // de siempre, con los botones Nueva/Cargar disponibles.
        setBoards([])
      }
    })
    return () => {
      active = false
    }
  }, [coach.key])
```

- [ ] **Step 4: Usar `nextMarkerPosition` en vez de `x: 50, y: 50` fijo**

Ubicar (líneas ~187-216 actuales):

```ts
  function addGenericMarker() {
    const count = markers.filter(m => m.kind === 'generic' && m.team === markerTeam).length
    // x/y en 0-100 sobre ambos ejes (mismo sistema que las anotaciones en TacticalBoardPitch,
    // no el viewBox 0-130 de FormationPage): 50/50 es el centro real de esta cancha.
    setMarkers([
      ...markers,
      { id: uid(), kind: 'generic', team: markerTeam, label: String(count + 1), playerId: null, x: 50, y: 50 },
    ])
  }

  function addPlayerMarker(player: SquadPlayer) {
    setMarkers([
      ...markers,
      {
        id: uid(),
        kind: 'player',
        team: 'propio',
        label: player.number != null ? String(player.number) : player.name.split(' ').slice(-1)[0],
        playerId: player.id,
        x: 50,
        y: 50,
      },
    ])
    setShowPlayerPicker(false)
  }

  function addBallMarker() {
    if (markers.some(m => m.kind === 'ball')) return
    setMarkers([...markers, { id: uid(), kind: 'ball', team: null, label: '', playerId: null, x: 50, y: 50 }])
  }
```

y reemplazarlo por:

```ts
  function addGenericMarker() {
    const count = markers.filter(m => m.kind === 'generic' && m.team === markerTeam).length
    const pos = nextMarkerPosition(markers, markerTeam, '4-3-3')
    setMarkers([
      ...markers,
      { id: uid(), kind: 'generic', team: markerTeam, label: String(count + 1), playerId: null, x: pos.x, y: pos.y },
    ])
  }

  function addPlayerMarker(player: SquadPlayer) {
    const pos = nextMarkerPosition(markers, 'propio', '4-3-3')
    setMarkers([
      ...markers,
      {
        id: uid(),
        kind: 'player',
        team: 'propio',
        label: player.number != null ? String(player.number) : player.name.split(' ').slice(-1)[0],
        playerId: player.id,
        x: pos.x,
        y: pos.y,
      },
    ])
    setShowPlayerPicker(false)
  }

  function addBallMarker() {
    if (markers.some(m => m.kind === 'ball')) return
    // La pelota no compite por slots de formacion -- un unico punto neutral cerca
    // del centro, pero no exactamente sobre el circulo central (mas facil de
    // distinguir de una ficha si alguna cae cerca).
    setMarkers([...markers, { id: uid(), kind: 'ball', team: null, label: '', playerId: null, x: 50, y: 46 }])
  }
```

(Nota: `nextMarkerPosition` usa siempre `'4-3-3'` como formación de referencia para las fichas agregadas manualmente después del prellenado inicial — es una simplificación deliberada: el prellenado automático (Step 3) sí usa la formación real detectada, pero una vez que el usuario ya está editando la pizarra a mano, cualquier formación fija sirve solo como grilla de referencia para no apilar fichas, no como restricción real.)

- [ ] **Step 5: Sacar el estado vacío viejo (ya no aplica en el primer ingreso, pero sigue aplicando si el usuario borra todas sus pizarras)**

El bloque `{current ? (...) : (<div>...Creá una pizarra nueva...</div>)}` (líneas ~299-329 actuales) se deja igual — sigue siendo el fallback correcto para cuando el usuario borra manualmente todas sus pizarras guardadas (caso legítimo, no se fuerza contenido en ese caso).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Verificar visualmente en el navegador**

Importante: para probar el auto-prellenado hace falta un entrenador SIN pizarras guardadas todavía. Si Nicolás Domingo ya tiene una pizarra de pruebas de esta sesión, borrarla primero desde "Cargar" → "Borrar", o probar con Stillitano (`/entrenadores/stillitano`) si nunca se le creó una. Confirmar: al entrar a la pestaña sin pizarras, aparece automáticamente una cancha con 11 fichas propias reales (nombres del último partido, en formación) + 11 fichas rivales genéricas del lado opuesto, sin haber tocado "Nueva". Confirmar que agregar una ficha manual nueva (+ Ficha, + Jugador) aparece en un lugar distinto a las existentes, nunca invisible/superpuesta.

- [ ] **Step 8: Commit**

```bash
git add src/services/tacticalBoardService.ts src/features/coaches/components/CoachTacticalBoardTab.tsx
git commit -m "feat(entrenadores): pizarra se prellena sola con 11 propios reales + 11 rivales, fichas nuevas no se apilan invisibles"
```

---

### Task 5: Pizarra — Zona con forma círculo/cuadrado, sacar Texto, pelota más reconocible

**Files:**
- Modify: `src/services/tacticalBoardService.ts`
- Modify: `src/features/coaches/components/TacticalBoardToolbar.tsx`
- Modify: `src/features/coaches/components/TacticalBoardPitch.tsx`

**Interfaces:**
- `ZoneAnnotation` gana el campo `shape: 'circulo' | 'cuadrado'`.
- `TacticalBoardPitch`'s prop `tool: BoardTool` pierde el valor `'texto'` (union queda `'mover' | 'lapiz' | 'flecha' | 'zona'`).

- [ ] **Step 1: Agregar `shape` a `ZoneAnnotation`**

En `src/services/tacticalBoardService.ts`, ubicar:

```ts
export interface ZoneAnnotation     { id: string; kind: 'zone';     color: AnnotationColor; x1: number; y1: number; x2: number; y2: number }
```

y reemplazarlo por:

```ts
export type ZoneShape = 'circulo' | 'cuadrado'
export interface ZoneAnnotation     { id: string; kind: 'zone';     color: AnnotationColor; x1: number; y1: number; x2: number; y2: number; shape: ZoneShape }
```

- [ ] **Step 2: Sacar `'texto'` de `BoardTool` y todo su manejo en `TacticalBoardPitch.tsx`**

Ubicar (línea 6 actual):

```ts
export type BoardTool = 'mover' | 'lapiz' | 'flecha' | 'zona' | 'texto'
```

y reemplazarlo por:

```ts
export type BoardTool = 'mover' | 'lapiz' | 'flecha' | 'zona'
```

Sacar del componente `TacticalBoardPitch`:
- Los estados `textInput`/`setTextInput` y `textValue`/`setTextValue` (líneas ~47-48 actuales).
- La función `commitText` completa (líneas ~185-194 actuales).
- El bloque `if (tool === 'texto') { ... }` dentro de `handleContainerPointerDown` (líneas ~105-112 actuales) — el resto de la función sigue igual.
- El `<input>` de texto en progreso al final del JSX (líneas ~335-346 actuales, el bloque `{textInput && (<input ... />)}`).
- En el `onMouseDown` del contenedor (líneas ~206-215 actuales), sacar el `if (tool === 'texto') e.preventDefault()` — todo ese `onMouseDown` handler queda sin usar y se puede sacar entero si no hace nada más (confirmar leyendo el archivo completo antes de sacarlo, por si se agregó algo más ahí en el camino).

El caso `kind === 'text'` dentro del `.map(a => {...})` de anotaciones (líneas ~278-282 actuales, el `<text>` final del switch) se deja intacto — pizarras guardadas antes de este cambio pueden tener anotaciones de texto ya creadas, siguen renderizándose, simplemente no se pueden crear nuevas.

- [ ] **Step 3: Agregar el selector de forma cuando la herramienta es "Zona", pasar `shape` al crear**

En `TacticalBoardPitch.tsx`, agregar un estado nuevo `const [zoneShape, setZoneShape] = useState<ZoneShape>('circulo')` (importar `ZoneShape` desde `@/services/tacticalBoardService`) y recibirlo como prop en vez de estado local — más simple: subir el estado al padre igual que `tool`/`color`, ya que el toolbar necesita mostrarlo y cambiarlo.

Agregar la prop `zoneShape: ZoneShape` y `onZoneShapeChange: (shape: ZoneShape) => void` a `TacticalBoardPitch`, y usar `zoneShape` en vez de un valor fijo al crear la anotación de zona (dentro de `handleContainerPointerUp`, el bloque `else if (tool === 'zona' && dragStart && dragCurrent)`):

```ts
    } else if (tool === 'zona' && dragStart && dragCurrent) {
      if (Math.abs(dragCurrent.x - dragStart.x) > 1 || Math.abs(dragCurrent.y - dragStart.y) > 1) {
        onAnnotationsChange([
          ...annotations,
          { id: uid(), kind: 'zone', color, x1: dragStart.x, y1: dragStart.y, x2: dragCurrent.x, y2: dragCurrent.y, shape: zoneShape },
        ])
      }
      setDragStart(null)
      setDragCurrent(null)
    }
```

Y en el render de zonas (tanto la ya confirmada como el preview en progreso), condicionar `<ellipse>` vs `<rect>` según `a.shape`/`zoneShape`:

```tsx
            if (a.kind === 'zone') {
              const cx = (a.x1 + a.x2) / 2
              const cy = (a.y1 + a.y2) / 2
              const rx = Math.abs(a.x2 - a.x1) / 2
              const ry = Math.abs(a.y2 - a.y1) / 2
              return a.shape === 'cuadrado' ? (
                <rect
                  key={a.id}
                  x={Math.min(a.x1, a.x2)}
                  y={Math.min(a.y1, a.y2)}
                  width={Math.abs(a.x2 - a.x1)}
                  height={Math.abs(a.y2 - a.y1)}
                  fill={COLOR_META[a.color].hex}
                  fillOpacity="0.25"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="0.5"
                />
              ) : (
                <ellipse
                  key={a.id}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill={COLOR_META[a.color].hex}
                  fillOpacity="0.25"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="0.5"
                />
              )
            }
```

Aplicar el mismo condicional `shape` en el preview en progreso (`{dragStart && dragCurrent && tool === 'zona' && (...)}`, usando `zoneShape` en vez de `a.shape` ya que todavía no es una anotación confirmada).

- [ ] **Step 4: Toolbar — sacar "Texto" del listado de herramientas, agregar selector círculo/cuadrado**

En `TacticalBoardToolbar.tsx`, ubicar:

```ts
const TOOL_META: { id: BoardTool; label: string }[] = [
  { id: 'mover', label: 'Mover' },
  { id: 'lapiz', label: 'Lápiz' },
  { id: 'flecha', label: 'Flecha' },
  { id: 'zona', label: 'Zona' },
  { id: 'texto', label: 'Texto' },
]
```

y sacar la última línea (`{ id: 'texto', label: 'Texto' }`).

Agregar las props `zoneShape`/`onZoneShapeChange` a la firma del componente, y agregar el selector de forma junto al selector de color, visible solo cuando `tool === 'zona'`:

```tsx
      {tool === 'zona' && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onZoneShapeChange('circulo')}
            aria-label="Zona circular"
            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${zoneShape === 'circulo' ? 'border-brand-green' : 'border-apple-gray-200 dark:border-apple-gray-600'}`}
          >
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current text-apple-gray-500 dark:text-apple-gray-400" />
          </button>
          <button
            type="button"
            onClick={() => onZoneShapeChange('cuadrado')}
            aria-label="Zona rectangular"
            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${zoneShape === 'cuadrado' ? 'border-brand-green' : 'border-apple-gray-200 dark:border-apple-gray-600'}`}
          >
            <span className="w-3.5 h-3.5 border-2 border-current text-apple-gray-500 dark:text-apple-gray-400" />
          </button>
        </div>
      )}
```

- [ ] **Step 5: Enganchar el estado de `zoneShape` en `CoachTacticalBoardTab.tsx`**

Agregar `const [zoneShape, setZoneShape] = useState<ZoneShape>('circulo')` (importar `ZoneShape` desde `@/services/tacticalBoardService`) y pasar `zoneShape`/`onZoneShapeChange={setZoneShape}` tanto a `TacticalBoardToolbar` como a `TacticalBoardPitch`.

- [ ] **Step 6: Pelota más reconocible**

En `TacticalBoardPitch.tsx`, ubicar la función `BallIcon` actual (líneas ~17-24) y reemplazarla por un dibujo más grueso y simple (menos líneas de costura, pentágono central sólido):

```tsx
function BallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="white" stroke="#111827" strokeWidth="1.5" />
      <polygon points="12,7 15.5,9.5 14.2,13.5 9.8,13.5 8.5,9.5" fill="#111827" />
      <path d="M12 7V4.5M8.5 9.5 5.7 7.5M15.5 9.5l2.8-2M9.8 13.5l-1.6 3.8M14.2 13.5l1.6 3.8" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Verificar visualmente en el navegador**

Confirmar: la herramienta "Texto" ya no aparece en la barra; elegir "Zona" muestra el selector círculo/cuadrado, dibujar una zona con cada forma se ve correctamente (elipse vs. rectángulo); la ficha de pelota se distingue claramente como pelota a tamaño real en la cancha, no como una mancha de líneas.

- [ ] **Step 9: Commit**

```bash
git add src/services/tacticalBoardService.ts src/features/coaches/components/TacticalBoardToolbar.tsx src/features/coaches/components/TacticalBoardPitch.tsx src/features/coaches/components/CoachTacticalBoardTab.tsx
git commit -m "fix(entrenadores): pizarra con zona circulo/cuadrado, sin herramienta de texto, pelota mas reconocible"
```

---

### Task 6: Plantel futuro — filtros en Sugeridos, Score GG en Plantel, explicar Bajas planificadas

**Files:**
- Modify: `src/features/coaches/components/FutureSquadPlayerPicker.tsx`
- Modify: `src/features/coaches/components/CoachFutureSquadTab.tsx`

**Interfaces:**
- Sin cambios de interfaz pública de `FutureSquadPlayerPicker` (mismas props) — los filtros son estado interno del componente.

- [ ] **Step 1: Agregar filtros de liga y valor de mercado a "Sugeridos"**

En `FutureSquadPlayerPicker.tsx`, agregar estado nuevo junto a los existentes (`searchQuery`, etc.):

```ts
const [suggestedLeagueId, setSuggestedLeagueId] = useState<number | null>(null)
const [suggestedMaxValue, setSuggestedMaxValue] = useState<number | null>(null)
```

Ubicar la llamada actual a `usePlayersList` para sugeridos:

```ts
  const { players: suggestionPool, loading: suggestionsLoading } = usePlayersList(
    activeTab === 'sugeridos' && allowedPositions.length > 0
      ? { positions: allowedPositions, pageSize: 200 }
      : { pageSize: 0 },
  )
```

y reemplazarla por:

```ts
  const { players: suggestionPool, loading: suggestionsLoading } = usePlayersList(
    activeTab === 'sugeridos' && allowedPositions.length > 0
      ? {
          positions: allowedPositions,
          pageSize: 200,
          league_id: suggestedLeagueId ?? undefined,
          max_market_value: suggestedMaxValue ?? undefined,
        }
      : { pageSize: 0 },
  )
```

Agregar, dentro del bloque `activeTab === 'sugeridos'` del render (antes de la lista de `suggestions`), una fila de filtros compacta:

```tsx
<div className="flex flex-wrap gap-2 mb-3">
  <select
    value={suggestedLeagueId ?? ''}
    onChange={e => setSuggestedLeagueId(e.target.value ? Number(e.target.value) : null)}
    className="min-h-[32px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 text-2xs text-apple-gray-700 dark:text-apple-gray-300"
  >
    <option value="">Todas las ligas</option>
    {/* opciones a completar con las ligas ya disponibles en la plataforma -- ver Step 2 */}
  </select>
  <select
    value={suggestedMaxValue ?? ''}
    onChange={e => setSuggestedMaxValue(e.target.value ? Number(e.target.value) : null)}
    className="min-h-[32px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 text-2xs text-apple-gray-700 dark:text-apple-gray-300"
  >
    <option value="">Cualquier valor</option>
    <option value="500000">Hasta 500.000 €</option>
    <option value="1000000">Hasta 1.000.000 €</option>
    <option value="5000000">Hasta 5.000.000 €</option>
  </select>
</div>
```

- [ ] **Step 2: Poblar el selector de liga**

Buscar en el codebase cómo se listan las ligas con datos disponibles en otro selector ya existente de la plataforma (ej. filtros de Búsqueda de Talento) y reusar el mismo mecanismo (hook o consulta directa a la tabla `leagues` con `has_player_stats = true`, `select id, name`). Si ya existe un hook (`useLeagues` o similar), importarlo y usarlo para las `<option>` del selector de liga. Si no existe, agregar una consulta simple con `useEffect` + `supabase.from('leagues').select('id, name').eq('has_player_stats', true).order('name')` directamente en este componente — no hace falta un hook nuevo compartido si es la única pantalla que lo necesita por ahora.

- [ ] **Step 3: Filtro de país (client-side)**

Agregar `const [suggestedCountry, setSuggestedCountry] = useState<string | null>(null)`, un tercer `<select>` con las nacionalidades presentes en `suggestionPool` (`[...new Set(suggestionPool.map(p => p.nationality).filter(Boolean))].sort()`), y aplicar el filtro sobre `suggestions` (la lista ya derivada de `suggestionPool` vía `useMemo`) agregando la condición `(!suggestedCountry || p.nationality === suggestedCountry)` al `.filter(...)` existente.

- [ ] **Step 4: Score GG en la pestaña "Plantel"**

Ubicar el render de la pestaña "Plantel" (el `.map(p => ...)` sobre `availableSquad`) y agregar, junto al texto de posición/dorsal, el Score GG si el jugador ya tiene una fila conocida. Para esto, traer (con `usePlayersList` acotado por búsqueda de nombre exacto, o cruzando contra `suggestionPool`/una consulta separada por `apiId`) el `primary_score` de cada jugador del plantel — si no está disponible de forma simple sin una consulta nueva por jugador, usar `getScoreColorClass` sobre el valor si existe y mostrar "—" si no. Mantener esto simple: no bloquear el render de la pestaña "Plantel" esperando esta consulta — se puede mostrar el score de forma progresiva (undefined mientras carga, número cuando llega).

- [ ] **Step 5: Explicar "Bajas planificadas"**

En `CoachFutureSquadTab.tsx`, ubicar el encabezado `<h3>Bajas planificadas</h3>` (dentro de la sección correspondiente) y agregar debajo una línea de ayuda:

```tsx
<h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">Bajas planificadas</h3>
<p className="text-2xs text-apple-gray-400 mb-3">
  Jugadores que salen del plantel: se agregan solos al sacar a alguien de la cancha, o podés anotar el motivo acá.
</p>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Verificar visualmente en el navegador**

`/entrenadores/domingo?tab=plantel_futuro`, abrir el selector de un slot: confirmar filtros de liga/valor/país en "Sugeridos" (probar que realmente acotan la lista), confirmar que "Plantel" muestra algo de Score GG (o "—"), y que "Bajas planificadas" ahora tiene el texto explicativo.

- [ ] **Step 8: Commit**

```bash
git add src/features/coaches/components/FutureSquadPlayerPicker.tsx src/features/coaches/components/CoachFutureSquadTab.tsx
git commit -m "fix(entrenadores): plantel futuro con filtros reales en sugeridos, Score GG en plantel, explica bajas planificadas"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test` (o `npx vitest run`)
Expected: todos los tests en verde, incluidos los nuevos de `tacticalBoardPrefill.test.ts`.

- [ ] **Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Verificación visual completa en el navegador, con `npm run dev`:**
  - Plantel: lista, no cards.
  - Calendario: escudos visibles en la grilla sin clickear.
  - Notas de partidos: "Fase defensiva"/"Fase ofensiva"/"Fase de transiciones", sin placeholders.
  - Pizarra: entra ya armada con 11+11, agregar fichas nuevas no las apila invisibles, Zona con círculo/cuadrado, sin herramienta de Texto, pelota reconocible.
  - Plantel futuro: Sugeridos con filtros funcionando, Score GG visible en Plantel, Bajas planificadas con explicación.
