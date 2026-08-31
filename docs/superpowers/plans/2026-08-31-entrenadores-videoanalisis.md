# Entrenadores — Videoanálisis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva pestaña "Videoanálisis" en la ficha de cada entrenador: subir XML de videoanálisis (Nacsport/similares) + video opcional del partido, ver estadísticas, cancha y evolución en el tiempo, acumulando partidos para el equipo propio y para una biblioteca de rivales con nombre libre.

**Architecture:** 2 tablas nuevas en Supabase (`coach_video_analysis_buckets`, `coach_video_analysis_matches`) + un bucket de Storage para el video. Parser XML puro y testeado (`parseNacsportXml`), clasificación de fase/zona por diccionario de palabras clave (`videoAnalysisTagging`), y agregación para gráficos (`videoAnalysisStats`) — todos módulos de lógica pura sin dependencias de red, siguiendo el patrón ya establecido en `features/gps/parser/` y `features/coaches/boardGeometry.ts`. La UI vive en `CoachVideoAnalysisTab.tsx` + componentes hijos, wireada como una pestaña más de `CoachDetailPage.tsx` (mismo patrón que `CoachTacticalBoardTab`).

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + Storage), Vitest, `DOMParser` nativo del browser (ya usado en `features/informes/parseFile.ts`, sin librerías nuevas).

**Spec:** `docs/superpowers/specs/2026-08-31-entrenadores-videoanalisis-design.md`

## Global Constraints

- Sin librerías nuevas de parseo XML — `DOMParser` nativo, mismo patrón que `parseFile.ts`.
- Coordenadas x/y siempre en el sistema 0-100 (%) ya usado por `markers`/`FORMATIONS` — nunca píxeles crudos.
- Tamaño máximo de video: 500MB por archivo, chequeado del lado del cliente antes de subir.
- Sin `onProgress` de subida — `supabase-js` v2 no expone progreso real de upload (usa `fetch`, no XHR); el estado de subida es binario (subiendo / listo), no un porcentaje.
- Storage bucket público (mismo modelo que `scout-player-files`/`informes-compartidos`) — la ruta de cada objeto no es adivinable (incluye `bucketId`/`matchId`), así que no hace falta URL firmada.
- No traducir esta pestaña a los 9 idiomas todavía (fuera de alcance del spec) — sólo se agrega la key en español para que el label de la pestaña no muestre la clave cruda.
- Convención de testing de este repo: solo los módulos de lógica pura (parser, tagging, stats, geometría) llevan test unitario — mismo criterio que `boardGeometry.ts`/`trainingInsights.ts` (testeados) vs. `TacticalBoardPitch.tsx`/`CoachTrainingDayPanel.tsx` (componentes de UI, sin test propio, verificados por typecheck + prueba manual en Chrome). Las Tasks 6, 9-16 de este plan son componentes de UI y deliberadamente no llevan test unitario — no es un hueco de cobertura, es el patrón ya establecido en el repo.

---

## Task 1: Migración — tablas + bucket de Storage

**Files:**
- Create: `supabase/migrations/20260831_coach_video_analysis_schema.sql`

**Interfaces:**
- Produces: tablas `coach_video_analysis_buckets` (`id`, `coach_key`, `kind`, `name`, `created_at`) y `coach_video_analysis_matches` (`id`, `bucket_id`, `match_date`, `opponent_name`, `instances` JSONB, `video_storage_path`, `created_at`); bucket de Storage `coach-video-analysis`. Todas las tareas de servicio (Task 7, 8) dependen de estos nombres exactos.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260831_coach_video_analysis_schema.sql

CREATE TABLE IF NOT EXISTS public.coach_video_analysis_buckets (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('propio', 'rival')),
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cvab_coach ON public.coach_video_analysis_buckets(coach_key);

