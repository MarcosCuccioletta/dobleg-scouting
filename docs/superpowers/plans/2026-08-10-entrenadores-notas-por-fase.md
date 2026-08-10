# Entrenadores — Notas de partido divididas por fase de juego Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la nota de partido única (un textarea libre por partido) por 5 campos separados por fase de juego (Defensiva, Ofensiva, Transiciones, ABP, Observaciones), tanto en el tab de carga (`CoachNotesTab.tsx`, filas plegables) como en la ficha de partido de solo lectura (`CoachMatchDetailPage.tsx`).

**Architecture:** Extensión de la tabla `coach_match_notes` con 5 columnas nuevas + backfill de los datos existentes hacia "Observaciones". `coachService.ts` reemplaza sus 3 funciones de notas (list/get/upsert) por versiones que trabajan con las 5 fases en vez de un string único. Metadata de las fases (label, placeholder, orden) en una constante compartida nueva, mismo patrón que `trainingConstants.ts` del sub-proyecto anterior.

**Tech Stack:** React 18 + TypeScript, Supabase.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-10-entrenadores-notas-por-fase-design.md`.
- Las notas ya cargadas no se pierden — se migran a "Observaciones" en la misma migración SQL (`UPDATE ... SET observaciones = note WHERE ...`).
- `note` (columna vieja) deja de escribirse desde la app, pero no se borra de la tabla.
- Los `select` a Supabase son explícitos por columna, nunca `select('*')` — no acoplar el código nuevo a la columna `note` legacy.
- Sin lógica pura nueva que testear — extensión de esquema + UI reusando patrones ya existentes, sin tests de UI (mismo criterio de toda la sección).
- Seguir el estilo visual y las clases Tailwind ya usadas en `CoachNotesTab.tsx`/`CoachTrainingDayPanel.tsx` — no introducir un sistema de diseño nuevo.

---

## Task 1: Migración de Supabase — columnas de fase + backfill

**Files:**
- Create: `supabase/migrations/20260810_coach_match_notes_phases.sql`

**Interfaces:**
- Produces: `coach_match_notes` gana 5 columnas nullable (`defensiva`, `ofensiva`, `transiciones`, `abp`, `observaciones`, todas `TEXT`); `note` deja de ser `NOT NULL`; las notas existentes se copian a `observaciones`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Notas de partido divididas por fase de juego. `note` (una sola nota libre)
-- deja de escribirse desde la app pero se conserva; las notas ya cargadas se
-- migran a `observaciones` para no perder nada.
ALTER TABLE public.coach_match_notes
  ALTER COLUMN note DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS defensiva TEXT,
  ADD COLUMN IF NOT EXISTS ofensiva TEXT,
  ADD COLUMN IF NOT EXISTS transiciones TEXT,
  ADD COLUMN IF NOT EXISTS abp TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

UPDATE public.coach_match_notes
SET observaciones = note
WHERE observaciones IS NULL AND note IS NOT NULL AND note <> '';
```

- [ ] **Step 2: Verificar que el archivo quedó bien formado**

Run: `cat supabase/migrations/20260810_coach_match_notes_phases.sql`
Expected: el contenido exacto de arriba, sin errores de sintaxis SQL visibles (paréntesis balanceados, `;` al final de cada statement).

No se corre en una base de datos real desde acá — el usuario la corre a mano en Supabase (mismo flujo que las migraciones anteriores de esta rama).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260810_coach_match_notes_phases.sql
git commit -m "feat(entrenadores): agrega columnas de fase a coach_match_notes y migra notas existentes"
```

---

## Task 2: Reemplazar las funciones de notas en `coachService.ts`

**Files:**
- Modify: `src/services/coachService.ts:33-41` (interfaz `CoachMatchNote`), `:102-150` (`listMatchNotes`/`getMatchNote`/`upsertMatchNote`)

**Interfaces:**
- Produces: `interface MatchNotePhases { defensiva: string | null; ofensiva: string | null; transiciones: string | null; abp: string | null; observaciones: string | null }`, `listMatchNotePhases(coachKey: string): Promise<Record<number, MatchNotePhases>>`, `getMatchNotePhases(coachKey: string, fixtureId: number): Promise<MatchNotePhases | null>`, `upsertMatchNotePhases(coachKey: string, fixtureId: number, phases: MatchNotePhases): Promise<{ success: boolean; error?: string }>`.

- [ ] **Step 1: Reemplazar la interfaz `CoachMatchNote`**

Ubicar (líneas 33-41 del archivo actual):

```ts
export interface CoachMatchNote {
  id: number
  coach_key: string
  fixture_id: number
  note: string
  author: string | null
  created_at: string
  updated_at: string
}
```

y reemplazarlo por:

```ts
export interface MatchNotePhases {
  defensiva: string | null
  ofensiva: string | null
  transiciones: string | null
  abp: string | null
  observaciones: string | null
}

