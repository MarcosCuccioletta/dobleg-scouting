# Informe de Entrenador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el informe de entrenador (CV compartible para ofrecer un DT de la agencia a clubes) como feature real de la app, migrando de paso el roster de Entrenadores de un array hardcodeado a Supabase.

**Architecture:** Dos subsistemas secuenciales. (1) **Roster de entrenadores en Supabase**: tabla `agency_coaches` + servicio CRUD, reemplaza `AGENCY_COACHES`/`getCoachByKey` en los 3 sitios que los tocan directo; el resto de la ficha de Entrenadores no cambia (sigue consumiendo `AgencyCoach` como prop, mismo shape). (2) **Informe de DT**: subsistema **paralelo** al de Informes de jugador — tipos, store (localStorage) y export HTML propios (`src/features/informesDT/`), no una unión discriminada dentro del `Informe` de jugador existente. Se decidió así en el plan (la spec lo dejó abierto) para no arriesgar el wizard de jugador, que ya está en producción: el motor de comparación por-90/percentiles de jugador no aplica a datos de equipo, y forzar una unión de tipos habría tocado `Step2Metricas`, `Step3Contenido`, `Step4Preview` y las 1594 líneas de `exportInformeHTML.ts` sin necesidad real. Se reusa sí: el patrón de `informesStore.ts` (guardado local comprimido), el patrón de `shareInforme.ts` (upload a Storage + link `/i/*`), y sobre todo el parser de Wyscout de equipo que **ya existe** en Entrenadores (`parseWyscoutTeamStatsXlsx`) — no se reinventa un parser de archivo nuevo. El diseño visual final (HTML) sale directo del mockup validado (`public/informe-dt-domingo-preview.html`), con el bug de blur cuadrado corregido desde el arranque.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind, Supabase (Postgres + Storage), `xlsx` (SheetJS) para parseo, `lz-string` para compresión de localStorage, Vitest para tests.

**Spec:** `docs/superpowers/specs/2026-08-28-informe-entrenador-design.md`

## Global Constraints

- Nunca usar emojis en la UI — SVG lineal o texto con color (preferencia explícita y repetida del usuario).
- El scoring/datos de jugadores no se toca en este plan — es una feature separada de equipo/DT.
- No pushear a `origin` salvo pedido explícito del usuario — solo commits locales.
- `agency_coaches.key` es texto (slug), igual convención que ya usan `coach_training_sessions.coach_key`, `coach_match_notes`, etc. — no se agrega una FK real hacia esas tablas en este plan (serían cambios en migraciones ya en producción, fuera de alcance).
- El "récord de Domingo" que sirve de fixture de test en varias tareas (27 PJ, 11-11-5, PPG 1.63, GF-GC 31-24, posesión 50.2% vs 49.8%, xG 0.96 vs 1.32, PPDA 8.71 vs 9.19, duelos aéreos 49.8% vs 41.5%) sale de datos reales verificados contra el Excel `Team Stats Temperley (3).xlsx` — usarlos tal cual en los tests, no inventar otros números.

---

## File Structure

```
supabase/migrations/
  20260828_agency_coaches.sql              # tabla nueva + RLS

src/services/
  agencyCoachesService.ts                  # listCoaches, getCoachByKey (async, Supabase), createCoach

src/constants/
  agencyCoaches.ts                         # queda SOLO el tipo AgencyCoach (se borra el array y getCoachByKey sync)

src/pages/
  CoachesListPage.tsx                      # MODIFICA: fetch async con loading/error
  CoachDetailPage.tsx                      # MODIFICA: fetch async con loading/error
  CoachMatchDetailPage.tsx                 # MODIFICA: fetch async con loading/error

src/features/coaches/components/
  AddCoachModal.tsx                        # NUEVO: formulario "+ Agregar entrenador"

src/features/informesDT/
  types.ts                                 # InformeDT, InformeDTContent, tipos de gráfico elegible
  trophyCatalog.ts                         # catálogo fijo competencia -> imagen de trofeo
  coachAggregation.ts                      # funciones puras: récord, comparativa vs rival, sistemas, disciplina, forma reciente
  informeDTStore.ts                        # persistencia localStorage (mismo patrón que informesStore.ts)
  buildInformeDTHtml.ts                    # genera el HTML autocontenido (a partir del mockup validado)
  exportInformeDTHTML.ts                   # descarga el HTML como archivo
  components/
    InformeDTWizard.tsx                    # orquesta los 4 pasos (análogo a InformesPage pero solo DT)
    Step1CoachYArchivo.tsx                 # elegir DT del roster + subir Wyscout Team Stats
    Step2GraficosDT.tsx                    # elegir ejes del radar + qué gráficos de evolución incluir
    Step3ContenidoDT.tsx                   # editor: récord/comparativa editable/sistemas/disciplina/forma/experiencia jugador/carrera DT
    Step4PreviewDT.tsx                     # preview con las 6 tabs + guardar/exportar/compartir

src/pages/
  InformesPage.tsx                         # MODIFICA: selector Jugador/DT en "Nuevo informe", lista mezclada

src/features/informes/
  exportInformeHTML.ts                     # MODIFICA: fix del bug de blur cuadrado en .dg-tabbar-wrap/.dg-tabbar
```

---

### Task 1: Tabla `agency_coaches` en Supabase

**Files:**
- Create: `supabase/migrations/20260828_agency_coaches.sql`

**Interfaces:**
- Produces: tabla `public.agency_coaches` con columnas `key text primary key, full_name text not null, photo_url text, status text not null default 'activo', club text, api_team_id int, reserve_api_team_id int, league_api_id int, league_name text, league_season int, coach_api_id int, relationship text not null default 'propio', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()`

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260828_agency_coaches.sql
CREATE TABLE IF NOT EXISTS public.agency_coaches (
  key TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status = ANY (ARRAY['activo', 'sin_club'])),
  club TEXT,
  api_team_id INT,
  reserve_api_team_id INT,
  league_api_id INT,
  league_name TEXT,
  league_season INT,
  coach_api_id INT,
  relationship TEXT NOT NULL DEFAULT 'propio' CHECK (relationship = ANY (ARRAY['propio', 'intermediado'])),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_coaches_active_idx ON public.agency_coaches(active);

ALTER TABLE public.agency_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_agency_coaches" ON public.agency_coaches;
CREATE POLICY "read_agency_coaches" ON public.agency_coaches FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_agency_coaches" ON public.agency_coaches;
CREATE POLICY "write_agency_coaches" ON public.agency_coaches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.agency_coaches (key, full_name, photo_url, status, club, api_team_id, league_api_id, league_name, league_season, relationship)
VALUES ('domingo', 'Nicolás Domingo', '/coaches/domingo.png', 'activo', 'Temperley', 454, 129, 'Primera Nacional', 2026, 'propio')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.agency_coaches (key, full_name, photo_url, status, club, coach_api_id, relationship)
VALUES ('stillitano', 'Leandro Stillitano', '/coaches/stillitano.png', 'sin_club', NULL, 19200, 'propio')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Avisar al usuario que tiene que correr esta migración a mano en Supabase**

No hay CLI de Supabase logueado con permisos de escritura de schema en este entorno (patrón ya establecido en el resto del proyecto — ver migraciones anteriores como `20260810_coach_tactical_boards.sql`). Al llegar a este punto, decirle al usuario: "corré `supabase/migrations/20260828_agency_coaches.sql` en el SQL Editor de Supabase antes de seguir probando el roster."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260828_agency_coaches.sql
git commit -m "feat(entrenadores): agrega tabla agency_coaches con Domingo y Stillitano seed"
```

---

### Task 2: Servicio `agencyCoachesService.ts`

**Files:**
- Create: `src/services/agencyCoachesService.ts`
- Create: `src/services/agencyCoachesService.test.ts`
- Modify: `src/constants/agencyCoaches.ts`
- Delete: `src/constants/agencyCoaches.test.ts` (sus 3 casos migran al test nuevo, ya no aplica — el archivo prueba `getCoachByKey` síncrono contra el array hardcodeado que se borra en este task)

**Interfaces:**
- Consumes: cliente Supabase ya configurado en `src/lib/supabase.ts` (mismo import que usa el resto del proyecto, ej. `src/services/marketService.ts`)
- Produces:
  - `export async function listAgencyCoaches(): Promise<AgencyCoach[]>` — solo `active = true`, ordenado por `full_name`
  - `export async function getAgencyCoachByKey(key: string): Promise<AgencyCoach | null>`
  - `export async function createAgencyCoach(input: { key: string; fullName: string; photo: string | null; club: string | null; relationship: 'propio' | 'intermediado' }): Promise<AgencyCoach>`
  - `AgencyCoach` sigue teniendo exactamente el mismo shape que hoy (se mapean los nombres de columna snake_case -> camelCase en el servicio)

- [ ] **Step 1: Dejar `AgencyCoach` como único export de `agencyCoaches.ts`**

```ts
// src/constants/agencyCoaches.ts
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
  relationship: 'propio' | 'intermediado'
}
```

Borrar `AGENCY_COACHES` y `getCoachByKey` de este archivo — ya no viven acá.

- [ ] **Step 2: Borrar el test viejo que prueba el array hardcodeado**

```bash
rm src/constants/agencyCoaches.test.ts
```

- [ ] **Step 3: Escribir el test del servicio nuevo (falla porque el archivo no existe)**

```ts
// src/services/agencyCoachesService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { listAgencyCoaches, getAgencyCoachByKey, createAgencyCoach } from './agencyCoachesService'

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = vi.fn(self)
  builder.eq = vi.fn(self)
  builder.order = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.insert = vi.fn(self)
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('listAgencyCoaches', () => {
  it('mapea las columnas snake_case de Supabase al shape de AgencyCoach', async () => {
    mockFrom.mockReturnValue(chain({
      data: [{
        key: 'domingo', full_name: 'Nicolás Domingo', photo_url: '/coaches/domingo.png',
        status: 'activo', club: 'Temperley', api_team_id: 454, reserve_api_team_id: null,
        league_api_id: 129, league_name: 'Primera Nacional', league_season: 2026,
        coach_api_id: null, relationship: 'propio',
      }],
      error: null,
    }))
    const coaches = await listAgencyCoaches()
    expect(coaches).toEqual([{
      key: 'domingo', fullName: 'Nicolás Domingo', photo: '/coaches/domingo.png',
      status: 'activo', club: 'Temperley', apiTeamId: 454, reserveApiTeamId: null,
      leagueApiId: 129, leagueName: 'Primera Nacional', leagueSeason: 2026,
      coachApiId: null, relationship: 'propio',
    }])
  })

  it('devuelve [] si Supabase devuelve error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('boom') }))
    expect(await listAgencyCoaches()).toEqual([])
  })
})