CREATE TABLE IF NOT EXISTS public.coach_video_analysis_matches (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_id          BIGINT NOT NULL REFERENCES public.coach_video_analysis_buckets(id) ON DELETE CASCADE,
  match_date         DATE NOT NULL,
  opponent_name      TEXT,
  instances          JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_storage_path TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cvam_bucket ON public.coach_video_analysis_matches(bucket_id);

ALTER TABLE public.coach_video_analysis_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_video_analysis_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "read_cvab" ON public.coach_video_analysis_buckets FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "write_cvab" ON public.coach_video_analysis_buckets FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "read_cvam" ON public.coach_video_analysis_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "write_cvam" ON public.coach_video_analysis_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bucket de Storage para los videos de partido, publico (mismo modelo que
-- 'informes-compartidos'): la ruta de cada objeto incluye bucketId/matchId,
-- no es adivinable ni listable sin conocer esos ids.
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-video-analysis', 'coach-video-analysis', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "coach_video_analysis_insert" ON storage.objects;
CREATE POLICY "coach_video_analysis_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'coach-video-analysis');

DROP POLICY IF EXISTS "coach_video_analysis_update" ON storage.objects;
CREATE POLICY "coach_video_analysis_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'coach-video-analysis')
  WITH CHECK (bucket_id = 'coach-video-analysis');

DROP POLICY IF EXISTS "coach_video_analysis_read" ON storage.objects;
CREATE POLICY "coach_video_analysis_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'coach-video-analysis');

DROP POLICY IF EXISTS "coach_video_analysis_delete" ON storage.objects;
CREATE POLICY "coach_video_analysis_delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'coach-video-analysis');
```

- [ ] **Step 2: Aplicar la migración**

Run: `supabase db push`
Expected: la migración se aplica sin errores contra el proyecto remoto (`project_id = "primer-appcloud"` en `supabase/config.toml`). Si el CLI pide login, avisar al usuario en vez de pedirle que corra el comando — probar primero si ya hay sesión activa.

- [ ] **Step 3: Verificar en Supabase**

Confirmar en el dashboard de Supabase (Table Editor) que `coach_video_analysis_buckets` y `coach_video_analysis_matches` existen con las columnas esperadas, y que el bucket `coach-video-analysis` aparece en Storage marcado como público.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260831_coach_video_analysis_schema.sql
git commit -m "feat(videoanalisis): tablas y bucket de Storage para Videoanalisis de Entrenadores"
```

---

## Task 2: Parser de XML — `parseNacsportXml`

**Files:**
- Create: `src/features/coaches/videoAnalysis/parseNacsportXml.ts`
- Create: `src/features/coaches/videoAnalysis/parseNacsportXml.test.ts`

**Interfaces:**
- Produces: `interface ParsedInstance { code: string; start: number; end: number; labels: { group: string; text: string }[]; x: number | null; y: number | null }`, `function parseNacsportXml(xmlText: string): { instances: ParsedInstance[]; warnings: string[] }`. Consumido por Task 4 (stats), Task 7 (service, al guardar `instances`), Task 13 (dropzone, al parsear el archivo subido).

- [ ] **Step 1: Escribir el test (fallando)**

```ts
// src/features/coaches/videoAnalysis/parseNacsportXml.test.ts
import { describe, it, expect } from 'vitest'
import { parseNacsportXml } from './parseNacsportXml'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<file>
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>12.5</start>
      <end>18.2</end>
      <code>Salida en corto</code>
      <label><group>Equipo</group><text>Propio</text></label>
      <label><group>Jugador</group><text>5 - Perez</text></label>
    </instance>
    <instance>
      <ID>2</ID>
      <start>40</start>
      <end>47.3</end>
      <code>Ataque posicional</code>
      <label><group>pos_x</group><text>0.62</text></label>
      <label><group>pos_y</group><text>0.35</text></label>
    </instance>
  </ALL_INSTANCES>
</file>`

describe('parseNacsportXml', () => {
  it('extrae code/start/end/labels de cada instance', () => {
    const { instances } = parseNacsportXml(SAMPLE_XML)
    expect(instances).toHaveLength(2)
    expect(instances[0]).toEqual({
      code: 'Salida en corto',
      start: 12.5,
      end: 18.2,
      labels: [
        { group: 'Equipo', text: 'Propio' },
        { group: 'Jugador', text: '5 - Perez' },
      ],
      x: null,
      y: null,
    })
  })

  it('detecta coordenadas x/y entre los labels cuando estan en formato fraccion 0-1 y las normaliza a 0-100', () => {
    const { instances } = parseNacsportXml(SAMPLE_XML)
    expect(instances[1].x).toBeCloseTo(62, 5)
    expect(instances[1].y).toBeCloseTo(35, 5)
  })

  it('tira un error claro si el archivo no tiene ninguna instance', () => {
    expect(() => parseNacsportXml('<file><ALL_INSTANCES></ALL_INSTANCES></file>')).toThrow(
      'No se encontraron cortes en este archivo',
    )
  })

  it('tira un error claro si el XML esta mal formado', () => {
    expect(() => parseNacsportXml('<file><ALL_INSTANCES><instance>')).toThrow('XML inválido')
  })

  it('ignora un label sin group o sin text en vez de romper', () => {
    const xml = `<file><ALL_INSTANCES><instance>
      <ID>1</ID><start>1</start><end>2</end><code>Test</code>
      <label><group>Solo group</group></label>
      <label><text>Solo text</text></label>
    </instance></ALL_INSTANCES></file>`
    const { instances } = parseNacsportXml(xml)
    expect(instances[0].labels).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/features/coaches/videoAnalysis/parseNacsportXml.test.ts`
Expected: FAIL — `parseNacsportXml.ts` todavía no existe.

- [ ] **Step 3: Implementar el parser**

```ts
// src/features/coaches/videoAnalysis/parseNacsportXml.ts

export interface ParsedInstance {
  code: string
  start: number
  end: number
  labels: { group: string; text: string }[]
  x: number | null
  y: number | null
}

const X_GROUP_NAMES = ['x', 'pos_x', 'posx']
const Y_GROUP_NAMES = ['y', 'pos_y', 'posy']

function textOf(el: Element, tag: string): string {
  return el.querySelector(tag)?.textContent?.trim() ?? ''
}

function parseLabels(instanceEl: Element): { group: string; text: string }[] {
  const labels: { group: string; text: string }[] = []
  instanceEl.querySelectorAll('label').forEach(labelEl => {
    const group = textOf(labelEl, 'group')
    const text = textOf(labelEl, 'text')
    if (group && text) labels.push({ group, text })
  })
  return labels
}

/** Normaliza una coordenada encontrada a 0-100. Fraccion [0,1] -> x100. Ya en [0,100] -> tal cual.
 *  Cualquier otro rango (ej. pixeles de un video en particular) no se puede normalizar sin mas
 *  contexto -- se descarta antes de dibujar un punto en una posicion inventada. */
function normalizeCoord(raw: number): number | null {
  if (raw >= 0 && raw <= 1) return raw * 100
  if (raw >= 0 && raw <= 100) return raw
  return null
}

function extractCoord(labels: { group: string; text: string }[], names: string[]): number | null {
  for (const label of labels) {
    if (!names.includes(label.group.toLowerCase())) continue
    const num = Number(label.text)
    if (!Number.isNaN(num)) return normalizeCoord(num)
  }
  return null
}

export function parseNacsportXml(xmlText: string): { instances: ParsedInstance[]; warnings: string[] } {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML inválido')

  const instanceEls = Array.from(doc.querySelectorAll('instance'))
  if (instanceEls.length === 0) {
    throw new Error('No se encontraron cortes en este archivo — ¿es una exportación de Nacsport?')
  }

  const warnings: string[] = []
  const instances: ParsedInstance[] = instanceEls.map(instanceEl => {
    const code = textOf(instanceEl, 'code')
    const start = Number(textOf(instanceEl, 'start'))
    const end = Number(textOf(instanceEl, 'end'))
    const labels = parseLabels(instanceEl)
    if (!code) warnings.push(`Instancia sin código de categoría (ID ${textOf(instanceEl, 'ID') || '?'})`)
    return {
      code,
      start: Number.isNaN(start) ? 0 : start,
      end: Number.isNaN(end) ? 0 : end,
      labels,
      x: extractCoord(labels, X_GROUP_NAMES),
      y: extractCoord(labels, Y_GROUP_NAMES),
    }
  })

  return { instances, warnings }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/features/coaches/videoAnalysis/parseNacsportXml.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/videoAnalysis/parseNacsportXml.ts src/features/coaches/videoAnalysis/parseNacsportXml.test.ts
git commit -m "feat(videoanalisis): parser de XML de Nacsport"
```

---

## Task 3: Clasificación de fase y zona — `videoAnalysisTagging`

**Files:**
- Create: `src/features/coaches/videoAnalysis/videoAnalysisTagging.ts`
- Create: `src/features/coaches/videoAnalysis/videoAnalysisTagging.test.ts`

**Interfaces:**
- Consumes: `normalizeName` de `@/utils/scoring` (case/tilde-insensitive, ya usado en el resto de la app).
- Produces: `type ActionPhase = 'defensiva' | 'ofensiva' | 'transicion' | 'abp' | 'otro'`, `function classifyPhase(code: string): ActionPhase`, `function inferZoneRect(code: string): { x1: number; y1: number; x2: number; y2: number } | null`. Consumido por Task 4 (stats) y Task 9 (cancha).

- [ ] **Step 1: Escribir el test (fallando)**

```ts
// src/features/coaches/videoAnalysis/videoAnalysisTagging.test.ts
import { describe, it, expect } from 'vitest'
import { classifyPhase, inferZoneRect } from './videoAnalysisTagging'

describe('classifyPhase', () => {
  it('clasifica terminos ofensivos', () => {
    expect(classifyPhase('Salida en corto')).toBe('ofensiva')
    expect(classifyPhase('Ataque posicional')).toBe('ofensiva')
  })
  it('clasifica terminos defensivos', () => {
    expect(classifyPhase('Presión alta')).toBe('defensiva')
    expect(classifyPhase('Repliegue')).toBe('defensiva')
  })
  it('clasifica transiciones', () => {
    expect(classifyPhase('Transición defensiva')).toBe('transicion')
    expect(classifyPhase('TRANSICION OFENSIVA')).toBe('transicion')
  })
  it('clasifica ABP', () => {
    expect(classifyPhase('ABP a favor')).toBe('abp')
    expect(classifyPhase('Córner en contra')).toBe('abp')
    expect(classifyPhase('Tiro libre')).toBe('abp')
  })
  it('es insensible a mayusculas y tildes', () => {
    expect(classifyPhase('PRESION ALTA')).toBe('defensiva')
    expect(classifyPhase('presion alta')).toBe('defensiva')
  })
  it('sin match devuelve otro', () => {
    expect(classifyPhase('Categoría rara sin sentido futbolístico')).toBe('otro')
  })
})

describe('inferZoneRect', () => {
  it('reconoce banda izquierda', () => {
    expect(inferZoneRect('Ataque por izquierda')).toEqual({ x1: 0, y1: 0, x2: 33, y2: 100 })
  })
  it('reconoce banda derecha', () => {
    expect(inferZoneRect('Ataque por derecha')).toEqual({ x1: 67, y1: 0, x2: 100, y2: 100 })
  })
  it('reconoce centro', () => {
    expect(inferZoneRect('Ataque por el centro')).toEqual({ x1: 33, y1: 0, x2: 67, y2: 100 })
  })
  it('reconoce tercio propio (defensivo)', () => {
    expect(inferZoneRect('Salida en corto')).toEqual({ x1: 0, y1: 67, x2: 100, y2: 100 })
  })
  it('reconoce tercio rival (ofensivo)', () => {
    expect(inferZoneRect('Remate en zona ofensiva')).toEqual({ x1: 0, y1: 0, x2: 100, y2: 33 })
  })
  it('sin match devuelve null', () => {
    expect(inferZoneRect('Categoría sin ninguna pista de zona')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/features/coaches/videoAnalysis/videoAnalysisTagging.test.ts`
Expected: FAIL — el módulo todavía no existe.

- [ ] **Step 3: Implementar la clasificación**

```ts
// src/features/coaches/videoAnalysis/videoAnalysisTagging.ts
import { normalizeName } from '@/utils/scoring'

export type ActionPhase = 'defensiva' | 'ofensiva' | 'transicion' | 'abp' | 'otro'

// Diccionario semilla de terminos comunes de botoneras de videoanalisis en espanol.
// Ampliable: si un XML real trae un codigo que no matchea nada, se agrega aca.
const PHASE_KEYWORDS: { phase: ActionPhase; keywords: string[] }[] = [
  { phase: 'transicion', keywords: ['transicion'] },
  { phase: 'abp', keywords: ['abp', 'corner', 'tiro libre', 'penal', 'lateral', 'saque de banda'] },
  { phase: 'defensiva', keywords: ['presion', 'repliegue', 'marca', 'recuperacion', 'defensiv'] },
  { phase: 'ofensiva', keywords: ['salida', 'ataque', 'posesion', 'ofensiv', 'finalizacion', 'remate', 'gestacion'] },
]

export function classifyPhase(code: string): ActionPhase {
  const normalized = normalizeName(code)
  for (const { phase, keywords } of PHASE_KEYWORDS) {
    if (keywords.some(k => normalized.includes(k))) return phase
  }
  return 'otro'
}

interface ZoneRect { x1: number; y1: number; x2: number; y2: number }

// Sistema 0-100 igual que markers/FORMATIONS: y=0 arco rival, y=100 arco propio;
// x=0 banda izquierda, x=100 banda derecha (vista desde el propio equipo atacando hacia arriba).
const ZONE_KEYWORDS: { zone: ZoneRect; keywords: string[] }[] = [
  { zone: { x1: 0, y1: 0, x2: 33, y2: 100 }, keywords: ['izquierda', 'carril 1', 'carril 2'] },
  { zone: { x1: 67, y1: 0, x2: 100, y2: 100 }, keywords: ['derecha', 'carril 4', 'carril 5'] },
  { zone: { x1: 33, y1: 0, x2: 67, y2: 100 }, keywords: ['centro', 'central', 'carril 3'] },
  { zone: { x1: 0, y1: 0, x2: 100, y2: 33 }, keywords: ['ofensiv', 'zona rival', 'tercio rival'] },
  { zone: { x1: 0, y1: 67, x2: 100, y2: 100 }, keywords: ['salida', 'defensiv', 'tercio propio'] },
]

export function inferZoneRect(code: string): ZoneRect | null {
  const normalized = normalizeName(code)
  for (const { zone, keywords } of ZONE_KEYWORDS) {
    if (keywords.some(k => normalized.includes(k))) return zone
  }
  return null
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/features/coaches/videoAnalysis/videoAnalysisTagging.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/videoAnalysis/videoAnalysisTagging.ts src/features/coaches/videoAnalysis/videoAnalysisTagging.test.ts
git commit -m "feat(videoanalisis): clasificacion de fase y zona por palabra clave"
```

---

## Task 4: Agregación para gráficos — `videoAnalysisStats`

**Files:**
- Create: `src/features/coaches/videoAnalysis/videoAnalysisStats.ts`
- Create: `src/features/coaches/videoAnalysis/videoAnalysisStats.test.ts`

**Interfaces:**
- Consumes: `ParsedInstance` (Task 2), `classifyPhase`/`inferZoneRect` (Task 3).
- Produces: `interface StatsMatch { match_date: string; instances: ParsedInstance[] }`, `countByCode`, `countByPhase`, `evolutionByMatch`, `pitchPoints` — usados por Task 9 (cancha), Task 10 (barras), Task 11 (torta), Task 12 (evolución).

- [ ] **Step 1: Escribir el test (fallando)**

```ts
// src/features/coaches/videoAnalysis/videoAnalysisStats.test.ts
import { describe, it, expect } from 'vitest'
import { countByCode, countByPhase, evolutionByMatch, pitchPoints, type StatsMatch } from './videoAnalysisStats'
import type { ParsedInstance } from './parseNacsportXml'

function inst(over: Partial<ParsedInstance> = {}): ParsedInstance {
  return { code: 'Salida en corto', start: 0, end: 1, labels: [], x: null, y: null, ...over }
}

describe('countByCode', () => {
  it('suma cortes del mismo codigo entre varios matches', () => {
    const matches: StatsMatch[] = [
      { match_date: '2026-08-16', instances: [inst({ code: 'Salida en corto' }), inst({ code: 'Ataque' })] },
      { match_date: '2026-08-23', instances: [inst({ code: 'Salida en corto' })] },
    ]
    const result = countByCode(matches)
    expect(result).toEqual([
      { code: 'Salida en corto', count: 2 },
      { code: 'Ataque', count: 1 },
    ])
  })

  it('con 0 matches devuelve lista vacia', () => {
    expect(countByCode([])).toEqual([])
  })
})

describe('countByPhase', () => {
  it('agrupa por fase clasificada del codigo', () => {
    const matches: StatsMatch[] = [
      { match_date: '2026-08-16', instances: [inst({ code: 'Salida en corto' }), inst({ code: 'Presión alta' })] },
    ]
    const result = countByPhase(matches)
    expect(result.ofensiva).toBe(1)
    expect(result.defensiva).toBe(1)
    expect(result.transicion).toBe(0)
    expect(result.abp).toBe(0)
    expect(result.otro).toBe(0)
  })
})

describe('evolutionByMatch', () => {
  it('ordena por fecha aunque los matches vengan desordenados', () => {
    const matches: StatsMatch[] = [
      { match_date: '2026-08-23', instances: [inst({ code: 'X' }), inst({ code: 'X' })] },
      { match_date: '2026-08-16', instances: [inst({ code: 'X' })] },
    ]
    const result = evolutionByMatch(matches, 'X')
    expect(result).toEqual([
      { matchDate: '2026-08-16', count: 1 },
      { matchDate: '2026-08-23', count: 2 },
    ])
  })

  it('un match sin cortes de esa categoria cuenta 0', () => {
    const matches: StatsMatch[] = [{ match_date: '2026-08-16', instances: [inst({ code: 'Otro' })] }]
    const result = evolutionByMatch(matches, 'X')
    expect(result).toEqual([{ matchDate: '2026-08-16', count: 0 }])
  })
})

describe('pitchPoints', () => {
  it('separa puntos exactos (con x/y) de zonas inferidas (sin x/y)', () => {
    const matches: StatsMatch[] = [
      {
        match_date: '2026-08-16',
        instances: [
          inst({ code: 'X', x: 62, y: 35 }),
          inst({ code: 'X', x: null, y: null }), // sin coordenadas, "X" no matchea ningun termino de zona
        ],
      },
    ]
    const result = pitchPoints(matches, 'X')
    expect(result.exact).toEqual([{ x: 62, y: 35 }])
    expect(result.zones).toEqual([])
  })

  it('usa la zona inferida cuando no hay x/y pero el codigo matchea un termino conocido', () => {
    const matches: StatsMatch[] = [{ match_date: '2026-08-16', instances: [inst({ code: 'Salida en corto' })] }]
    const result = pitchPoints(matches, 'Salida en corto')
    expect(result.exact).toEqual([])
    expect(result.zones).toEqual([{ x1: 0, y1: 67, x2: 100, y2: 100 }])
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/features/coaches/videoAnalysis/videoAnalysisStats.test.ts`
Expected: FAIL — el módulo todavía no existe.

- [ ] **Step 3: Implementar la agregación**

```ts
// src/features/coaches/videoAnalysis/videoAnalysisStats.ts
import type { ParsedInstance } from './parseNacsportXml'
import { classifyPhase, inferZoneRect, type ActionPhase } from './videoAnalysisTagging'

export interface StatsMatch {
  match_date: string
  instances: ParsedInstance[]
}

function allInstances(matches: StatsMatch[]): ParsedInstance[] {
  return matches.flatMap(m => m.instances)
}

export function countByCode(matches: StatsMatch[]): { code: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const inst of allInstances(matches)) {
    counts.set(inst.code, (counts.get(inst.code) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
}

export function countByPhase(matches: StatsMatch[]): Record<ActionPhase, number> {
  const result: Record<ActionPhase, number> = { defensiva: 0, ofensiva: 0, transicion: 0, abp: 0, otro: 0 }
  for (const inst of allInstances(matches)) {
    result[classifyPhase(inst.code)]++
  }
  return result
}

export function evolutionByMatch(matches: StatsMatch[], code: string): { matchDate: string; count: number }[] {
  return [...matches]
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
    .map(m => ({ matchDate: m.match_date, count: m.instances.filter(i => i.code === code).length }))
}

export function pitchPoints(
  matches: StatsMatch[],
  code: string,
): { exact: { x: number; y: number }[]; zones: { x1: number; y1: number; x2: number; y2: number }[] } {
  const exact: { x: number; y: number }[] = []
  const zones: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (const inst of allInstances(matches)) {
    if (inst.code !== code) continue
    if (inst.x !== null && inst.y !== null) {
      exact.push({ x: inst.x, y: inst.y })
    } else {
      const zone = inferZoneRect(inst.code)
      if (zone) zones.push(zone)
    }
  }
  return { exact, zones }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/features/coaches/videoAnalysis/videoAnalysisStats.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/videoAnalysis/videoAnalysisStats.ts src/features/coaches/videoAnalysis/videoAnalysisStats.test.ts
git commit -m "feat(videoanalisis): agregacion de datos para graficos y cancha"
```

---

## Task 5: Geometría del filtro de fechas — `dateRangeSlider`

**Files:**
- Create: `src/features/coaches/videoAnalysis/dateRangeSlider.ts`
- Create: `src/features/coaches/videoAnalysis/dateRangeSlider.test.ts`

**Interfaces:**
- Produces: `function dateToPercent(date: string, minDate: string, maxDate: string): number`, `function percentToDate(percent: number, minDate: string, maxDate: string): string`. Consumido por Task 6 (componente del slider).

- [ ] **Step 1: Escribir el test (fallando)**

```ts
// src/features/coaches/videoAnalysis/dateRangeSlider.test.ts
import { describe, it, expect } from 'vitest'
import { dateToPercent, percentToDate } from './dateRangeSlider'

describe('dateToPercent', () => {
  it('la fecha minima es 0%, la maxima es 100%', () => {
    expect(dateToPercent('2026-08-02', '2026-08-02', '2026-08-30')).toBe(0)
    expect(dateToPercent('2026-08-30', '2026-08-02', '2026-08-30')).toBe(100)
  })
  it('una fecha a mitad de camino da ~50%', () => {
    expect(dateToPercent('2026-08-16', '2026-08-02', '2026-08-30')).toBeCloseTo(50, 0)
  })
  it('con min === max (un solo partido) siempre da 100% sin dividir por cero', () => {
    expect(dateToPercent('2026-08-16', '2026-08-16', '2026-08-16')).toBe(100)
  })
})

describe('percentToDate', () => {
  it('0% da la fecha minima, 100% da la maxima', () => {
    expect(percentToDate(0, '2026-08-02', '2026-08-30')).toBe('2026-08-02')
    expect(percentToDate(100, '2026-08-02', '2026-08-30')).toBe('2026-08-30')
  })
  it('con min === max siempre devuelve esa fecha', () => {
    expect(percentToDate(37, '2026-08-16', '2026-08-16')).toBe('2026-08-16')
  })
  it('es la inversa aproximada de dateToPercent', () => {
    const pct = dateToPercent('2026-08-16', '2026-08-02', '2026-08-30')
    expect(percentToDate(pct, '2026-08-02', '2026-08-30')).toBe('2026-08-16')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/features/coaches/videoAnalysis/dateRangeSlider.test.ts`
Expected: FAIL — el módulo todavía no existe.

- [ ] **Step 3: Implementar la geometría**

```ts
// src/features/coaches/videoAnalysis/dateRangeSlider.ts
import { clampPercent } from '@/features/coaches/boardGeometry'

const DAY_MS = 24 * 60 * 60 * 1000

function toMs(date: string): number {
  return new Date(`${date}T00:00:00`).getTime()
}

export function dateToPercent(date: string, minDate: string, maxDate: string): number {
  const min = toMs(minDate)
  const max = toMs(maxDate)
  if (max <= min) return 100
  return clampPercent(((toMs(date) - min) / (max - min)) * 100)
}

export function percentToDate(percent: number, minDate: string, maxDate: string): string {
  const min = toMs(minDate)
  const max = toMs(maxDate)
  if (max <= min) return minDate
  const clamped = clampPercent(percent)
  const ms = min + (clamped / 100) * (max - min)
  const snapped = Math.round(ms / DAY_MS) * DAY_MS
  return new Date(snapped).toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/features/coaches/videoAnalysis/dateRangeSlider.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/coaches/videoAnalysis/dateRangeSlider.ts src/features/coaches/videoAnalysis/dateRangeSlider.test.ts
git commit -m "feat(videoanalisis): geometria pura del filtro de fechas"
```

---

## Task 6: Componente del filtro de fechas — `VideoAnalysisDateRangeSlider`

**Files:**
- Create: `src/features/coaches/components/VideoAnalysisDateRangeSlider.tsx`

**Interfaces:**
- Consumes: `dateToPercent`, `percentToDate` (Task 5).
- Produces: `export default function VideoAnalysisDateRangeSlider(props: { minDate: string; maxDate: string; fromDate: string; toDate: string; onChange: (from: string, to: string) => void }): JSX.Element`. Consumido por Task 15 (tab principal).

- [ ] **Step 1: Implementar el componente**

Mismo patrón de interacción por puntero que `TacticalBoardPitch.tsx` (`pointerdown`/`pointermove`/`pointerup` sobre un contenedor, posición convertida a % con `getBoundingClientRect`), aplicado a 2 manijas en vez de fichas libres:

```tsx
// src/features/coaches/components/VideoAnalysisDateRangeSlider.tsx
import { useRef, useState } from 'react'
import { dateToPercent, percentToDate } from '@/features/coaches/videoAnalysis/dateRangeSlider'
import { clampPercent } from '@/features/coaches/boardGeometry'

type Handle = 'from' | 'to'

export default function VideoAnalysisDateRangeSlider({
  minDate,
  maxDate,
  fromDate,
  toDate,
  onChange,
}: {
  minDate: string
  maxDate: string
  fromDate: string
  toDate: string
  onChange: (from: string, to: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<Handle | null>(null)

  const fromPct = dateToPercent(fromDate, minDate, maxDate)
  const toPct = dateToPercent(toDate, minDate, maxDate)

  function percentFromEvent(e: React.PointerEvent): number {
    const rect = trackRef.current!.getBoundingClientRect()
    return clampPercent(((e.clientX - rect.left) / rect.width) * 100)
  }

  function handleMove(e: React.PointerEvent) {
    if (!dragging) return
    const pct = percentFromEvent(e)
    const date = percentToDate(pct, minDate, maxDate)
    if (dragging === 'from') {
      onChange(date <= toDate ? date : toDate, toDate)
    } else {
      onChange(fromDate, date >= fromDate ? date : fromDate)
    }
  }

  function startDrag(handle: Handle) {
    return (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(handle)
    }
  }

  function endDrag(e: React.PointerEvent) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
    setDragging(null)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-2xs text-apple-gray-400 flex-shrink-0">{minDate}</span>
      <div
        ref={trackRef}
        className="relative flex-1 h-1 bg-apple-gray-200 dark:bg-apple-gray-700 rounded-full"
        onPointerMove={handleMove}
      >
        <div
          className="absolute h-full bg-brand-green rounded-full"
          style={{ left: `${fromPct}%`, right: `${100 - toPct}%` }}
        />
        <div
          onPointerDown={startDrag('from')}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-green border-2 border-white dark:border-apple-gray-900 shadow cursor-grab active:cursor-grabbing"
          style={{ left: `${fromPct}%` }}
        />
        <div
          onPointerDown={startDrag('to')}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-green border-2 border-white dark:border-apple-gray-900 shadow cursor-grab active:cursor-grabbing"
          style={{ left: `${toPct}%` }}
        />
      </div>
      <span className="text-2xs text-apple-gray-400 flex-shrink-0">{maxDate}</span>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores. Este componente se ejercita en vivo recién en Task 15 (no tiene lógica no trivial propia — la lógica testeada vive en Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/VideoAnalysisDateRangeSlider.tsx
git commit -m "feat(videoanalisis): componente de filtro de rango de fechas"
```

---

## Task 7: Servicio — buckets (`videoAnalysisService.ts`, parte 1)

**Files:**
- Create: `src/services/videoAnalysisService.ts`

**Interfaces:**
- Produces: `type BucketKind = 'propio' | 'rival'`, `interface VideoAnalysisBucket { id: number; coach_key: string; kind: BucketKind; name: string | null; created_at: string }`, `ensurePropioBucket`, `listBuckets`, `createRivalBucket`, `deleteBucket`. Consumido por Task 15.

- [ ] **Step 1: Implementar el servicio de buckets**

Mismo patrón que `tacticalBoardService.ts` (Supabase directo, `console.error` + valor por defecto en error, sin tests unitarios — es un wrapper delgado de I/O, mismo criterio que el resto de `src/services/`):

```ts
// src/services/videoAnalysisService.ts
import { supabase } from '@/lib/supabase'

export type BucketKind = 'propio' | 'rival'

export interface VideoAnalysisBucket {
  id: number
  coach_key: string
  kind: BucketKind
  name: string | null
  created_at: string
}

export async function listBuckets(coachKey: string): Promise<VideoAnalysisBucket[]> {
  const { data, error } = await supabase
    .from('coach_video_analysis_buckets')
    .select('*')
    .eq('coach_key', coachKey)
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Error listando buckets de videoanalisis:', error)
    return []
  }
  return data as unknown as VideoAnalysisBucket[]
}

/** Trae el bucket 'propio' del coach, o lo crea si es la primera vez que entra a la pestana. */
export async function ensurePropioBucket(coachKey: string): Promise<VideoAnalysisBucket | null> {
  const existing = await listBuckets(coachKey)
  const propio = existing.find(b => b.kind === 'propio')
  if (propio) return propio

  const { data, error } = await supabase
    .from('coach_video_analysis_buckets')
    .insert({ coach_key: coachKey, kind: 'propio', name: null })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creando bucket propio de videoanalisis:', error)
    return null
  }
  return data as unknown as VideoAnalysisBucket
}

export async function createRivalBucket(coachKey: string, name: string): Promise<VideoAnalysisBucket | null> {
  const { data, error } = await supabase
    .from('coach_video_analysis_buckets')
    .insert({ coach_key: coachKey, kind: 'rival', name })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creando bucket de rival de videoanalisis:', error)
    return null
  }
  return data as unknown as VideoAnalysisBucket
}

export async function deleteBucket(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_video_analysis_buckets').delete().eq('id', id)
  if (error) {
    console.error('Error borrando bucket de videoanalisis:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/services/videoAnalysisService.ts
git commit -m "feat(videoanalisis): servicio de buckets (propio/rival)"
```

---

## Task 8: Servicio — partidos + video (`videoAnalysisService.ts`, parte 2)

**Files:**
- Modify: `src/services/videoAnalysisService.ts` (agregar al final del archivo de Task 7)

**Interfaces:**
- Consumes: `ParsedInstance` (Task 2).
- Produces: `interface VideoAnalysisMatch { id: number; bucket_id: number; match_date: string; opponent_name: string | null; instances: ParsedInstance[]; video_storage_path: string | null; created_at: string }`, `listMatches`, `createMatch`, `deleteMatch`, `uploadMatchVideo`. Consumido por Task 13 (dropzone) y Task 15.

- [ ] **Step 1: Agregar las funciones de partidos y video**

```ts
// agregar a src/services/videoAnalysisService.ts
import type { ParsedInstance } from '@/features/coaches/videoAnalysis/parseNacsportXml'

const MAX_VIDEO_BYTES = 500 * 1024 * 1024 // 500MB

export interface VideoAnalysisMatch {
  id: number
  bucket_id: number
  match_date: string
  opponent_name: string | null
  instances: ParsedInstance[]
  video_storage_path: string | null
  created_at: string
}

export async function listMatches(bucketId: number): Promise<VideoAnalysisMatch[]> {
  const { data, error } = await supabase
    .from('coach_video_analysis_matches')
    .select('*')
    .eq('bucket_id', bucketId)
    .order('match_date', { ascending: false })

  if (error || !data) {
    console.error('Error listando partidos de videoanalisis:', error)
    return []
  }
  return data as unknown as VideoAnalysisMatch[]
}

export async function createMatch(
  bucketId: number,
  matchDate: string,
  opponentName: string | null,
  instances: ParsedInstance[],
): Promise<VideoAnalysisMatch | null> {
  const { data, error } = await supabase
    .from('coach_video_analysis_matches')
    .insert({ bucket_id: bucketId, match_date: matchDate, opponent_name: opponentName, instances })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creando partido de videoanalisis:', error)
    return null
  }
  return data as unknown as VideoAnalysisMatch
}

export async function deleteMatch(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_video_analysis_matches').delete().eq('id', id)
  if (error) {
    console.error('Error borrando partido de videoanalisis:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** Sube el video completo del partido a Storage y guarda la ruta en el match.
 *  Sin progreso real (supabase-js no lo expone) -- el llamador muestra un estado
 *  binario "subiendo/listo", no un porcentaje. */
export async function uploadMatchVideo(
  coachKey: string,
  bucketId: number,
  matchId: number,
  file: File,
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (file.size > MAX_VIDEO_BYTES) {
    return { success: false, error: 'El video pesa más de 500MB. Comprimilo o subí una versión más liviana.' }
  }

  const ext = file.name.split('.').pop() ?? 'mp4'
  const path = `${coachKey}/${bucketId}/${matchId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('coach-video-analysis')
    .upload(path, file, { upsert: true })

  if (uploadError) {
    console.error('Error subiendo video de videoanalisis:', uploadError)
    return { success: false, error: uploadError.message }
  }

  const { error: updateError } = await supabase
    .from('coach_video_analysis_matches')
    .update({ video_storage_path: path })
    .eq('id', matchId)

  if (updateError) {
    console.error('Error guardando ruta de video de videoanalisis:', updateError)
    return { success: false, error: updateError.message }
  }

  return { success: true, path }
}

export function getMatchVideoUrl(path: string): string {
  return supabase.storage.from('coach-video-analysis').getPublicUrl(path).data.publicUrl
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/services/videoAnalysisService.ts
git commit -m "feat(videoanalisis): servicio de partidos y subida de video"
```

---

## Task 9: Cancha — `VideoAnalysisPitch`

**Files:**
- Create: `src/features/coaches/components/VideoAnalysisPitch.tsx`

**Interfaces:**
- Consumes: salida de `pitchPoints` (Task 4): `{ exact: { x: number; y: number }[]; zones: { x1: number; y1: number; x2: number; y2: number }[] }`.
- Produces: `export default function VideoAnalysisPitch(props: { exact: { x: number; y: number }[]; zones: { x1: number; y1: number; x2: number; y2: number }[] }): JSX.Element`. Consumido por Task 15.

- [ ] **Step 1: Implementar la cancha**

Reusa el mismo dibujo SVG de líneas de campo que `TacticalBoardPitch.tsx` (`viewBox="0 0 100 130"`, orientación vertical fija — no hace falta horizontal acá, es solo visualización, no interactiva):

```tsx
// src/features/coaches/components/VideoAnalysisPitch.tsx
export default function VideoAnalysisPitch({
  exact,
  zones,
}: {
  exact: { x: number; y: number }[]
  zones: { x1: number; y1: number; x2: number; y2: number }[]
}) {
  return (
    <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl p-4 relative w-full aspect-[3/4] max-w-md mx-auto shadow-2xl overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
        <rect x="2" y="2" width="96" height="126" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <line x1="2" y1="65" x2="98" y2="65" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="2" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="108" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
      </svg>

      {zones.map((z, i) => (
        <div
          key={i}
          className="absolute bg-brand-green/30 rounded-md"
          style={{ left: `${z.x1}%`, top: `${z.y1}%`, width: `${z.x2 - z.x1}%`, height: `${z.y2 - z.y1}%` }}
        />
      ))}

      {exact.map((p, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 shadow"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        />
      ))}

      {exact.length === 0 && zones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/70 text-center px-6">Sin datos de posición para esta categoría.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/VideoAnalysisPitch.tsx
git commit -m "feat(videoanalisis): cancha con puntos exactos y zonas inferidas"
```

---

## Task 10: Gráfico de barras — `VideoAnalysisCategoryChart`

**Files:**
- Create: `src/features/coaches/components/VideoAnalysisCategoryChart.tsx`

**Interfaces:**
- Consumes: salida de `countByCode` (Task 4).
- Produces: `export default function VideoAnalysisCategoryChart(props: { data: { code: string; count: number }[] }): JSX.Element`. Consumido por Task 15.

- [ ] **Step 1: Implementar el gráfico de barras**

```tsx
// src/features/coaches/components/VideoAnalysisCategoryChart.tsx
export default function VideoAnalysisCategoryChart({ data }: { data: { code: string; count: number }[] }) {
  const top = data.slice(0, 8)
  const max = top[0]?.count ?? 1

  return (
    <div>
      <p className="text-2xs text-apple-gray-400 mb-2">Qué acción se repite más en el rango elegido.</p>
      {top.length === 0 && <p className="text-xs text-apple-gray-400">Sin cortes en este rango.</p>}
      {top.map(row => (
        <div key={row.code} className="flex items-center gap-2 my-1.5">
          <span className="text-2xs text-apple-gray-600 dark:text-apple-gray-300 w-28 flex-shrink-0 truncate">{row.code}</span>
          <div className="flex-1 h-2.5 bg-apple-gray-100 dark:bg-apple-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-green rounded-full" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
          <span className="text-2xs text-apple-gray-400 w-6 text-right flex-shrink-0">{row.count}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/VideoAnalysisCategoryChart.tsx
git commit -m "feat(videoanalisis): grafico de barras por categoria"
```

---

## Task 11: Gráfico de fases — `VideoAnalysisPhaseChart`

**Files:**
- Create: `src/features/coaches/components/VideoAnalysisPhaseChart.tsx`

**Interfaces:**
- Consumes: salida de `countByPhase` (Task 4): `Record<ActionPhase, number>`.
- Produces: `export default function VideoAnalysisPhaseChart(props: { counts: Record<ActionPhase, number> }): JSX.Element`. Consumido por Task 15.

- [ ] **Step 1: Implementar el gráfico de torta**

Torta vía `conic-gradient` en CSS (sin librería de gráficos — mismo criterio "sin dependencias nuevas" del resto del plan):

```tsx
// src/features/coaches/components/VideoAnalysisPhaseChart.tsx
import type { ActionPhase } from '@/features/coaches/videoAnalysis/videoAnalysisTagging'

const PHASE_META: { key: ActionPhase; label: string; color: string }[] = [
  { key: 'ofensiva', label: 'Ofensiva', color: '#22c55e' },
  { key: 'defensiva', label: 'Defensiva', color: '#38bdf8' },
  { key: 'transicion', label: 'Transición', color: '#facc15' },
  { key: 'abp', label: 'ABP', color: '#f97316' },
  { key: 'otro', label: 'Otro', color: '#a3a3a3' },
]

export default function VideoAnalysisPhaseChart({ counts }: { counts: Record<ActionPhase, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) {
    return <p className="text-xs text-apple-gray-400">Sin cortes en este rango.</p>
  }

  let acc = 0
  const stops = PHASE_META.map(m => {
    const pct = (counts[m.key] / total) * 100
    const stop = `${m.color} ${acc}% ${acc + pct}%`
    acc += pct
    return stop
  }).join(', ')

  return (
    <div>
      <p className="text-2xs text-apple-gray-400 mb-2">Cuánto fue defensivo, ofensivo o transición.</p>
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex-shrink-0"
          style={{ background: `conic-gradient(${stops})` }}
        />
        <div className="flex flex-col gap-1">
          {PHASE_META.filter(m => counts[m.key] > 0).map(m => (
            <span key={m.key} className="text-2xs text-apple-gray-500 dark:text-apple-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              {m.label} {Math.round((counts[m.key] / total) * 100)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/VideoAnalysisPhaseChart.tsx
git commit -m "feat(videoanalisis): grafico de torta por fase de juego"
```

---

## Task 12: Gráfico de evolución — `VideoAnalysisEvolutionChart`

**Files:**
- Create: `src/features/coaches/components/VideoAnalysisEvolutionChart.tsx`

**Interfaces:**
- Consumes: `countByCode`, `evolutionByMatch`, `StatsMatch` (Task 4).
- Produces: `export default function VideoAnalysisEvolutionChart(props: { matches: StatsMatch[] }): JSX.Element` (recibe los matches ya filtrados por fecha; calcula internamente la lista de categorías disponibles con `countByCode`). Consumido por Task 15.

- [ ] **Step 1: Implementar el gráfico de evolución**

```tsx
// src/features/coaches/components/VideoAnalysisEvolutionChart.tsx
import { useState, useEffect } from 'react'
import { countByCode, evolutionByMatch, type StatsMatch } from '@/features/coaches/videoAnalysis/videoAnalysisStats'

export default function VideoAnalysisEvolutionChart({ matches }: { matches: StatsMatch[] }) {
  const topCodes = countByCode(matches).map(c => c.code)
  const [selected, setSelected] = useState(topCodes[0] ?? '')

  useEffect(() => {
    if (!topCodes.includes(selected)) setSelected(topCodes[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  if (topCodes.length === 0) {
    return <p className="text-xs text-apple-gray-400">Sin cortes en este rango.</p>
  }

  const evolution = evolutionByMatch(matches, selected)
  const max = Math.max(1, ...evolution.map(e => e.count))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xs text-apple-gray-400">Evolución partido a partido.</p>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="text-2xs rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 py-1"
        >
          {topCodes.map(code => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {evolution.map((e, i) => (
          <div
            key={i}
            title={`${e.matchDate}: ${e.count}`}
            className="flex-1 bg-gradient-to-t from-green-600 to-brand-green rounded-t"
            style={{ height: `${(e.count / max) * 100}%`, minHeight: e.count > 0 ? '4px' : '0' }}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/VideoAnalysisEvolutionChart.tsx
git commit -m "feat(videoanalisis): grafico de evolucion partido a partido"
```

---

## Task 13: Subida de archivos — `VideoAnalysisDropzone`

**Files:**
- Create: `src/features/coaches/components/VideoAnalysisDropzone.tsx`

**Interfaces:**
- Consumes: `parseNacsportXml` (Task 2).
- Produces: `export default function VideoAnalysisDropzone(props: { onParsed: (result: { instances: ParsedInstance[]; matchDate: string; opponentName: string | null; videoFile: File | null }) => void }): JSX.Element`. Consumido por Task 15.

- [ ] **Step 1: Implementar el dropzone**

Acepta 1-2 archivos sueltos a la vez (XML obligatorio, video opcional), distinguidos por extensión. Al detectar el XML, pide fecha (obligatoria) y rival (opcional, solo informativo) en un formulario chico antes de confirmar — mismo patrón de formulario simple que `SessionForm` de Entrenamientos:

```tsx
// src/features/coaches/components/VideoAnalysisDropzone.tsx
import { useRef, useState } from 'react'
import { parseNacsportXml, type ParsedInstance } from '@/features/coaches/videoAnalysis/parseNacsportXml'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm']

function extOf(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

export default function VideoAnalysisDropzone({
  onParsed,
}: {
  onParsed: (result: { instances: ParsedInstance[]; matchDate: string; opponentName: string | null; videoFile: File | null }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ instances: ParsedInstance[]; videoFile: File | null } | null>(null)
  const [matchDate, setMatchDate] = useState('')
  const [opponentName, setOpponentName] = useState('')

  async function handleFiles(files: FileList | File[]) {
    setError(null)
    const list = Array.from(files)
    const xmlFile = list.find(f => extOf(f) === 'xml')
    const videoFile = list.find(f => VIDEO_EXTENSIONS.includes(extOf(f))) ?? null

    if (!xmlFile) {
      setError('Hace falta un archivo .xml del videoanálisis.')
      return
    }

    try {
      const text = await xmlFile.text()
      const { instances } = parseNacsportXml(text)
      setPending({ instances, videoFile })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  function confirm() {
    if (!pending || !matchDate) return
    onParsed({
      instances: pending.instances,
      matchDate,
      opponentName: opponentName.trim() || null,
      videoFile: pending.videoFile,
    })
    setPending(null)
    setMatchDate('')
    setOpponentName('')
  }

  if (pending) {
    return (
      <div className="space-y-3 bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
        <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400">
          {pending.instances.length} cortes detectados{pending.videoFile ? ` · video: ${pending.videoFile.name}` : ''}
        </p>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Fecha del partido</label>
          <input
            type="date"
            value={matchDate}
            onChange={e => setMatchDate(e.target.value)}
            className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Rival (opcional)</label>
          <input
            type="text"
            value={opponentName}
            onChange={e => setOpponentName(e.target.value)}
            placeholder="Ej: Quilmes"
            className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPending(null)} className="flex-1 min-h-[40px] rounded-lg text-sm text-apple-gray-500">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!matchDate}
            className="flex-1 min-h-[40px] rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); void handleFiles(e.dataTransfer.files) }}
      className={`rounded-apple-xl border-2 border-dashed transition-colors ${
        over ? 'border-brand-green bg-brand-green/5' : 'border-apple-gray-200 dark:border-apple-gray-600'
      }`}
    >
      <button type="button" onClick={() => inputRef.current?.click()} className="w-full px-4 py-6 text-center">
        <p className="text-sm font-medium text-apple-gray-800 dark:text-white">
          Arrastrá el XML (y el video, opcional) del próximo partido acá
        </p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml,video/*"
        className="hidden"
        onChange={e => { if (e.target.files) void handleFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/VideoAnalysisDropzone.tsx
git commit -m "feat(videoanalisis): dropzone de XML + video con confirmacion de fecha"
```

---

## Task 14: Reproductor de clips — `VideoAnalysisClipPlayer`

**Files:**
- Create: `src/features/coaches/components/VideoAnalysisClipPlayer.tsx`

**Interfaces:**
- Consumes: `getMatchVideoUrl` (Task 8).
- Produces: `export default function VideoAnalysisClipPlayer(props: { videoPath: string; start: number; end: number; onClose: () => void }): JSX.Element`. Consumido por Task 15.

- [ ] **Step 1: Implementar el reproductor**

```tsx
// src/features/coaches/components/VideoAnalysisClipPlayer.tsx
import { useEffect, useRef } from 'react'
import { getMatchVideoUrl } from '@/services/videoAnalysisService'

export default function VideoAnalysisClipPlayer({
  videoPath,
  start,
  end,
  onClose,
}: {
  videoPath: string
  start: number
  end: number
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function onLoaded() {
      video!.currentTime = start
      void video!.play()
    }
    function onTimeUpdate() {
      if (video!.currentTime >= end) video!.pause()
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [start, end])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <video ref={videoRef} src={getMatchVideoUrl(videoPath)} controls className="w-full rounded-apple-lg" />
        <button type="button" onClick={onClose} className="mt-3 text-sm text-white/80 hover:text-white">
          Cerrar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/VideoAnalysisClipPlayer.tsx
git commit -m "feat(videoanalisis): reproductor de clips con salto automatico"
```

---

## Task 15: Pestaña principal — `CoachVideoAnalysisTab`

**Files:**
- Create: `src/features/coaches/components/CoachVideoAnalysisTab.tsx`

**Interfaces:**
- Consumes: todo lo anterior — `ensurePropioBucket`/`listBuckets`/`createRivalBucket`/`deleteBucket`/`listMatches`/`createMatch`/`deleteMatch`/`uploadMatchVideo` (Task 7-8), `countByCode`/`countByPhase`/`pitchPoints` (Task 4), `VideoAnalysisDateRangeSlider` (Task 6), `VideoAnalysisPitch` (Task 9), `VideoAnalysisCategoryChart` (Task 10), `VideoAnalysisPhaseChart` (Task 11), `VideoAnalysisEvolutionChart` (Task 12), `VideoAnalysisDropzone` (Task 13), `VideoAnalysisClipPlayer` (Task 14).
- Produces: `export default function CoachVideoAnalysisTab(props: { coach: AgencyCoach }): JSX.Element`. Consumido por Task 16.

- [ ] **Step 1: Implementar la pestaña**

```tsx
// src/features/coaches/components/CoachVideoAnalysisTab.tsx
import { useEffect, useMemo, useState } from 'react'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  ensurePropioBucket, listBuckets, createRivalBucket, deleteBucket,
  listMatches, createMatch, deleteMatch, uploadMatchVideo,
  type VideoAnalysisBucket, type VideoAnalysisMatch,
} from '@/services/videoAnalysisService'
import { countByCode, countByPhase, pitchPoints, type StatsMatch } from '@/features/coaches/videoAnalysis/videoAnalysisStats'
import type { ParsedInstance } from '@/features/coaches/videoAnalysis/parseNacsportXml'
import VideoAnalysisDateRangeSlider from './VideoAnalysisDateRangeSlider'
import VideoAnalysisPitch from './VideoAnalysisPitch'
import VideoAnalysisCategoryChart from './VideoAnalysisCategoryChart'
import VideoAnalysisPhaseChart from './VideoAnalysisPhaseChart'
import VideoAnalysisEvolutionChart from './VideoAnalysisEvolutionChart'
import VideoAnalysisDropzone from './VideoAnalysisDropzone'
import VideoAnalysisClipPlayer from './VideoAnalysisClipPlayer'

export default function CoachVideoAnalysisTab({ coach }: { coach: AgencyCoach }) {
  const [buckets, setBuckets] = useState<VideoAnalysisBucket[] | null>(null)
  const [activeBucketId, setActiveBucketId] = useState<number | null>(null)
  const [matches, setMatches] = useState<VideoAnalysisMatch[] | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showNewRival, setShowNewRival] = useState(false)
  const [newRivalName, setNewRivalName] = useState('')
  const [uploadingVideoFor, setUploadingVideoFor] = useState<number | null>(null)
  const [playingClip, setPlayingClip] = useState<{ videoPath: string; start: number; end: number } | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const propio = await ensurePropioBucket(coach.key)
      const all = await listBuckets(coach.key)
      if (!active) return
      setBuckets(all)
      setActiveBucketId(propio?.id ?? all[0]?.id ?? null)
    }
    void load()
    return () => { active = false }
  }, [coach.key])

  useEffect(() => {
    if (activeBucketId === null) return
    let active = true
    listMatches(activeBucketId).then(m => {
      if (!active) return
      setMatches(m)
      const dates = m.map(x => x.match_date).sort()
      setFromDate(dates[0] ?? '')
      setToDate(dates[dates.length - 1] ?? '')
    })
    return () => { active = false }
  }, [activeBucketId])

  const filteredMatches: StatsMatch[] = useMemo(() => {
    if (!matches) return []
    return matches.filter(m => (!fromDate || m.match_date >= fromDate) && (!toDate || m.match_date <= toDate))
  }, [matches, fromDate, toDate])

  const codeStats = useMemo(() => countByCode(filteredMatches), [filteredMatches])
  const phaseStats = useMemo(() => countByPhase(filteredMatches), [filteredMatches])
  const topCode = codeStats[0]?.code ?? ''
  const pitchData = useMemo(() => (topCode ? pitchPoints(filteredMatches, topCode) : { exact: [], zones: [] }), [filteredMatches, topCode])

  async function handleCreateRival() {
    if (!newRivalName.trim()) return
    const bucket = await createRivalBucket(coach.key, newRivalName.trim())
    if (bucket) {
      setBuckets(prev => [...(prev ?? []), bucket])
      setActiveBucketId(bucket.id)
    }
    setShowNewRival(false)
    setNewRivalName('')
  }

  async function handleDeleteBucket(bucket: VideoAnalysisBucket) {
    const ok = window.confirm(`¿Borrar "${bucket.name}" y todos sus partidos cargados?`)
    if (!ok) return
    const res = await deleteBucket(bucket.id)
    if (!res.success) { window.alert('No se pudo borrar, intentá de nuevo.'); return }
    const remaining = (buckets ?? []).filter(b => b.id !== bucket.id)
    setBuckets(remaining)
    setActiveBucketId(remaining.find(b => b.kind === 'propio')?.id ?? remaining[0]?.id ?? null)
  }

  async function handleUpload(result: { instances: ParsedInstance[]; matchDate: string; opponentName: string | null; videoFile: File | null }) {
    if (activeBucketId === null) return
    const match = await createMatch(activeBucketId, result.matchDate, result.opponentName, result.instances)
    if (!match) { window.alert('No se pudo guardar el partido, intentá de nuevo.'); return }
    setMatches(prev => [match, ...(prev ?? [])].sort((a, b) => b.match_date.localeCompare(a.match_date)))
    if (result.videoFile) {
      setUploadingVideoFor(match.id)
      const res = await uploadMatchVideo(coach.key, activeBucketId, match.id, result.videoFile)
      setUploadingVideoFor(null)
      if (res.success && res.path) {
        setMatches(prev => (prev ?? []).map(m => (m.id === match.id ? { ...m, video_storage_path: res.path! } : m)))
      } else {
        window.alert(res.error ?? 'No se pudo subir el video. El partido quedó guardado sin video.')
      }
    }
  }

  async function handleDeleteMatch(match: VideoAnalysisMatch) {
    const ok = window.confirm(`¿Borrar el partido del ${match.match_date}?`)
    if (!ok) return
    const res = await deleteMatch(match.id)
    if (!res.success) { window.alert('No se pudo borrar, intentá de nuevo.'); return }
    setMatches(prev => (prev ?? []).filter(m => m.id !== match.id))
  }

  if (buckets === null || activeBucketId === null) return <LoadingSpinner message="Cargando videoanálisis..." />

  const matchDates = (matches ?? []).map(m => m.match_date).sort()
  const minDate = matchDates[0] ?? ''
  const maxDate = matchDates[matchDates.length - 1] ?? ''

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        {buckets.map(b => (
          <div key={b.id} className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveBucketId(b.id)}
              className={`min-h-[32px] px-3 rounded-full text-xs font-semibold ${
                b.id === activeBucketId ? 'bg-brand-green text-apple-gray-900' : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
              }`}
            >
              {b.kind === 'propio' ? 'Propio equipo' : b.name}
            </button>
            {b.kind === 'rival' && b.id === activeBucketId && (
              <button type="button" onClick={() => void handleDeleteBucket(b)} className="ml-1 text-2xs text-red-500">✕</button>
            )}
          </div>
        ))}
        {showNewRival ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newRivalName}
              onChange={e => setNewRivalName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleCreateRival()}
              placeholder="Nombre del rival"
              className="min-h-[32px] rounded-full border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-xs"
            />
            <button type="button" onClick={() => void handleCreateRival()} className="text-xs font-semibold text-brand-green">Crear</button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowNewRival(true)} className="min-h-[32px] px-3 rounded-full border border-dashed border-apple-gray-300 dark:border-apple-gray-600 text-xs font-semibold text-brand-green">
            + Nuevo rival
          </button>
        )}
      </div>

      {matches === null ? (
        <LoadingSpinner message="Cargando partidos..." />
      ) : (
        <>
          <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
            <div className="flex justify-around pb-3 mb-3 border-b border-apple-gray-100 dark:border-apple-gray-700/40 text-center">
              <div><div className="text-lg font-bold text-apple-gray-800 dark:text-white">{matches.length}</div><div className="text-2xs text-apple-gray-400 uppercase">Partidos</div></div>
              <div><div className="text-lg font-bold text-apple-gray-800 dark:text-white">{filteredMatches.flatMap(m => m.instances).length}</div><div className="text-2xs text-apple-gray-400 uppercase">Cortes</div></div>
              <div><div className="text-lg font-bold text-apple-gray-800 dark:text-white">{codeStats.length}</div><div className="text-2xs text-apple-gray-400 uppercase">Categorías</div></div>
            </div>
            {minDate && maxDate && (
              <VideoAnalysisDateRangeSlider minDate={minDate} maxDate={maxDate} fromDate={fromDate || minDate} toDate={toDate || maxDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
            )}
          </div>

          {matches.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">Cancha — {topCode || 'sin categoría'}</p>
                <VideoAnalysisPitch exact={pitchData.exact} zones={pitchData.zones} />
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                  <VideoAnalysisCategoryChart data={codeStats} />
                </div>
                <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                  <VideoAnalysisPhaseChart counts={phaseStats} />
                </div>
                <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                  <VideoAnalysisEvolutionChart matches={filteredMatches} />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
            <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">Partidos cargados</p>
            {matches.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-apple-gray-100 dark:border-apple-gray-700/40 text-sm">
                <span className="text-apple-gray-700 dark:text-apple-gray-300">
                  {m.opponent_name ? `vs ${m.opponent_name} · ` : ''}{m.match_date}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-apple-gray-400">{m.instances.length} cortes</span>
                  {uploadingVideoFor === m.id && <span className="text-2xs text-amber-500">Subiendo video...</span>}
                  {m.video_storage_path && m.instances[0] && (
                    <button
                      type="button"
                      onClick={() => setPlayingClip({ videoPath: m.video_storage_path!, start: m.instances[0].start, end: m.instances[0].end })}
                      className="w-6 h-6 rounded-full bg-brand-green text-apple-gray-900 text-2xs flex items-center justify-center"
                    >▶</button>
                  )}
                  <button type="button" onClick={() => void handleDeleteMatch(m)} className="text-2xs text-red-500 font-semibold">Borrar</button>
                </div>
              </div>
            ))}
            <div className="mt-3">
              <VideoAnalysisDropzone onParsed={r => void handleUpload(r)} />
            </div>
          </div>
        </>
      )}

      {playingClip && (
        <VideoAnalysisClipPlayer videoPath={playingClip.videoPath} start={playingClip.start} end={playingClip.end} onClose={() => setPlayingClip(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/coaches/components/CoachVideoAnalysisTab.tsx
git commit -m "feat(videoanalisis): pestana principal de Videoanalisis"
```

---

## Task 16: Wiring en `CoachDetailPage.tsx`

**Files:**
- Modify: `src/pages/CoachDetailPage.tsx`
- Modify: `src/constants/translations.ts`

**Interfaces:**
- Consumes: `CoachVideoAnalysisTab` (Task 15).

- [ ] **Step 1: Agregar la key de traducción en español**

Solo español por ahora — el resto de la pestaña queda fuera del alcance de i18n de esta versión (ver spec). Agregar en el bloque `es:` de `src/constants/translations.ts`, junto a las demás keys `coachDetail.tab*` (buscar `'coachDetail.tabPizarra'` como ancla):

```ts
    'coachDetail.tabVideoanalisis': "Videoanálisis",
```

- [ ] **Step 2: Wirear la pestaña nueva**

En `src/pages/CoachDetailPage.tsx`:

1. Agregar el import:
```ts
import CoachVideoAnalysisTab from '@/features/coaches/components/CoachVideoAnalysisTab'
```

2. Extender el tipo y las listas (línea ~17, ~19-32):
```ts
type CoachTab = 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'pizarra' | 'videoanalisis' | 'plantel_futuro' | 'reserva'

const TAB_LABEL_KEY: Record<Exclude<CoachTab, 'reserva'>, string> = {
  resumen: 'coachDetail.tabResumen',
  plantel: 'coachDetail.tabPlantel',
  liga: 'coachDetail.tabLiga',
  calendario: 'coachDetail.tabCalendario',
  entrenamientos: 'coachDetail.tabEntrenamientos',
  notas: 'coachDetail.tabNotas',
  pizarra: 'coachDetail.tabPizarra',
  videoanalisis: 'coachDetail.tabVideoanalisis',
  plantel_futuro: 'coachDetail.tabPlantelFuturo',
}

const TAB_IDS: Exclude<CoachTab, 'reserva'>[] = ['resumen', 'plantel', 'liga', 'calendario', 'entrenamientos', 'notas', 'pizarra', 'videoanalisis', 'plantel_futuro']

const SIN_CLUB_TAB_IDS: CoachTab[] = ['resumen', 'entrenamientos', 'pizarra', 'videoanalisis']
```

3. Extender `isValidTab` (línea ~57-58):
```ts
  const isValidTab = (val: string): val is CoachTab =>
    ['resumen', 'plantel', 'liga', 'calendario', 'entrenamientos', 'notas', 'pizarra', 'videoanalisis', 'plantel_futuro', 'reserva'].includes(val)
```

4. Agregar el render condicional, después de la línea de `pizarra` (línea ~185):
```tsx
      {activeTab === 'videoanalisis' && <CoachVideoAnalysisTab key={coach.key} coach={coach} />}
```

- [ ] **Step 3: Typecheck y tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: sin errores de tipo; los tests nuevos (Tasks 2-5) y el resto de la suite en verde (los 2 fallos preexistentes de `opportunities.test.ts`, sensibles a la fecha del día, no cuentan como regresión).

- [ ] **Step 4: Probar en Chrome**

Levantar `npm run dev`, entrar a un entrenador con club (`/entrenadores/domingo`), confirmar que aparece la pestaña "Videoanálisis" entre "Pizarra" y "Plantel futuro", que carga sin errores (bucket "Propio equipo" vacío), y que "+ Nuevo rival" crea un bucket nuevo. Si hay forma de armar un XML de prueba a mano (copiar el fixture del test de Task 2 a un archivo `.xml`), probar la subida completa: parseo, fecha, gráficos, cancha y borrado.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CoachDetailPage.tsx src/constants/translations.ts
git commit -m "feat(videoanalisis): agrega la pestana Videoanalisis a la ficha de Entrenadores"
```

---

## Fuera de alcance (heredado del spec)

Excel como formato de entrada. Edición manual de cortes. Comparar 2 partidos lado a lado. Ranking de jugadores más tageados. Exportar a PDF/imagen. Reproductor de video completo tipo streaming. Traducción a los 9 idiomas (solo se agrega la key en español para que el label de la pestaña no muestre la clave cruda — ver Task 16).
