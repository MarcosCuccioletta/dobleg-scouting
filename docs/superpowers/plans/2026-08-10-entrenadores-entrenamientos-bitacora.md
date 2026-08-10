# Entrenadores — Entrenamientos como bitácora semanal con insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el tab Entrenamientos (hoy: formulario mínimo + lista plana) por una bitácora semanal tipo almanaque, con carga de sesión más rica (duración, intensidad, notas, foco del día) e insights automáticos calculados por reglas sobre los datos cargados.

**Architecture:** Dos módulos puros y testeados (`trainingWeek.ts` para el cálculo de la semana, `trainingInsights.ts` para las reglas de insights). Dos componentes nuevos (`CoachTrainingDayPanel.tsx` para ver/cargar/editar las sesiones de un día, `CoachTrainingInsightsBar.tsx` para la franja de insights) y una constante compartida (`trainingConstants.ts`). `CoachTrainingTab.tsx` se reescribe para orquestar todo: franja semanal + panel del día + historial.

**Tech Stack:** React 18 + TypeScript, Supabase, Vitest (`.test.ts` de lógica pura).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-10-entrenadores-entrenamientos-bitacora-design.md`.
- La semana es Lunes a Domingo (calendario simple, no microciclo real de partido a partido) — mismo criterio que el Calendario del sub-proyecto #4.
- `title` sigue siendo el nombre corto obligatorio de la sesión; `notes` (columna ya existente, sin usar hasta ahora) pasa a ser el contenido largo opcional.
- Sin `CHECK` de base de datos sobre los valores de `focus_tags` — la forma la valida la capa de aplicación (mismo criterio que `raw_metrics JSONB` en `coach_match_team_stats`).
- Insights solo se calculan y se muestran con 5 o más sesiones cargadas (`hasEnoughData`) — evita ruido en las primeras cargas.
- Sin integración de IA/LLM nueva — los insights son reglas simples sobre los datos, mismo espíritu que `src/features/informes/insights/` ya existente en el proyecto.
- Tests son solo de lógica pura (`.test.ts`), sobre `trainingWeek.ts` y `trainingInsights.ts` — los componentes no se testean (mismo criterio ya usado en toda la sección Entrenadores).
- Seguir el estilo visual y las clases Tailwind ya usadas en el `CoachTrainingTab.tsx` actual y en `CoachCalendarTab.tsx` — no introducir un sistema de diseño nuevo.

---

## Task 1: Migración de Supabase — columnas nuevas en `coach_training_sessions`

**Files:**
- Create: `supabase/migrations/20260810_coach_training_sessions_richer.sql`

**Interfaces:**
- Produces: `coach_training_sessions` gana 3 columnas: `duration_minutes INTEGER`, `intensity SMALLINT`, `focus_tags TEXT[] NOT NULL DEFAULT '{}'`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Entrenamientos como bitacora: campos nuevos para calcular carga e insights.
-- `notes` ya existia en la tabla, sin usar en la UI hasta ahora.
ALTER TABLE public.coach_training_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER CHECK (duration_minutes > 0),
  ADD COLUMN IF NOT EXISTS intensity SMALLINT CHECK (intensity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS focus_tags TEXT[] NOT NULL DEFAULT '{}'::text[];
```

- [ ] **Step 2: Verificar que el archivo quedó bien formado**

Run: `cat supabase/migrations/20260810_coach_training_sessions_richer.sql`
Expected: el contenido exacto de arriba, sin errores de sintaxis SQL visibles (paréntesis balanceados, `;` al final de cada statement).