describe('getAgencyCoachByKey', () => {
  it('devuelve null si no existe la key', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }))
    expect(await getAgencyCoachByKey('inexistente')).toBeNull()
  })
})

describe('createAgencyCoach', () => {
  it('inserta y devuelve el registro creado mapeado', async () => {
    mockFrom.mockReturnValue(chain({
      data: {
        key: 'nuevo-dt', full_name: 'Nuevo DT', photo_url: null, status: 'sin_club',
        club: null, api_team_id: null, reserve_api_team_id: null, league_api_id: null,
        league_name: null, league_season: null, coach_api_id: null, relationship: 'intermediado',
      },
      error: null,
    }))
    const created = await createAgencyCoach({
      key: 'nuevo-dt', fullName: 'Nuevo DT', photo: null, club: null, relationship: 'intermediado',
    })
    expect(created.key).toBe('nuevo-dt')
    expect(created.relationship).toBe('intermediado')
  })
})
```

- [ ] **Step 4: Correr el test, confirmar que falla**

Run: `npx vitest run src/services/agencyCoachesService.test.ts`
Expected: FAIL — `Cannot find module './agencyCoachesService'`

- [ ] **Step 5: Implementar el servicio**

```ts
// src/services/agencyCoachesService.ts
import { supabase } from '@/lib/supabase'
import type { AgencyCoach } from '@/constants/agencyCoaches'

interface AgencyCoachRow {
  key: string
  full_name: string
  photo_url: string | null
  status: 'activo' | 'sin_club'
  club: string | null
  api_team_id: number | null
  reserve_api_team_id: number | null
  league_api_id: number | null
  league_name: string | null
  league_season: number | null
  coach_api_id: number | null
  relationship: 'propio' | 'intermediado'
}

function mapRow(row: AgencyCoachRow): AgencyCoach {
  return {
    key: row.key,
    fullName: row.full_name,
    photo: row.photo_url,
    status: row.status,
    club: row.club,
    apiTeamId: row.api_team_id,
    reserveApiTeamId: row.reserve_api_team_id,
    leagueApiId: row.league_api_id,
    leagueName: row.league_name,
    leagueSeason: row.league_season,
    coachApiId: row.coach_api_id,
    relationship: row.relationship,
  }
}

export async function listAgencyCoaches(): Promise<AgencyCoach[]> {
  const { data, error } = await supabase
    .from('agency_coaches')
    .select('*')
    .eq('active', true)
    .order('full_name')
  if (error || !data) return []
  return (data as AgencyCoachRow[]).map(mapRow)
}

export async function getAgencyCoachByKey(key: string): Promise<AgencyCoach | null> {
  const { data, error } = await supabase
    .from('agency_coaches')
    .select('*')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as AgencyCoachRow)
}

export async function createAgencyCoach(input: {
  key: string
  fullName: string
  photo: string | null
  club: string | null
  relationship: 'propio' | 'intermediado'
}): Promise<AgencyCoach> {
  const { data, error } = await supabase
    .from('agency_coaches')
    .insert({
      key: input.key,
      full_name: input.fullName,
      photo_url: input.photo,
      club: input.club,
      status: input.club ? 'activo' : 'sin_club',
      relationship: input.relationship,
    })
    .select('*')
    .single()
  if (error || !data) throw error ?? new Error('No se pudo crear el entrenador')
  return mapRow(data as AgencyCoachRow)
}
```

- [ ] **Step 6: Correr el test, confirmar que pasa**

Run: `npx vitest run src/services/agencyCoachesService.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add src/services/agencyCoachesService.ts src/services/agencyCoachesService.test.ts src/constants/agencyCoaches.ts
git rm src/constants/agencyCoaches.test.ts
git commit -m "feat(entrenadores): agencyCoachesService reemplaza el roster hardcodeado"
```

---

### Task 3: `CoachesListPage`, `CoachDetailPage`, `CoachMatchDetailPage` — fetch async

**Files:**
- Modify: `src/pages/CoachesListPage.tsx`
- Modify: `src/pages/CoachDetailPage.tsx`
- Modify: `src/pages/CoachMatchDetailPage.tsx`

**Interfaces:**
- Consumes: `listAgencyCoaches()`, `getAgencyCoachByKey(key)` de Task 2

Estos 3 archivos son los únicos que tocan `AGENCY_COACHES`/`getCoachByKey` directo (confirmado por grep en toda `src/`). El resto de los componentes de Entrenadores (`CoachBioTab`, `CoachSummaryTab`, etc.) reciben `coach: AgencyCoach` como prop y no cambian.

- [ ] **Step 1: `CoachesListPage.tsx` — reemplazar el `.map` síncrono por fetch + loading/error**

Reemplazar `import { AGENCY_COACHES } from '@/constants/agencyCoaches'` por:

```tsx
import { useEffect, useState } from 'react'
import { listAgencyCoaches } from '@/services/agencyCoachesService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
```

Al inicio del componente:

```tsx
const [coaches, setCoaches] = useState<AgencyCoach[] | null>(null)

useEffect(() => {
  let active = true
  listAgencyCoaches().then(list => { if (active) setCoaches(list) })
  return () => { active = false }
}, [])

if (coaches === null) return <LoadingSpinner message="Cargando entrenadores..." />
```

Y cambiar `{AGENCY_COACHES.map(coach => ...)}` por `{coaches.map(coach => ...)}` (el resto del JSX de cada card no cambia — mismo shape de `AgencyCoach`).

- [ ] **Step 2: `CoachDetailPage.tsx` — reemplazar `getCoachByKey` síncrono**

Reemplazar `import { getCoachByKey } from '@/constants/agencyCoaches'` por:

```tsx
import { useEffect, useState } from 'react'
import { getAgencyCoachByKey } from '@/services/agencyCoachesService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
```

Reemplazar `const coach = coachKey ? getCoachByKey(coachKey) : undefined` por:

```tsx
const [coach, setCoach] = useState<AgencyCoach | null | undefined>(undefined) // undefined = cargando, null = no existe

useEffect(() => {
  if (!coachKey) { setCoach(null); return }
  let active = true
  getAgencyCoachByKey(coachKey).then(c => { if (active) setCoach(c) })
  return () => { active = false }
}, [coachKey])

if (coach === undefined) return <LoadingSpinner message="Cargando entrenador..." />
if (!coach) return <NotFound /> // usar el mismo componente/mensaje que ya usaba el caso "no encontrado"
```

El resto del componente sigue usando `coach.status`, `coach.photo`, etc. sin cambios — a partir de acá `coach` es siempre `AgencyCoach` no-nulo, TypeScript lo va a exigir con este narrowing.

- [ ] **Step 3: `CoachMatchDetailPage.tsx` — mismo patrón que Step 2**

Aplicar exactamente el mismo cambio (`getCoachByKey` síncrono → `getAgencyCoachByKey` async con estado `undefined`/`null`/`AgencyCoach`) en la línea 134 de este archivo.

- [ ] **Step 4: Verificar en el navegador**

Correr `npm run dev`, abrir `/entrenadores` (lista), `/entrenadores/domingo` (detalle) y un partido de Domingo — confirmar que cargan igual que antes (con un spinner breve) y que no rompió nada. Requiere haber corrido la migración del Task 1 en Supabase.

- [ ] **Step 5: `tsc` y `npm run build` limpios**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add src/pages/CoachesListPage.tsx src/pages/CoachDetailPage.tsx src/pages/CoachMatchDetailPage.tsx
git commit -m "feat(entrenadores): CoachesListPage/CoachDetailPage/CoachMatchDetailPage leen el roster de Supabase"
```

---

### Task 4: Formulario "+ Agregar entrenador"

**Files:**
- Create: `src/features/coaches/components/AddCoachModal.tsx`
- Modify: `src/pages/CoachesListPage.tsx`

**Interfaces:**
- Consumes: `createAgencyCoach()` de Task 2
- Produces: `<AddCoachModal onClose={() => void} onCreated={(coach: AgencyCoach) => void} />`

- [ ] **Step 1: Implementar el modal**

