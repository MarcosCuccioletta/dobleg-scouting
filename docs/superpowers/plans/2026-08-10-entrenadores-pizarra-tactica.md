# Entrenadores — Pizarra táctica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pestaña nueva "Pizarra" en la ficha de un entrenador: una cancha interactiva donde arrastra fichas (genéricas, jugadores reales del plantel, la pelota) y dibuja (lápiz, flecha, zona sombreada, texto, en 5 colores), con pizarras guardadas para retomar después.

**Architecture:** Una tabla nueva en Supabase (`coach_tactical_boards`, markers/annotations en JSONB, sin esquema rígido — la app valida la forma). Un módulo puro y testeado para la geometría del dibujo (`boardGeometry.ts`). Tres componentes: la cancha interactiva (`TacticalBoardPitch.tsx`, dueña de toda la lógica de puntero — arrastre de fichas y dibujo por modo), la barra de herramientas (`TacticalBoardToolbar.tsx`, solo presentación + callbacks) y el tab que orquesta todo (`CoachTacticalBoardTab.tsx`: fetch de pizarras/plantel, CRUD, modales de nueva/cargar/jugador).

**Tech Stack:** React 18 + TypeScript, Supabase, SVG + Pointer Events (sin librería de dibujo — mismo criterio que la cancha de `/formacion`, que ya dibuja el campo a mano en SVG), Vitest (`.test.ts` de lógica pura).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-10-entrenadores-pizarra-tactica-design.md`.
- La cancha reusa exactamente el mismo dibujo SVG de líneas de campo que ya existe en `src/pages/FormationPage.tsx` (`viewBox="0 0 100 130"`) — no rediseñar el campo.
- Coordenadas de fichas y anotaciones son porcentajes (0-100) del contenedor de la cancha, nunca píxeles — así se ve igual en cualquier tamaño de pantalla.
- La ficha de pelota es única — nunca se agrega una segunda; el botón "+ Pelota" queda deshabilitado si ya hay una en la cancha (simplificación respecto al spec: en vez de "seleccionar la existente", que requeriría levantar el estado de selección fuera de la cancha, el botón simplemente se deshabilita — mismo resultado para el usuario, sin duplicar nunca).
- Nunca usar el emoji ⚽ directo en el marcador de pelota — ya se rompió visualmente una vez en esta sección (ver feedback histórico); se dibuja como ícono SVG propio (mismo patrón que `GoalIcon` en `CoachMatchDetailPage.tsx`).
- Deshacer saca la última anotación de una pila global (lápiz+flecha+zona+texto mezclados, no una pila por herramienta). Borrar un trazo puntual del medio de la secuencia queda fuera de alcance.
- Sin `CHECK` de base de datos sobre `markers`/`annotations` — la forma la valida la capa de aplicación (mismo criterio que sub-proyectos anteriores).
- Guardado manual (botón "Guardar"), sin autoguardado.
- Sin tests de UI — solo `boardGeometry.ts` tiene lógica pura testeada, el resto son componentes de interacción (mismo criterio de toda la sección Entrenadores).
- Seguir el estilo visual y las clases Tailwind ya usadas en el resto de Entrenadores (`rounded-apple-lg`, `bg-brand-green text-apple-gray-900`, botones `min-h-[36px]`/`[40px]`) — no introducir un sistema de diseño nuevo, salvo la cancha en sí (que reusa el estilo ya existente de `/formacion`).

---

## Task 1: Migración de Supabase — `coach_tactical_boards`

**Files:**
- Create: `supabase/migrations/20260810_coach_tactical_boards.sql`

**Interfaces:**
- Produces: tabla `coach_tactical_boards(id, coach_key, name, markers, annotations, created_at, updated_at)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Pizarra tactica: fichas arrastrables + anotaciones de dibujo sobre una cancha,
-- guardadas por entrenador. Sin CHECK sobre la forma de markers/annotations
-- (JSONB libre) -- la valida la capa de aplicacion, mismo criterio que
-- coach_match_team_stats.raw_metrics.
CREATE TABLE IF NOT EXISTS public.coach_tactical_boards (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  name        TEXT NOT NULL,
  markers     JSONB NOT NULL DEFAULT '[]'::jsonb,
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_tactical_boards_coach ON public.coach_tactical_boards(coach_key);

ALTER TABLE public.coach_tactical_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "read_coach_tactical_boards" ON public.coach_tactical_boards FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "write_coach_tactical_boards" ON public.coach_tactical_boards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Verificar que el archivo quedó bien formado**

Run: `cat supabase/migrations/20260810_coach_tactical_boards.sql`
Expected: el contenido exacto de arriba, sin errores de sintaxis SQL visibles (paréntesis balanceados, `;` al final de cada statement).

No se corre en una base de datos real desde acá — el usuario la corre a mano en Supabase (mismo flujo que las migraciones anteriores de esta rama).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260810_coach_tactical_boards.sql
git commit -m "feat(entrenadores): migracion de coach_tactical_boards para la pizarra tactica"
```

---

## Task 2: Servicio `tacticalBoardService.ts`

**Files:**
- Create: `src/services/tacticalBoardService.ts`

**Interfaces:**
- Produces: tipos `MarkerTeam`, `MarkerKind`, `BoardMarker`, `AnnotationColor`, `FreehandAnnotation`, `ArrowAnnotation`, `ZoneAnnotation`, `TextAnnotation`, `BoardAnnotation`, `TacticalBoard`; funciones `listTacticalBoards(coachKey: string): Promise<TacticalBoard[]>`, `createTacticalBoard(coachKey: string, name: string): Promise<TacticalBoard | null>`, `updateTacticalBoard(id: number, markers: BoardMarker[], annotations: BoardAnnotation[]): Promise<{ success: boolean; error?: string }>`, `renameTacticalBoard(id: number, name: string): Promise<{ success: boolean; error?: string }>`, `deleteTacticalBoard(id: number): Promise<{ success: boolean; error?: string }>`.

- [ ] **Step 1: Implementar el servicio**

```ts
// src/services/tacticalBoardService.ts
import { supabase } from '@/lib/supabase'

export type MarkerTeam = 'propio' | 'rival'
export type MarkerKind = 'generic' | 'player' | 'ball'

export interface BoardMarker {
  id: string
  kind: MarkerKind
  team: MarkerTeam | null   // null solo para la pelota
  label: string              // lo que se ve en la ficha: numero, apellido, o vacio (pelota)
  playerId: number | null    // id de API-Football, solo si kind === 'player'
  x: number                  // % del ancho de la cancha, 0-100
  y: number                  // % del alto de la cancha, 0-100
}

export type AnnotationColor = 'white' | 'yellow' | 'red' | 'skyblue' | 'black'

export interface FreehandAnnotation { id: string; kind: 'freehand'; color: AnnotationColor; points: { x: number; y: number }[] }
export interface ArrowAnnotation    { id: string; kind: 'arrow';    color: AnnotationColor; x1: number; y1: number; x2: number; y2: number }
export interface ZoneAnnotation     { id: string; kind: 'zone';     color: AnnotationColor; x1: number; y1: number; x2: number; y2: number }
export interface TextAnnotation     { id: string; kind: 'text';     color: AnnotationColor; x: number; y: number; text: string }

export type BoardAnnotation = FreehandAnnotation | ArrowAnnotation | ZoneAnnotation | TextAnnotation

export interface TacticalBoard {
  id: number
  coach_key: string
  name: string
  markers: BoardMarker[]
  annotations: BoardAnnotation[]
  created_at: string
  updated_at: string
}

export async function listTacticalBoards(coachKey: string): Promise<TacticalBoard[]> {
  const { data, error } = await supabase
    .from('coach_tactical_boards')
    .select('*')
    .eq('coach_key', coachKey)
    .order('updated_at', { ascending: false })

  if (error || !data) {
    console.error('Error listando pizarras tacticas:', error)
    return []
  }
  return data as unknown as TacticalBoard[]
}

export async function createTacticalBoard(coachKey: string, name: string): Promise<TacticalBoard | null> {
  const { data, error } = await supabase
    .from('coach_tactical_boards')
    .insert({ coach_key: coachKey, name, markers: [], annotations: [] })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creando pizarra tactica:', error)
    return null
  }
  return data as unknown as TacticalBoard
}

