# Entrenadores — Armado de plantel a futuro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pestaña nueva "Plantel futuro" en la ficha del entrenador: cancha con la formación real del equipo (prellenada desde el último partido vía API-Football), donde el DT marca bajas y agrega altas (buscador sobre toda la base de scouting), con un plan único guardado por entrenador.

**Architecture:** Reuso del set de formaciones de `/formacion` (extraído a una constante compartida) con su mismo patrón real de interacción — **posiciones fijas por formación + click abre un modal de selección** (no arrastre libre; se corrige la asunción de la spec original tras revisar el código real de `FormationPage.tsx`, que no usa drag). Prellenado automático la primera vez desde `fetchFixtureLineups` del último partido jugado. Persistencia en tabla nueva `coach_future_squads`, una fila por entrenador (upsert).

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + RLS), `usePlayersList` (scouting DB existente), `fetchSquadCached`/`fetchSeasonFixtures`/`fetchFixtureLineups` (API-Football, ya existen).

## Global Constraints

- Coordenadas de las fichas en la cancha son fijas por formación (mismo objeto `FORMATIONS[formationType].positions`, `{key, x, y}` en porcentaje 0-100 del contenedor) — no hay arrastre libre, a diferencia de la Pizarra táctica.
- Cambiar de formación **limpia** los slots (mismo comportamiento real de `/formacion`, no un reacomodo "al slot más cercano" — se corrige así la spec original tras confirmar el código real).
- Un solo plan por entrenador (`UNIQUE` en `coach_key`), guardado manual con upsert — sin múltiples planes guardados en paralelo (a diferencia de la Pizarra táctica).
- El buscador de altas cubre toda la base de scouting (`usePlayersList`), sin ninguna relación con la agencia Doble G — explícitamente descartado por el usuario.
- Nunca usar emoji crudo como ícono — SVG dibujado a mano (convención ya establecida en toda la rama).
- Guardado manual con botón "Guardar", sin autoguardado.
- `key={coach.key}` en el montaje del tab para forzar remount al cambiar de entrenador (mismo criterio que Calendario/Entrenamientos/Pizarra).

---

### Task 1: Migración `coach_future_squads`

**Files:**
- Create: `supabase/migrations/20260810_coach_future_squads.sql`

**Interfaces:**
- Produces: tabla `public.coach_future_squads` con columnas `id, coach_key (unique), formation_type, slots (jsonb), bajas (jsonb), created_at, updated_at`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260810_coach_future_squads.sql
-- Plantel a futuro: un plan por entrenador (upsert por coach_key), con la cancha
-- (slots por posicion de formacion, plantel propio + altas de scouting) y una
-- lista de bajas planificadas. Sin CHECK sobre slots/bajas (JSONB libre), mismo
-- criterio que coach_tactical_boards -- la valida la capa de aplicacion.
CREATE TABLE IF NOT EXISTS public.coach_future_squads (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key       TEXT NOT NULL,
  formation_type  TEXT NOT NULL DEFAULT '4-3-3',
  slots           JSONB NOT NULL DEFAULT '[]'::jsonb,
  bajas           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_future_squads_coach ON public.coach_future_squads(coach_key);

ALTER TABLE public.coach_future_squads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "read_coach_future_squads" ON public.coach_future_squads FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "write_coach_future_squads" ON public.coach_future_squads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260810_coach_future_squads.sql
git commit -m "feat(entrenadores): migracion de coach_future_squads para plantel a futuro"
```

---

### Task 2: Extraer formaciones compartidas a `src/constants/formations.ts`

**Files:**
- Create: `src/constants/formations.ts`
- Modify: `src/pages/FormationPage.tsx:1-180`

**Interfaces:**
- Produces: `FORMATIONS`, `POSITION_KEY_API_MAP`, `FORMATION_POSITION_API_OVERRIDES`, `POSITION_DISPLAY_NAME`, `FORMATION_DISPLAY_OVERRIDES`, `FORMATION_SHORT_LABEL_OVERRIDES` (todas exportadas, mismos tipos y valores que hoy tiene `FormationPage.tsx` local).

- [ ] **Step 1: Crear el archivo de constantes**

```ts
// src/constants/formations.ts
import type { Position } from '@/types/scoring'

export const FORMATIONS: Record<string, { name: string; positions: { key: string; x: number; y: number }[] }> = {
  '4-3-3': {
    name: '4-3-3',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LB', x: 15, y: 72 },
      { key: 'CB1', x: 35, y: 75 },
      { key: 'CB2', x: 65, y: 75 },
      { key: 'RB', x: 85, y: 72 },
      { key: 'CM1', x: 30, y: 50 },
      { key: 'CM2', x: 50, y: 55 },
      { key: 'CM3', x: 70, y: 50 },
      { key: 'LW', x: 18, y: 25 },
      { key: 'ST', x: 50, y: 20 },
      { key: 'RW', x: 82, y: 25 },
    ],
  },
  '4-4-2': {
    name: '4-4-2',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LB', x: 15, y: 72 },
      { key: 'CB1', x: 35, y: 75 },
      { key: 'CB2', x: 65, y: 75 },
      { key: 'RB', x: 85, y: 72 },
      { key: 'LM', x: 15, y: 48 },
      { key: 'CM1', x: 38, y: 52 },
      { key: 'CM2', x: 62, y: 52 },
      { key: 'RM', x: 85, y: 48 },
      { key: 'ST1', x: 35, y: 22 },
      { key: 'ST2', x: 65, y: 22 },
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LB', x: 15, y: 72 },
      { key: 'CB1', x: 35, y: 75 },
      { key: 'CB2', x: 65, y: 75 },
      { key: 'RB', x: 85, y: 72 },
      { key: 'CDM1', x: 38, y: 58 },
      { key: 'CDM2', x: 62, y: 58 },
      { key: 'LW', x: 18, y: 35 },
      { key: 'CAM', x: 50, y: 38 },
      { key: 'RW', x: 82, y: 35 },
      { key: 'ST', x: 50, y: 18 },
    ],
  },
  '3-5-2': {
    name: '3-5-2',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'CB1', x: 25, y: 75 },
      { key: 'CB2', x: 50, y: 78 },
      { key: 'CB3', x: 75, y: 75 },
      { key: 'LWB', x: 10, y: 50 },
      { key: 'CM1', x: 35, y: 52 },
      { key: 'CM2', x: 50, y: 48 },
      { key: 'CM3', x: 65, y: 52 },
      { key: 'RWB', x: 90, y: 50 },
      { key: 'ST1', x: 38, y: 22 },
      { key: 'ST2', x: 62, y: 22 },
    ],
  },
  '5-3-2': {
    name: '5-3-2',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LWB', x: 10, y: 65 },
      { key: 'CB1', x: 28, y: 75 },
      { key: 'CB2', x: 50, y: 78 },
      { key: 'CB3', x: 72, y: 75 },
      { key: 'RWB', x: 90, y: 65 },
      { key: 'CM1', x: 30, y: 48 },
      { key: 'CM2', x: 50, y: 52 },
      { key: 'CM3', x: 70, y: 48 },
      { key: 'ST1', x: 38, y: 22 },
      { key: 'ST2', x: 62, y: 22 },
    ],
  },
}