```tsx
// src/features/coaches/components/AddCoachModal.tsx
import { useState } from 'react'
import { createAgencyCoach } from '@/services/agencyCoachesService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import { normalizeForSearch } from '@/lib/search'

function slugify(name: string): string {
  return normalizeForSearch(name).replace(/\s+/g, '-')
}

export default function AddCoachModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (coach: AgencyCoach) => void
}) {
  const [fullName, setFullName] = useState('')
  const [club, setClub] = useState('')
  const [relationship, setRelationship] = useState<'propio' | 'intermediado'>('propio')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!fullName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const coach = await createAgencyCoach({
        key: slugify(fullName),
        fullName: fullName.trim(),
        photo: null,
        club: club.trim() || null,
        relationship,
      })
      onCreated(coach)
    } catch {
      setError('No se pudo guardar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-apple-gray-900 rounded-apple-lg p-6 w-full max-w-sm space-y-4">
        <h3 className="text-base font-semibold text-apple-gray-800 dark:text-white">Agregar entrenador</h3>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Nombre completo"
          className="w-full px-3 py-2.5 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
        />
        <input
          value={club}
          onChange={e => setClub(e.target.value)}
          placeholder="Club actual (opcional)"
          className="w-full px-3 py-2.5 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRelationship('propio')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${relationship === 'propio' ? 'bg-brand-green text-apple-gray-900' : 'bg-apple-gray-100 dark:bg-apple-gray-800'}`}
          >
            Cliente propio
          </button>
          <button
            type="button"
            onClick={() => setRelationship('intermediado')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${relationship === 'intermediado' ? 'bg-brand-green text-apple-gray-900' : 'bg-apple-gray-100 dark:bg-apple-gray-800'}`}
          >
            Intermediado
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-apple-gray-500">Cancelar</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!fullName.trim() || saving}
            className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Cablear el botón en `CoachesListPage.tsx`**

Agregar estado `const [showAdd, setShowAdd] = useState(false)`, un botón "+ Agregar entrenador" que lo abre, y renderizar `{showAdd && <AddCoachModal onClose={() => setShowAdd(false)} onCreated={coach => { setCoaches(prev => prev ? [...prev, coach] : [coach]); setShowAdd(false) }} />}`.

- [ ] **Step 3: Verificar en el navegador**

Abrir `/entrenadores`, click en "+ Agregar entrenador", cargar un nombre de prueba, confirmar que aparece en la lista sin recargar la página. Borrar el registro de prueba de la tabla en Supabase después de probar.

- [ ] **Step 4: `tsc` limpio y commit**

```bash
npx tsc --noEmit
git add src/features/coaches/components/AddCoachModal.tsx src/pages/CoachesListPage.tsx
git commit -m "feat(entrenadores): formulario para agregar entrenadores propios o intermediados"
```

---

### Task 5: Tipos del Informe de DT

**Files:**
- Create: `src/features/informesDT/types.ts`

**Interfaces:**
- Consumes: `WyscoutMatch` de `@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats`, `AgencyCoach` de `@/constants/agencyCoaches`
- Produces: todos los tipos que consumen las tareas siguientes

- [ ] **Step 1: Escribir los tipos**

```ts
// src/features/informesDT/types.ts
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'

export type RadarAxisKey = 'posesion' | 'duelos' | 'duelosAereos' | 'precisionPase' | 'xg' | 'ppda'
export type EvolutionChartKey = 'posesion' | 'xg' | 'duelos' | 'duelosAereos' | 'ppda'

export interface RecordStats {
  pj: number
  ganados: number
  empatados: number
  perdidos: number
  ppg: number
  gf: number
  gc: number
  efectividadPct: number
}

export interface ComparativaMetric {
  key: string
  label: string
  ownValue: number
  rivalValue: number
  unit: '%' | ''
  overridden: boolean // true si el usuario lo corrigió a mano
}

export interface SistemaUsado {
  formacion: string
  partidos: number
}

export interface DisciplinaStats {
  faltasPorPartido: number
  amarillas: number
  rojas: number
  faltasRivalPorPartido: number
}

export interface FormaRecienteEntry {
  resultado: 'V' | 'E' | 'D'
  puntosAcumulados: number
  fecha: string
}

export interface TituloJugador {
  nombre: string
  temporada: string
  club: string
  trofeoKey: string // key del catálogo de trophyCatalog.ts
}

export interface ClubJugador {
  club: string
  periodo: string
  cedido: boolean
  logoUrl: string | null
}

export interface ExperienciaJugador {
  incluir: boolean
  edad: string
  lugarNacimiento: string
  altura: string
  posicion: string
  pieHabil: string
  seleccion: string
  titulos: TituloJugador[]
  trayectoria: ClubJugador[]
}

export interface ClubDT {
  club: string
  periodo: string
  liga: string | null
  logoUrl: string | null
}

export interface InformeDTContent {
  nombre: string
  cargo: string
  club: string
  liga: string
  sistemaHabitual: string
  edad: string
  fotoDataUrl: string | null
  record: RecordStats
  comparativa: ComparativaMetric[]
  radarAxes: RadarAxisKey[]
  evolutionCharts: EvolutionChartKey[]
  sistemas: SistemaUsado[]
  disciplina: DisciplinaStats
  formaReciente: FormaRecienteEntry[]
  experienciaJugador: ExperienciaJugador
  carreraDT: ClubDT[]
}

export interface InformeDT {
  id: string
  createdAt: string
  updatedAt: string
  coachKey: string
  content: InformeDTContent
  matches: WyscoutMatch[] // se guarda para poder re-generar/editar sin re-subir el archivo
}
```

- [ ] **Step 2: `tsc` limpio y commit**

```bash
npx tsc --noEmit
git add src/features/informesDT/types.ts
git commit -m "feat(informe-dt): tipos del informe de entrenador"
```

---

### Task 6: Agregaciones puras desde `WyscoutMatch[]`

**Files:**
- Create: `src/features/informesDT/coachAggregation.ts`
- Test: `src/features/informesDT/coachAggregation.test.ts`

**Interfaces:**
- Consumes: `WyscoutMatch` de `parseWyscoutTeamStats.ts`, tipos de Task 5
- Produces:
  - `export function computeRecord(matches: WyscoutMatch[]): RecordStats`
  - `export function computeComparativa(matches: WyscoutMatch[]): ComparativaMetric[]`
  - `export function computeSistemas(matches: WyscoutMatch[]): SistemaUsado[]`
  - `export function computeDisciplina(matches: WyscoutMatch[]): DisciplinaStats`
  - `export function computeFormaReciente(matches: WyscoutMatch[], n?: number): FormaRecienteEntry[]`

`rawMetrics` en cada `WyscoutMatch` viene del `extra` del row, con keys slugificadas por `normalizeForSearch` (acentos fuera, minúsculas, espacios -> `_`). Para el export "Team Stats" de Wyscout, las keys relevantes que no están en los campos tipados son: `seleccionar_esquema` (formación), `faltas` (propias), `faltas_2` (rival, mismo header repetido — Wyscout no distingue "propio"/"rival" en el nombre, se identifica por si la fila es del equipo propio o del rival dentro de `buildWyscoutMatches`), `tarjetas_amarillas`, `tarjetas_rojas`. **Antes de escribir el test, correr esto una vez contra un archivo real para confirmar los nombres exactos** (el usuario tiene copias en `Downloads`, ej. `Team Stats Temperley (3).xlsx`):

```bash
node -e "
const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/marcos/Downloads/Team Stats Temperley (3).xlsx');
const ws = wb.Sheets['TeamStats'];
const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval: null});
console.log(rows[0].slice(0,10), rows[0].slice(70,80));
"
```

Si los nombres reales difieren de lo asumido acá, ajustar las claves en `coachAggregation.ts` antes de seguir — no adivinar en silencio.

- [ ] **Step 1: Escribir los tests con un fixture reducido (3 partidos, números controlados a mano)**

```ts
// src/features/informesDT/coachAggregation.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeRecord, computeComparativa, computeSistemas, computeDisciplina, computeFormaReciente,
} from './coachAggregation'
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'

function match(overrides: Partial<WyscoutMatch> & { rawMetrics?: Record<string, number | string | null> }): WyscoutMatch {
  return {
    fecha: '2026-02-06',
    partido: 'Temperley - Rival 1:0',
    competencia: 'Primera Nacional',
    equipoPropio: 'Temperley',
    equipoRival: 'Rival',
    xgFor: 1,
    xgAgainst: 0.5,
    possessionPct: 55,
    rawMetrics: {},
    ...overrides,
  }
}

const fixture: WyscoutMatch[] = [
  match({
    fecha: '2026-02-06', xgFor: 2, xgAgainst: 1, possessionPct: 60,
    rawMetrics: {
      goles_propio: 2, goles_rival: 1, seleccionar_esquema: '4-2-3-1',
      duelos_pct: 55, duelos_pct_rival: 45, duelos_aereos_pct: 50, duelos_aereos_pct_rival: 40,
      pases_pct: 80, pases_pct_rival: 75, faltas: 10, faltas_rival: 12,
      tarjetas_amarillas: 2, tarjetas_rojas: 0, ppda: 8, ppda_rival: 10,
    },
  }),
  match({
    fecha: '2026-02-14', xgFor: 0.5, xgAgainst: 1.5, possessionPct: 45,
    rawMetrics: {
      goles_propio: 0, goles_rival: 1, seleccionar_esquema: '4-2-3-1',
      duelos_pct: 48, duelos_pct_rival: 52, duelos_aereos_pct: 45, duelos_aereos_pct_rival: 55,
      pases_pct: 74, pases_pct_rival: 78, faltas: 14, faltas_rival: 9,
      tarjetas_amarillas: 3, tarjetas_rojas: 1, ppda: 9, ppda_rival: 8,
    },
  }),
  match({
    fecha: '2026-02-23', xgFor: 1, xgAgainst: 1, possessionPct: 50,
    rawMetrics: {
      goles_propio: 1, goles_rival: 1, seleccionar_esquema: '4-4-2',
      duelos_pct: 50, duelos_pct_rival: 50, duelos_aereos_pct: 52, duelos_aereos_pct_rival: 48,
      pases_pct: 77, pases_pct_rival: 77, faltas: 11, faltas_rival: 11,
      tarjetas_amarillas: 1, tarjetas_rojas: 0, ppda: 8.5, ppda_rival: 8.5,
    },
  }),
]

describe('computeRecord', () => {
  it('cuenta victorias/empates/derrotas por diferencia de goles y calcula PPG/efectividad', () => {
    const r = computeRecord(fixture)
    expect(r).toEqual({
      pj: 3, ganados: 1, empatados: 1, perdidos: 1,
      ppg: (3 + 1 + 0) / 3, gf: 3, gc: 3,
      efectividadPct: ((3 + 1) / 9) * 100,
    })
  })
})

describe('computeComparativa', () => {
  it('promedia cada métrica propio vs. rival a lo largo de los partidos', () => {
    const c = computeComparativa(fixture)
    const posesion = c.find(m => m.key === 'posesion')!
    expect(posesion.ownValue).toBeCloseTo((60 + 45 + 50) / 3, 5)
    const xg = c.find(m => m.key === 'xg')!
    expect(xg.ownValue).toBeCloseTo((2 + 0.5 + 1) / 3, 5)
    expect(xg.rivalValue).toBeCloseTo((1 + 1.5 + 1) / 3, 5)
    expect(c.every(m => m.overridden === false)).toBe(true)
  })
})

describe('computeSistemas', () => {
  it('cuenta partidos por formación, orden descendente', () => {
    expect(computeSistemas(fixture)).toEqual([
      { formacion: '4-2-3-1', partidos: 2 },
      { formacion: '4-4-2', partidos: 1 },
    ])
  })
})