export async function updateTacticalBoard(
  id: number,
  markers: BoardMarker[],
  annotations: BoardAnnotation[],
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_tactical_boards')
    .update({ markers, annotations, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error guardando pizarra tactica:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function renameTacticalBoard(id: number, name: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_tactical_boards')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error renombrando pizarra tactica:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteTacticalBoard(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_tactical_boards').delete().eq('id', id)

  if (error) {
    console.error('Error borrando pizarra tactica:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
```

Sin test propio — funciones de I/O finas sobre Supabase, mismo criterio ya usado en el resto de servicios de esta sección.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/services/tacticalBoardService.ts
git commit -m "feat(entrenadores): servicio de pizarras tacticas (tipos + CRUD)"
```

---

## Task 3: Geometría del dibujo — lógica pura

**Files:**
- Create: `src/features/coaches/boardGeometry.ts`
- Create: `src/features/coaches/boardGeometry.test.ts`

**Interfaces:**
- Produces: `clampPercent(value: number): number`, `pointsToPathD(points: { x: number; y: number }[]): string`, `arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size?: number): { x: number; y: number }[]`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/boardGeometry.test.ts
import { describe, it, expect } from 'vitest'
import { clampPercent, pointsToPathD, arrowHeadPoints } from './boardGeometry'

describe('clampPercent', () => {
  it('deja pasar valores dentro de 0-100', () => {
    expect(clampPercent(50)).toBe(50)
    expect(clampPercent(0)).toBe(0)
    expect(clampPercent(100)).toBe(100)
  })

  it('satura valores negativos a 0', () => {
    expect(clampPercent(-10)).toBe(0)
  })

  it('satura valores mayores a 100', () => {
    expect(clampPercent(150)).toBe(100)
  })
})

describe('pointsToPathD', () => {
  it('sin puntos devuelve string vacio', () => {
    expect(pointsToPathD([])).toBe('')
  })

  it('con un punto arma un M seguido de L al mismo punto', () => {
    expect(pointsToPathD([{ x: 10, y: 20 }])).toBe('M 10 20 L 10 20')
  })

  it('con varios puntos arma M seguido de L por cada uno', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }]
    expect(pointsToPathD(points)).toBe('M 0 0 L 10 10 L 20 5')
  })
})

describe('arrowHeadPoints', () => {
  it('para una flecha horizontal, los puntos laterales quedan simetricos arriba y abajo del final', () => {
    const [left, tip, right] = arrowHeadPoints(0, 0, 10, 0, 3)
    expect(tip).toEqual({ x: 10, y: 0 })
    expect(left.y).toBeCloseTo(-right.y, 5)
    expect(left.x).toBeCloseTo(right.x, 5)
    expect(left.x).toBeLessThan(10)
  })

  it('para una flecha vertical hacia abajo, los puntos laterales quedan simetricos a izquierda y derecha', () => {
    const [left, tip, right] = arrowHeadPoints(0, 0, 0, 10, 3)
    expect(tip).toEqual({ x: 0, y: 10 })
    expect(left.x).toBeCloseTo(-right.x, 5)
    expect(left.y).toBeCloseTo(right.y, 5)
    expect(left.y).toBeLessThan(10)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/boardGeometry.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `boardGeometry.ts`**

```ts
// src/features/coaches/boardGeometry.ts

/** Satura un valor al rango [0, 100] -- coordenadas de la cancha son porcentajes. */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Convierte una lista de puntos del lapiz a un `d` de SVG <path>. */
export function pointsToPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x} ${p.y} L ${p.x} ${p.y}`
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/** Los 2 puntos laterales de la cabeza de una flecha que va de (x1,y1) a (x2,y2). */
export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 3,
): { x: number; y: number }[] {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const spread = Math.PI / 7
  const left = { x: x2 - size * Math.cos(angle - spread), y: y2 - size * Math.sin(angle - spread) }
  const right = { x: x2 - size * Math.cos(angle + spread), y: y2 - size * Math.sin(angle + spread) }
  return [left, { x: x2, y: y2 }, right]
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/boardGeometry.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/boardGeometry.ts src/features/coaches/boardGeometry.test.ts
git commit -m "feat(entrenadores): geometria pura del dibujo de la pizarra tactica"
```

---

## Task 4: Paleta de colores — `tacticalBoardConstants.ts`

**Files:**
- Create: `src/features/coaches/tacticalBoardConstants.ts`

**Interfaces:**
- Consumes: `AnnotationColor` (Task 2, `@/services/tacticalBoardService`).
- Produces: `COLOR_META: Record<AnnotationColor, { hex: string; label: string }>`, `COLOR_ORDER: AnnotationColor[]`.

- [ ] **Step 1: Implementar el archivo**

```ts
// src/features/coaches/tacticalBoardConstants.ts
import type { AnnotationColor } from '@/services/tacticalBoardService'

export const COLOR_META: Record<AnnotationColor, { hex: string; label: string }> = {
  white:   { hex: '#FFFFFF', label: 'Blanco' },
  yellow:  { hex: '#FACC15', label: 'Amarillo' },
  red:     { hex: '#EF4444', label: 'Rojo' },
  skyblue: { hex: '#38BDF8', label: 'Celeste' },
  black:   { hex: '#000000', label: 'Negro' },
}

export const COLOR_ORDER: AnnotationColor[] = ['white', 'yellow', 'red', 'skyblue', 'black']
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/tacticalBoardConstants.ts
git commit -m "feat(entrenadores): paleta de colores de la pizarra tactica"
```

---

## Task 5: `TacticalBoardPitch.tsx` — la cancha interactiva

**Files:**
- Create: `src/features/coaches/components/TacticalBoardPitch.tsx`

**Interfaces:**
- Consumes: `clampPercent`, `pointsToPathD`, `arrowHeadPoints` (Task 3); `COLOR_META` (Task 4); `BoardMarker`, `BoardAnnotation`, `AnnotationColor` (Task 2, tipos).
- Produces: `export type BoardTool = 'mover' | 'lapiz' | 'flecha' | 'zona' | 'texto'`; `TacticalBoardPitch({ markers, annotations, tool, color, onMarkersChange, onAnnotationsChange }: { markers: BoardMarker[]; annotations: BoardAnnotation[]; tool: BoardTool; color: AnnotationColor; onMarkersChange: (markers: BoardMarker[]) => void; onAnnotationsChange: (annotations: BoardAnnotation[]) => void })` — default export. Dueño exclusivo de todo el manejo de puntero (arrastre de fichas + dibujo).

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/TacticalBoardPitch.tsx
import { useRef, useState } from 'react'
import { clampPercent, pointsToPathD, arrowHeadPoints } from '@/features/coaches/boardGeometry'
import { COLOR_META } from '@/features/coaches/tacticalBoardConstants'
import type { BoardMarker, BoardAnnotation, AnnotationColor } from '@/services/tacticalBoardService'

export type BoardTool = 'mover' | 'lapiz' | 'flecha' | 'zona' | 'texto'

interface Point {
  x: number
  y: number
}

function uid(): string {
  return crypto.randomUUID()
}

function BallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth={2}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.2l2.7 2-1 3.1H10.3l-1-3.1L12 8.2zM12 8.2V5.3M9.5 9.7L7 8M14.5 9.7L17 8M10.4 12.8l-2 2.7M13.6 12.8l2 2.7M11 15.3l-.6 3M13 15.3l.6 3" />
    </svg>
  )
}

export default function TacticalBoardPitch({
  markers,
  annotations,
  tool,
  color,
  onMarkersChange,
  onAnnotationsChange,
}: {
  markers: BoardMarker[]
  annotations: BoardAnnotation[]
  tool: BoardTool
  color: AnnotationColor
  onMarkersChange: (markers: BoardMarker[]) => void
  onAnnotationsChange: (annotations: BoardAnnotation[]) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<Point[] | null>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null)
  const [textInput, setTextInput] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')

  function pointFromEvent(e: React.PointerEvent): Point {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: clampPercent(((e.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((e.clientY - rect.top) / rect.height) * 100),
    }
  }

  function handleMarkerPointerDown(e: React.PointerEvent<HTMLDivElement>, marker: BoardMarker) {
    if (tool !== 'mover') return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingMarkerId(marker.id)
    setSelectedMarkerId(marker.id)
  }

  function handleMarkerPointerMove(e: React.PointerEvent<HTMLDivElement>, marker: BoardMarker) {
    if (draggingMarkerId !== marker.id) return
    const p = pointFromEvent(e)
    onMarkersChange(markers.map(m => (m.id === marker.id ? { ...m, x: p.x, y: p.y } : m)))
  }

  function handleMarkerPointerUp(e: React.PointerEvent<HTMLDivElement>, marker: BoardMarker) {
    if (draggingMarkerId !== marker.id) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDraggingMarkerId(null)
  }

  function handleDeleteSelected() {
    if (!selectedMarkerId) return
    onMarkersChange(markers.filter(m => m.id !== selectedMarkerId))
    setSelectedMarkerId(null)
  }

  function handleContainerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === 'mover') {
      setSelectedMarkerId(null)
      return
    }
    const p = pointFromEvent(e)
    containerRef.current!.setPointerCapture(e.pointerId)

    if (tool === 'lapiz') {
      setFreehandPoints([p])
    } else if (tool === 'flecha' || tool === 'zona') {
      setDragStart(p)
      setDragCurrent(p)
    } else if (tool === 'texto') {
      setTextInput(p)
      setTextValue('')
    }
  }

  function handleContainerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === 'lapiz' && freehandPoints) {
      setFreehandPoints([...freehandPoints, pointFromEvent(e)])
    } else if ((tool === 'flecha' || tool === 'zona') && dragStart) {
      setDragCurrent(pointFromEvent(e))
    }
  }

  function handleContainerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === 'lapiz' && freehandPoints) {
      if (freehandPoints.length > 1) {
        onAnnotationsChange([...annotations, { id: uid(), kind: 'freehand', color, points: freehandPoints }])
      }
      setFreehandPoints(null)
    } else if (tool === 'flecha' && dragStart && dragCurrent) {
      onAnnotationsChange([
        ...annotations,
        { id: uid(), kind: 'arrow', color, x1: dragStart.x, y1: dragStart.y, x2: dragCurrent.x, y2: dragCurrent.y },
      ])
      setDragStart(null)
      setDragCurrent(null)
    } else if (tool === 'zona' && dragStart && dragCurrent) {
      onAnnotationsChange([
        ...annotations,
        { id: uid(), kind: 'zone', color, x1: dragStart.x, y1: dragStart.y, x2: dragCurrent.x, y2: dragCurrent.y },
      ])
      setDragStart(null)
      setDragCurrent(null)
    }
    try {
      containerRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
  }

  function commitText() {
    if (textInput && textValue.trim()) {
      onAnnotationsChange([
        ...annotations,
        { id: uid(), kind: 'text', color, x: textInput.x, y: textInput.y, text: textValue.trim() },
      ])
    }
    setTextInput(null)
    setTextValue('')
  }

  return (
    <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl p-4 sm:p-6 relative aspect-[3/4] w-full max-w-xl mx-auto shadow-2xl overflow-hidden select-none touch-none">
      <div
        ref={containerRef}
        className="absolute inset-0"
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
      >
        {/* Lineas de campo -- mismo dibujo que /formacion */}
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

        {/* Anotaciones: lapiz, flechas, zonas, texto */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
          {annotations.map(a => {
            if (a.kind === 'freehand') {
              return (
                <path
                  key={a.id}
                  d={pointsToPathD(a.points)}
                  fill="none"
                  stroke={COLOR_META[a.color].hex}
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            }
            if (a.kind === 'arrow') {
              const head = arrowHeadPoints(a.x1, a.y1, a.x2, a.y2, 3)
              return (
                <g key={a.id}>
                  <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={COLOR_META[a.color].hex} strokeWidth="0.8" />
                  <polygon points={head.map(p => `${p.x},${p.y}`).join(' ')} fill={COLOR_META[a.color].hex} />
                </g>
              )
            }
            if (a.kind === 'zone') {
              const cx = (a.x1 + a.x2) / 2
              const cy = (a.y1 + a.y2) / 2
              const rx = Math.abs(a.x2 - a.x1) / 2
              const ry = Math.abs(a.y2 - a.y1) / 2
              return (
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
            return (
              <text key={a.id} x={a.x} y={a.y} fill={COLOR_META[a.color].hex} fontSize="4" fontWeight="700" dominantBaseline="middle">
                {a.text}
              </text>
            )
          })}

          {/* Trazo/figura en progreso (mientras se arrastra) */}
          {freehandPoints && (
            <path d={pointsToPathD(freehandPoints)} fill="none" stroke={COLOR_META[color].hex} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {dragStart && dragCurrent && tool === 'flecha' && (
            <line x1={dragStart.x} y1={dragStart.y} x2={dragCurrent.x} y2={dragCurrent.y} stroke={COLOR_META[color].hex} strokeWidth="0.8" strokeDasharray="1.5" />
          )}
          {dragStart && dragCurrent && tool === 'zona' && (
            <ellipse
              cx={(dragStart.x + dragCurrent.x) / 2}
              cy={(dragStart.y + dragCurrent.y) / 2}
              rx={Math.abs(dragCurrent.x - dragStart.x) / 2}
              ry={Math.abs(dragCurrent.y - dragStart.y) / 2}
              fill={COLOR_META[color].hex}
              fillOpacity="0.25"
              stroke={COLOR_META[color].hex}
              strokeWidth="0.5"
              strokeDasharray="1.5"
            />
          )}
        </svg>

        {/* Fichas */}
        {markers.map(marker => {
          const isSelected = selectedMarkerId === marker.id
          const bg =
            marker.kind === 'ball'
              ? 'bg-white'
              : marker.team === 'rival'
                ? 'bg-red-500 text-white'
                : 'bg-white text-apple-gray-900'
          return (
            <div
              key={marker.id}
              onPointerDown={e => handleMarkerPointerDown(e, marker)}
              onPointerMove={e => handleMarkerPointerMove(e, marker)}
              onPointerUp={e => handleMarkerPointerUp(e, marker)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg text-xs font-bold ${bg} ${
                isSelected ? 'ring-4 ring-brand-green' : ''
              } ${tool === 'mover' ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            >
              {marker.kind === 'ball' ? <BallIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : marker.label}
            </div>
          )
        })}

        {/* Input de texto en progreso */}
        {textInput && (
          <input
            autoFocus
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={e => e.key === 'Enter' && commitText()}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-bold bg-white/90 rounded px-1.5 py-0.5 outline-none"
            style={{ left: `${textInput.x}%`, top: `${textInput.y}%`, width: '80px' }}
            placeholder="Texto..."
          />
        )}
      </div>

      {selectedMarkerId && tool === 'mover' && (
        <button
          type="button"
          onClick={handleDeleteSelected}
          className="absolute top-2 right-2 min-h-[36px] px-3 rounded-full bg-red-500 text-white text-xs font-semibold shadow-lg"
        >
          Eliminar ficha
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/TacticalBoardPitch.tsx
git commit -m "feat(entrenadores): cancha interactiva de la pizarra tactica (fichas + dibujo)"
```

---

## Task 6: `TacticalBoardToolbar.tsx`

**Files:**
- Create: `src/features/coaches/components/TacticalBoardToolbar.tsx`

**Interfaces:**
- Consumes: `COLOR_META`, `COLOR_ORDER` (Task 4); `BoardTool` (Task 5, `./TacticalBoardPitch`); `AnnotationColor`, `MarkerTeam` (Task 2).
- Produces: `TacticalBoardToolbar({ tool, onToolChange, color, onColorChange, markerTeam, onMarkerTeamChange, onAddGeneric, onAddPlayer, onAddBall, onUndo, onClearAll, canUndo, ballAlreadyPlaced }: {...})` — default export, componente de solo presentación (sin estado propio salvo lo trivial de UI).

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/TacticalBoardToolbar.tsx
import { COLOR_META, COLOR_ORDER } from '@/features/coaches/tacticalBoardConstants'
import type { AnnotationColor, MarkerTeam } from '@/services/tacticalBoardService'
import type { BoardTool } from './TacticalBoardPitch'

const TOOL_META: { id: BoardTool; label: string }[] = [
  { id: 'mover', label: 'Mover' },
  { id: 'lapiz', label: 'Lápiz' },
  { id: 'flecha', label: 'Flecha' },
  { id: 'zona', label: 'Zona' },
  { id: 'texto', label: 'Texto' },
]

export default function TacticalBoardToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  markerTeam,
  onMarkerTeamChange,
  onAddGeneric,
  onAddPlayer,
  onAddBall,
  onUndo,
  onClearAll,
  canUndo,
  ballAlreadyPlaced,
}: {
  tool: BoardTool
  onToolChange: (tool: BoardTool) => void
  color: AnnotationColor
  onColorChange: (color: AnnotationColor) => void
  markerTeam: MarkerTeam
  onMarkerTeamChange: (team: MarkerTeam) => void
  onAddGeneric: () => void
  onAddPlayer: () => void
  onAddBall: () => void
  onUndo: () => void
  onClearAll: () => void
  canUndo: boolean
  ballAlreadyPlaced: boolean
}) {
  return (
    <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TOOL_META.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onToolChange(t.id)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
              tool === t.id
                ? 'bg-brand-green text-apple-gray-900'
                : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tool !== 'mover' && (
        <div className="flex items-center gap-1.5">
          {COLOR_ORDER.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              title={COLOR_META[c].label}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c ? 'border-brand-green scale-110' : 'border-apple-gray-200 dark:border-apple-gray-600'
              }`}
              style={{ backgroundColor: COLOR_META[c].hex }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-apple-gray-200/60 dark:border-apple-gray-700/40">
        <div className="flex items-center gap-1 bg-apple-gray-100 dark:bg-apple-gray-700 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => onMarkerTeamChange('propio')}
            className={`min-h-[28px] px-2.5 rounded-full text-2xs font-semibold transition-colors ${
              markerTeam === 'propio' ? 'bg-white dark:bg-apple-gray-900 text-apple-gray-800 dark:text-white shadow' : 'text-apple-gray-500'
            }`}
          >
            Propio
          </button>
          <button
            type="button"
            onClick={() => onMarkerTeamChange('rival')}
            className={`min-h-[28px] px-2.5 rounded-full text-2xs font-semibold transition-colors ${
              markerTeam === 'rival' ? 'bg-white dark:bg-apple-gray-900 text-apple-gray-800 dark:text-white shadow' : 'text-apple-gray-500'
            }`}
          >
            Rival
          </button>
        </div>
        <button
          type="button"
          onClick={onAddGeneric}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          + Ficha
        </button>
        <button
          type="button"
          onClick={onAddPlayer}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          + Jugador
        </button>
        <button
          type="button"
          onClick={onAddBall}
          disabled={ballAlreadyPlaced}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300 disabled:opacity-40"
        >
          + Pelota
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="min-h-[36px] px-3 rounded-full text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 disabled:opacity-40"
        >
          Deshacer
        </button>
        <button type="button" onClick={onClearAll} className="min-h-[36px] px-3 rounded-full text-xs font-semibold text-red-500">
          Borrar todo
        </button>
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
git add src/features/coaches/components/TacticalBoardToolbar.tsx
git commit -m "feat(entrenadores): barra de herramientas de la pizarra tactica"
```

---

## Task 7: `CoachTacticalBoardTab.tsx` — orquestación

**Files:**
- Create: `src/features/coaches/components/CoachTacticalBoardTab.tsx`

**Interfaces:**
- Consumes: `listTacticalBoards`, `createTacticalBoard`, `updateTacticalBoard`, `renameTacticalBoard`, `deleteTacticalBoard`, `TacticalBoard`, `BoardMarker`, `BoardAnnotation`, `MarkerTeam`, `AnnotationColor` (Task 2); `fetchSquadCached`, `SquadPlayer` (`@/services/footballApiService`, ya existen); `TacticalBoardPitch`, `BoardTool` (Task 5); `TacticalBoardToolbar` (Task 6).
- Produces: `CoachTacticalBoardTab({ coach }: { coach: AgencyCoach })` — default export.

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/CoachTacticalBoardTab.tsx
import { useEffect, useState } from 'react'
import {
  listTacticalBoards,
  createTacticalBoard,
  updateTacticalBoard,
  renameTacticalBoard,
  deleteTacticalBoard,
  type TacticalBoard,
  type BoardMarker,
  type BoardAnnotation,
  type MarkerTeam,
  type AnnotationColor,
} from '@/services/tacticalBoardService'
import { fetchSquadCached, type SquadPlayer } from '@/services/footballApiService'
import TacticalBoardPitch, { type BoardTool } from './TacticalBoardPitch'
import TacticalBoardToolbar from './TacticalBoardToolbar'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function uid(): string {
  return crypto.randomUUID()
}

function PlayerPickerModal({
  players,
  onSelect,
  onClose,
}: {
  players: SquadPlayer[]
  onSelect: (player: SquadPlayer) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-apple-gray-800 rounded-apple-lg max-w-sm w-full max-h-[70vh] overflow-hidden shadow-apple-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-apple-gray-200 dark:border-apple-gray-700">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm text-apple-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/40"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700/40 transition-colors"
            >
              <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{p.name}</span>
              {p.number != null && <span className="text-xs text-apple-gray-400">#{p.number}</span>}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-apple-gray-400 text-center py-8">Sin resultados.</p>}
        </div>
      </div>
    </div>
  )
}

export default function CoachTacticalBoardTab({ coach }: { coach: AgencyCoach }) {
  const [boards, setBoards] = useState<TacticalBoard[] | null>(null)
  const [current, setCurrent] = useState<TacticalBoard | null>(null)
  const [markers, setMarkers] = useState<BoardMarker[]>([])
  const [annotations, setAnnotations] = useState<BoardAnnotation[]>([])
  const [tool, setTool] = useState<BoardTool>('mover')
  const [color, setColor] = useState<AnnotationColor>('white')
  const [markerTeam, setMarkerTeam] = useState<MarkerTeam>('propio')
  const [squad, setSquad] = useState<SquadPlayer[]>([])
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showNewInput, setShowNewInput] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  async function reloadBoards() {
    setBoards(await listTacticalBoards(coach.key))
  }

  useEffect(() => {
    reloadBoards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.key])

  useEffect(() => {
    if (!coach.apiTeamId) return
    fetchSquadCached(coach.apiTeamId).then(setSquad)
  }, [coach.apiTeamId])

  function loadBoard(board: TacticalBoard) {
    setCurrent(board)
    setMarkers(board.markers)
    setAnnotations(board.annotations)
    setShowLoadModal(false)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const board = await createTacticalBoard(coach.key, newName.trim())
    if (board) {
      loadBoard(board)
      await reloadBoards()
    }
    setShowNewInput(false)
    setNewName('')
  }

  async function handleSave() {
    if (!current) return
    setSaving(true)
    try {
      await updateTacticalBoard(current.id, markers, annotations)
      await reloadBoards()
    } finally {
      setSaving(false)
    }
  }

  async function handleRename() {
    if (!current || !renameValue.trim()) return
    await renameTacticalBoard(current.id, renameValue.trim())
    setCurrent({ ...current, name: renameValue.trim() })
    await reloadBoards()
    setRenaming(false)
  }

  async function handleDelete(board: TacticalBoard) {
    const ok = window.confirm(`¿Borrar la pizarra "${board.name}"?`)
    if (!ok) return
    await deleteTacticalBoard(board.id)
    if (current?.id === board.id) {
      setCurrent(null)
      setMarkers([])
      setAnnotations([])
    }
    await reloadBoards()
  }

  function addGenericMarker() {
    const count = markers.filter(m => m.kind === 'generic' && m.team === markerTeam).length
    setMarkers([
      ...markers,
      { id: uid(), kind: 'generic', team: markerTeam, label: String(count + 1), playerId: null, x: 50, y: 65 },
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
        y: 65,
      },
    ])
    setShowPlayerPicker(false)
  }

  function addBallMarker() {
    if (markers.some(m => m.kind === 'ball')) return
    setMarkers([...markers, { id: uid(), kind: 'ball', team: null, label: '', playerId: null, x: 50, y: 65 }])
  }

  function handleUndo() {
    setAnnotations(annotations.slice(0, -1))
  }

  function handleClearAll() {
    if (annotations.length === 0) return
    const ok = window.confirm('¿Borrar todos los dibujos de esta pizarra?')
    if (!ok) return
    setAnnotations([])
  }

  if (boards === null) return <LoadingSpinner message="Cargando pizarras..." />

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        {current ? (
          renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                className="min-h-[36px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 text-sm"
              />
              <button type="button" onClick={() => void handleRename()} className="text-xs font-semibold text-brand-green">
                Guardar nombre
              </button>
              <button type="button" onClick={() => setRenaming(false)} className="text-xs text-apple-gray-400">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenaming(true)
                setRenameValue(current.name)
              }}
              className="text-sm font-semibold text-apple-gray-800 dark:text-white hover:text-brand-green transition-colors"
            >
              {current.name}
            </button>
          )
        ) : (
          <span className="text-sm text-apple-gray-400">Sin pizarra abierta</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowNewInput(true)}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          Nueva
        </button>
        <button
          type="button"
          onClick={() => setShowLoadModal(true)}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          Cargar
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!current || saving}
          className="min-h-[36px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-xs font-semibold disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {current ? (
        <>
          <TacticalBoardToolbar
            tool={tool}
            onToolChange={setTool}
            color={color}
            onColorChange={setColor}
            markerTeam={markerTeam}
            onMarkerTeamChange={setMarkerTeam}
            onAddGeneric={addGenericMarker}
            onAddPlayer={() => setShowPlayerPicker(true)}
            onAddBall={addBallMarker}
            onUndo={handleUndo}
            onClearAll={handleClearAll}
            canUndo={annotations.length > 0}
            ballAlreadyPlaced={markers.some(m => m.kind === 'ball')}
          />
          <TacticalBoardPitch
            markers={markers}
            annotations={annotations}
            tool={tool}
            color={color}
            onMarkersChange={setMarkers}
            onAnnotationsChange={setAnnotations}
          />
        </>
      ) : (
        <div className="flex items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-apple-gray-400 max-w-xs">Creá una pizarra nueva o cargá una guardada para empezar.</p>
        </div>
      )}

      {showPlayerPicker && <PlayerPickerModal players={squad} onSelect={addPlayerMarker} onClose={() => setShowPlayerPicker(false)} />}

      {showNewInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowNewInput(false)}>
          <div className="bg-white dark:bg-apple-gray-800 rounded-apple-lg p-5 max-w-sm w-full shadow-apple-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Nueva pizarra</h3>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Ej: Salida en corto vs 4-4-2"
              className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNewInput(false)} className="flex-1 min-h-[40px] rounded-lg text-sm text-apple-gray-500">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!newName.trim()}
                className="flex-1 min-h-[40px] rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowLoadModal(false)}>
          <div
            className="bg-white dark:bg-apple-gray-800 rounded-apple-lg max-w-md w-full max-h-[70vh] overflow-hidden shadow-apple-lg flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-apple-gray-200 dark:border-apple-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Pizarras guardadas</h3>
              <button type="button" onClick={() => setShowLoadModal(false)} className="text-apple-gray-400" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {boards.map(b => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b border-apple-gray-100 dark:border-apple-gray-700/40">
                  <button type="button" onClick={() => loadBoard(b)} className="text-left flex-1">
                    <p className="text-sm font-semibold text-apple-gray-800 dark:text-white">{b.name}</p>
                    <p className="text-xs text-apple-gray-400">
                      {new Date(b.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                  <button type="button" onClick={() => void handleDelete(b)} className="text-xs text-red-500 font-semibold ml-3">
                    Borrar
                  </button>
                </div>
              ))}
              {boards.length === 0 && <p className="text-sm text-apple-gray-400 text-center py-8">Sin pizarras guardadas todavía.</p>}
            </div>
          </div>
        </div>
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
git add src/features/coaches/components/CoachTacticalBoardTab.tsx
git commit -m "feat(entrenadores): tab de pizarra tactica (pizarras guardadas + selector de jugador)"
```

---

## Task 8: Agregar la tab "Pizarra" en `CoachDetailPage.tsx`

**Files:**
- Modify: `src/pages/CoachDetailPage.tsx`

**Interfaces:**
- Consumes: `CoachTacticalBoardTab` (Task 7).

- [ ] **Step 1: Agregar el import**

Ubicar (línea 8 del archivo actual):

```ts
import CoachNotesTab from '@/features/coaches/components/CoachNotesTab'
```

y agregar debajo:

```ts
import CoachTacticalBoardTab from '@/features/coaches/components/CoachTacticalBoardTab'
```

- [ ] **Step 2: Agregar `'pizarra'` al tipo `CoachTab`**

Ubicar (línea 10 del archivo actual):

```ts
type CoachTab = 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'reserva'
```

y reemplazarlo por:

```ts
type CoachTab = 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'pizarra' | 'reserva'
```

- [ ] **Step 3: Agregar la tab a `TABS`**

Ubicar (líneas 12-19 del archivo actual):

```ts
const TABS: { id: CoachTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'plantel', label: 'Plantel' },
  { id: 'liga', label: 'Liga' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'entrenamientos', label: 'Entrenamientos' },
  { id: 'notas', label: 'Notas de partidos' },
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
]
```

- [ ] **Step 4: Agregar `'pizarra'` a `isValidTab`**

Ubicar (líneas 35-36 del archivo actual):

```ts
  const isValidTab = (val: string): val is CoachTab =>
    ['resumen', 'plantel', 'liga', 'calendario', 'entrenamientos', 'notas', 'reserva'].includes(val)