No se corre en una base de datos real desde acá — el usuario la corre a mano en Supabase (mismo flujo que las migraciones anteriores de esta rama).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260810_coach_training_sessions_richer.sql
git commit -m "feat(entrenadores): agrega duracion, intensidad y foco a coach_training_sessions"
```

---

## Task 2: Extender `coachService.ts` con los campos nuevos

**Files:**
- Modify: `src/services/coachService.ts:5-25` (interfaces `CoachTrainingSession`/`CoachTrainingSessionInput`), `:64-81` (`upsertTrainingSession`)

**Interfaces:**
- Produces: `CoachTrainingSession` y `CoachTrainingSessionInput` ganan `duration_minutes: number | null`, `intensity: number | null`, `focus_tags: string[]` (los dos primeros opcionales en el input, `focus_tags` opcional con default `[]` al persistir). `upsertTrainingSession` persiste los 3 campos nuevos.

- [ ] **Step 1: Reemplazar las interfaces**

Ubicar (líneas 5-25 del archivo actual):

```ts
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
```

y reemplazarlo por:

```ts
export interface CoachTrainingSession {
  id: number
  coach_key: string
  session_date: string
  session_time: string | null
  type: TrainingSessionType
  title: string
  notes: string | null
  duration_minutes: number | null
  intensity: number | null
  focus_tags: string[]
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
  duration_minutes?: number | null
  intensity?: number | null
  focus_tags?: string[]
}
```

- [ ] **Step 2: Persistir los campos nuevos en `upsertTrainingSession`**

Ubicar (líneas 64-81 del archivo actual):

```ts
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
```

y reemplazarlo por:

```ts
export async function upsertTrainingSession(input: CoachTrainingSessionInput): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_training_sessions').upsert({
    ...(input.id ? { id: input.id } : {}),
    coach_key: input.coach_key,
    session_date: input.session_date,
    session_time: input.session_time ?? null,
    type: input.type,
    title: input.title,
    notes: input.notes ?? null,
    duration_minutes: input.duration_minutes ?? null,
    intensity: input.intensity ?? null,
    focus_tags: input.focus_tags ?? [],
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Error guardando entrenamiento:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
```

Sin test propio — `upsertTrainingSession`/`listTrainingSessions` son envoltorios finos sobre Supabase (I/O), mismo criterio ya usado en el resto de `coachService.ts`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/services/coachService.ts
git commit -m "feat(entrenadores): duracion, intensidad y foco en CoachTrainingSession"
```

---

## Task 3: Lógica pura de la semana de entrenamiento

**Files:**
- Create: `src/features/coaches/trainingWeek.ts`
- Create: `src/features/coaches/trainingWeek.test.ts`

**Interfaces:**
- Produces: `getWeekDates(referenceDateKey: string): string[]` — 7 ArDateKeys ('YYYY-MM-DD'), Lunes a Domingo, de la semana que contiene `referenceDateKey`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/trainingWeek.test.ts
import { describe, it, expect } from 'vitest'
import { getWeekDates } from './trainingWeek'