// Position key -> API Position[] mapping
export const POSITION_KEY_API_MAP: Record<string, Position[]> = {
  'GK':   ['ARQ'],
  'LB':   ['LI'],
  'RB':   ['LD'],
  'LWB':  ['LI'],
  'RWB':  ['LD'],
  'CB1':  ['CB'],
  'CB2':  ['CB'],
  'CB3':  ['CB'],
  'CDM':  ['VC'],
  'CDM1': ['VC'],
  'CDM2': ['VC'],
  'CM1':  ['VC', 'VI'],
  'CM2':  ['VC', 'VI'],
  'CM3':  ['VC', 'VI'],
  'CAM':  ['VI'],
  'LM':   ['EXT'],
  'RM':   ['EXT'],
  'LW':   ['EXT'],
  'RW':   ['EXT'],
  'ST':   ['DEL'],
  'ST1':  ['DEL'],
  'ST2':  ['DEL'],
}

// Formation-specific overrides for CM positions in 4-3-3
export const FORMATION_POSITION_API_OVERRIDES: Record<string, Record<string, Position[]>> = {
  '4-3-3': {
    'CM1': ['VI'],
    'CM2': ['VC'],
    'CM3': ['VI'],
  },
}

export const POSITION_DISPLAY_NAME: Record<string, string> = {
  'GK':   'Arquero',
  'LB':   'Lateral Izquierdo',
  'RB':   'Lateral Derecho',
  'LWB':  'Lateral Izquierdo',
  'RWB':  'Lateral Derecho',
  'CB1':  'Defensor Central',
  'CB2':  'Defensor Central',
  'CB3':  'Defensor Central',
  'CDM':  'Volante Central',
  'CDM1': 'Volante Central',
  'CDM2': 'Volante Central',
  'CM1':  'Mediocampista',
  'CM2':  'Mediocampista',
  'CM3':  'Mediocampista',
  'CAM':  'Mediapunta',
  'LM':   'Extremo Izquierdo',
  'RM':   'Extremo Derecho',
  'LW':   'Extremo Izquierdo',
  'RW':   'Extremo Derecho',
  'ST':   'Delantero',
  'ST1':  'Delantero',
  'ST2':  'Delantero',
}

export const FORMATION_DISPLAY_OVERRIDES: Record<string, Record<string, string>> = {
  '4-3-3': {
    'CM1': 'Vol. Interno Izq.',
    'CM2': 'Volante Central',
    'CM3': 'Vol. Interno Der.',
  },
}

export const FORMATION_SHORT_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  '4-3-3': {
    'CM1': 'VI',
    'CM2': 'VC',
    'CM3': 'VI',
  },
}
```

- [ ] **Step 2: Actualizar `FormationPage.tsx` para importar desde la constante compartida**

Ubicar (línea 15 del archivo actual, después de `import type { PlayerWithScore, Position } from '@/types/scoring'`):

```ts
import type { PlayerWithScore, Position } from '@/types/scoring'
```

y agregar debajo:

```ts
import {
  FORMATIONS,
  POSITION_KEY_API_MAP,
  FORMATION_POSITION_API_OVERRIDES,
  POSITION_DISPLAY_NAME,
  FORMATION_DISPLAY_OVERRIDES,
  FORMATION_SHORT_LABEL_OVERRIDES,
} from '@/constants/formations'
```

Luego **borrar por completo** el bloque de constantes locales, desde el comentario `// ─── Formation definitions ────...` (línea 19 actual) hasta el cierre de `FORMATION_SHORT_LABEL_OVERRIDES` (línea 180 actual) inclusive — todo ese bloque queda reemplazado por el import de arriba. El resto del archivo (desde `// ─── Age helper ───` en adelante) no cambia.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores (confirma que `FormationPage.tsx` sigue compilando igual con las constantes importadas).