export interface CoachMatchNote extends MatchNotePhases {
  id: number
  coach_key: string
  fixture_id: number
  author: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Reemplazar las 3 funciones de notas**

Ubicar (líneas 102-150 del archivo actual):

```ts
export async function listMatchNotes(coachKey: string): Promise<Record<number, string>> {
  const { data, error } = await supabase
    .from('coach_match_notes')
    .select('fixture_id, note')
    .eq('coach_key', coachKey)

  if (error || !data) {
    console.error('Error listando notas de partido:', error)
    return {}
  }

  const result: Record<number, string> = {}
  for (const row of data as unknown as Array<{ fixture_id: number; note: string }>) {
    result[row.fixture_id] = row.note
  }
  return result
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
```

y reemplazarlas por:

```ts
const NOTE_PHASE_COLUMNS = 'defensiva, ofensiva, transiciones, abp, observaciones'

export async function listMatchNotePhases(coachKey: string): Promise<Record<number, MatchNotePhases>> {
  const { data, error } = await supabase
    .from('coach_match_notes')
    .select(`fixture_id, ${NOTE_PHASE_COLUMNS}`)
    .eq('coach_key', coachKey)

  if (error || !data) {
    console.error('Error listando notas de partido:', error)
    return {}
  }

  const result: Record<number, MatchNotePhases> = {}
  for (const row of data as unknown as Array<MatchNotePhases & { fixture_id: number }>) {
    result[row.fixture_id] = {
      defensiva: row.defensiva,
      ofensiva: row.ofensiva,
      transiciones: row.transiciones,
      abp: row.abp,
      observaciones: row.observaciones,
    }
  }
  return result
}

export async function getMatchNotePhases(coachKey: string, fixtureId: number): Promise<MatchNotePhases | null> {
  const { data, error } = await supabase
    .from('coach_match_notes')
    .select(NOTE_PHASE_COLUMNS)
    .eq('coach_key', coachKey)
    .eq('fixture_id', fixtureId)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as MatchNotePhases
}

export async function upsertMatchNotePhases(
  coachKey: string,
  fixtureId: number,
  phases: MatchNotePhases,
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('coach_match_notes').upsert({
    coach_key: coachKey,
    fixture_id: fixtureId,
    defensiva: phases.defensiva || null,
    ofensiva: phases.ofensiva || null,
    transiciones: phases.transiciones || null,
    abp: phases.abp || null,
    observaciones: phases.observaciones || null,
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
```

Sin test propio — funciones de I/O finas sobre Supabase, mismo criterio ya usado en el resto de `coachService.ts`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — esperado en este punto, porque `CoachNotesTab.tsx` y `CoachMatchDetailPage.tsx` (Tasks 4 y 5) todavía importan las funciones viejas (`listMatchNotes`, `getMatchNote`). Confirmá que los únicos errores son justamente esos dos imports rotos, no otra cosa.

- [ ] **Step 4: Commit**

```bash
git add src/services/coachService.ts
git commit -m "feat(entrenadores): funciones de notas de partido por fase de juego"
```

---

## Task 3: Metadata de fases — `matchNotesConstants.ts`

**Files:**
- Create: `src/features/coaches/matchNotesConstants.ts`

**Interfaces:**
- Consumes: `MatchNotePhases` (Task 2, `@/services/coachService`).
- Produces: `PHASE_META: { key: keyof MatchNotePhases; label: string; placeholder: string }[]`.

- [ ] **Step 1: Implementar el archivo**

```ts
// src/features/coaches/matchNotesConstants.ts
import type { MatchNotePhases } from '@/services/coachService'

export const PHASE_META: { key: keyof MatchNotePhases; label: string; placeholder: string }[] = [
  { key: 'defensiva', label: 'Defensiva', placeholder: 'Marca, línea, coberturas...' },
  { key: 'ofensiva', label: 'Ofensiva', placeholder: 'Circulación, generación, definición...' },
  { key: 'transiciones', label: 'Transiciones', placeholder: 'Ataque-defensa y defensa-ataque...' },
  { key: 'abp', label: 'ABP', placeholder: 'Córners, tiros libres, penales...' },
  { key: 'observaciones', label: 'Observaciones', placeholder: 'Otros puntos, contexto del partido...' },
]
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: mismo estado que al final de Task 2 (los errores de `CoachNotesTab.tsx`/`CoachMatchDetailPage.tsx` siguen ahí, nada nuevo roto).

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/matchNotesConstants.ts
git commit -m "feat(entrenadores): metadata compartida de fases de notas de partido"
```

---

## Task 4: `CoachNotesTab.tsx` — filas plegables por fase

**Files:**
- Modify: `src/features/coaches/components/CoachNotesTab.tsx` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: `listMatchNotePhases`, `upsertMatchNotePhases`, `MatchNotePhases` (Task 2), `PHASE_META` (Task 3).
- Produces: `CoachNotesTab({ coach }: { coach: AgencyCoach })` — mismo default export y misma firma que hoy, ningún caller cambia.

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```tsx
// src/features/coaches/components/CoachNotesTab.tsx
import { useEffect, useState } from 'react'
import { fetchTeamFixtures } from '@/services/footballApiService'
import { listMatchNotePhases, upsertMatchNotePhases, type MatchNotePhases } from '@/services/coachService'
import { PHASE_META } from '@/features/coaches/matchNotesConstants'
import { isMatchFinished } from '@/utils/coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const EMPTY_PHASES: MatchNotePhases = {
  defensiva: null,
  ofensiva: null,
  transiciones: null,
  abp: null,
  observaciones: null,
}

/** Etiqueta de fecha corta, evitando el corrimiento de huso horario de `new Date(iso)`
 *  (mismo criterio que CoachCalendarTab/CoachTrainingTab). */
function formatMatchDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

function phasesEqual(a: MatchNotePhases, b: MatchNotePhases): boolean {
  return PHASE_META.every(p => (a[p.key] ?? '') === (b[p.key] ?? ''))
}

function hasAnyContent(phases: MatchNotePhases): boolean {
  return PHASE_META.some(p => (phases[p.key] ?? '').trim().length > 0)
}

function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function NoteRow({
  coach,
  fixture,
  initialPhases,
  defaultExpanded,
}: {
  coach: AgencyCoach
  fixture: AgencyFixture
  initialPhases: MatchNotePhases
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [phases, setPhases] = useState(initialPhases)
  const [savedPhases, setSavedPhases] = useState(initialPhases)
  const [status, setStatus] = useState<SaveStatus>('idle')

  const dirty = !phasesEqual(phases, savedPhases)
  const canSave = dirty && status !== 'saving'

  async function handleSave() {
    if (!canSave) return
    setStatus('saving')
    const res = await upsertMatchNotePhases(coach.key, fixture.fixtureId, phases)
    if (!res.success) {
      setStatus('error')
      return
    }
    setSavedPhases(phases)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 1500)
  }

  const opponent = fixture.isHome ? fixture.awayTeam : fixture.homeTeam
  const buttonLabel =
    status === 'saving' ? 'Guardando...' : status === 'saved' ? 'Guardado ✓' : status === 'error' ? 'Reintentar' : 'Guardar'

  return (
    <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 overflow-hidden">
      <button type="button" onClick={() => setExpanded(v => !v)} className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left">
        <img src={opponent.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">
            {fixture.isHome ? 'vs' : '@'} {opponent.name}
          </p>
          <p className="text-xs text-apple-gray-400">
            {fixture.goalsHome} - {fixture.goalsAway} &middot; {formatMatchDate(fixture.date)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {PHASE_META.map(p => (
            <span
              key={p.key}
              title={p.label}
              className={`w-1.5 h-1.5 rounded-full ${
                (savedPhases[p.key] ?? '').trim() ? 'bg-brand-green' : 'bg-apple-gray-200 dark:bg-apple-gray-700'
              }`}
            />
          ))}
        </div>
        <ChevronIcon className="w-4 h-4 text-apple-gray-400 flex-shrink-0" expanded={expanded} />
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-apple-gray-200/60 dark:border-apple-gray-700/40 pt-4">
          {PHASE_META.map(phase => (
            <div key={phase.key}>
              <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">{phase.label}</label>
              <textarea
                value={phases[phase.key] ?? ''}
                onChange={e => setPhases({ ...phases, [phase.key]: e.target.value })}
                placeholder={phase.placeholder}
                rows={2}
                className="w-full min-h-[56px] resize-y rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 py-2 text-sm text-apple-gray-800 dark:text-white placeholder:text-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition-colors"
              />
            </div>
          ))}
          <div className="flex items-center justify-end gap-2">
            {status === 'error' && <span className="text-xs text-brand-red">Error al guardar</span>}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className="min-h-[40px] px-4 rounded-lg bg-brand-green text-apple-gray-900 text-xs font-semibold transition-all duration-200 ease-apple hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CoachNotesTab({ coach }: { coach: AgencyCoach }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)
  const [notes, setNotes] = useState<Record<number, MatchNotePhases>>({})

  useEffect(() => {
    if (!coach.apiTeamId) return
    let active = true
    // Una sola consulta de notas para toda la pestaña en vez de una por fila
    // (evitaba un N+1 de ~20+ requests a Supabase cada vez que se abría Notas).
    Promise.all([fetchTeamFixtures(coach.apiTeamId), listMatchNotePhases(coach.key)]).then(([f, n]) => {
      if (!active) return
      setFixtures(f)
      setNotes(n)
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId, coach.key])

  if (!coach.apiTeamId) {
    return (
      <div className="flex items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-apple-gray-400 max-w-xs">No hay datos de equipo disponibles para este entrenador todavía.</p>
      </div>
    )
  }

  if (fixtures === null) return <LoadingSpinner message="Cargando partidos..." />

  const played = [...fixtures].filter(f => isMatchFinished(f.statusShort)).sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="space-y-3 animate-fade-in">
      {played.map((f, i) => {
        const initialPhases = notes[f.fixtureId] ?? EMPTY_PHASES
        return (
          <NoteRow
            key={f.fixtureId}
            coach={coach}
            fixture={f}
            initialPhases={initialPhases}
            defaultExpanded={i === 0 && !hasAnyContent(initialPhases)}
          />
        )
      })}
      {played.length === 0 && (
        <div className="flex items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-apple-gray-400 max-w-xs">Sin partidos jugados todavía.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: solo debería quedar el error de `CoachMatchDetailPage.tsx` (Task 5), que todavía usa `getMatchNote`.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/CoachNotesTab.tsx
git commit -m "feat(entrenadores): notas de partido en filas plegables por fase de juego"
```

---

## Task 5: `CoachMatchDetailPage.tsx` — lectura por fase

**Files:**
- Modify: `src/pages/CoachMatchDetailPage.tsx:12` (import), `:138` (estado), `:155` (fetch), `:214-227` (render)

**Interfaces:**
- Consumes: `getMatchNotePhases`, `MatchNotePhases` (Task 2), `PHASE_META` (Task 3).

- [ ] **Step 1: Cambiar el import**

Ubicar (línea 12 del archivo actual):

```ts
import { getMatchNote } from '@/services/coachService'
```

y reemplazarlo por:

```ts
import { getMatchNotePhases, type MatchNotePhases } from '@/services/coachService'
import { PHASE_META } from '@/features/coaches/matchNotesConstants'
```

- [ ] **Step 2: Cambiar el estado**

Ubicar (línea 138 del archivo actual):

```ts
  const [note, setNote] = useState<string | null>(null)
```

y reemplazarlo por:

```ts
  const [notePhases, setNotePhases] = useState<MatchNotePhases | null>(null)
```

- [ ] **Step 3: Cambiar la carga de datos**

Ubicar (línea 155 del archivo actual):

```ts
    getMatchNote(coach.key, Number(fixtureId)).then(n => { if (active) setNote(n) })
```

y reemplazarlo por:

```ts
    getMatchNotePhases(coach.key, Number(fixtureId)).then(p => { if (active) setNotePhases(p) })
```

- [ ] **Step 4: Cambiar el render**

Ubicar (líneas 214-227 del archivo actual):

```tsx
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
```

y reemplazarlo por:

```tsx
      {notePhases && PHASE_META.some(p => (notePhases[p.key] ?? '').trim()) && (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-apple-gray-400 uppercase tracking-wide">Notas del DT</p>
            <Link
              to={`/entrenadores/${coach.key}?tab=notas`}
              className="text-2xs font-semibold text-brand-green hover:underline"
            >
              Editar en Notas de partidos
            </Link>
          </div>
          <div className="space-y-3">
            {PHASE_META.filter(p => (notePhases[p.key] ?? '').trim()).map(p => (
              <div key={p.key}>
                <p className="text-2xs font-semibold uppercase tracking-wide text-apple-gray-400 mb-1">{p.label}</p>
                <p className="text-sm text-apple-gray-700 dark:text-apple-gray-300 whitespace-pre-wrap">{notePhases[p.key]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 7: Commit**

```bash
git add src/pages/CoachMatchDetailPage.tsx
git commit -m "feat(entrenadores): ficha de partido muestra las notas por fase de juego"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde (sin tests nuevos en este plan, solo confirmar que nada se rompió).

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Avisar al usuario que corra la migración de Supabase**

`supabase/migrations/20260810_coach_match_notes_phases.sql` (Task 1) todavía no corrió en la base real. Hasta que no corra: las notas viejas siguen en la columna `note` (no aparecen como "Observaciones" en la UI nueva todavía), y guardar una nota nueva por fase va a fallar porque las columnas no existen.

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`, tab Notas de partidos), con la migración ya corrida:
  - Los partidos jugados se ven como filas plegables con puntitos de fase (verdes si tienen contenido).
  - El partido más reciente sin notas arranca abierto.
  - Escribir en una o más fases y guardar persiste los 5 campos juntos.
  - Una nota vieja (cargada antes de este cambio) aparece bajo "Observaciones" después de correr la migración.
  - En la ficha de un partido con notas, se ven solo las fases con contenido, cada una con su título.