describe('getWeekDates', () => {
  it('devuelve 7 fechas consecutivas empezando en lunes para una fecha a mitad de semana', () => {
    // 2026-08-12 es un miercoles
    const dates = getWeekDates('2026-08-12')
    expect(dates).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'])
  })

  it('si la fecha de referencia ya es lunes, la semana arranca ahi mismo', () => {
    const dates = getWeekDates('2026-08-10') // lunes
    expect(dates[0]).toBe('2026-08-10')
    expect(dates).toHaveLength(7)
  })

  it('si la fecha de referencia es domingo, es el ultimo dia de esa semana', () => {
    const dates = getWeekDates('2026-08-16') // domingo
    expect(dates[6]).toBe('2026-08-16')
    expect(dates[0]).toBe('2026-08-10')
  })

  it('cruza correctamente de un mes a otro', () => {
    const dates = getWeekDates('2026-08-31') // lunes
    expect(dates[0]).toBe('2026-08-31')
    expect(dates[6]).toBe('2026-09-06')
  })

  it('cruza correctamente de un año a otro', () => {
    const dates = getWeekDates('2025-12-29') // lunes
    expect(dates[0]).toBe('2025-12-29')
    expect(dates[6]).toBe('2026-01-04')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/trainingWeek.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `trainingWeek.ts`**

```ts
// src/features/coaches/trainingWeek.ts

function parseArDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// getDay() de JS es 0=Domingo..6=Sabado; esto lo convierte a 0=Lunes..6=Domingo.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** Las 7 fechas (Lunes a Domingo) de la semana que contiene `referenceDateKey`.
 *  Anclado a mediodia (no medianoche) para no depender de bordes de DST. */
export function getWeekDates(referenceDateKey: string): string[] {
  const ref = parseArDateKey(referenceDateKey)
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - mondayIndex(ref), 12)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12)
    dates.push(formatDateKey(d))
  }
  return dates
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/trainingWeek.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/trainingWeek.ts src/features/coaches/trainingWeek.test.ts
git commit -m "feat(entrenadores): calculo puro de la semana de entrenamiento"
```

---

## Task 4: Motor de insights — lógica pura

**Files:**
- Create: `src/features/coaches/trainingInsights.ts`
- Create: `src/features/coaches/trainingInsights.test.ts`

**Interfaces:**
- Consumes: `CoachTrainingSession` (Task 2, ya extendida con `duration_minutes`/`intensity`/`focus_tags`).
- Produces: `interface TrainingInsights { hasEnoughData: boolean; streakDays: number; topFocus: { tag: string; count: number } | null; overloadWarning: boolean }`, `computeTrainingInsights(sessions: CoachTrainingSession[], todayKey: string): TrainingInsights`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/trainingInsights.test.ts
import { describe, it, expect } from 'vitest'
import { computeTrainingInsights } from './trainingInsights'
import type { CoachTrainingSession } from '@/services/coachService'

function mkSession(over: Partial<CoachTrainingSession> = {}): CoachTrainingSession {
  return {
    id: 1, coach_key: 'domingo', session_date: '2026-08-10', session_time: null,
    type: 'tactico', title: 'Sesion', notes: null,
    duration_minutes: null, intensity: null, focus_tags: [],
    created_at: '', updated_at: '',
    ...over,
  }
}

describe('computeTrainingInsights', () => {
  it('con menos de 5 sesiones, hasEnoughData es false y el resto queda en blanco', () => {
    const sessions = [mkSession(), mkSession({ id: 2 })]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result).toEqual({ hasEnoughData: false, streakDays: 0, topFocus: null, overloadWarning: false })
  })

  it('calcula la racha de dias consecutivos hasta hoy, cortando en el primer salteado', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-06' }),
      mkSession({ id: 2, session_date: '2026-08-07' }),
      mkSession({ id: 3, session_date: '2026-08-08' }),
      mkSession({ id: 4, session_date: '2026-08-09' }),
      mkSession({ id: 5, session_date: '2026-08-10' }),
      mkSession({ id: 6, session_date: '2026-08-03' }), // salteado antes, no debe sumar
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.streakDays).toBe(5)
  })

  it('si hoy todavia no se cargo nada, la racha arranca del dia cargado mas reciente', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-07' }),
      mkSession({ id: 2, session_date: '2026-08-08' }),
      mkSession({ id: 3, session_date: '2026-08-09' }),
      mkSession({ id: 4, session_date: '2026-08-01' }),
      mkSession({ id: 5, session_date: '2026-08-02' }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.streakDays).toBe(3)
  })

  it('el foco predominante es el tag mas frecuente entre las ultimas 10 sesiones', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01', focus_tags: ['Posesión'] }),
      mkSession({ id: 2, session_date: '2026-08-02', focus_tags: ['Finalización'] }),
      mkSession({ id: 3, session_date: '2026-08-03', focus_tags: ['Finalización'] }),
      mkSession({ id: 4, session_date: '2026-08-04', focus_tags: ['Finalización'] }),
      mkSession({ id: 5, session_date: '2026-08-05', focus_tags: ['Posesión'] }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.topFocus).toEqual({ tag: 'Finalización', count: 3 })
  })

  it('en un empate, gana el tag de la sesion mas reciente', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01', focus_tags: ['Posesión'] }),
      mkSession({ id: 2, session_date: '2026-08-02', focus_tags: ['Finalización'] }),
      mkSession({ id: 3, session_date: '2026-08-03', focus_tags: [] }),
      mkSession({ id: 4, session_date: '2026-08-04', focus_tags: [] }),
      mkSession({ id: 5, session_date: '2026-08-05', focus_tags: [] }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.topFocus).toEqual({ tag: 'Finalización', count: 1 })
  })

  it('sin ningun tag cargado, topFocus es null', () => {
    const sessions = [1, 2, 3, 4, 5].map(n => mkSession({ id: n, session_date: `2026-08-0${n}` }))
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.topFocus).toBeNull()
  })

  it('avisa de sobrecarga si las ultimas 3 sesiones son de intensidad alta sin recuperacion', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01' }),
      mkSession({ id: 2, session_date: '2026-08-02' }),
      mkSession({ id: 3, session_date: '2026-08-08', type: 'tactico', intensity: 4 }),
      mkSession({ id: 4, session_date: '2026-08-09', type: 'fisico', intensity: 5 }),
      mkSession({ id: 5, session_date: '2026-08-10', type: 'tactico', intensity: 4 }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.overloadWarning).toBe(true)
  })

  it('no avisa si alguna de las ultimas 3 es de recuperacion', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01' }),
      mkSession({ id: 2, session_date: '2026-08-02' }),
      mkSession({ id: 3, session_date: '2026-08-08', type: 'tactico', intensity: 4 }),
      mkSession({ id: 4, session_date: '2026-08-09', type: 'recuperacion', intensity: 4 }),
      mkSession({ id: 5, session_date: '2026-08-10', type: 'tactico', intensity: 5 }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.overloadWarning).toBe(false)
  })

  it('no avisa si falta la intensidad en alguna de las ultimas 3', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01' }),
      mkSession({ id: 2, session_date: '2026-08-02' }),
      mkSession({ id: 3, session_date: '2026-08-08', type: 'tactico', intensity: 4 }),
      mkSession({ id: 4, session_date: '2026-08-09', type: 'tactico', intensity: null }),
      mkSession({ id: 5, session_date: '2026-08-10', type: 'tactico', intensity: 5 }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.overloadWarning).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/trainingInsights.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `trainingInsights.ts`**

```ts
// src/features/coaches/trainingInsights.ts
import type { CoachTrainingSession } from '@/services/coachService'

export interface TrainingInsights {
  hasEnoughData: boolean
  streakDays: number
  topFocus: { tag: string; count: number } | null
  overloadWarning: boolean
}

const MIN_SESSIONS_FOR_INSIGHTS = 5
const TOP_FOCUS_WINDOW = 10
const OVERLOAD_WINDOW = 3
const OVERLOAD_MIN_INTENSITY = 4

function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days, 12)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function computeStreakDays(sessions: CoachTrainingSession[], todayKey: string): number {
  const datesWithSession = new Set(sessions.map(s => s.session_date))
  if (datesWithSession.size === 0) return 0

  let cursor: string | undefined
  if (datesWithSession.has(todayKey)) {
    cursor = todayKey
  } else {
    const pastDates = [...datesWithSession].filter(d => d <= todayKey).sort()
    cursor = pastDates[pastDates.length - 1]
  }
  if (!cursor) return 0

  let streak = 0
  let day = cursor
  while (datesWithSession.has(day)) {
    streak++
    day = addDaysToKey(day, -1)
  }
  return streak
}

function computeTopFocus(sessions: CoachTrainingSession[]): { tag: string; count: number } | null {
  const recent = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date)).slice(0, TOP_FOCUS_WINDOW)

  const counts = new Map<string, number>()
  const mostRecentIndex = new Map<string, number>()
  recent.forEach((s, idx) => {
    for (const tag of s.focus_tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
      if (!mostRecentIndex.has(tag)) mostRecentIndex.set(tag, idx)
    }
  })

  if (counts.size === 0) return null

  let bestTag: string | null = null
  let bestCount = 0
  let bestRecency = Infinity
  for (const [tag, count] of counts) {
    const recency = mostRecentIndex.get(tag)!
    if (count > bestCount || (count === bestCount && recency < bestRecency)) {
      bestTag = tag
      bestCount = count
      bestRecency = recency
    }
  }
  return bestTag ? { tag: bestTag, count: bestCount } : null
}

function computeOverloadWarning(sessions: CoachTrainingSession[]): boolean {
  const recent = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date)).slice(0, OVERLOAD_WINDOW)
  if (recent.length < OVERLOAD_WINDOW) return false
  return recent.every(s => s.intensity !== null && s.intensity >= OVERLOAD_MIN_INTENSITY && s.type !== 'recuperacion')
}

export function computeTrainingInsights(sessions: CoachTrainingSession[], todayKey: string): TrainingInsights {
  if (sessions.length < MIN_SESSIONS_FOR_INSIGHTS) {
    return { hasEnoughData: false, streakDays: 0, topFocus: null, overloadWarning: false }
  }
  return {
    hasEnoughData: true,
    streakDays: computeStreakDays(sessions, todayKey),
    topFocus: computeTopFocus(sessions),
    overloadWarning: computeOverloadWarning(sessions),
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/trainingInsights.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/trainingInsights.ts src/features/coaches/trainingInsights.test.ts
git commit -m "feat(entrenadores): motor de insights de entrenamientos (racha, foco, sobrecarga)"
```

---

## Task 5: `CoachTrainingInsightsBar.tsx`

**Files:**
- Create: `src/features/coaches/components/CoachTrainingInsightsBar.tsx`

**Interfaces:**
- Consumes: `TrainingInsights` (Task 4).
- Produces: `CoachTrainingInsightsBar({ insights }: { insights: TrainingInsights })` — default export. Devuelve `null` si `insights.hasEnoughData` es `false`.

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/coaches/components/CoachTrainingInsightsBar.tsx
import type { TrainingInsights } from '@/features/coaches/trainingInsights'

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 22c4.5 0 7.5-3 7.5-7 0-3.5-2-5.5-3-7.5-.5 2-1.5 3-2.5 3 .5-3-1-6-4-7 .5 3-1 5-2.5 7C6 12.5 4.5 14 4.5 16c0 4 3 6 7.5 6z"
      />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <circle cx="12" cy="12" r="0.5" strokeWidth={2} />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

export default function CoachTrainingInsightsBar({ insights }: { insights: TrainingInsights }) {
  if (!insights.hasEnoughData) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {insights.streakDays > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-500/10 text-orange-500 px-3 py-1.5 rounded-full">
          <FlameIcon className="w-4 h-4" />
          {insights.streakDays} {insights.streakDays === 1 ? 'día seguido' : 'días seguidos'}
        </span>
      )}
      {insights.topFocus && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-full">
          <TargetIcon className="w-4 h-4" />
          Foco: {insights.topFocus.tag}
        </span>
      )}
      {insights.overloadWarning && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-500/10 text-red-500 px-3 py-1.5 rounded-full">
          <WarningIcon className="w-4 h-4" />
          Varios días de alta intensidad seguidos
        </span>
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
git add src/features/coaches/components/CoachTrainingInsightsBar.tsx
git commit -m "feat(entrenadores): franja de insights de entrenamientos"
```

---

## Task 6: Constantes compartidas + `CoachTrainingDayPanel.tsx`

**Files:**
- Create: `src/features/coaches/trainingConstants.ts`
- Create: `src/features/coaches/components/CoachTrainingDayPanel.tsx`

**Interfaces:**
- Consumes: `upsertTrainingSession`, `deleteTrainingSession`, `CoachTrainingSession`, `TrainingSessionType` (Task 2, `@/services/coachService`).
- Produces: `TYPE_META: Record<TrainingSessionType, { label: string; badgeClass: string; dotClass: string }>`, `FOCUS_TAGS: readonly string[]` (`trainingConstants.ts`); `CoachTrainingDayPanel({ coachKey, dateKey, sessions, onChanged }: { coachKey: string; dateKey: string; sessions: CoachTrainingSession[]; onChanged: () => void })` — default export.

- [ ] **Step 1: Implementar `trainingConstants.ts`**

```ts
// src/features/coaches/trainingConstants.ts
import type { TrainingSessionType } from '@/services/coachService'

export const TYPE_META: Record<TrainingSessionType, { label: string; badgeClass: string; dotClass: string }> = {
  tactico: { label: 'Táctico', badgeClass: 'bg-blue-500/10 text-blue-500', dotClass: 'bg-blue-500' },
  fisico: { label: 'Físico', badgeClass: 'bg-orange-500/10 text-orange-500', dotClass: 'bg-orange-500' },
  recuperacion: { label: 'Recuperación', badgeClass: 'bg-teal-500/10 text-teal-500', dotClass: 'bg-teal-500' },
  set_pieces: { label: 'Pelota parada', badgeClass: 'bg-purple-500/10 text-purple-500', dotClass: 'bg-purple-500' },
  pre_rival: { label: 'Pre-rival', badgeClass: 'bg-red-500/10 text-red-500', dotClass: 'bg-red-500' },
  otro: {
    label: 'Otro',
    badgeClass: 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400',
    dotClass: 'bg-apple-gray-400',
  },
}

export const FOCUS_TAGS = [
  'Finalización',
  'Posesión',
  'Pressing',
  'Transiciones',
  'ABP',
  'Físico aeróbico',
  'Fuerza',
  'Táctico defensivo',
  'Táctico ofensivo',
] as const
```

- [ ] **Step 2: Implementar `CoachTrainingDayPanel.tsx`**

```tsx
// src/features/coaches/components/CoachTrainingDayPanel.tsx
import { useState } from 'react'
import {
  upsertTrainingSession,
  deleteTrainingSession,
  type CoachTrainingSession,
  type TrainingSessionType,
} from '@/services/coachService'
import { TYPE_META, FOCUS_TAGS } from '@/features/coaches/trainingConstants'

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6.75 6.75v10.5M17.25 6.75v10.5M3 9.75v4.5M21 9.75v4.5M6.75 12h10.5"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M6 7.5h12M9.75 7.5V6a1.5 1.5 0 011.5-1.5h1.5A1.5 1.5 0 0114.25 6v1.5m-7.5 0 .621 10.556A2.25 2.25 0 009.615 19.5h4.77a2.25 2.25 0 002.244-2.444L17.25 7.5m-9 3.75v5.25m4.5-5.25v5.25"
      />
    </svg>
  )
}