describe('computeDisciplina', () => {
  it('promedia faltas y suma tarjetas', () => {
    const d = computeDisciplina(fixture)
    expect(d.faltasPorPartido).toBeCloseTo((10 + 14 + 11) / 3, 5)
    expect(d.amarillas).toBe(6)
    expect(d.rojas).toBe(1)
    expect(d.faltasRivalPorPartido).toBeCloseTo((12 + 9 + 11) / 3, 5)
  })
})

describe('computeFormaReciente', () => {
  it('devuelve resultado y puntos acumulados en orden cronológico, limitado a n', () => {
    const f = computeFormaReciente(fixture, 2)
    expect(f.map(x => x.resultado)).toEqual(['D', 'E'])
    expect(f[1].puntosAcumulados).toBe(1 + 1) // victoria(3) del primer partido no entra en el corte de n=2, arranca del 2do
  })
})
```

- [ ] **Step 2: Correr, confirmar que falla**

Run: `npx vitest run src/features/informesDT/coachAggregation.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar**

```ts
// src/features/informesDT/coachAggregation.ts
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import type {
  RecordStats, ComparativaMetric, SistemaUsado, DisciplinaStats, FormaRecienteEntry,
} from './types'

function num(m: WyscoutMatch, key: string): number | null {
  const v = m.rawMetrics[key]
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length
}

export function computeRecord(matches: WyscoutMatch[]): RecordStats {
  let ganados = 0, empatados = 0, perdidos = 0, gf = 0, gc = 0
  for (const m of matches) {
    const own = num(m, 'goles_propio') ?? 0
    const rival = num(m, 'goles_rival') ?? 0
    gf += own
    gc += rival
    if (own > rival) ganados++
    else if (own === rival) empatados++
    else perdidos++
  }
  const pj = matches.length
  const puntos = ganados * 3 + empatados
  return {
    pj, ganados, empatados, perdidos,
    ppg: pj === 0 ? 0 : puntos / pj,
    gf, gc,
    efectividadPct: pj === 0 ? 0 : (puntos / (pj * 3)) * 100,
  }
}

const COMPARATIVA_METRICS: { key: string; label: string; ownKey: string; rivalKey: string; unit: '%' | '' }[] = [
  { key: 'posesion', label: 'Posesión del balón', ownKey: 'possessionPct', rivalKey: '', unit: '%' },
  { key: 'duelos', label: 'Duelos ganados (total)', ownKey: 'duelos_pct', rivalKey: 'duelos_pct_rival', unit: '%' },
  { key: 'duelosAereos', label: 'Duelos aéreos ganados', ownKey: 'duelos_aereos_pct', rivalKey: 'duelos_aereos_pct_rival', unit: '%' },
  { key: 'precisionPase', label: 'Precisión de pase', ownKey: 'pases_pct', rivalKey: 'pases_pct_rival', unit: '%' },
  { key: 'xg', label: 'xG por partido', ownKey: '', rivalKey: '', unit: '' },
  { key: 'ppda', label: 'PPDA (presión)', ownKey: 'ppda', rivalKey: 'ppda_rival', unit: '' },
]

export function computeComparativa(matches: WyscoutMatch[]): ComparativaMetric[] {
  return COMPARATIVA_METRICS.map(def => {
    let ownValues: number[]
    let rivalValues: number[]
    if (def.key === 'posesion') {
      ownValues = matches.map(m => m.possessionPct ?? 0)
      rivalValues = matches.map(m => 100 - (m.possessionPct ?? 0))
    } else if (def.key === 'xg') {
      ownValues = matches.map(m => m.xgFor ?? 0)
      rivalValues = matches.map(m => m.xgAgainst ?? 0)
    } else {
      ownValues = matches.map(m => num(m, def.ownKey) ?? 0)
      rivalValues = matches.map(m => num(m, def.rivalKey) ?? 0)
    }
    return {
      key: def.key,
      label: def.label,
      ownValue: avg(ownValues),
      rivalValue: avg(rivalValues),
      unit: def.unit,
      overridden: false,
    }
  })
}

export function computeSistemas(matches: WyscoutMatch[]): SistemaUsado[] {
  const counts = new Map<string, number>()
  for (const m of matches) {
    const formacion = m.rawMetrics['seleccionar_esquema']
    if (!formacion || typeof formacion !== 'string') continue
    counts.set(formacion, (counts.get(formacion) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([formacion, partidos]) => ({ formacion, partidos }))
    .sort((a, b) => b.partidos - a.partidos)
}

export function computeDisciplina(matches: WyscoutMatch[]): DisciplinaStats {
  return {
    faltasPorPartido: avg(matches.map(m => num(m, 'faltas') ?? 0)),
    amarillas: matches.reduce((s, m) => s + (num(m, 'tarjetas_amarillas') ?? 0), 0),
    rojas: matches.reduce((s, m) => s + (num(m, 'tarjetas_rojas') ?? 0), 0),
    faltasRivalPorPartido: avg(matches.map(m => num(m, 'faltas_rival') ?? 0)),
  }
}

export function computeFormaReciente(matches: WyscoutMatch[], n = 10): FormaRecienteEntry[] {
  const sorted = [...matches].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimos = sorted.slice(-n)
  let acumulado = 0
  return ultimos.map(m => {
    const own = num(m, 'goles_propio') ?? 0
    const rival = num(m, 'goles_rival') ?? 0
    const resultado: 'V' | 'E' | 'D' = own > rival ? 'V' : own === rival ? 'E' : 'D'
    acumulado += resultado === 'V' ? 3 : resultado === 'E' ? 1 : 0
    return { resultado, puntosAcumulados: acumulado, fecha: m.fecha }
  })
}
```

- [ ] **Step 4: Correr, confirmar que pasa**

Run: `npx vitest run src/features/informesDT/coachAggregation.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/informesDT/coachAggregation.ts src/features/informesDT/coachAggregation.test.ts
git commit -m "feat(informe-dt): agregaciones puras de record/comparativa/sistemas/disciplina/forma"
```

---

### Task 7: Catálogo de trofeos

**Files:**
- Create: `src/features/informesDT/trophyCatalog.ts`
- Test: `src/features/informesDT/trophyCatalog.test.ts`

**Interfaces:**
- Produces: `export const TROPHY_CATALOG: { key: string; label: string; imageUrl: string }[]`, `export function trophyImageUrl(key: string): string`

Los 6 archivos ya existen en `public/trophies/` (`sudamericana.png`, `suruga-bank.png`, `recopa.png`, `campeon-argentina.png`, `copa-argentina.png`, `primera-nacional.png` — procesados a mano en la sesión de diseño del mockup, fondo transparente, mismo tamaño de referencia). Ninguno de los 5 archivos previos de esa carpeta (`continental.png`, `copa.png`, `copa_liga.png`, `liga.png`, `otro.png`, usados hoy por `AchievementsSection.tsx`) se toca.

- [ ] **Step 1: Test**

```ts
// src/features/informesDT/trophyCatalog.test.ts
import { describe, it, expect } from 'vitest'
import { TROPHY_CATALOG, trophyImageUrl } from './trophyCatalog'

describe('trophyImageUrl', () => {
  it('devuelve la ruta pública del trofeo por key', () => {
    expect(trophyImageUrl('sudamericana')).toBe('/trophies/sudamericana.png')
  })
  it('devuelve el genérico si la key no está en el catálogo', () => {
    expect(trophyImageUrl('inventado')).toBe('/trophies/generico.png')
  })
})

describe('TROPHY_CATALOG', () => {
  it('tiene una entrada por cada imagen procesada', () => {
    const keys = TROPHY_CATALOG.map(t => t.key)
    expect(keys).toEqual([
      'sudamericana', 'recopa', 'suruga-bank', 'copa-argentina', 'campeon-argentina', 'primera-nacional', 'generico',
    ])
  })
})
```

- [ ] **Step 2: Correr, confirmar que falla**

Run: `npx vitest run src/features/informesDT/trophyCatalog.test.ts`

- [ ] **Step 3: Implementar**

```ts
// src/features/informesDT/trophyCatalog.ts
export const TROPHY_CATALOG: { key: string; label: string; imageUrl: string }[] = [
  { key: 'sudamericana', label: 'Copa Sudamericana', imageUrl: '/trophies/sudamericana.png' },
  { key: 'recopa', label: 'Recopa Sudamericana', imageUrl: '/trophies/recopa.png' },
  { key: 'suruga-bank', label: 'Copa Suruga Bank', imageUrl: '/trophies/suruga-bank.png' },
  { key: 'copa-argentina', label: 'Copa Argentina', imageUrl: '/trophies/copa-argentina.png' },
  { key: 'campeon-argentina', label: 'Campeón de Argentina / Liga Profesional', imageUrl: '/trophies/campeon-argentina.png' },
  { key: 'primera-nacional', label: 'Primera Nacional', imageUrl: '/trophies/primera-nacional.png' },
  { key: 'generico', label: 'Otro título', imageUrl: '/trophies/generico.png' },
]

export function trophyImageUrl(key: string): string {
  return TROPHY_CATALOG.find(t => t.key === key)?.imageUrl ?? '/trophies/generico.png'
}
```

**Nota para quien ejecute esta tarea:** falta el archivo `public/trophies/generico.png` (ícono neutro para títulos que no matcheen el catálogo — línea SVG exportada a PNG con fondo transparente, mismo criterio visual que los otros 6, sin emojis). Crearlo antes de dar la tarea por terminada — puede ser un ícono de copa lineal simple en el verde/gris de la marca.

- [ ] **Step 4: Correr, confirmar que pasa; commit**

```bash
npx vitest run src/features/informesDT/trophyCatalog.test.ts
git add src/features/informesDT/trophyCatalog.ts src/features/informesDT/trophyCatalog.test.ts public/trophies/generico.png
git commit -m "feat(informe-dt): catalogo fijo de imagenes de trofeos"
```

---

### Task 8: `informeDTStore.ts` (persistencia local)

**Files:**
- Create: `src/features/informesDT/informeDTStore.ts`
- Test: `src/features/informesDT/informeDTStore.test.ts`

**Interfaces:**
- Consumes: `InformeDT` de Task 5
- Produces: `saveInformeDT(informe: InformeDT): void`, `listInformesDT(): InformeDT[]`, `loadInformeDT(id: string): InformeDT | null`, `deleteInformeDT(id: string): void`, `newInformeDTId(): string`