- [ ] **Step 4: Commit**

```bash
git add src/constants/formations.ts src/pages/FormationPage.tsx
git commit -m "refactor(formacion): extrae formaciones compartidas a constants/formations.ts"
```

---

### Task 3: `futureSquadService.ts`

**Files:**
- Create: `src/services/futureSquadService.ts`

**Interfaces:**
- Produces: tipos `SlotPlayerSource`, `FutureSquadSlot`, `FutureSquadBaja`, `FutureSquadPlan` + funciones `getFutureSquad`, `saveFutureSquad`.

- [ ] **Step 1: Implementar el servicio**

```ts
// src/services/futureSquadService.ts
import { supabase } from '@/lib/supabase'

export type SlotPlayerSource = 'squad' | 'candidate'

export interface FutureSquadSlot {
  slotKey: string                    // clave de FORMATIONS[formationType].positions, ej. 'LB'
  source: SlotPlayerSource | null    // null = slot vacio
  playerId: number | string | null   // number = id de API-Football (squad), string = id de scoring (candidate)
  playerName: string | null
  playerNumber: number | null        // solo aplica a source === 'squad'
  ggScore: number | null             // solo aplica a source === 'candidate'
}

export interface FutureSquadBaja {
  id: string          // uuid generado en el cliente
  playerId: number     // id de API-Football
  playerName: string
  reason: string        // texto libre, puede quedar vacio
}

export interface FutureSquadPlan {
  coach_key: string
  formation_type: string
  slots: FutureSquadSlot[]
  bajas: FutureSquadBaja[]
  updated_at: string
}

export async function getFutureSquad(coachKey: string): Promise<FutureSquadPlan | null> {
  const { data, error } = await supabase
    .from('coach_future_squads')
    .select('*')
    .eq('coach_key', coachKey)
    .maybeSingle()

  if (error) {
    console.error('Error cargando plantel a futuro:', error)
    return null
  }
  return (data as unknown as FutureSquadPlan) ?? null
}

export async function saveFutureSquad(
  coachKey: string,
  formationType: string,
  slots: FutureSquadSlot[],
  bajas: FutureSquadBaja[],
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_future_squads')
    .upsert(
      { coach_key: coachKey, formation_type: formationType, slots, bajas, updated_at: new Date().toISOString() },
      { onConflict: 'coach_key' },
    )

  if (error) {
    console.error('Error guardando plantel a futuro:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/services/futureSquadService.ts
git commit -m "feat(entrenadores): servicio de plantel a futuro (tipos + get/save upsert)"
```

---

### Task 4: `futureSquadPrefill.ts` — mapeo puro de alineación real a slots

**Files:**
- Create: `src/features/coaches/futureSquadPrefill.ts`
- Test: `src/features/coaches/futureSquadPrefill.test.ts`

**Interfaces:**
- Consumes: `FORMATIONS` (Task 2); `FutureSquadSlot` (Task 3, tipo).
- Produces: `export interface LineupPlayerForPrefill { id: number; name: string; number: number | null }`; `export function mapLineupToSlots(startXI: LineupPlayerForPrefill[], formationType: string): { formationType: string; slots: FutureSquadSlot[] }`.

- [ ] **Step 1: Escribir el test que falla primero**

```ts
// src/features/coaches/futureSquadPrefill.test.ts
import { describe, expect, it } from 'vitest'
import { mapLineupToSlots, type LineupPlayerForPrefill } from './futureSquadPrefill'

function makePlayer(id: number, name: string): LineupPlayerForPrefill {
  return { id, name, number: id }
}

describe('mapLineupToSlots', () => {
  it('ubica los 11 titulares en orden sobre los slots de la formacion elegida', () => {
    const startXI = Array.from({ length: 11 }, (_, i) => makePlayer(i + 1, `Jugador ${i + 1}`))
    const { formationType, slots } = mapLineupToSlots(startXI, '4-3-3')

    expect(formationType).toBe('4-3-3')
    expect(slots).toHaveLength(11)
    expect(slots[0]).toEqual({
      slotKey: 'GK', source: 'squad', playerId: 1, playerName: 'Jugador 1', playerNumber: 1, ggScore: null,
    })
    expect(slots[10]).toEqual({
      slotKey: 'RW', source: 'squad', playerId: 11, playerName: 'Jugador 11', playerNumber: 11, ggScore: null,
    })
    expect(slots.every(s => s.source === 'squad')).toBe(true)
  })

  it('usa 4-3-3 por defecto si la formacion reportada no es conocida', () => {
    const startXI = Array.from({ length: 11 }, (_, i) => makePlayer(i + 1, `Jugador ${i + 1}`))
    const { formationType, slots } = mapLineupToSlots(startXI, '4-1-4-1')

    expect(formationType).toBe('4-3-3')
    expect(slots.map(s => s.slotKey)).toEqual(['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM1', 'CM2', 'CM3', 'LW', 'ST', 'RW'])
  })

  it('deja vacios los slots sin jugador correspondiente si el startXI trae menos de 11', () => {
    const startXI = Array.from({ length: 8 }, (_, i) => makePlayer(i + 1, `Jugador ${i + 1}`))
    const { slots } = mapLineupToSlots(startXI, '4-4-2')

    expect(slots).toHaveLength(11)
    expect(slots.slice(0, 8).every(s => s.source === 'squad')).toBe(true)
    expect(slots.slice(8).every(s => s.source === null && s.playerId === null)).toBe(true)
  })

  it('devuelve slots vacios para un startXI vacio', () => {
    const { slots } = mapLineupToSlots([], '4-2-3-1')
    expect(slots).toHaveLength(11)
    expect(slots.every(s => s.source === null)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/features/coaches/futureSquadPrefill.test.ts`