const inputClass =
  'w-full min-h-[44px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm text-apple-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition-colors'

interface DraftSession {
  id?: number
  session_time: string
  type: TrainingSessionType
  title: string
  duration_minutes: string
  intensity: number | null
  focus_tags: string[]
  notes: string
}

function emptyDraft(): DraftSession {
  return { session_time: '', type: 'tactico', title: '', duration_minutes: '', intensity: null, focus_tags: [], notes: '' }
}

function sessionToDraft(s: CoachTrainingSession): DraftSession {
  return {
    id: s.id,
    session_time: s.session_time ?? '',
    type: s.type,
    title: s.title,
    duration_minutes: s.duration_minutes != null ? String(s.duration_minutes) : '',
    intensity: s.intensity,
    focus_tags: s.focus_tags,
    notes: s.notes ?? '',
  }
}

function IntensityPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(level => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          aria-label={`Intensidad ${level}`}
          className={`w-8 h-8 rounded-full border-2 text-xs font-bold transition-colors ${
            value !== null && level <= value
              ? 'bg-brand-green border-brand-green text-apple-gray-900'
              : 'border-apple-gray-200 dark:border-apple-gray-700 text-apple-gray-300 dark:text-apple-gray-600'
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  )
}

function SessionForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitting,
}: {
  draft: DraftSession
  onChange: (draft: DraftSession) => void
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
}) {
  const toggleTag = (tag: string) => {
    onChange({
      ...draft,
      focus_tags: draft.focus_tags.includes(tag) ? draft.focus_tags.filter(t => t !== tag) : [...draft.focus_tags, tag],
    })
  }

  const canSubmit = draft.title.trim().length > 0 && !submitting

  return (
    <div className="space-y-3 bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Horario</label>
          <input type="time" value={draft.session_time} onChange={e => onChange({ ...draft, session_time: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Tipo</label>
          <select value={draft.type} onChange={e => onChange({ ...draft, type: e.target.value as TrainingSessionType })} className={inputClass}>
            {Object.entries(TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Duración (min)</label>
          <input
            type="number"
            min={1}
            value={draft.duration_minutes}
            onChange={e => onChange({ ...draft, duration_minutes: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Intensidad</label>
          <IntensityPicker value={draft.intensity} onChange={v => onChange({ ...draft, intensity: v })} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Título</label>
        <input
          type="text"
          value={draft.title}
          onChange={e => onChange({ ...draft, title: e.target.value })}
          placeholder="Ej: Trabajo de definición"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Foco del día</label>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
                draft.focus_tags.includes(tag)
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-white dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 border border-apple-gray-200 dark:border-apple-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Notas</label>
        <textarea
          value={draft.notes}
          onChange={e => onChange({ ...draft, notes: e.target.value })}
          rows={3}
          placeholder="Qué se trabajó, observaciones..."
          className={`${inputClass} min-h-[80px] py-2`}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="min-h-[40px] px-5 rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} className="min-h-[40px] px-4 rounded-lg text-sm text-apple-gray-500 hover:text-apple-gray-700 dark:hover:text-apple-gray-300">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function CoachTrainingDayPanel({
  coachKey,
  dateKey,
  sessions,
  onChanged,
}: {
  coachKey: string
  dateKey: string
  sessions: CoachTrainingSession[]
  onChanged: () => void
}) {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<DraftSession>(emptyDraft())
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const startEdit = (session: CoachTrainingSession) => {
    setDraft(sessionToDraft(session))
    setEditingId(session.id)
  }

  const startNew = () => {
    setDraft(emptyDraft())
    setEditingId('new')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const handleSubmit = async () => {
    if (!draft.title.trim() || submitting) return
    setSubmitting(true)
    try {
      await upsertTrainingSession({
        ...(typeof editingId === 'number' ? { id: editingId } : {}),
        coach_key: coachKey,
        session_date: dateKey,
        session_time: draft.session_time || null,
        type: draft.type,
        title: draft.title.trim(),
        notes: draft.notes.trim() || null,
        duration_minutes: draft.duration_minutes ? Number(draft.duration_minutes) : null,
        intensity: draft.intensity,
        focus_tags: draft.focus_tags,
      })
      cancelEdit()
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (session: CoachTrainingSession) => {
    const ok = window.confirm(`¿Borrar la sesión "${session.title}"?`)
    if (!ok) return
    setDeletingId(session.id)
    try {
      await deleteTrainingSession(session.id)
      onChanged()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {sessions.map(session => {
        const meta = TYPE_META[session.type]
        if (editingId === session.id) {
          return (
            <SessionForm key={session.id} draft={draft} onChange={setDraft} onSubmit={() => void handleSubmit()} onCancel={cancelEdit} submitting={submitting} />
          )
        }
        return (
          <div
            key={session.id}
            className="flex items-start justify-between gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-4 py-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.badgeClass}`}>
                <DumbbellIcon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <button type="button" onClick={() => startEdit(session)} className="text-left">
                  <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate hover:text-brand-green transition-colors">
                    {session.title}
                  </p>
                </button>
                <p className="text-xs text-apple-gray-400">
                  {meta.label}
                  {session.session_time && ` · ${session.session_time.slice(0, 5)}`}
                  {session.duration_minutes && ` · ${session.duration_minutes}'`}
                  {session.intensity && ` · Intensidad ${session.intensity}/5`}
                </p>
                {session.focus_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {session.focus_tags.map(tag => (
                      <span
                        key={tag}
                        className="text-2xs font-medium px-2 py-0.5 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {session.notes && <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mt-1.5 whitespace-pre-wrap">{session.notes}</p>}
              </div>
            </div>
            <button
              onClick={() => void handleDelete(session)}
              disabled={deletingId === session.id}
              aria-label={`Borrar sesión ${session.title}`}
              className="flex-shrink-0 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-apple-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        )
      })}

      {editingId === 'new' ? (
        <SessionForm draft={draft} onChange={setDraft} onSubmit={() => void handleSubmit()} onCancel={cancelEdit} submitting={submitting} />
      ) : (
        <button
          type="button"
          onClick={startNew}
          className="w-full min-h-[44px] rounded-lg border-2 border-dashed border-apple-gray-200 dark:border-apple-gray-700 text-sm font-medium text-apple-gray-400 hover:text-brand-green hover:border-brand-green/40 transition-colors"
        >
          + Agregar sesión
        </button>
      )}

      {sessions.length === 0 && editingId !== 'new' && (
        <p className="text-sm text-apple-gray-300 dark:text-apple-gray-600 text-center py-2">Sin entrenamientos este día.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/features/coaches/trainingConstants.ts src/features/coaches/components/CoachTrainingDayPanel.tsx
git commit -m "feat(entrenadores): panel de carga y edicion de un dia de entrenamiento"
```

---

## Task 7: `CoachTrainingTab.tsx` — reescritura a bitácora semanal

**Files:**
- Modify: `src/features/coaches/components/CoachTrainingTab.tsx` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: `getWeekDates` (Task 3), `computeTrainingInsights` (Task 4), `CoachTrainingInsightsBar` (Task 5), `TYPE_META` (Task 6, `@/features/coaches/trainingConstants`), `CoachTrainingDayPanel` (Task 6), `listTrainingSessions` (Task 2), `fetchTeamFixtures`/`toArDateKey` (`@/services/footballApiService`, ya existen).
- Produces: `CoachTrainingTab({ coach }: { coach: AgencyCoach })` — mismo default export y misma firma que hoy, ningún caller cambia.

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```tsx
// src/features/coaches/components/CoachTrainingTab.tsx
import { useEffect, useMemo, useState } from 'react'
import { fetchTeamFixtures, toArDateKey } from '@/services/footballApiService'
import { listTrainingSessions, type CoachTrainingSession } from '@/services/coachService'
import { getWeekDates } from '@/features/coaches/trainingWeek'
import { computeTrainingInsights } from '@/features/coaches/trainingInsights'
import { TYPE_META } from '@/features/coaches/trainingConstants'
import CoachTrainingInsightsBar from './CoachTrainingInsightsBar'
import CoachTrainingDayPanel from './CoachTrainingDayPanel'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import type { AgencyFixture } from '@/types/footballApi'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function parseArDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function formatSessionDate(sessionDate: string): string {
  const [y, m, d] = sessionDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function CoachTrainingTab({ coach }: { coach: AgencyCoach }) {
  const [sessions, setSessions] = useState<CoachTrainingSession[] | null>(null)
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)
  const todayKey = useMemo(() => toArDateKey(new Date()), [])
  const [referenceDate, setReferenceDate] = useState(todayKey)
  const [selectedDate, setSelectedDate] = useState(todayKey)

  async function reload() {
    setSessions(await listTrainingSessions(coach.key))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.key])

  useEffect(() => {
    if (!coach.apiTeamId) {
      setFixtures([])
      return
    }
    let active = true
    fetchTeamFixtures(coach.apiTeamId).then(f => {
      if (active) setFixtures(f)
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId])

  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate])

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CoachTrainingSession[]>()
    if (!sessions) return map
    for (const s of sessions) {
      const arr = map.get(s.session_date) ?? []
      arr.push(s)
      map.set(s.session_date, arr)
    }
    return map
  }, [sessions])

  const fixtureDatesInWeek = useMemo(() => {
    const set = new Set<string>()
    if (!fixtures) return set
    for (const f of fixtures) {
      const key = toArDateKey(f.date)
      if (weekDates.includes(key)) set.add(key)
    }
    return set
  }, [fixtures, weekDates])

  const insights = useMemo(() => {
    if (!sessions) return null
    return computeTrainingInsights(sessions, todayKey)
  }, [sessions, todayKey])

  if (sessions === null || fixtures === null) return <LoadingSpinner message="Cargando entrenamientos..." />

  const goPrevWeek = () => {
    const d = parseArDateKey(weekDates[0])
    d.setDate(d.getDate() - 7)
    const key = toArDateKey(d)
    setReferenceDate(key)
    setSelectedDate(key)
  }

  const goNextWeek = () => {
    const d = parseArDateKey(weekDates[0])
    d.setDate(d.getDate() + 7)
    const key = toArDateKey(d)
    setReferenceDate(key)
    setSelectedDate(key)
  }

  const goToday = () => {
    setReferenceDate(todayKey)
    setSelectedDate(todayKey)
  }

  const isCurrentWeek = weekDates.includes(todayKey)

  const weekLabel = (() => {
    const first = parseArDateKey(weekDates[0])
    const last = parseArDateKey(weekDates[6])
    const firstLabel = capitalize(first.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }))
    const lastLabel = capitalize(last.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }))
    return `${firstLabel} - ${lastLabel}`
  })()

  const historySessions = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date))

  return (
    <div className="space-y-5 animate-fade-in">
      {insights && <CoachTrainingInsightsBar insights={insights} />}

      <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goPrevWeek}
            aria-label="Semana anterior"
            className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{weekLabel}</span>
            {!isCurrentWeek && (
              <button type="button" onClick={goToday} className="text-2xs font-semibold text-brand-green hover:underline">
                Esta semana
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={goNextWeek}
            aria-label="Semana siguiente"
            className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map((dateKey, i) => {
            const isToday = dateKey === todayKey
            const isSelected = dateKey === selectedDate
            const daySessions = sessionsByDate.get(dateKey) ?? []
            const hasMatch = fixtureDatesInWeek.has(dateKey)
            const parsed = parseArDateKey(dateKey)

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDate(dateKey)}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-apple-lg transition-colors duration-150 ease-apple ${
                  isSelected
                    ? 'bg-brand-green text-apple-gray-900'
                    : isToday
                      ? 'bg-brand-green/10 text-brand-green'
                      : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800'
                }`}
              >
                <span className="text-2xs font-semibold uppercase">{WEEKDAY_LABELS[i]}</span>
                <span className="text-sm font-bold">{parsed.getDate()}</span>
                <span className="flex items-center gap-0.5 h-2">
                  {daySessions.slice(0, 3).map(s => (
                    <span key={s.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_META[s.type].dotClass}`} />
                  ))}
                  {hasMatch && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900' : 'bg-apple-gray-400'}`} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <CoachTrainingDayPanel coachKey={coach.key} dateKey={selectedDate} sessions={sessionsByDate.get(selectedDate) ?? []} onChanged={reload} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Historial</h2>
        {historySessions.map(s => {
          const meta = TYPE_META[s.type]
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{s.title}</p>
                <p className="text-xs text-apple-gray-400">
                  {formatSessionDate(s.session_date)} · {meta.label}
                  {s.duration_minutes && ` · ${s.duration_minutes}'`}
                  {s.intensity && ` · Int. ${s.intensity}/5`}
                </p>
              </div>
              <span className={`text-2xs font-semibold px-2 py-1 rounded-full ${meta.badgeClass} flex-shrink-0`}>{meta.label}</span>
            </div>
          )
        })}
        {historySessions.length === 0 && (
          <div className="flex items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-apple-gray-400 max-w-xs">
              Sin entrenamientos agendados. Tocá un día de la semana de arriba para cargar el primero.
            </p>
          </div>
        )}
      </div>
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
git add src/features/coaches/components/CoachTrainingTab.tsx
git commit -m "feat(entrenadores): entrenamientos como bitacora semanal"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 14 nuevos de este plan (5 de `trainingWeek.test.ts` + 9 de `trainingInsights.test.ts`).

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Avisar al usuario que corra la migración de Supabase**

`supabase/migrations/20260810_coach_training_sessions_richer.sql` (Task 1) todavía no corrió en la base real — sin eso, guardar duración/intensidad/foco falla silenciosamente en runtime (las columnas no existen, Supabase devuelve error y `upsertTrainingSession` lo loguea pero la sesión no se guarda).

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`, tab Entrenamientos), con la migración ya corrida:
  - Se ve la franja semanal (L a D) con el día de hoy resaltado.
  - Tocar "+ Agregar sesión" en el panel de abajo permite cargar tipo, horario, duración, intensidad, foco y notas.
  - Guardar una sesión hace aparecer su puntito de color en el día correspondiente de la franja.
  - Cargar 5 o más sesiones hace aparecer la franja de insights (racha, foco predominante, aviso de sobrecarga si corresponde).
  - Las flechas cambian de semana; "Esta semana" vuelve a la actual.
  - El historial de abajo muestra las sesiones con los badges de duración/intensidad cuando están cargados.
  - Editar y borrar una sesión existente sigue funcionando desde el panel del día.