Mismo patrón exacto que `src/features/informes/informesStore.ts` (LZ-string sobre `localStorage`), con su propia clave para no compartir namespace con los informes de jugador.

- [ ] **Step 1: Test (igual estructura que `informesStore.test.ts`, adaptado)**

```ts
// src/features/informesDT/informeDTStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveInformeDT, listInformesDT, loadInformeDT, deleteInformeDT, newInformeDTId } from './informeDTStore'
import type { InformeDT } from './types'

function fakeInforme(id: string): InformeDT {
  return {
    id, createdAt: '2026-08-28T00:00:00Z', updatedAt: '2026-08-28T00:00:00Z',
    coachKey: 'domingo',
    content: {
      nombre: 'Nicolás Domingo', cargo: 'Director Técnico', club: 'Temperley', liga: 'Primera Nacional',
      sistemaHabitual: '4-2-3-1', edad: '41', fotoDataUrl: null,
      record: { pj: 27, ganados: 11, empatados: 11, perdidos: 5, ppg: 1.63, gf: 31, gc: 24, efectividadPct: 54 },
      comparativa: [], radarAxes: [], evolutionCharts: [], sistemas: [],
      disciplina: { faltasPorPartido: 12.7, amarillas: 81, rojas: 2, faltasRivalPorPartido: 12.5 },
      formaReciente: [], experienciaJugador: {
        incluir: false, edad: '', lugarNacimiento: '', altura: '', posicion: '', pieHabil: '', seleccion: '',
        titulos: [], trayectoria: [],
      },
      carreraDT: [],
    },
    matches: [],
  }
}

beforeEach(() => localStorage.clear())

describe('informeDTStore', () => {
  it('guarda y lista informes de DT', () => {
    saveInformeDT(fakeInforme('a'))
    expect(listInformesDT().map(i => i.id)).toEqual(['a'])
  })

  it('carga uno por id', () => {
    saveInformeDT(fakeInforme('b'))
    expect(loadInformeDT('b')?.coachKey).toBe('domingo')
    expect(loadInformeDT('inexistente')).toBeNull()
  })

  it('borra uno por id', () => {
    saveInformeDT(fakeInforme('c'))
    deleteInformeDT('c')
    expect(listInformesDT()).toEqual([])
  })

  it('newInformeDTId genera ids distintos', () => {
    expect(newInformeDTId()).not.toBe(newInformeDTId())
  })
})
```

- [ ] **Step 2: Correr, confirmar que falla**

Run: `npx vitest run src/features/informesDT/informeDTStore.test.ts`

- [ ] **Step 3: Implementar (adaptar `informesStore.ts` 1:1, misma librería `lz-string`)**

```ts
// src/features/informesDT/informeDTStore.ts
import LZString from 'lz-string'
import type { InformeDT } from './types'

const KEY = 'scout_informes_dt_v1'

function readAll(): InformeDT[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const json = raw.startsWith('{') || raw.startsWith('[') ? raw : LZString.decompressFromUTF16(raw)
    return json ? (JSON.parse(json) as InformeDT[]) : []
  } catch {
    return []
  }
}

function writeAll(all: InformeDT[]): void {
  localStorage.setItem(KEY, LZString.compressToUTF16(JSON.stringify(all)))
}

export function saveInformeDT(informe: InformeDT): void {
  const all = readAll()
  const idx = all.findIndex(i => i.id === informe.id)
  if (idx >= 0) all[idx] = informe
  else all.push(informe)
  writeAll(all)
}

export function listInformesDT(): InformeDT[] {
  return readAll()
}

export function loadInformeDT(id: string): InformeDT | null {
  return readAll().find(i => i.id === id) ?? null
}

export function deleteInformeDT(id: string): void {
  writeAll(readAll().filter(i => i.id !== id))
}

export function newInformeDTId(): string {
  return `dt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
```

- [ ] **Step 4: Correr, confirmar que pasa; commit**

```bash
npx vitest run src/features/informesDT/informeDTStore.test.ts
git add src/features/informesDT/informeDTStore.ts src/features/informesDT/informeDTStore.test.ts
git commit -m "feat(informe-dt): persistencia local de informes de entrenador"
```

---

### Task 9: Wizard Step 1 — elegir DT + subir Wyscout Team Stats

**Files:**
- Create: `src/features/informesDT/components/Step1CoachYArchivo.tsx`

**Interfaces:**
- Consumes: `listAgencyCoaches()` (Task 2), `AddCoachModal` (Task 4), `parseWyscoutTeamStatsXlsx(data: ArrayBuffer, ownTeamName: string): Promise<WyscoutMatch[]>` (ya existe en `@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats`)
- Produces: `<Step1CoachYArchivo onNext={(coach: AgencyCoach, matches: WyscoutMatch[]) => void} />`

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/informesDT/components/Step1CoachYArchivo.tsx
import { useEffect, useState } from 'react'
import { listAgencyCoaches } from '@/services/agencyCoachesService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import AddCoachModal from '@/features/coaches/components/AddCoachModal'
import { parseWyscoutTeamStatsXlsx } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Step1CoachYArchivo({
  onNext,
}: {
  onNext: (coach: AgencyCoach, matches: WyscoutMatch[]) => void
}) {
  const [coaches, setCoaches] = useState<AgencyCoach[] | null>(null)
  const [selected, setSelected] = useState<AgencyCoach | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAgencyCoaches().then(setCoaches)
  }, [])

  const handleFile = async (file: File) => {
    if (!selected) return
    setError(null)
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const matches = await parseWyscoutTeamStatsXlsx(buffer, selected.club ?? selected.fullName)
      if (matches.length === 0) {
        setError('No se encontraron partidos de este equipo en el archivo. Revisá que sea el export "Team Stats" correcto.')
        return
      }
      onNext(selected, matches)
    } catch {
      setError('No se pudo leer el archivo. Tiene que ser el export "Team Stats" de Wyscout (.xlsx).')
    } finally {
      setParsing(false)
    }
  }

  if (coaches === null) return <LoadingSpinner message="Cargando entrenadores..." />

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Elegí el entrenador</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coaches.map(coach => (
            <button
              key={coach.key}
              type="button"
              onClick={() => setSelected(coach)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left ${
                selected?.key === coach.key
                  ? 'border-brand-green bg-brand-green/5'
                  : 'border-apple-gray-200 dark:border-apple-gray-700'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{coach.fullName}</p>
                <p className="text-xs text-apple-gray-400">{coach.club ?? 'Sin club'}</p>
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="p-3 rounded-xl border border-dashed border-apple-gray-300 dark:border-apple-gray-600 text-sm text-apple-gray-500"
          >
            + Agregar entrenador
          </button>
        </div>
      </div>

      {selected && (
        <div>
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-2">
            Subí el export "Team Stats" de Wyscout de {selected.club ?? selected.fullName}
          </h3>
          <input
            type="file"
            accept=".xlsx"
            disabled={parsing}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm"
          />
          {parsing && <p className="text-xs text-apple-gray-400 mt-2">Procesando archivo...</p>}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}

      {showAdd && (
        <AddCoachModal
          onClose={() => setShowAdd(false)}
          onCreated={coach => {
            setCoaches(prev => (prev ? [...prev, coach] : [coach]))
            setSelected(coach)
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar en el navegador con el archivo real**

Montar temporalmente `Step1CoachYArchivo` en una ruta de prueba (o directo en `InformeDTWizard` cuando exista en el Task 12), elegir a Domingo, subir `Team Stats Temperley (3).xlsx` de `Downloads`, confirmar en consola (`console.log` temporal) que devuelve 27 matches. Sacar el log antes de commitear.

- [ ] **Step 3: `tsc` limpio y commit**

```bash
npx tsc --noEmit
git add src/features/informesDT/components/Step1CoachYArchivo.tsx
git commit -m "feat(informe-dt): paso 1 del wizard, elegir DT y subir Wyscout Team Stats"
```

---

### Task 10: Wizard Step 2 — elegir gráficos

**Files:**
- Create: `src/features/informesDT/components/Step2GraficosDT.tsx`

**Interfaces:**
- Consumes: `RadarAxisKey`, `EvolutionChartKey` de Task 5
- Produces: `<Step2GraficosDT radarAxes={RadarAxisKey[]} evolutionCharts={EvolutionChartKey[]} onChange={(radarAxes, evolutionCharts) => void} onBack={() => void} onNext={() => void} />`

Requisito explícito del usuario: elegir libremente qué ejes van al radar y qué gráficos de evolución incluir, **o ninguno**.

- [ ] **Step 1: Implementar**

```tsx
// src/features/informesDT/components/Step2GraficosDT.tsx
import type { RadarAxisKey, EvolutionChartKey } from '../types'

const RADAR_OPTIONS: { key: RadarAxisKey; label: string }[] = [
  { key: 'posesion', label: 'Posesión' },
  { key: 'duelos', label: 'Duelos ganados' },
  { key: 'duelosAereos', label: 'Duelos aéreos' },
  { key: 'precisionPase', label: 'Precisión de pase' },
  { key: 'xg', label: 'xG por partido' },
  { key: 'ppda', label: 'PPDA (presión)' },
]

const EVOLUTION_OPTIONS: { key: EvolutionChartKey; label: string }[] = [
  { key: 'posesion', label: 'Evolución de posesión' },
  { key: 'xg', label: 'Evolución de xG' },
  { key: 'duelos', label: 'Evolución de duelos' },
  { key: 'duelosAereos', label: 'Evolución de duelos aéreos' },
  { key: 'ppda', label: 'Evolución de PPDA' },
]

function toggle<T>(list: T[], key: T): T[] {
  return list.includes(key) ? list.filter(k => k !== key) : [...list, key]
}