Expected: FAIL con "Cannot find module './futureSquadPrefill'"

- [ ] **Step 3: Implementar la funcion**

```ts
// src/features/coaches/futureSquadPrefill.ts
import { FORMATIONS } from '@/constants/formations'
import type { FutureSquadSlot } from '@/services/futureSquadService'

export interface LineupPlayerForPrefill {
  id: number
  name: string
  number: number | null
}

export function mapLineupToSlots(
  startXI: LineupPlayerForPrefill[],
  formationType: string,
): { formationType: string; slots: FutureSquadSlot[] } {
  const resolvedFormationType = FORMATIONS[formationType] ? formationType : '4-3-3'
  const positionKeys = FORMATIONS[resolvedFormationType].positions.map(p => p.key)

  const slots: FutureSquadSlot[] = positionKeys.map((slotKey, i) => {
    const player = startXI[i]
    if (!player) {
      return { slotKey, source: null, playerId: null, playerName: null, playerNumber: null, ggScore: null }
    }
    return {
      slotKey,
      source: 'squad',
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      ggScore: null,
    }
  })

  return { formationType: resolvedFormationType, slots }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/features/coaches/futureSquadPrefill.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/futureSquadPrefill.ts src/features/coaches/futureSquadPrefill.test.ts
git commit -m "feat(entrenadores): mapeo puro de alineacion real a slots de plantel futuro"
```

---

### Task 5: `FutureSquadPitch.tsx` — cancha de posiciones fijas

**Files:**
- Create: `src/features/coaches/components/FutureSquadPitch.tsx`

**Interfaces:**
- Consumes: `FORMATIONS` (Task 2); `FutureSquadSlot` (Task 3, tipo).
- Produces: `FutureSquadPitch({ formationType, slots, onSlotClick, onRemoveSlot }: { formationType: string; slots: FutureSquadSlot[]; onSlotClick: (slotKey: string) => void; onRemoveSlot: (slotKey: string) => void })` — default export, componente de solo presentación (sin estado propio).

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/FutureSquadPitch.tsx
import { FORMATIONS, FORMATION_SHORT_LABEL_OVERRIDES } from '@/constants/formations'
import type { FutureSquadSlot } from '@/services/futureSquadService'