```

y reemplazarlo por:

```ts
  const isValidTab = (val: string): val is CoachTab =>
    ['resumen', 'plantel', 'liga', 'calendario', 'entrenamientos', 'notas', 'pizarra', 'reserva'].includes(val)
```

- [ ] **Step 5: Renderizar el tab**

Ubicar (línea 164 del archivo actual):

```tsx
      {activeTab === 'notas' && <CoachNotesTab coach={coach} />}
    </div>
  )
}
```

y reemplazarlo por:

```tsx
      {activeTab === 'notas' && <CoachNotesTab coach={coach} />}
      {activeTab === 'pizarra' && <CoachTacticalBoardTab key={coach.key} coach={coach} />}
    </div>
  )
}
```

(`key={coach.key}` fuerza un remount al cambiar de entrenador — mismo criterio ya aplicado en `CoachCalendarTab`, evita que quede una pizarra de otro entrenador cargada en memoria por error.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 8: Commit**

```bash
git add src/pages/CoachDetailPage.tsx
git commit -m "feat(entrenadores): agrega la tab Pizarra a la ficha del entrenador"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 8 nuevos de `boardGeometry.test.ts`.

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Avisar al usuario que corra la migración de Supabase**

`supabase/migrations/20260810_coach_tactical_boards.sql` (Task 1) todavía no corrió en la base real — sin eso, crear/listar/guardar pizarras falla en runtime (tabla inexistente).

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`, tab Pizarra), con la migración ya corrida:
  - "Nueva" pide un nombre y abre la cancha vacía.
  - "+ Ficha" agrega una ficha numerada; se puede arrastrar en modo Mover.
  - "+ Jugador" abre el buscador del plantel y agrega la ficha con dorsal/apellido.
  - "+ Pelota" agrega el ícono de pelota (SVG, no emoji) y se deshabilita si ya hay una.
  - El toggle Propio/Rival cambia el color de las fichas genéricas nuevas.
  - En modo Lápiz se puede dibujar a mano alzada; en Flecha se arrastra y queda una flecha con punta; en Zona queda un óvalo sombreado; en Texto se puede escribir sobre la cancha — los 4 respetan el color elegido.
  - "Deshacer" saca el último dibujo; "Borrar todo" limpia todos los dibujos (con confirmación) sin tocar las fichas.
  - Tocar una ficha en modo Mover la selecciona y aparece "Eliminar ficha".
  - "Guardar" persiste; "Cargar" muestra la lista de pizarras guardadas y las abre; se puede renombrar y borrar una pizarra guardada.
  - Cambiar de entrenador (si aplica) no arrastra la pizarra del anterior.