export default function Step2GraficosDT({
  radarAxes,
  evolutionCharts,
  onChange,
  onBack,
  onNext,
}: {
  radarAxes: RadarAxisKey[]
  evolutionCharts: EvolutionChartKey[]
  onChange: (radarAxes: RadarAxisKey[], evolutionCharts: EvolutionChartKey[]) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">
          Radar de perfil táctico
        </h3>
        <p className="text-xs text-apple-gray-400 mb-3">Elegí hasta 6 ejes, o ninguno para sacar el radar del informe.</p>
        <div className="flex flex-wrap gap-2">
          {RADAR_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(toggle(radarAxes, opt.key), evolutionCharts)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                radarAxes.includes(opt.key)
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">
          Gráficos de evolución partido a partido
        </h3>
        <p className="text-xs text-apple-gray-400 mb-3">Elegí cuáles incluir, o ninguno.</p>
        <div className="flex flex-wrap gap-2">
          {EVOLUTION_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(radarAxes, toggle(evolutionCharts, opt.key))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                evolutionCharts.includes(opt.key)
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-apple-gray-500">Atrás</button>
        <button type="button" onClick={onNext} className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold">
          Siguiente
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `tsc` limpio y commit**

```bash
npx tsc --noEmit
git add src/features/informesDT/components/Step2GraficosDT.tsx
git commit -m "feat(informe-dt): paso 2 del wizard, seleccion de graficos"
```

---

### Task 11: Wizard Step 3 — contenido editable

**Files:**
- Create: `src/features/informesDT/components/Step3ContenidoDT.tsx`

**Interfaces:**
- Consumes: `InformeDTContent` de Task 5, `TROPHY_CATALOG` de Task 7
- Produces: `<Step3ContenidoDT content={InformeDTContent} onChange={(content: InformeDTContent) => void} onBack={() => void} onNext={() => void} />`

Cubre el requisito explícito de "poder modificar los % en Comparativa vs rivales, una vez que arrastro y aparecen los datos" — cada celda de `comparativa` es un input editable que marca `overridden: true` al tocarla. También cubre "Experiencia como jugador" (opcional, `incluir` toggle) y "Carrera como DT".

- [ ] **Step 1: Implementar**

```tsx
// src/features/informesDT/components/Step3ContenidoDT.tsx
import type { InformeDTContent, ComparativaMetric, TituloJugador } from '../types'
import { TROPHY_CATALOG } from '../trophyCatalog'

function updateComparativaValue(
  comparativa: ComparativaMetric[],
  key: string,
  field: 'ownValue' | 'rivalValue',
  value: number,
): ComparativaMetric[] {
  return comparativa.map(m => (m.key === key ? { ...m, [field]: value, overridden: true } : m))
}

export default function Step3ContenidoDT({
  content,
  onChange,
  onBack,
  onNext,
}: {
  content: InformeDTContent
  onChange: (content: InformeDTContent) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Identidad</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={content.nombre}
            onChange={e => onChange({ ...content, nombre: e.target.value })}
            placeholder="Nombre"
            className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
          />
          <input
            value={content.sistemaHabitual}
            onChange={e => onChange({ ...content, sistemaHabitual: e.target.value })}
            placeholder="Sistema habitual (ej. 4-2-3-1)"
            className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">
          Comparativa vs. rival promedio
        </h3>
        <p className="text-xs text-apple-gray-400 mb-3">
          Los valores salen del archivo de Wyscout. Si alguno está mal, corregilo acá — queda marcado como editado a mano.
        </p>
        <div className="space-y-2">
          {content.comparativa.map(metric => (
            <div key={metric.key} className="flex items-center gap-3">
              <span className="text-xs text-apple-gray-500 flex-1">{metric.label}</span>
              <input
                type="number"
                step="0.01"
                value={metric.ownValue}
                onChange={e =>
                  onChange({
                    ...content,
                    comparativa: updateComparativaValue(content.comparativa, metric.key, 'ownValue', Number(e.target.value)),
                  })
                }
                className="w-20 px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm text-right"
              />
              <span className="text-2xs text-apple-gray-400">vs</span>
              <input
                type="number"
                step="0.01"
                value={metric.rivalValue}
                onChange={e =>
                  onChange({
                    ...content,
                    comparativa: updateComparativaValue(content.comparativa, metric.key, 'rivalValue', Number(e.target.value)),
                  })
                }
                className="w-20 px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm text-right"
              />
              {metric.overridden && <span className="text-2xs text-amber-500">editado</span>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={content.experienciaJugador.incluir}
            onChange={e =>
              onChange({
                ...content,
                experienciaJugador: { ...content.experienciaJugador, incluir: e.target.checked },
              })
            }
          />
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">
            Incluir "Experiencia como jugador"
          </h3>
        </div>
        {content.experienciaJugador.incluir && (
          <div className="space-y-3 pl-6">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={content.experienciaJugador.edad}
                onChange={e =>
                  onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, edad: e.target.value } })
                }
                placeholder="Edad"
                className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
              />
              <input
                value={content.experienciaJugador.posicion}
                onChange={e =>
                  onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, posicion: e.target.value } })
                }
                placeholder="Posición habitual"
                className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-apple-gray-400 mb-2">Títulos como jugador</p>
              {content.experienciaJugador.titulos.map((t, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    value={t.nombre}
                    onChange={e => {
                      const titulos = [...content.experienciaJugador.titulos]
                      titulos[i] = { ...t, nombre: e.target.value }
                      onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, titulos } })
                    }}
                    placeholder="Nombre del título"
                    className="flex-1 px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
                  />
                  <select
                    value={t.trofeoKey}
                    onChange={e => {
                      const titulos = [...content.experienciaJugador.titulos]
                      titulos[i] = { ...t, trofeoKey: e.target.value }
                      onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, titulos } })
                    }}
                    className="px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
                  >
                    {TROPHY_CATALOG.map(trophy => (
                      <option key={trophy.key} value={trophy.key}>{trophy.label}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const nuevo: TituloJugador = { nombre: '', temporada: '', club: '', trofeoKey: 'generico' }
                  onChange({
                    ...content,
                    experienciaJugador: {
                      ...content.experienciaJugador,
                      titulos: [...content.experienciaJugador.titulos, nuevo],
                    },
                  })
                }}
                className="text-xs text-brand-green font-medium"
              >
                + Agregar título
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-apple-gray-500">Atrás</button>
        <button type="button" onClick={onNext} className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold">
          Siguiente
        </button>
      </div>
    </div>
  )
}
```

**Nota para quien ejecute esta tarea:** este componente cubre identidad, comparativa editable y experiencia como jugador con el detalle completo pedido en el spec. "Sistemas", "Disciplina", "Forma reciente" y "Carrera como DT" se autocompletan desde `coachAggregation.ts`/`agency_coaches` y no necesitan edición manual en la v1 — si al probarlo en vivo el usuario pide poder editarlos también, es la misma técnica (input controlado + `onChange` sobre el campo correspondiente de `content`), agregarlo como iteración corta después de validar el resto.

- [ ] **Step 2: `tsc` limpio y commit**

```bash
npx tsc --noEmit
git add src/features/informesDT/components/Step3ContenidoDT.tsx
git commit -m "feat(informe-dt): paso 3 del wizard, contenido editable"
```

---

### Task 12: `buildInformeDTHtml` + `exportInformeDTHTML` + Step4Preview

**Files:**
- Create: `src/features/informesDT/buildInformeDTHtml.ts`
- Create: `src/features/informesDT/exportInformeDTHTML.ts`
- Create: `src/features/informesDT/components/Step4PreviewDT.tsx`
- Test: `src/features/informesDT/buildInformeDTHtml.test.ts`

**Interfaces:**
- Consumes: `InformeDT` de Task 5
- Produces: `export function buildInformeDTHtml(informe: InformeDT): string`, `export function exportInformeDTHTML(informe: InformeDT): void`

El HTML sale del mockup validado (`public/informe-dt-domingo-preview.html`) convertido a template function — mismo CSS/estructura de las 6 pestañas, pero **con el bug de blur cuadrado corregido desde el arranque** (`backdrop-filter` en `.dg-tabbar`, no en `.dg-tabbar-wrap`), y con los valores interpolados desde `informe.content` en vez de hardcodeados.

- [ ] **Step 1: Test — no probamos el HTML pixel a pixel, probamos que interpola los datos y no repite el bug**

```ts
// src/features/informesDT/buildInformeDTHtml.test.ts
import { describe, it, expect } from 'vitest'
import { buildInformeDTHtml } from './buildInformeDTHtml'
import type { InformeDT } from './types'

const informe: InformeDT = {
  id: 'dt_1', createdAt: '', updatedAt: '', coachKey: 'domingo',
  content: {
    nombre: 'Nicolás Domingo', cargo: 'Director Técnico', club: 'Temperley', liga: 'Primera Nacional',
    sistemaHabitual: '4-2-3-1', edad: '41', fotoDataUrl: null,
    record: { pj: 27, ganados: 11, empatados: 11, perdidos: 5, ppg: 1.63, gf: 31, gc: 24, efectividadPct: 54 },
    comparativa: [{ key: 'posesion', label: 'Posesión', ownValue: 50.2, rivalValue: 49.8, unit: '%', overridden: false }],
    radarAxes: ['posesion'], evolutionCharts: [], sistemas: [{ formacion: '4-2-3-1', partidos: 14 }],
    disciplina: { faltasPorPartido: 12.7, amarillas: 81, rojas: 2, faltasRivalPorPartido: 12.5 },
    formaReciente: [], experienciaJugador: {
      incluir: false, edad: '', lugarNacimiento: '', altura: '', posicion: '', pieHabil: '', seleccion: '',
      titulos: [], trayectoria: [],
    },
    carreraDT: [{ club: 'Temperley', periodo: 'Jul 2026 — actualidad', liga: 'Primera Nacional', logoUrl: null }],
  },
  matches: [],
}

describe('buildInformeDTHtml', () => {
  it('interpola nombre, club y récord', () => {
    const html = buildInformeDTHtml(informe)
    expect(html).toContain('Nicolás Domingo')
    expect(html).toContain('Temperley')
    expect(html).toContain('27')
    expect(html).toContain('54%')
  })

  it('no incluye la pestaña de Experiencia como jugador si incluir=false', () => {
    const html = buildInformeDTHtml(informe)
    expect(html).not.toContain('data-tab="jugador"')
  })

  it('aplica el blur en .dg-tabbar, no en .dg-tabbar-wrap (fix del bug de costura cuadrada)', () => {
    const html = buildInformeDTHtml(informe)
    const wrapRule = html.match(/\.dg-tabbar-wrap\s*\{[^}]*\}/)?.[0] ?? ''
    const tabbarRule = html.match(/\.dg-tabbar\s*\{[^}]*\}/)?.[0] ?? ''
    expect(wrapRule).not.toMatch(/backdrop-filter/)
    expect(tabbarRule).toMatch(/backdrop-filter/)
  })
})
```

- [ ] **Step 2: Correr, confirmar que falla**

Run: `npx vitest run src/features/informesDT/buildInformeDTHtml.test.ts`

- [ ] **Step 3: Implementar `buildInformeDTHtml.ts`**

Partir del contenido completo de `public/informe-dt-domingo-preview.html` (ya validado visualmente por el usuario). Convertirlo en:

```ts
// src/features/informesDT/buildInformeDTHtml.ts
import type { InformeDT } from './types'
import { trophyImageUrl } from './trophyCatalog'

export function buildInformeDTHtml(informe: InformeDT): string {
  const { content } = informe
  const wdlTotal = content.record.pj || 1
  const wPct = (content.record.ganados / wdlTotal) * 100
  const dPct = (content.record.empatados / wdlTotal) * 100
  const lPct = (content.record.perdidos / wdlTotal) * 100

  const comparativaRows = content.comparativa.map(m => `
    <div class="cmp-row">
      <div class="cmp-top"><span class="cmp-name">${m.label}</span></div>
      <div class="cmp-bars">
        <div class="cmp-bar-line"><span class="cmp-bar-tag team">DT</span><div class="cmp-track"><div class="cmp-fill team" style="width:${m.ownValue}%"></div></div><span class="cmp-val">${m.ownValue.toFixed(1)}${m.unit}</span></div>
        <div class="cmp-bar-line"><span class="cmp-bar-tag rival">Rival</span><div class="cmp-track"><div class="cmp-fill rival" style="width:${m.rivalValue}%"></div></div><span class="cmp-val">${m.rivalValue.toFixed(1)}${m.unit}</span></div>
      </div>
    </div>`).join('')

  const sistemasRows = content.sistemas.map(s => {
    const maxPartidos = content.sistemas[0]?.partidos || 1
    return `<div class="sys-row"><div class="sys-name">${s.formacion}</div><div class="sys-track"><div class="sys-fill" style="width:${(s.partidos / maxPartidos) * 100}%"></div></div><div class="sys-count">${s.partidos}</div></div>`
  }).join('')

  const jugadorTab = content.experienciaJugador.incluir ? `
    <section class="dg-panel" data-panel="jugador">
      <p class="dg-panel-title">Títulos como jugador</p>
      <div class="trophy-grid">
        ${content.experienciaJugador.titulos.map(t => `
          <div class="trophy-card">
            <img class="trophy-icon" src="${trophyImageUrl(t.trofeoKey)}" alt="">
            <div><p class="t-name">${t.nombre}</p><p class="t-meta">${t.temporada} · ${t.club}</p></div>
          </div>`).join('')}
      </div>
    </section>` : ''

  const tabButtons = [
    '<button class="dg-tab active" data-tab="general">General</button>',
    '<button class="dg-tab" data-tab="rivales">Comparativa vs rivales</button>',
    '<button class="dg-tab" data-tab="sistemas">Sistemas</button>',
    '<button class="dg-tab" data-tab="racha">Racha</button>',
    '<button class="dg-tab" data-tab="carreradt">Carrera como DT</button>',
    content.experienciaJugador.incluir ? '<button class="dg-tab" data-tab="jugador">Experiencia como jugador</button>' : '',
  ].join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Informe de Entrenador — ${content.nombre}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { background: #08090B; color: #F5F7FA; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .dg-tabbar-wrap { position: sticky; top: 0; z-index: 30; margin: 0 -24px 16px; padding: 10px 24px 12px; }
  .dg-tabbar { display: flex; gap: 2px; padding: 4px; border-radius: 13px; background: rgba(20,22,26,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); overflow-x: auto; }
  .dg-tab { padding: 8px 14px; border-radius: 9px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #A8AEB6; cursor: pointer; white-space: nowrap; }
  .dg-tab.active { background: #22C55E; color: #08090B; font-weight: 700; }
  .dg-panel { display: none; }
  .dg-panel.active { display: block; }
  .wdl-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; }
  .wdl-bar .w { background: #22C55E; } .wdl-bar .d { background: #4A4F57; } .wdl-bar .l { background: #EF4444; }
  .cmp-row { padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .cmp-track { height: 9px; background: rgba(255,255,255,0.06); border-radius: 5px; overflow: hidden; }
  .cmp-fill.team { background: #22C55E; height: 100%; } .cmp-fill.rival { background: #565C64; height: 100%; }
  .sys-row { display: grid; grid-template-columns: 92px 1fr 34px; align-items: center; gap: 12px; padding: 8px 0; }
  .sys-track { height: 18px; background: rgba(255,255,255,0.06); border-radius: 6px; overflow: hidden; }
  .sys-fill { height: 100%; border-radius: 6px; background: #22C55E; }
  .trophy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px,1fr)); gap: 12px; }
  .trophy-card { background: #14171B; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 16px; display: flex; gap: 12px; align-items: center; }
  .trophy-icon { width: 56px; height: 56px; object-fit: contain; }
</style>
</head>
<body>
<div class="dg-container">
  <header class="dg-header"><span class="dg-header-badge">Informe de entrenador</span><span class="dg-header-agency">Doble G Sports Group</span></header>
  <div class="dg-tabbar-wrap"><nav class="dg-tabbar">${tabButtons}</nav></div>
  <div class="dg-layout">
    <aside class="dg-rail">
      <h2>${content.nombre}</h2>
      <p>${content.cargo}</p>
      <dl>
        <div><dt>Club</dt><dd>${content.club}</dd></div>
        <div><dt>Liga</dt><dd>${content.liga}</dd></div>
        <div><dt>Sistema habitual</dt><dd>${content.sistemaHabitual}</dd></div>
      </dl>
    </aside>
    <div class="dg-panel-card">
      <section class="dg-panel active" data-panel="general">
        <p class="dg-panel-title">Récord — ${content.record.pj} partidos dirigidos</p>
        <div class="wdl-bar"><span class="w" style="width:${wPct}%"></span><span class="d" style="width:${dPct}%"></span><span class="l" style="width:${lPct}%"></span></div>
      </section>
      <section class="dg-panel" data-panel="rivales">${comparativaRows}</section>
      <section class="dg-panel" data-panel="sistemas">${sistemasRows}</section>
      <section class="dg-panel" data-panel="racha"></section>
      <section class="dg-panel" data-panel="carreradt">
        ${content.carreraDT.map(c => `<div class="career-row"><p class="name">${c.club}</p><p class="period">${c.periodo}</p></div>`).join('')}
      </section>
      ${jugadorTab}
    </div>
  </div>
</div>
<script>
  document.querySelectorAll('.dg-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dg-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dg-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector('.dg-panel[data-panel="' + btn.dataset.tab + '"]').classList.add('active');
    });
  });
</script>
</body>
</html>`
}
```

**Nota para quien ejecute esta tarea:** el snippet de arriba es el esqueleto mínimo para pasar los tests — al implementarlo de verdad, copiar el CSS/HTML completo y fiel de `public/informe-dt-domingo-preview.html` (radar SVG, gráficos de evolución SVG, KPI grids, forma reciente, trayectoria de clubes con logos, todo lo que ya está validado ahí) e interpolar `content.*` en cada punto donde el mockup tiene datos hardcodeados de Domingo — no reinventar el diseño, es un port 1:1 a template function.

- [ ] **Step 4: Correr, confirmar que pasa**

Run: `npx vitest run src/features/informesDT/buildInformeDTHtml.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: `exportInformeDTHTML.ts`**

```ts
// src/features/informesDT/exportInformeDTHTML.ts
import { buildInformeDTHtml } from './buildInformeDTHtml'
import type { InformeDT } from './types'

export function exportInformeDTHTML(informe: InformeDT): void {
  const html = buildInformeDTHtml(informe)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Informe_DT_${informe.content.nombre.replace(/\s+/g, '_')}.html`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 6: `Step4PreviewDT.tsx`**

```tsx
// src/features/informesDT/components/Step4PreviewDT.tsx
import { useState } from 'react'
import type { InformeDT } from '../types'
import { buildInformeDTHtml } from '../buildInformeDTHtml'
import { exportInformeDTHTML } from '../exportInformeDTHTML'
import { uploadInformeHtml } from '@/features/informes/shareInforme'
import { informeShareUrl } from '@/features/informes/shareUrl'

export default function Step4PreviewDT({
  informe,
  onBack,
  onSave,
}: {
  informe: InformeDT
  onBack: () => void
  onSave: () => void
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const html = buildInformeDTHtml(informe)

  const handleShare = async () => {
    setSharing(true)
    try {
      await uploadInformeHtml(html, informe.id, informe.content.nombre)
      setShareUrl(informeShareUrl(informe.id, informe.content.nombre))
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-4">
      <iframe title="preview" srcDoc={html} className="w-full h-[70vh] rounded-xl border border-apple-gray-200 dark:border-apple-gray-700" />
      <div className="flex flex-wrap gap-2 justify-between">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-apple-gray-500">Atrás</button>
        <div className="flex gap-2">
          <button type="button" onClick={onSave} className="px-4 py-2 rounded-xl bg-apple-gray-100 dark:bg-apple-gray-800 text-sm font-semibold">Guardar</button>
          <button type="button" onClick={() => exportInformeDTHTML(informe)} className="px-4 py-2 rounded-xl bg-apple-gray-100 dark:bg-apple-gray-800 text-sm font-semibold">Exportar HTML</button>
          <button type="button" onClick={handleShare} disabled={sharing} className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50">
            {sharing ? 'Compartiendo...' : 'Compartir'}
          </button>
        </div>
      </div>
      {shareUrl && (
        <p className="text-xs text-apple-gray-500">
          Link: <a href={shareUrl} target="_blank" rel="noreferrer" className="text-brand-green">{shareUrl}</a>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 7: `tsc` limpio y commit**

```bash
npx tsc --noEmit
git add src/features/informesDT/buildInformeDTHtml.ts src/features/informesDT/buildInformeDTHtml.test.ts src/features/informesDT/exportInformeDTHTML.ts src/features/informesDT/components/Step4PreviewDT.tsx
git commit -m "feat(informe-dt): export/preview/share del informe de entrenador"
```

---

### Task 13: `InformeDTWizard` + selector Jugador/DT en `InformesPage`

**Files:**
- Create: `src/features/informesDT/components/InformeDTWizard.tsx`
- Modify: `src/pages/InformesPage.tsx`

**Interfaces:**
- Consumes: `Step1CoachYArchivo`, `Step2GraficosDT`, `Step3ContenidoDT`, `Step4PreviewDT` (Tasks 9-12), `saveInformeDT`/`newInformeDTId` (Task 8), `computeRecord`/`computeComparativa`/`computeSistemas`/`computeDisciplina`/`computeFormaReciente` (Task 6)

- [ ] **Step 1: `InformeDTWizard.tsx` — orquesta los 4 pasos**

```tsx
// src/features/informesDT/components/InformeDTWizard.tsx
import { useState } from 'react'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import type { InformeDT, InformeDTContent, RadarAxisKey, EvolutionChartKey } from '../types'
import {
  computeRecord, computeComparativa, computeSistemas, computeDisciplina, computeFormaReciente,
} from '../coachAggregation'
import { saveInformeDT, newInformeDTId } from '../informeDTStore'
import Step1CoachYArchivo from './Step1CoachYArchivo'
import Step2GraficosDT from './Step2GraficosDT'
import Step3ContenidoDT from './Step3ContenidoDT'
import Step4PreviewDT from './Step4PreviewDT'

function buildContentFromMatches(coach: AgencyCoach, matches: WyscoutMatch[]): InformeDTContent {
  return {
    nombre: coach.fullName,
    cargo: 'Director Técnico',
    club: coach.club ?? '',
    liga: coach.leagueName ?? '',
    sistemaHabitual: computeSistemas(matches)[0]?.formacion ?? '',
    edad: '',
    fotoDataUrl: coach.photo,
    record: computeRecord(matches),
    comparativa: computeComparativa(matches),
    radarAxes: ['posesion', 'duelos', 'duelosAereos', 'precisionPase', 'xg', 'ppda'],
    evolutionCharts: ['posesion', 'xg'],
    sistemas: computeSistemas(matches),
    disciplina: computeDisciplina(matches),
    formaReciente: computeFormaReciente(matches),
    experienciaJugador: {
      incluir: false, edad: '', lugarNacimiento: '', altura: '', posicion: '', pieHabil: '', seleccion: '',
      titulos: [], trayectoria: [],
    },
    carreraDT: coach.club ? [{ club: coach.club, periodo: 'Actualidad', liga: coach.leagueName ?? null, logoUrl: coach.photo }] : [],
  }
}

export default function InformeDTWizard({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0)
  const [informe, setInforme] = useState<InformeDT | null>(null)

  if (step === 0) {
    return (
      <Step1CoachYArchivo
        onNext={(coach, matches) => {
          const content = buildContentFromMatches(coach, matches)
          setInforme({
            id: newInformeDTId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            coachKey: coach.key, content, matches,
          })
          setStep(1)
        }}
      />
    )
  }

  if (!informe) return null

  if (step === 1) {
    return (
      <Step2GraficosDT
        radarAxes={informe.content.radarAxes}
        evolutionCharts={informe.content.evolutionCharts}
        onChange={(radarAxes, evolutionCharts) =>
          setInforme({ ...informe, content: { ...informe.content, radarAxes, evolutionCharts } })
        }
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
      />
    )
  }

  if (step === 2) {
    return (
      <Step3ContenidoDT
        content={informe.content}
        onChange={content => setInforme({ ...informe, content })}
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
      />
    )
  }

  return (
    <Step4PreviewDT
      informe={informe}
      onBack={() => setStep(2)}
      onSave={() => {
        saveInformeDT({ ...informe, updatedAt: new Date().toISOString() })
        onExit()
      }}
    />
  )
}
```

- [ ] **Step 2: Selector Jugador/DT en `InformesPage.tsx`**

En la vista `'list'` (antes de `handleNew`), agregar un selector de tipo que decide si `handleNew` abre el wizard de jugador existente o monta `<InformeDTWizard onExit={() => setView('list')} />`. Cambios concretos:

```tsx
// dentro de InformesPage.tsx
import InformeDTWizard from '@/features/informesDT/components/InformeDTWizard'
// ...
const [tipoWizard, setTipoWizard] = useState<'jugador' | 'dt' | null>(null)

// en handleNew, en vez de ir directo a setView('wizard'):
const handleNewClick = (tipo: 'jugador' | 'dt') => {
  setTipoWizard(tipo)
  if (tipo === 'jugador') handleNew()
  else setView('wizard')
}

// en el render, reemplazar el botón único de "Nuevo informe" (dentro de InformesList o al lado)
// por dos botones/opciones: "Nuevo informe de jugador" y "Nuevo informe de DT"

// y en el bloque `view === 'wizard'`, si tipoWizard === 'dt':
{tipoWizard === 'dt' ? (
  <InformeDTWizard onExit={() => { setView('list'); setTipoWizard(null) }} />
) : (
  // ... el wizard de jugador existente, sin cambios
)}
```

El detalle exacto de dónde entra el botón "Nuevo informe de DT" depende del layout actual de `InformesList.tsx` (no listado en la investigación previa) — revisar ese archivo al ejecutar esta tarea y agregar el segundo botón junto al de "Nuevo informe" existente, mismo estilo visual.

- [ ] **Step 3: Verificar en el navegador de punta a punta**

`npm run dev`, ir a `/informes`, click en "Nuevo informe de DT", elegir a Domingo, subir el Excel real, pasar por los 4 pasos, exportar el HTML y abrirlo — comparar visualmente contra `public/informe-dt-domingo-preview.html` (tienen que verse iguales). Confirmar que "Nuevo informe de jugador" sigue funcionando exactamente igual que antes (no se rompió nada del flujo existente).

- [ ] **Step 4: `tsc`, `npm run build`, suite completa; commit**

```bash
npx tsc --noEmit && npm run build && npx vitest run
git add src/features/informesDT/components/InformeDTWizard.tsx src/pages/InformesPage.tsx
git commit -m "feat(informe-dt): wizard completo y selector Jugador/DT en Informes"
```

---

### Task 14: Fix del bug de blur cuadrado en Informes de jugador (producción)

**Files:**
- Modify: `src/features/informes/exportInformeHTML.ts`

**Interfaces:**
- No cambia ninguna firma pública — es un fix de CSS puro dentro del template string.

- [ ] **Step 1: Mover el `backdrop-filter` de `.dg-tabbar-wrap` a `.dg-tabbar`**

En `src/features/informes/exportInformeHTML.ts`, buscar la regla actual (línea ~1061-1071):

```css
.dg-tabbar-wrap {
    position: sticky;
    top: 0;
    z-index: 30;
    margin: 0 -24px 16px;
    padding: 10px 24px 12px;
    background: rgba(8,9,11,0.90);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
```

Sacarle `backdrop-filter`/`-webkit-backdrop-filter` (y ajustar `background` a algo más opaco ya que pierde el blur, ej. `rgba(8,9,11,0.98)`), y agregar esas dos líneas a la regla `.dg-tabbar` (que ya tiene `border-radius: 13px`), quedando:

```css
.dg-tabbar-wrap {
    position: sticky;
    top: 0;
    z-index: 30;
    margin: 0 -24px 16px;
    padding: 10px 24px 12px;
    background: rgba(8,9,11,0.98);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
```

Y en la regla `.dg-tabbar` existente, agregar:

```css
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
```

- [ ] **Step 2: Verificar en el navegador**

Abrir `/informes`, entrar a un informe de jugador guardado (o generar uno de prueba), revisar visualmente que la barra de pestañas ya no tiene la costura cuadrada al hacer scroll.

- [ ] **Step 3: Correr la suite de Informes de jugador entera, confirmar que nada se rompió**

Run: `npx vitest run src/features/informes/`
Expected: PASS, mismo conteo de tests que antes de este cambio

- [ ] **Step 4: Commit**

```bash
git add src/features/informes/exportInformeHTML.ts
git commit -m "fix(informes): backdrop-filter en la pildora de pestanas, no en el contenedor rectangular"
```

---

## Self-Review

**Cobertura del spec:**
- Tabla `agency_coaches` + migración de Domingo/Stillitano → Task 1 ✓
- Formulario "+ Agregar entrenador" (propio/intermediado) → Task 4 ✓
- Selector Jugador/DT en "Nuevo informe" → Task 13 ✓
- Reuso del parser de Wyscout de equipo (no reinventar) → Task 9, usa `parseWyscoutTeamStatsXlsx` existente ✓
- 6 pestañas del informe con datos reales → Task 12 (nota explícita de portar el mockup 1:1) ✓
- Radar y gráficos de evolución elegibles por el usuario, o ninguno → Task 10 ✓
- Comparativa vs. rivales editable celda por celda → Task 11 ✓
- Experiencia como jugador opcional (títulos con catálogo fijo de trofeos) → Task 7, Task 11 ✓
- Carrera como DT → Task 9 (autocompletado desde `agency_coaches`), Task 12 (render) ✓
- Fix del bug de blur compartido, en los dos lugares → Task 12 (nuevo, nace corregido) y Task 14 (viejo, en producción) ✓
- Persistencia: no toca infraestructura de Informes de jugador (localStorage separado) → Task 8 ✓

**Nada quedó sin tarea.**

**Placeholders:** ninguno de los patrones prohibidos (TBD, "similar a Task N" sin código, "agregar validación" sin mostrar cómo). Las dos notas explícitas para quien ejecute (Task 7 sobre `generico.png`, Task 12 sobre portar el mockup completo) son instrucciones concretas con criterio claro, no placeholders vacíos.

**Consistencia de tipos:** `AgencyCoach` (Task 2) se usa igual en Tasks 3, 4, 9, 13. `WyscoutMatch`/`rawMetrics` (ya existente) se consume igual en Tasks 6 y 9. `InformeDTContent`/`ComparativaMetric`/etc. (Task 5) se usan sin cambios de nombre en Tasks 6, 8, 11, 12, 13 — verificado campo por campo.