export default function FutureSquadPitch({
  formationType,
  slots,
  onSlotClick,
  onRemoveSlot,
}: {
  formationType: string
  slots: FutureSquadSlot[]
  onSlotClick: (slotKey: string) => void
  onRemoveSlot: (slotKey: string) => void
}) {
  const currentFormation = FORMATIONS[formationType] ?? FORMATIONS['4-3-3']

  return (
    <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl p-4 sm:p-6 relative aspect-[3/4] w-full max-w-xl mx-auto shadow-2xl overflow-hidden">
      {/* Lineas de campo -- mismo dibujo que /formacion y la pizarra tactica */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
        <rect x="2" y="2" width="96" height="126" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <circle cx="50" cy="65" r="1" fill="rgba(255,255,255,0.5)" />
        <line x1="2" y1="65" x2="98" y2="65" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="2" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="30" y="2" width="40" height="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="108" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="30" y="120" width="40" height="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <path d="M 2 6 Q 2 2 6 2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M 94 2 Q 98 2 98 6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M 2 124 Q 2 128 6 128" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M 94 128 Q 98 128 98 124" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
      </svg>

      {currentFormation.positions.map(pos => {
        const slot = slots.find(s => s.slotKey === pos.key)
        const occupied = !!slot && slot.source !== null
        const isCandidate = slot?.source === 'candidate'

        const label = occupied
          ? isCandidate
            ? slot!.playerName!.split(' ').slice(-1)[0]
            : String(slot!.playerNumber ?? slot!.playerName!.split(' ').slice(-1)[0])
          : FORMATION_SHORT_LABEL_OVERRIDES[formationType]?.[pos.key] ?? pos.key

        return (
          <div
            key={pos.key}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <button
              type="button"
              onClick={() => onSlotClick(pos.key)}
              className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${
                occupied
                  ? isCandidate
                    ? 'bg-white text-apple-gray-900 ring-2 ring-sky-400'
                    : 'bg-white text-apple-gray-900'
                  : 'bg-white/15 border-2 border-dashed border-white/50 text-white/80 hover:bg-white/25 hover:border-white/70'
              }`}
            >
              <span className={occupied ? 'text-xs font-bold' : 'text-sm font-semibold'}>{label}</span>
            </button>

            {occupied && (
              <button
                type="button"
                onClick={() => onRemoveSlot(pos.key)}
                aria-label={isCandidate ? 'Quitar' : 'Dar de baja'}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {occupied && !isCandidate && (
              <p className="mt-1 text-center whitespace-nowrap text-2xs font-semibold text-white/90">
                {slot!.playerName!.split(' ').slice(-1)[0]}
              </p>
            )}
            {occupied && isCandidate && slot!.ggScore !== null && (
              <p className="mt-1 text-center whitespace-nowrap text-2xs font-bold text-sky-200">
                {slot!.ggScore!.toFixed(1)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/FutureSquadPitch.tsx
git commit -m "feat(entrenadores): cancha de plantel a futuro (posiciones fijas por formacion)"
```

---

### Task 6: `FutureSquadPlayerPicker.tsx` — modal de selección por slot

**Files:**
- Create: `src/features/coaches/components/FutureSquadPlayerPicker.tsx`

**Interfaces:**
- Consumes: `POSITION_KEY_API_MAP`, `FORMATION_POSITION_API_OVERRIDES`, `POSITION_DISPLAY_NAME`, `FORMATION_DISPLAY_OVERRIDES` (Task 2); `usePlayersList` (`@/hooks/usePlayerStats`, ya existe); `PlayerWithScore`, `Position` (`@/types/scoring`, ya existen); `getScoreColorClass` (`@/components/ui/ScoreBar`, ya existe); `useDebouncedValue` (`@/hooks/useDebouncedValue`, ya existe); `SquadPlayer` (`@/services/footballApiService`, ya existe); `POSITION_LABEL` (`@/features/coaches/squadGrouping`, ya existe).
- Produces: `FutureSquadPlayerPicker({ slotKey, formationType, squad, usedSquadIds, usedCandidateIds, onSelectSquad, onSelectCandidate, onClose }: {...})` — default export.

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/FutureSquadPlayerPicker.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlayersList } from '@/hooks/usePlayerStats'
import type { PlayerWithScore, Position } from '@/types/scoring'
import { getScoreColorClass } from '@/components/ui/ScoreBar'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { SquadPlayer } from '@/services/footballApiService'
import { POSITION_LABEL } from '@/features/coaches/squadGrouping'
import {
  POSITION_KEY_API_MAP,
  FORMATION_POSITION_API_OVERRIDES,
  POSITION_DISPLAY_NAME,
  FORMATION_DISPLAY_OVERRIDES,
} from '@/constants/formations'

type PickerTab = 'plantel' | 'sugeridos' | 'buscar'

export default function FutureSquadPlayerPicker({
  slotKey,
  formationType,
  squad,
  usedSquadIds,
  usedCandidateIds,
  onSelectSquad,
  onSelectCandidate,
  onClose,
}: {
  slotKey: string
  formationType: string
  squad: SquadPlayer[]
  usedSquadIds: Set<number>
  usedCandidateIds: Set<string>
  onSelectSquad: (player: SquadPlayer) => void
  onSelectCandidate: (player: PlayerWithScore) => void
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<PickerTab>('plantel')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const displayName =
    FORMATION_DISPLAY_OVERRIDES[formationType]?.[slotKey] ?? POSITION_DISPLAY_NAME[slotKey] ?? slotKey

  const allowedPositions: Position[] =
    FORMATION_POSITION_API_OVERRIDES[formationType]?.[slotKey] ?? POSITION_KEY_API_MAP[slotKey] ?? []

  const availableSquad = useMemo(
    () => squad.filter(p => !usedSquadIds.has(p.id)),
    [squad, usedSquadIds],
  )

  const { players: suggestionPool, loading: suggestionsLoading } = usePlayersList(
    activeTab === 'sugeridos' && allowedPositions.length > 0
      ? { positions: allowedPositions, pageSize: 200 }
      : { pageSize: 0 },
  )
  const suggestions = useMemo(
    () => suggestionPool.filter(p => !usedCandidateIds.has(String(p.id)) && p.primary_score !== null).slice(0, 15),
    [suggestionPool, usedCandidateIds],
  )

  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 250)
  const { players: searchPool, loading: searchLoading } = usePlayersList(
    activeTab === 'buscar' && debouncedSearch.length >= 2 ? { search: debouncedSearch, pageSize: 15 } : { pageSize: 0 },
  )
  const searchResults = useMemo(
    () => searchPool.filter(p => !usedCandidateIds.has(String(p.id))),
    [searchPool, usedCandidateIds],
  )

  useEffect(() => {
    if (activeTab === 'buscar' && searchInputRef.current) searchInputRef.current.focus()
  }, [activeTab])

  function renderCandidateCard(p: PlayerWithScore) {
    const score = p.primary_score
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => onSelectCandidate(p)}
        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 border border-apple-gray-100 dark:border-apple-gray-700 hover:border-brand-green/50"
      >
        {p.photo ? (
          <img src={p.photo} alt="" className="w-10 h-10 rounded-lg object-cover bg-apple-gray-200" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-apple-gray-200 dark:bg-apple-gray-600 flex items-center justify-center text-sm font-bold text-apple-gray-500">
            {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-apple-gray-800 dark:text-white text-sm truncate">{p.name}</p>
          <p className="text-xs text-apple-gray-500 truncate">{p.team?.name ?? '—'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {score !== null ? (
            <p className={`text-sm font-bold ${getScoreColorClass(score, '10')}`}>{score.toFixed(1)}</p>
          ) : (
            <p className="text-sm font-bold text-apple-gray-400">—</p>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-apple-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden animate-scale-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-apple-gray-200 dark:border-apple-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-apple-gray-800 dark:text-white">{displayName}</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-apple-gray-400 hover:text-apple-gray-600 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-1 bg-apple-gray-100 dark:bg-apple-gray-700 rounded-xl p-1">
            {(['plantel', 'sugeridos', 'buscar'] as PickerTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-apple-gray-600 text-apple-gray-800 dark:text-white shadow-sm'
                    : 'text-apple-gray-500 hover:text-apple-gray-700 dark:hover:text-apple-gray-300'
                }`}
              >
                {tab === 'plantel' ? 'Plantel' : tab === 'sugeridos' ? 'Sugeridos' : 'Buscar'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto flex-1">
          {activeTab === 'plantel' ? (
            availableSquad.length === 0 ? (
              <p className="text-center text-apple-gray-500 py-8 text-sm">No quedan jugadores del plantel sin ubicar.</p>
            ) : (
              <div className="space-y-2">
                {availableSquad.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectSquad(p)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 border border-apple-gray-100 dark:border-apple-gray-700 hover:border-brand-green/50"
                  >
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-10 h-10 rounded-lg object-cover bg-apple-gray-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-apple-gray-200 dark:bg-apple-gray-600 flex items-center justify-center text-sm font-bold text-apple-gray-500">
                        {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-apple-gray-800 dark:text-white text-sm truncate">{p.name}</p>
                      <p className="text-xs text-apple-gray-500 truncate">
                        {p.position ? POSITION_LABEL[p.position] ?? p.position : '—'}
                        {p.number != null ? ` · #${p.number}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : activeTab === 'sugeridos' ? (
            suggestionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-center text-apple-gray-500 py-8 text-sm">No hay jugadores sugeridos para esta posicion.</p>
            ) : (
              <div className="space-y-2">{suggestions.map(renderCandidateCard)}</div>
            )
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o equipo..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-apple-gray-100 dark:bg-apple-gray-700 border border-apple-gray-200 dark:border-apple-gray-600 text-apple-gray-800 dark:text-white placeholder-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/50 text-sm"
                />
              </div>
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : debouncedSearch.length < 2 ? (
                <p className="text-center text-apple-gray-500 py-8 text-sm">Escribi al menos 2 letras para buscar.</p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-apple-gray-500 py-8 text-sm">No se encontraron jugadores.</p>
              ) : (
                <div className="space-y-2">{searchResults.map(renderCandidateCard)}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/FutureSquadPlayerPicker.tsx
git commit -m "feat(entrenadores): modal de seleccion de jugador para plantel a futuro"
```

---

### Task 7: `CoachFutureSquadTab.tsx` — orquestación

**Files:**
- Create: `src/features/coaches/components/CoachFutureSquadTab.tsx`

**Interfaces:**
- Consumes: `getFutureSquad`, `saveFutureSquad`, `FutureSquadSlot`, `FutureSquadBaja` (Task 3); `mapLineupToSlots`, `LineupPlayerForPrefill` (Task 4); `FutureSquadPitch` (Task 5); `FutureSquadPlayerPicker` (Task 6); `FORMATIONS` (Task 2); `fetchSquadCached`, `fetchSeasonFixtures`, `fetchFixtureLineups`, `SquadPlayer` (`@/services/footballApiService`, ya existen); `AgencyCoach` (`@/constants/agencyCoaches`, ya existe); `LoadingSpinner` (`@/components/ui/LoadingSpinner`, ya existe).
- Produces: `CoachFutureSquadTab({ coach }: { coach: AgencyCoach })` — default export.

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/CoachFutureSquadTab.tsx
import { useEffect, useState } from 'react'
import {
  getFutureSquad,
  saveFutureSquad,
  type FutureSquadSlot,
  type FutureSquadBaja,
} from '@/services/futureSquadService'
import { mapLineupToSlots, type LineupPlayerForPrefill } from '@/features/coaches/futureSquadPrefill'
import FutureSquadPitch from './FutureSquadPitch'
import FutureSquadPlayerPicker from './FutureSquadPlayerPicker'
import { FORMATIONS } from '@/constants/formations'
import { fetchSquadCached, fetchSeasonFixtures, fetchFixtureLineups, type SquadPlayer } from '@/services/footballApiService'
import type { PlayerWithScore } from '@/types/scoring'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function uid(): string {
  return crypto.randomUUID()
}

function emptySlots(formationType: string): FutureSquadSlot[] {
  return (FORMATIONS[formationType] ?? FORMATIONS['4-3-3']).positions.map(pos => ({
    slotKey: pos.key,
    source: null,
    playerId: null,
    playerName: null,
    playerNumber: null,
    ggScore: null,
  }))
}

async function buildPrefill(coach: AgencyCoach): Promise<{ formationType: string; slots: FutureSquadSlot[] }> {
  if (!coach.apiTeamId || !coach.leagueSeason) return { formationType: '4-3-3', slots: emptySlots('4-3-3') }

  const fixtures = await fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason)
  const lastPlayed = fixtures
    .filter(f => f.statusShort === 'FT')
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  if (!lastPlayed) return { formationType: '4-3-3', slots: emptySlots('4-3-3') }

  const lineups = await fetchFixtureLineups(lastPlayed.fixtureId)
  const ownLineup = lineups.find(l => l.team.id === coach.apiTeamId)
  if (!ownLineup) return { formationType: '4-3-3', slots: emptySlots('4-3-3') }

  const startXI: LineupPlayerForPrefill[] = ownLineup.startXI.map(({ player }) => ({
    id: player.id,
    name: player.name,
    number: player.number,
  }))
  return mapLineupToSlots(startXI, ownLineup.formation ?? '4-3-3')
}

export default function CoachFutureSquadTab({ coach }: { coach: AgencyCoach }) {
  const [squad, setSquad] = useState<SquadPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [formationType, setFormationType] = useState('4-3-3')
  const [slots, setSlots] = useState<FutureSquadSlot[]>(emptySlots('4-3-3'))
  const [bajas, setBajas] = useState<FutureSquadBaja[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState<string>('')
  const [pickerSlotKey, setPickerSlotKey] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const [squadData, plan] = await Promise.all([
        coach.apiTeamId ? fetchSquadCached(coach.apiTeamId) : Promise.resolve([]),
        getFutureSquad(coach.key),
      ])
      if (!active) return
      setSquad(squadData)

      if (plan) {
        setFormationType(plan.formation_type)
        setSlots(plan.slots)
        setBajas(plan.bajas)
        setSavedSnapshot(JSON.stringify({ formationType: plan.formation_type, slots: plan.slots, bajas: plan.bajas }))
      } else {
        const prefill = await buildPrefill(coach)
        if (!active) return
        setFormationType(prefill.formationType)
        setSlots(prefill.slots)
        setBajas([])
        setSavedSnapshot('')
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [coach.key, coach.apiTeamId, coach.leagueSeason])

  const hasUnsavedChanges = JSON.stringify({ formationType, slots, bajas }) !== savedSnapshot

  function handleFormationChange(next: string) {
    setFormationType(next)
    setSlots(emptySlots(next))
  }

  function handleSelectSquad(player: SquadPlayer) {
    if (!pickerSlotKey) return
    setSlots(prev => prev.map(s => (
      s.slotKey === pickerSlotKey
        ? { slotKey: s.slotKey, source: 'squad', playerId: player.id, playerName: player.name, playerNumber: player.number, ggScore: null }
        : s
    )))
    setPickerSlotKey(null)
  }

  function handleSelectCandidate(player: PlayerWithScore) {
    if (!pickerSlotKey) return
    setSlots(prev => prev.map(s => (
      s.slotKey === pickerSlotKey
        ? { slotKey: s.slotKey, source: 'candidate', playerId: String(player.id), playerName: player.name, playerNumber: null, ggScore: player.primary_score }
        : s
    )))
    setPickerSlotKey(null)
  }

  function handleRemoveSlot(slotKey: string) {
    const slot = slots.find(s => s.slotKey === slotKey)
    if (!slot || slot.source === null) return

    if (slot.source === 'squad') {
      setBajas(prev => [...prev, { id: uid(), playerId: slot.playerId as number, playerName: slot.playerName as string, reason: '' }])
    }
    setSlots(prev => prev.map(s => (
      s.slotKey === slotKey ? { slotKey: s.slotKey, source: null, playerId: null, playerName: null, playerNumber: null, ggScore: null } : s
    )))
  }

  function handleBajaReasonChange(id: string, reason: string) {
    setBajas(prev => prev.map(b => (b.id === id ? { ...b, reason } : b)))
  }

  function handleRemoveBaja(id: string) {
    setBajas(prev => prev.filter(b => b.id !== id))
  }

  async function handleSave() {
    setSaveStatus('saving')
    const res = await saveFutureSquad(coach.key, formationType, slots, bajas)
    if (!res.success) {
      setSaveStatus('error')
      return
    }
    setSavedSnapshot(JSON.stringify({ formationType, slots, bajas }))
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  }

  const usedSquadIds = new Set(slots.filter(s => s.source === 'squad').map(s => s.playerId as number))
  const usedCandidateIds = new Set(slots.filter(s => s.source === 'candidate').map(s => s.playerId as string))
  const pickerSlot = pickerSlotKey ? slots.find(s => s.slotKey === pickerSlotKey) : null

  if (loading) return <LoadingSpinner message="Cargando plantel a futuro..." />

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider mb-1">
            Formacion
          </label>
          <select
            value={formationType}
            onChange={e => handleFormationChange(e.target.value)}
            className="input-apple"
          >
            {Object.keys(FORMATIONS).map(f => (
              <option key={f} value={f}>{FORMATIONS[f].name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        {saveStatus === 'error' && <span className="text-xs text-brand-red">Error al guardar</span>}
        {hasUnsavedChanges && saveStatus === 'idle' && <span className="text-xs text-amber-500">Cambios sin guardar</span>}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveStatus === 'saving'}
          className="min-h-[40px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
        >
          {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>

      <FutureSquadPitch
        formationType={formationType}
        slots={slots}
        onSlotClick={setPickerSlotKey}
        onRemoveSlot={handleRemoveSlot}
      />

      <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Bajas planificadas</h3>
        {bajas.length === 0 ? (
          <p className="text-sm text-apple-gray-400">Sin bajas planificadas todavia.</p>
        ) : (
          <div className="space-y-2">
            {bajas.map(b => (
              <div key={b.id} className="flex items-center gap-2">
                <span className="text-sm font-medium text-apple-gray-800 dark:text-white w-32 truncate flex-shrink-0">
                  {b.playerName}
                </span>
                <input
                  value={b.reason}
                  onChange={e => handleBajaReasonChange(b.id, e.target.value)}
                  placeholder="Motivo (opcional)..."
                  className="flex-1 min-h-[36px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm text-apple-gray-800 dark:text-white placeholder:text-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBaja(b.id)}
                  className="text-xs font-semibold text-red-500 flex-shrink-0"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerSlotKey && (
        <FutureSquadPlayerPicker
          slotKey={pickerSlotKey}
          formationType={formationType}
          squad={squad}
          usedSquadIds={pickerSlot?.source === 'squad' ? new Set([...usedSquadIds].filter(id => id !== pickerSlot.playerId)) : usedSquadIds}
          usedCandidateIds={pickerSlot?.source === 'candidate' ? new Set([...usedCandidateIds].filter(id => id !== pickerSlot.playerId)) : usedCandidateIds}
          onSelectSquad={handleSelectSquad}
          onSelectCandidate={handleSelectCandidate}
          onClose={() => setPickerSlotKey(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add src/features/coaches/components/CoachFutureSquadTab.tsx
git commit -m "feat(entrenadores): tab de plantel a futuro (prellenado + bajas/altas + guardado)"
```

---

### Task 8: Agregar la tab "Plantel futuro" en `CoachDetailPage.tsx`

**Files:**
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `CoachFutureSquadTab` (Task 7).

- [ ] **Step 1: Agregar el import**

Ubicar (línea 9 del archivo actual):

```ts
import CoachTacticalBoardTab from '@/features/coaches/components/CoachTacticalBoardTab'
```

y agregar debajo:

```ts
import CoachFutureSquadTab from '@/features/coaches/components/CoachFutureSquadTab'
```

- [ ] **Step 2: Agregar `'plantel_futuro'` al tipo `CoachTab`**

Ubicar (línea 11 del archivo actual):

```ts
type CoachTab = 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'pizarra' | 'reserva'
```

y reemplazarlo por:

```ts
type CoachTab = 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'pizarra' | 'plantel_futuro' | 'reserva'
```

- [ ] **Step 3: Agregar la tab a `TABS`**

Ubicar (líneas 13-21 del archivo actual):

```ts
const TABS: { id: CoachTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'plantel', label: 'Plantel' },
  { id: 'liga', label: 'Liga' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'entrenamientos', label: 'Entrenamientos' },
  { id: 'notas', label: 'Notas de partidos' },
  { id: 'pizarra', label: 'Pizarra' },
]
```

y reemplazarlo por:

```ts
const TABS: { id: CoachTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'plantel', label: 'Plantel' },
  { id: 'liga', label: 'Liga' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'entrenamientos', label: 'Entrenamientos' },
  { id: 'notas', label: 'Notas de partidos' },
  { id: 'pizarra', label: 'Pizarra' },
  { id: 'plantel_futuro', label: 'Plantel futuro' },
]
```

- [ ] **Step 4: Agregar `'plantel_futuro'` a `isValidTab`**

Ubicar (líneas 37-38 del archivo actual):

```ts
  const isValidTab = (val: string): val is CoachTab =>
    ['resumen', 'plantel', 'liga', 'calendario', 'entrenamientos', 'notas', 'pizarra', 'reserva'].includes(val)
```

y reemplazarlo por:

```ts
  const isValidTab = (val: string): val is CoachTab =>
    ['resumen', 'plantel', 'liga', 'calendario', 'entrenamientos', 'notas', 'pizarra', 'plantel_futuro', 'reserva'].includes(val)
```

- [ ] **Step 5: Renderizar el tab**

Ubicar (línea 167 del archivo actual):

```tsx
      {activeTab === 'pizarra' && <CoachTacticalBoardTab key={coach.key} coach={coach} />}
    </div>
  )
}
```

y reemplazarlo por:

```tsx
      {activeTab === 'pizarra' && <CoachTacticalBoardTab key={coach.key} coach={coach} />}
      {activeTab === 'plantel_futuro' && <CoachFutureSquadTab key={coach.key} coach={coach} />}
    </div>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 8: Commit**

```bash
git add src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): agrega la tab Plantel futuro a la ficha del entrenador"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 4 nuevos de `futureSquadPrefill.test.ts`.

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Avisar al usuario que corra la migración de Supabase**

`supabase/migrations/20260810_coach_future_squads.sql` (Task 1) todavía no corrió en la base real — sin eso, cargar/guardar el plantel a futuro falla en runtime (tabla inexistente).

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`, tab Plantel futuro), con la migración ya corrida:
  - Primera visita (sin plan guardado): la cancha se prellena con el 11 real del último partido jugado (o queda vacía en 4-3-3 si no hay datos).
  - Click en un slot ocupado por plantel propio abre el picker con tabs Plantel/Sugeridos/Buscar; elegir un jugador del plantel en otra posición lo reubica ahí.
  - El botón rojo de "×" sobre una ficha de plantel propio la manda a "Bajas planificadas" con motivo editable; sobre una ficha de alta (borde celeste) la quita directo, sin pasar por bajas.
  - Click en un slot vacío abre el picker; elegir alguien de "Sugeridos" o "Buscar" agrega una ficha celeste con nombre + Score GG.
  - Cambiar la formación limpia la cancha (mismo comportamiento que `/formacion`).
  - "Guardar" persiste; recargar la página y volver al tab carga el plan guardado (ya no se vuelve a prellenar desde la API).
  - Cambiar de entrenador no arrastra el plantel futuro del anterior.
  - `/formacion` (la página original) sigue funcionando exactamente igual que antes de la extracción de constantes (Task 2).
