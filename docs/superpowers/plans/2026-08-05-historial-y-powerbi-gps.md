# Historial GPS (HTML/PDF) + Reporte Power BI/Catapult — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar dos formas nuevas de carga a Carga de GPS: (1) una pestaña "Historial"
que lee HTML con el historial de muchos partidos de un jugador (fila = partido), y (2)
un extractor que lee reportes PDF de Power BI/Catapult de un solo partido (layout de
gráficos, no tabla).

**Architecture:** Ambos son módulos de parseo puros en `src/features/gps/parser/`
(sin React, testeables solos), que alimentan la UI existente o una UI nueva mínima.
El extractor de Power BI reusa la pantalla de revisión que ya existe
(`ParseReviewPanel`) sin tocarla. El modo Historial usa una pantalla de revisión nueva
(`HistoryReviewPanel`) porque su forma de datos (N partidos con fecha propia cada uno)
no encaja en la de "un partido, N jugadores" que asume la pantalla actual.

**Tech Stack:** React + TypeScript, Vitest, `DOMParser` (vía jsdom en tests),
`pdfjs-dist` (ya en uso), Supabase (`gps_entries`, sin cambios de esquema).

## Global Constraints

- No se modifica el modo Automática ni Manual existentes: todo es aditivo.
- No hay cambios de backend/esquema: `saveGpsEntries` ya acepta un array de cargas con
  fecha propia por fila.
- Los módulos de parser no dependen de React y van con su test junto (`*.test.ts`),
  siguiendo el patrón ya establecido en `src/features/gps/parser/`.
- Specs de referencia: `docs/superpowers/specs/2026-08-05-historial-gps-html-design.md`
  y `docs/superpowers/specs/2026-08-05-reporte-powerbi-catapult-design.md`.

---

## Fase 1 — Historial GPS (HTML)

### Task 1: Tipos para historial

**Files:**
- Modify: `src/features/gps/types.ts`

**Interfaces:**
- Produces: `HtmlTable`, `HistoryColumnRole`, `HistoryColumnMapping`,
  `HistoryMatchRow`, `HistoryParseResult` — usados por todas las tasks de la Fase 1.
  `GpsEntryInput['source']` y `GpsEntryRow['source']` amplían su unión a
  `'manual' | 'pdf' | 'html'`.

- [ ] **Step 1: Agregar los tipos nuevos y ampliar `source`**

Al final de la sección `// ─── Parser ───...` (después de `GpsParseResult`, antes de
`// ─── Formulario ───`), agregar:

```ts
// ─── Historial (fila = partido de un jugador) ──────────────────────────────────

export interface HtmlTable {
  headers: string[]
  rows: string[][]
}

export type HistoryColumnRole = 'date' | 'rival' | 'competencia' | 'minutes' | 'metric' | 'unmapped'

export interface HistoryColumnMapping {
  header: string
  index: number
  /** key de gps_metrics, o null si el rol no es 'metric'/'unmapped' resuelto. */
  metricKey: string | null
  role: HistoryColumnRole
}

export interface HistoryMatchRow {
  rawCells: string[]
  matchDate: string | null      // 'YYYY-MM-DD', null si el archivo no traía fecha
  rival: string
  competencia: string | null
  minutos: number | null
  /** Alineado 1:1 con `HistoryParseResult.columns` por índice. */
  values: (number | null)[]
}

export interface HistoryParseResult {
  columns: HistoryColumnMapping[]
  matches: HistoryMatchRow[]
}
```

Y modificar las dos apariciones de `source: 'manual' | 'pdf'` (en `GpsEntryRow` y en
`GpsEntryInput`) a `source: 'manual' | 'pdf' | 'html'`.

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores nuevos (los tipos son aditivos, nada los usa todavía).

- [ ] **Step 3: Commit**

```bash
git add src/features/gps/types.ts
git commit -m "feat(gps): tipos para el modo Historial y source 'html'"
```

---

### Task 2: `extractHtmlTable` — leer una tabla de un archivo HTML

**Files:**
- Create: `src/features/gps/parser/extractHtmlTable.ts`
- Create: `src/features/gps/parser/__fixtures__/loyola-historial.html`
- Test: `src/features/gps/parser/extractHtmlTable.test.ts`

**Interfaces:**
- Consumes: nada nuevo (usa `DOMParser`, global del browser/jsdom).
- Produces: `extractHtmlTable(html: string): HtmlTable | null`, usado por Task 3 y por
  la UI en Task 6.

- [ ] **Step 1: Crear el fixture HTML (recortado del historial real de Loyola)**

```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Favian Loyola — Historial de Partidos GPS</title></head>
<body>
<table id="tbl">
  <thead>
    <tr>
      <th>#</th>
      <th>Rival</th>
      <th>Torneo</th>
      <th>Minutos</th>
      <th>Dist. Total (m)</th>
      <th>m/min</th>
      <th>HSR (m)</th>
      <th>Vel. Máx (km/h)</th>
      <th>Sprints</th>
      <th>Player Load</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="num">1</td>
      <td class="rival">U. DE CHILE</td>
      <td><span class="badge">TORNEO NACIONAL</span></td>
      <td class="num" data-v="14">14'</td>
      <td class="num" data-v="1617">1.617</td>
      <td class="num" data-v="118.4">118,4</td>
      <td class="num" data-v="240">240</td>
      <td class="num" data-v="28.8">28,8</td>
      <td class="num" data-v="1">1</td>
      <td class="num" data-v="180">180</td>
    </tr>
    <tr>
      <td class="num">2</td>
      <td class="rival">ÑUBLENSE</td>
      <td><span class="badge">TORNEO NACIONAL</span></td>
      <td class="num" data-v="21">21'</td>
      <td class="num" data-v="2400">2.400</td>
      <td class="num" data-v="115.9">115,9</td>
      <td class="num" data-v="289">289</td>
      <td class="num" data-v="27.3">27,3</td>
      <td class="num" data-v="2">2</td>
      <td class="num" data-v="285">285</td>
    </tr>
    <tr>
      <td class="num">3</td>
      <td class="rival">EVERTON</td>
      <td><span class="badge">TORNEO NACIONAL</span></td>
      <td class="num" data-v="44">44'</td>
      <td class="num" data-v="4525">4.525</td>
      <td class="num" data-v="102.5">102,5</td>
      <td class="num" data-v="298">298</td>
      <td class="num" data-v="27.8">27,8</td>
      <td class="num" data-v="2">2</td>
      <td class="num" data-v="515">515</td>
    </tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: Escribir el test (falla porque el módulo no existe)**

```ts
// src/features/gps/parser/extractHtmlTable.test.ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extractHtmlTable } from './extractHtmlTable'

function fixture(name: string): string {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))
  return readFileSync(path, 'utf8')
}

describe('extractHtmlTable', () => {
  it('lee headers y filas, priorizando data-v sobre el texto visible', () => {
    const table = extractHtmlTable(fixture('loyola-historial.html'))
    expect(table).not.toBeNull()
    expect(table!.headers).toEqual([
      '#', 'Rival', 'Torneo', 'Minutos', 'Dist. Total (m)', 'm/min',
      'HSR (m)', 'Vel. Máx (km/h)', 'Sprints', 'Player Load',
    ])
    expect(table!.rows).toHaveLength(3)
    expect(table!.rows[0]).toEqual(
      ['1', 'U. DE CHILE', 'TORNEO NACIONAL', '14', '1617', '118.4', '240', '28.8', '1', '180'],
    )
    // El texto visible de "Minutos" trae comilla de minuto ("14'"); data-v="14" gana.
    expect(table!.rows[0][3]).toBe('14')
  })

  it('devuelve null si no hay ninguna tabla con más de una fila', () => {
    expect(extractHtmlTable('<html><body><p>sin tabla</p></body></html>')).toBeNull()
    expect(extractHtmlTable('<table><tr><th>Solo header</th></tr></table>')).toBeNull()
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx vitest run src/features/gps/parser/extractHtmlTable.test.ts`
Expected: FAIL — `Cannot find module './extractHtmlTable'`.

- [ ] **Step 4: Implementar `extractHtmlTable`**

```ts
// src/features/gps/parser/extractHtmlTable.ts
import type { HtmlTable } from '../types'

/**
 * Lee la primera <table> del HTML con más de una fila de datos. Prioriza el
 * atributo `data-v` de cada celda (valor numérico "limpio" que algunos reportes ya
 * traen, como el historial de Loyola) sobre el texto visible, que puede tener texto
 * agregado (comillas de minutos, separador de miles).
 */
export function extractHtmlTable(html: string): HtmlTable | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = Array.from(doc.querySelectorAll('table'))
  const table = tables.find(t => t.querySelectorAll('tr').length > 1)
  if (!table) return null

  const trs = Array.from(table.querySelectorAll('tr'))
  const headers = Array.from(trs[0].querySelectorAll('th, td')).map(c => c.textContent?.trim() ?? '')
  const rows = trs.slice(1)
    .map(tr => Array.from(tr.querySelectorAll('td, th')).map(cell => {
      const dataV = cell.getAttribute('data-v')
      return dataV !== null ? dataV : (cell.textContent?.trim() ?? '')
    }))
    .filter(row => row.some(cell => cell !== ''))

  if (headers.length === 0 || rows.length === 0) return null
  return { headers, rows }
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run src/features/gps/parser/extractHtmlTable.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/gps/parser/extractHtmlTable.ts \
        src/features/gps/parser/extractHtmlTable.test.ts \
        src/features/gps/parser/__fixtures__/loyola-historial.html
git commit -m "feat(gps): extractHtmlTable lee tablas HTML de historial"
```

---

### Task 3: `buildHistoryTable` — clasificar columnas y armar los partidos detectados

**Files:**
- Create: `src/features/gps/parser/buildHistoryTable.ts`
- Test: `src/features/gps/parser/buildHistoryTable.test.ts`

**Interfaces:**
- Consumes: `HtmlTable` (Task 2), `parseNumber`/`normalizeLabel` de `./normalize`
  (ya existen).
- Produces: `classifyHistoryColumns(headers, lookup)`, `parseHistoryDate(raw)`,
  `buildHistoryTable(table, lookup): HistoryParseResult` — usados por Task 6.

- [ ] **Step 1: Escribir los tests (fallan porque el módulo no existe)**

```ts
// src/features/gps/parser/buildHistoryTable.test.ts
import { describe, it, expect } from 'vitest'
import { buildHistoryTable, classifyHistoryColumns, parseHistoryDate } from './buildHistoryTable'
import type { HtmlTable } from '../types'

describe('parseHistoryDate', () => {
  it('acepta dd/mm/aa, dd/mm/aaaa e ISO', () => {
    expect(parseHistoryDate('30/01/26')).toBe('2026-01-30')
    expect(parseHistoryDate('30/01/2026')).toBe('2026-01-30')
    expect(parseHistoryDate('2026-01-30')).toBe('2026-01-30')
  })

  it('devuelve null si no matchea ningún formato', () => {
    expect(parseHistoryDate('Fecha 2 TC')).toBeNull()
    expect(parseHistoryDate('')).toBeNull()
  })
})

describe('classifyHistoryColumns', () => {
  it('reconoce fecha, rival, competencia y minutos por alias fijo', () => {
    const columns = classifyHistoryColumns(
      ['Fecha', 'Rival', 'Competencia', 'Minutos', 'Distancia'],
      { distancia: 'distancia_total' },
    )
    expect(columns.map(c => c.role)).toEqual(['date', 'rival', 'competencia', 'minutes', 'metric'])
    expect(columns[4].metricKey).toBe('distancia_total')
  })

  it('sin columna de fecha, esa fila queda sin rol "date"', () => {
    const columns = classifyHistoryColumns(['Rival', 'Torneo', 'Minutos'], {})
    expect(columns.map(c => c.role)).toEqual(['rival', 'competencia', 'minutes'])
  })

  it('columna desconocida contra el catálogo queda "unmapped"', () => {
    const columns = classifyHistoryColumns(['Dist Acele'], {})
    expect(columns[0].role).toBe('unmapped')
  })
})

describe('buildHistoryTable', () => {
  const lookup = { 'dist. total (m)': 'distancia_total', 'vel. max (km/h)': 'vel_max' }

  it('caso Loyola: sin columna de fecha, matchDate queda null en todas las filas', () => {
    const table: HtmlTable = {
      headers: ['#', 'Rival', 'Torneo', 'Minutos', 'Dist. Total (m)', 'Vel. Max (km/h)'],
      rows: [
        ['1', 'U. DE CHILE', 'TORNEO NACIONAL', '14', '1617', '28.8'],
        ['2', 'ÑUBLENSE', 'TORNEO NACIONAL', '21', '2400', '27.3'],
      ],
    }
    const result = buildHistoryTable(table, lookup)
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].matchDate).toBeNull()
    expect(result.matches[0].rival).toBe('U. DE CHILE')
    expect(result.matches[0].competencia).toBe('TORNEO NACIONAL')
    expect(result.matches[0].minutos).toBe(14)
    // values alineado con columns por índice: índice 4 = Dist. Total (m).
    expect(result.matches[0].values[4]).toBe(1617)
    expect(result.matches[1].rival).toBe('ÑUBLENSE')
  })

  it('con columna de fecha, la parsea; preserva el orden de las filas', () => {
    const table: HtmlTable = {
      headers: ['Fecha', 'Rival', 'Dist. Total (m)'],
      rows: [
        ['30/01/2026', 'A', '1000'],
        ['15/02/2026', 'B', '2000'],
      ],
    }
    const result = buildHistoryTable(table, lookup)
    expect(result.matches.map(m => m.matchDate)).toEqual(['2026-01-30', '2026-02-15'])
    expect(result.matches.map(m => m.rival)).toEqual(['A', 'B'])
  })
})
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/features/gps/parser/buildHistoryTable.test.ts`
Expected: FAIL — `Cannot find module './buildHistoryTable'`.

- [ ] **Step 3: Implementar**

```ts
// src/features/gps/parser/buildHistoryTable.ts
import { normalizeLabel, parseNumber } from './normalize'
import type { HtmlTable, HistoryColumnMapping, HistoryMatchRow, HistoryParseResult } from '../types'

const DATE_ALIASES = new Set(['fecha', 'date', 'dia', 'día'])
const RIVAL_ALIASES = new Set(['rival', 'oponente', 'opponent', 'visitante', 'contrincante'])
const COMPETENCIA_ALIASES = new Set(['competencia', 'torneo', 'liga', 'competition', 'campeonato'])
const MINUTES_ALIASES = new Set(['t', 'min', 'mins', 'minutos', 'minutos jugados', 'tiempo', 'minutes', 'mp'])

/**
 * Cabecera → rol. No reusa `mapColumns` de la tabla multi-jugador porque esa función
 * asume que la columna 0 es un nombre de jugador, algo que acá no existe (cada fila
 * es un partido, no un jugador).
 */
export function classifyHistoryColumns(headers: string[], lookup: Record<string, string>): HistoryColumnMapping[] {
  return headers.map((header, index) => {
    const norm = normalizeLabel(header)
    if (DATE_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'date' as const }
    if (RIVAL_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'rival' as const }
    if (COMPETENCIA_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'competencia' as const }
    if (MINUTES_ALIASES.has(norm)) return { header, index, metricKey: null, role: 'minutes' as const }
    const key = lookup[norm]
    return key
      ? { header, index, metricKey: key, role: 'metric' as const }
      : { header, index, metricKey: null, role: 'unmapped' as const }
  })
}

/** "30/01/26" | "30/01/2026" | "2026-01-30" → 'YYYY-MM-DD'. null si no matchea. */
export function parseHistoryDate(raw: string): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!dmy) return null
  const [, d, m, y] = dmy
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/**
 * Arma los "partidos detectados" a partir de una tabla con forma historial (fila =
 * partido de UN jugador). El orden de `table.rows` se conserva: en los reportes
 * reales coincide con el orden cronológico real aunque no traigan fecha de calendario
 * (caso Loyola).
 */
export function buildHistoryTable(table: HtmlTable, lookup: Record<string, string>): HistoryParseResult {
  const columns = classifyHistoryColumns(table.headers, lookup)
  const dateCol = columns.find(c => c.role === 'date')
  const rivalCol = columns.find(c => c.role === 'rival')
  const competenciaCol = columns.find(c => c.role === 'competencia')
  const minutosCol = columns.find(c => c.role === 'minutes')

  const matches: HistoryMatchRow[] = table.rows.map(row => ({
    rawCells: row,
    matchDate: dateCol ? parseHistoryDate(row[dateCol.index] ?? '') : null,
    rival: rivalCol ? (row[rivalCol.index] ?? '').trim() : '',
    competencia: competenciaCol ? ((row[competenciaCol.index] ?? '').trim() || null) : null,
    minutos: minutosCol ? parseNumber(row[minutosCol.index]) : null,
    values: row.map(cell => parseNumber(cell)),
  }))

  return { columns, matches }
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/features/gps/parser/buildHistoryTable.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/gps/parser/buildHistoryTable.ts src/features/gps/parser/buildHistoryTable.test.ts
git commit -m "feat(gps): buildHistoryTable arma los partidos detectados de un historial"
```

---

### Task 4: `GpsDropzone` acepta tipo de archivo y textos configurables

**Files:**
- Modify: `src/features/gps/components/GpsDropzone.tsx`

**Interfaces:**
- Produces: props nuevas `accept?`, `label?`, `hint?` con defaults iguales al
  comportamiento actual (nadie más lo usa hoy, así que esto no rompe Automática).

- [ ] **Step 1: Modificar el componente**

```tsx
// src/features/gps/components/GpsDropzone.tsx
import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
  accept?: string
  label?: string
  hint?: string
}

/**
 * Arrastrar o tocar. En la app nativa y en mobile el arrastre no existe, por eso todo
 * el bloque es un botón que abre el selector de archivos del sistema.
 */
export default function GpsDropzone({
  onFile, disabled, accept = 'application/pdf,.pdf',
  label = 'Arrastrá el PDF o tocá para elegirlo',
  hint = 'PDFs de GPS con texto. Las fotos y capturas hay que cargarlas a mano.',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files) }}
      className={`rounded-apple-xl border-2 border-dashed transition-colors ${
        over ? 'border-brand-green bg-brand-green/5' : 'border-apple-gray-200 dark:border-apple-gray-600'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full px-6 py-12 text-center"
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 flex items-center justify-center">
          <svg className="w-7 h-7 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
        </div>
        <div className="text-sm font-medium text-apple-gray-800 dark:text-white">
          {disabled ? 'Leyendo el archivo…' : label}
        </div>
        <div className="text-xs text-apple-gray-400 mt-1">{hint}</div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { take(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila y que Automática sigue igual**

Run: `npx tsc --noEmit -p .`
Expected: sin errores. `GpsUploadPage.tsx` sigue llamando `<GpsDropzone onFile={...} disabled={parsing} />` sin las props nuevas, así que usa los defaults (mismo comportamiento que hoy).

- [ ] **Step 3: Commit**

```bash
git add src/features/gps/components/GpsDropzone.tsx
git commit -m "feat(gps): GpsDropzone acepta tipo de archivo y textos configurables"
```

---

### Task 5: `HistoryReviewPanel` — pantalla de revisión del modo Historial

**Files:**
- Create: `src/features/gps/components/HistoryReviewPanel.tsx`

**Interfaces:**
- Consumes: `HistoryParseResult` (Task 1/3), `saveGpsEntries` (existente, sin
  cambios), `GpsMetric`, `useGpsCatalog['addMetric']` (existentes).
- Produces: componente `HistoryReviewPanel`, usado por Task 6.

No lleva test propio: es UI, y el repo no tiene tests de componentes React hoy (se
verifica a mano en el navegador, igual que `ParseReviewPanel`).

- [ ] **Step 1: Implementar el componente**

```tsx
// src/features/gps/components/HistoryReviewPanel.tsx
import { useMemo, useState } from 'react'
import { saveGpsEntries } from '@/services/gpsService'
import type { GpsMetric, HistoryParseResult } from '../types'
import type { useGpsCatalog } from '../useGpsCatalog'

interface Props {
  result: HistoryParseResult
  playerName: string
  fileName: string
  metrics: GpsMetric[]
  teams: string[]
  competitions: string[]
  defaultEquipo: string
  addMetric: ReturnType<typeof useGpsCatalog>['addMetric']
  onSaved: () => Promise<void>
  onCancel: () => void
}

const IGNORE = '__ignorar__'

interface RowDraft {
  include: boolean
  matchDate: string
  rival: string
  competencia: string
  minutos: string
}

export default function HistoryReviewPanel({
  result, playerName, fileName, metrics, teams, competitions, defaultEquipo,
  addMetric, onSaved, onCancel,
}: Props) {
  const [equipo, setEquipo] = useState(defaultEquipo)
  const [competenciaDefault, setCompetenciaDefault] = useState('')

  const metricColumns = result.columns.filter(c => c.role === 'metric' || c.role === 'unmapped')

  const [mapping, setMapping] = useState<Record<number, string>>(() =>
    Object.fromEntries(metricColumns.map(c => [c.index, c.metricKey ?? IGNORE])))

  const [rows, setRows] = useState<RowDraft[]>(() =>
    result.matches.map(m => ({
      include: true,
      matchDate: m.matchDate ?? '',
      rival: m.rival,
      competencia: m.competencia ?? '',
      minutos: m.minutos === null ? '' : String(m.minutos),
    })))

  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'conflict'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const setRow = (i: number, patch: Partial<RowDraft>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const changeMapping = async (index: number, value: string) => {
    if (value === '__nueva__') {
      const header = result.columns[index].header
      const created = await addMetric({ label: header, unit: '', decimals: 0, category: 'otro' })
      if (created) setMapping(prev => ({ ...prev, [index]: created.key }))
      return
    }
    setMapping(prev => ({ ...prev, [index]: value }))
  }

  const metricByKey = useMemo(() => new Map(metrics.map(m => [m.key, m])), [metrics])

  const savableCount = rows.filter(r => r.include && r.matchDate !== '').length
  const includedMissingDate = rows.filter(r => r.include && r.matchDate === '').length
  const canSave = savableCount > 0

  const save = async () => {
    setSaving(true)
    setStatus(null)

    const entries = rows.flatMap((r, i) => {
      if (!r.include || !r.matchDate) return []
      const match = result.matches[i]
      const metricsPayload: Record<string, number> = {}
      for (const col of metricColumns) {
        const target = mapping[col.index]
        const value = match.values[col.index]
        if (target === IGNORE || value === null || value === undefined) continue
        metricsPayload[target] = value
      }
      return [{
        playerName,
        matchDate: r.matchDate,
        equipo: equipo || null,
        rival: r.rival || null,
        competencia: (r.competencia || competenciaDefault) || null,
        resultado: null,
        minutos: r.minutos === '' ? null : Number(r.minutos),
        metrics: metricsPayload,
        source: 'html' as const,
        fileName,
      }]
    })

    const saveResult = await saveGpsEntries(entries, {})
    setSaving(false)

    if (saveResult.error) { setStatus({ kind: 'error', text: `No se pudo guardar: ${saveResult.error}` }); return }
    if (saveResult.conflicts.length > 0) {
      setStatus({ kind: 'conflict', text: `Ya había cargas para: ${saveResult.conflicts.join(', ')}.` })
      return
    }
    setStatus({ kind: 'ok', text: `Se guardaron ${saveResult.saved} partido(s).` })
    await onSaved()
    onCancel()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-apple-gray-800 dark:text-white">
            Revisá antes de guardar — {playerName}
          </h2>
          <p className="text-xs text-apple-gray-400 truncate">{fileName} · {result.matches.length} partido(s) detectados</p>
        </div>
        <button onClick={onCancel} className="shrink-0 text-sm text-apple-gray-500 underline">Elegir otro archivo</button>
      </div>

      {/* ── Equipo + competencia por defecto ── */}
      <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1.5">Equipo (todos los partidos)</label>
          <input list="hist-teams" className="w-full px-3 py-2.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
            value={equipo} onChange={e => setEquipo(e.target.value)} />
          <datalist id="hist-teams">{teams.map(t => <option key={t} value={t} />)}</datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1.5">Competencia por defecto (opcional)</label>
          <input list="hist-comps" className="w-full px-3 py-2.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
            placeholder="Se usa solo si el partido no trae la suya" value={competenciaDefault} onChange={e => setCompetenciaDefault(e.target.value)} />
          <datalist id="hist-comps">{competitions.map(c => <option key={c} value={c} />)}</datalist>
        </div>
      </div>

      {/* ── Mapeo de columnas a métricas ── */}
      {metricColumns.length > 0 && (
        <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Columnas del archivo</h3>
          <p className="text-xs text-apple-gray-400 mt-0.5 mb-4">Se aplica igual a todos los partidos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {metricColumns.map(col => (
              <div key={col.index} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.role === 'metric' ? '#22C55E' : '#F59E0B' }} />
                <span className="text-sm text-apple-gray-700 dark:text-apple-gray-300 w-32 shrink-0 truncate" title={col.header}>{col.header}</span>
                <select
                  className="flex-1 min-w-0 px-2 py-2 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                  value={mapping[col.index]} onChange={e => void changeMapping(col.index, e.target.value)}
                >
                  <option value={IGNORE}>Ignorar esta columna</option>
                  <option value="__nueva__">+ Crear métrica "{col.header}"</option>
                  {metrics.filter(m => m.is_active).map(m => (
                    <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Partidos detectados ── */}
      <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Partidos ({result.matches.length})</h3>
        <p className="text-xs text-apple-gray-400 mt-0.5 mb-4">
          La fecha es obligatoria para guardar cada fila. {includedMissingDate > 0 && `Faltan ${includedMissingDate}.`}
        </p>
        <div className="space-y-2">
          {rows.map((r, i) => {
            const match = result.matches[i]
            return (
              <div key={i} className="rounded-apple border border-apple-gray-100 dark:border-apple-gray-700 p-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.include} onChange={e => setRow(i, { include: e.target.checked })} className="w-5 h-5 accent-brand-green" />
                    {i + 1}
                  </label>
                  <input type="date" className={`px-2 py-1.5 rounded-apple border text-sm ${r.include && !r.matchDate ? 'border-amber-400' : 'border-apple-gray-200 dark:border-apple-gray-600'} bg-white dark:bg-apple-gray-700`}
                    value={r.matchDate} onChange={e => setRow(i, { matchDate: e.target.value })} />
                  <input className="px-2 py-1.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                    placeholder="Rival" value={r.rival} onChange={e => setRow(i, { rival: e.target.value })} />
                  <input className="px-2 py-1.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                    placeholder="Competencia" value={r.competencia} onChange={e => setRow(i, { competencia: e.target.value })} />
                  <input type="number" inputMode="numeric" className="px-2 py-1.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                    placeholder="Minutos" value={r.minutos} onChange={e => setRow(i, { minutos: e.target.value })} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {metricColumns.map(col => {
                    const target = mapping[col.index]
                    const value = match.values[col.index]
                    if (target === IGNORE || value === null || value === undefined) return null
                    const metric = metricByKey.get(target)
                    return (
                      <span key={col.index} className="text-2xs px-2 py-1 rounded-apple bg-apple-gray-50 dark:bg-apple-gray-700/40 text-apple-gray-500">
                        {metric?.label ?? col.header}: <strong className="text-apple-gray-800 dark:text-white">{value}</strong>
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {status && (
        <div className={`rounded-apple px-4 py-3 text-sm ${status.kind === 'ok' ? 'bg-brand-green/10 text-brand-green' : 'bg-red-500/10 text-red-500'}`}>
          {status.text}
        </div>
      )}

      <div className="sticky bottom-20 sm:bottom-0 sm:static">
        <button onClick={() => void save()} disabled={!canSave || saving}
          className="w-full sm:w-auto px-6 py-3 rounded-apple bg-brand-green text-white font-medium disabled:opacity-40">
          {saving ? 'Guardando…' : `Guardar ${savableCount} carga(s)`}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p .`
Expected: sin errores (`saveGpsEntries` ya acepta este shape de entradas; `GpsEntryInput.source` ya incluye `'html'` desde Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/features/gps/components/HistoryReviewPanel.tsx
git commit -m "feat(gps): HistoryReviewPanel, revisión por partido del modo Historial"
```

---

### Task 6: Pestaña "Historial" en `GpsUploadPage`

**Files:**
- Modify: `src/pages/GpsUploadPage.tsx`
- Modify: `src/features/gps/components/RecentGpsUploads.tsx`

**Interfaces:**
- Consumes: `extractHtmlTable` (Task 2), `buildHistoryTable` (Task 3),
  `HistoryReviewPanel` (Task 5), `GpsDropzone` con props nuevas (Task 4).

- [ ] **Step 1: Mostrar el origen "html" en "Últimas cargas"**

En `src/features/gps/components/RecentGpsUploads.tsx`, la línea:

```tsx
{metricCount(e)} métrica(s) · {e.source === 'pdf' ? `PDF${e.file_name ? `: ${e.file_name}` : ''}` : 'carga manual'}
```

pasa a:

```tsx
{metricCount(e)} métrica(s) · {
  e.source === 'pdf' ? `PDF${e.file_name ? `: ${e.file_name}` : ''}` :
  e.source === 'html' ? `Historial${e.file_name ? `: ${e.file_name}` : ''}` :
  'carga manual'
}
```

- [ ] **Step 2: Agregar la pestaña "Historial"**

En `src/pages/GpsUploadPage.tsx`:

1. Cambiar `type Tab = 'auto' | 'manual'` a `type Tab = 'auto' | 'historial' | 'manual'`.
2. En el control segmentado, agregar la entrada:
   ```tsx
   {([['auto', 'Automática'], ['historial', 'Historial'], ['manual', 'Manual']] as const).map(...)}
   ```
3. Agregar el render condicional junto a `AutoTab`/`ManualTab`:
   ```tsx
   ) : tab === 'historial' ? (
     <HistorialTab
       metrics={metrics} lookup={lookup} roster={roster}
       teams={teams} competitions={competitions}
       addMetric={addMetric} onSaved={reloadEntries}
     />
   ) : (
   ```
4. Importar `HistoryReviewPanel`, `extractHtmlTable`, `buildHistoryTable`, y agregar
   el import de `extractPdfItems`/`groupRows` (ya existen) si se quiere reusar para PDF
   — **fuera de alcance de esta task**, ver nota al final.
5. Agregar el componente `HistorialTab` al final del archivo, siguiendo el patrón de
   `AutoTab`:

```tsx
// ─── Pestaña Historial ─────────────────────────────────────────────────────────

function HistorialTab({ metrics, lookup, roster, teams, competitions, addMetric, onSaved }: {
  metrics: ReturnType<typeof useGpsCatalog>['metrics']
  lookup: ReturnType<typeof useGpsCatalog>['lookup']
  roster: ReturnType<typeof getAgencyPlayers>
  teams: string[]
  competitions: string[]
  addMetric: ReturnType<typeof useGpsCatalog>['addMetric']
  onSaved: () => Promise<void>
}) {
  const [player, setPlayer] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<HistoryParseResult | null>(null)
  const [fileName, setFileName] = useState('')

  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es')),
    [roster],
  )

  const handleFile = async (file: File) => {
    setParsing(true)
    setError(null)
    setResult(null)
    try {
      const html = await file.text()
      const table = extractHtmlTable(html)
      if (!table) throw new Error('No encontré ninguna tabla en el archivo.')
      setResult(buildHistoryTable(table, lookup))
      setFileName(file.name)
    } catch (err) {
      setError(`No pude leer el archivo: ${(err as Error).message}`)
    } finally {
      setParsing(false)
    }
  }

  if (result) {
    const selectedPlayer = roster.find(p => p.fullName === player)
    return (
      <HistoryReviewPanel
        result={result} playerName={player} fileName={fileName} metrics={metrics}
        teams={teams} competitions={competitions} defaultEquipo={selectedPlayer?.team ?? ''}
        addMetric={addMetric} onSaved={onSaved} onCancel={() => setResult(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
        <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1.5" htmlFor="gps-hist-jugador">
          ¿De qué jugador es el historial?
        </label>
        <select
          id="gps-hist-jugador"
          className="w-full px-3 py-2.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/40"
          value={player}
          onChange={e => setPlayer(e.target.value)}
        >
          <option value="">Elegí un jugador</option>
          {sortedRoster.map(p => <option key={p.fullName} value={p.fullName}>{p.fullName}</option>)}
        </select>
        <p className="text-2xs text-apple-gray-400 mt-1.5">
          Para archivos con muchos partidos de un solo jugador (una fila por partido).
        </p>
      </div>

      <GpsDropzone
        onFile={file => void handleFile(file)}
        disabled={parsing || !player}
        accept=".html,text/html"
        label="Arrastrá el HTML del historial o tocá para elegirlo"
        hint="Un archivo HTML con una tabla de partidos de un solo jugador."
      />
      {!player && <p className="text-xs text-apple-gray-400">Elegí el jugador antes de subir el archivo.</p>}
      {error && <div className="rounded-apple bg-red-500/10 text-red-500 px-4 py-3 text-sm">{error}</div>}
    </div>
  )
}
```

6. Agregar los imports que faltan al principio del archivo:

```tsx
import HistoryReviewPanel from '@/features/gps/components/HistoryReviewPanel'
import { extractHtmlTable } from '@/features/gps/parser/extractHtmlTable'
import { buildHistoryTable } from '@/features/gps/parser/buildHistoryTable'
import type { HistoryParseResult } from '@/features/gps/types'
```

> Nota de alcance: esta task cubre HTML. El spec también contempla PDF con forma
> historial; queda para una task de seguimiento reusar
> `extractPdfItems`+`groupRows`+`buildTable` con un adaptador a `HtmlTable`, porque hoy
> no hay ningún PDF real de este tipo para fixture — hacerlo a ciegas es el mismo error
> que ya se evitó con el extractor de Power BI.

- [ ] **Step 3: Probar a mano en el navegador**

Run: `npm run dev`, ir a `/carga-gps`, pestaña "Historial", elegir "Favian Loyola",
subir `LOYOLA GPS.html` (el archivo real que mandó el usuario, en Descargas).
Verificar:
- Aparecen 24 partidos, cada uno con su fecha vacía (el archivo no trae fecha).
- El botón "Guardar" queda deshabilitado hasta completar al menos una fecha.
- Completar una fecha habilita el guardado de esa fila; guardar 1-2 filas de prueba y
  confirmar que aparecen en "Últimas cargas" con el rótulo "Historial: LOYOLA GPS.html".
- Borrar esas filas de prueba desde "Últimas cargas" para no dejar datos de prueba.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GpsUploadPage.tsx src/features/gps/components/RecentGpsUploads.tsx
git commit -m "feat(gps): pestaña Historial en Carga de GPS"
```

---

## Fase 2 — Reporte Power BI/Catapult (un partido)

### Task 7: `inferContext` reconoce el patrón "Rival: X"

**Files:**
- Modify: `src/features/gps/parser/inferContext.ts`
- Modify: `src/features/gps/parser/inferContext.test.ts`

**Interfaces:**
- Produces: `inferRival` reconoce una segunda forma, además de `vs X`. No cambia la
  firma pública de `inferContext`.

- [ ] **Step 1: Agregar el caso al test existente**

Agregar a `src/features/gps/parser/inferContext.test.ts`:

```ts
it('reconoce el rival en formato "Rival: X" (reportes Power BI)', () => {
  const result = inferContext(['Instancia: Fecha 2 TC', 'Rival: River Plate', 'Torneo: LPF Apertura 2026'])
  expect(result.rival).toBe('River Plate')
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/features/gps/parser/inferContext.test.ts`
Expected: FAIL — `result.rival` es `null` (el patrón `vs X` no matchea "Rival: River Plate").

- [ ] **Step 3: Extender `inferRival`**

```ts
function inferRival(lines: string[]): string | null {
  for (const line of lines) {
    const vs = line.match(/\bvs\.?\s+(.+?)\s*(?:\((?:L|V|H|A)\))?\s*$/i)
    if (vs && vs[1].trim().length <= 40) return vs[1].trim()

    const labeled = line.match(/^rival:\s*(.+)$/i)
    if (labeled && labeled[1].trim().length <= 40) return labeled[1].trim()
  }
  return null
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/features/gps/parser/inferContext.test.ts`
Expected: PASS (todos, incluyendo el nuevo).

- [ ] **Step 5: Commit**

```bash
git add src/features/gps/parser/inferContext.ts src/features/gps/parser/inferContext.test.ts
git commit -m "feat(gps): inferContext reconoce rival en formato 'Rival: X'"
```

---

### Task 8: `parsePowerBiReport` — extractor del reporte de un partido

**Files:**
- Create: `src/features/gps/parser/parsePowerBiReport.ts`
- Test: `src/features/gps/parser/parsePowerBiReport.test.ts`
- Fixture ya copiada: `src/features/gps/parser/__fixtures__/powerbi-steimbach.pdf`
  (el PDF real que mandó el usuario, ya está en el repo sin trackear — agregarlo con
  `git add` en el commit de esta task).

**Interfaces:**
- Consumes: `PdfRow[]` (de `groupRows`, ya existe), `parseNumber` de `./normalize`.
- Produces: `parsePowerBiReport(rows: PdfRow[], playerName: string): PdfTable | null`,
  usado por Task 9.

> Contexto de esta task: se inspeccionaron las coordenadas reales del PDF de Steimbach
> (`extractPdfItems` + `groupRows` sobre la página 2, "2/3" en el pie). La página tiene:
> - Un bloque de 4+4 pares etiqueta/valor con la misma cantidad de celdas en la fila de
>   título y la de valor (ej. `"Distancia total (m)" x43` / `"Distancia total (m)" x358`
>   seguido de `"5334" x82` / `"5432" x397`) — mismo patrón que ya reconoce
>   `buildCardTable`, solo que con la etiqueta repetida dos veces (Primer/Segundo
>   Tiempo) en vez de una.
> - Un caso aparte para "Minutos jugados": la etiqueta va sola, y el valor total +
>   parciales de PT/ST aparecen 2 filas después, en una fila de 3 celdas ordenadas por
>   X: `[PT, Total, ST]`.
> - Las secciones "Cargas Locomotivas" y "Cargas Mecánicas" (gráficos de barras, no
>   pares etiqueta/valor limpios) se ignoran a propósito — no son parte del alcance
>   aprobado.

- [ ] **Step 1: Escribir el test contra el fixture real**

```ts
// src/features/gps/parser/parsePowerBiReport.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extractPdfItems } from './extractItems'
import { groupRows } from './buildTable'
import { parsePowerBiReport } from './parsePowerBiReport'

function fixture(name: string): ArrayBuffer {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))
  const buf = readFileSync(path)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('parsePowerBiReport', () => {
  it('lee el detalle de Primer/Segundo Tiempo del reporte de Steimbach vs River', async () => {
    const items = await extractPdfItems(fixture('powerbi-steimbach.pdf'))
    const rows = groupRows(items)
    const table = parsePowerBiReport(rows, 'Alexis Steimbach')

    expect(table).not.toBeNull()
    const row = table!.rows[0]
    expect(row.name).toBe('Alexis Steimbach')

    const byHeader = Object.fromEntries(table!.headers.map((h, i) => [h, row.values[i]]))
    expect(byHeader['Distancia total (m) (PT)']).toBe(5334)
    expect(byHeader['Distancia total (m) (ST)']).toBe(5432)
    expect(byHeader['Mts/min (PT)']).toBe(111.5)
    expect(byHeader['Mts/min (ST)']).toBe(107.2)
    expect(byHeader['Velocidad Max. (km/h) (PT)']).toBe(30.6)
    expect(byHeader['Velocidad Max. (km/h) (ST)']).toBe(28.9)
    expect(byHeader['Dist > 21 Km/h (PT)']).toBe(432)
    expect(byHeader['Dist > 21 Km/h (ST)']).toBe(306)
    expect(byHeader['Minutos jugados (PT)']).toBe(48)
    expect(byHeader['Minutos jugados']).toBe(99)
    expect(byHeader['Minutos jugados (ST)']).toBe(51)

    // Los gráficos de barras (Cargas Locomotivas / Mecánicas) quedan fuera.
    expect(table!.headers.some(h => h.includes('Dist 16-21'))).toBe(false)
    expect(table!.headers.some(h => h.includes('Acc > 2m/s'))).toBe(false)

    expect(table!.preambleLines.join(' | ')).toContain('Rival: River Plate')
  })

  it('devuelve null si el PDF no tiene la página de Primer/Segundo Tiempo', async () => {
    const items = await extractPdfItems(fixture('estudiantes-tigre.pdf'))
    const rows = groupRows(items)
    expect(parsePowerBiReport(rows, 'Alexis Steimbach')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/features/gps/parser/parsePowerBiReport.test.ts`
Expected: FAIL — `Cannot find module './parsePowerBiReport'`.

- [ ] **Step 3: Implementar**

```ts
// src/features/gps/parser/parsePowerBiReport.ts
import { parseNumber } from './normalize'
import type { PdfRow, PdfTable, PdfTableRow } from '../types'

/**
 * Separa las dos columnas (Primer/Segundo Tiempo) de la página por posición X.
 * Calibrado contra las coordenadas reales del reporte "Reporte jugador" de Power
 * BI/Catapult: las celdas de PT caen en x 33-227, las de ST en x 348-546.
 */
const HALF_WIDTH_X = 290

const SECTION_STOP = ['cargas locomotivas', 'cargas mecánicas', 'cargas mecanicas']
const CONTEXT_LABELS = ['instancia', 'rival', 'torneo', 'estadio']
const MAX_LABEL_VALUE_DIST = 150

function isLabelRow(row: PdfRow): boolean {
  return row.cells.length >= 2 && row.cells.every(c => parseNumber(c.text) === null)
}

function isValueRow(row: PdfRow, width: number): boolean {
  return row.cells.length === width && row.cells.every(c => parseNumber(c.text) !== null)
}

function side(x: number): 'PT' | 'ST' {
  return x < HALF_WIDTH_X ? 'PT' : 'ST'
}

/** Página con "Primer Tiempo", "Segundo Tiempo" y "Minutos jugados" — la plantilla
 * siempre trae el detalle del partido ahí. */
function findAnchorPage(rows: PdfRow[]): number | null {
  const textByPage = new Map<number, string>()
  for (const r of rows) {
    const text = r.cells.map(c => c.text.toLowerCase()).join(' ')
    textByPage.set(r.page, `${textByPage.get(r.page) ?? ''} ${text}`)
  }
  for (const [page, text] of textByPage) {
    if (text.includes('primer tiempo') && text.includes('segundo tiempo') && text.includes('minutos jugados')) {
      return page
    }
  }
  return null
}

/** "Instancia:"/"Rival:"/"Torneo:"/"Estadio:" → "Rival: River Plate", una línea por
 * etiqueta encontrada. El valor es la celda más cercana en X (misma fila o la
 * siguiente), porque estas etiquetas comparten fila con otro texto que no es el valor
 * (ej. el dorsal del jugador). */
function extractContext(pageRows: PdfRow[]): string[] {
  const lines: string[] = []
  for (let i = 0; i < pageRows.length; i++) {
    for (const cell of pageRows[i].cells) {
      const norm = cell.text.trim().toLowerCase().replace(':', '')
      if (!CONTEXT_LABELS.includes(norm)) continue
      const candidates = [
        ...pageRows[i].cells.filter(c => c !== cell),
        ...(pageRows[i + 1]?.cells ?? []),
      ]
      const closest = candidates
        .map(c => ({ c, dist: Math.abs(c.x - cell.x) }))
        .sort((a, b) => a.dist - b.dist)[0]
      if (closest && closest.dist < MAX_LABEL_VALUE_DIST) {
        lines.push(`${cell.text.replace(':', '').trim()}: ${closest.c.text.trim()}`)
      }
    }
  }
  return lines
}

function addPtStHeaders(
  headers: string[], values: (number | null)[], seen: Map<string, number>,
  title: PdfRow, value: PdfRow,
) {
  for (let c = 0; c < title.cells.length; c++) {
    const label = `${title.cells[c].text.trim()} (${side(title.cells[c].x)})`
    const count = (seen.get(label) ?? 0) + 1
    seen.set(label, count)
    headers.push(count > 1 ? `${label} #${count}` : label)
    values.push(parseNumber(value.cells[c].text))
  }
}

/**
 * Lee la página de detalle de partido de un "Reporte jugador" de Power BI/Catapult
 * (uno por partido, gráficos con etiquetas repetidas Primer/Segundo Tiempo). Ignora a
 * propósito los gráficos de barras (Cargas Locomotivas/Mecánicas): sus etiquetas no
 * están alineadas con sus valores como para reconstruirlas con confianza.
 */
export function parsePowerBiReport(rows: PdfRow[], playerName: string): PdfTable | null {
  const page = findAnchorPage(rows)
  if (page === null) return null
  const pageRows = rows.filter(r => r.page === page)

  const headers: string[] = ['']
  const values: (number | null)[] = [null]
  const seen = new Map<string, number>()

  for (let i = 0; i < pageRows.length; i++) {
    const title = pageRows[i]
    const titleText = title.cells.map(c => c.text.trim().toLowerCase()).join(' ')
    if (SECTION_STOP.some(s => titleText.includes(s))) break

    const value = pageRows[i + 1]
    if (value && isLabelRow(title) && isValueRow(value, title.cells.length)) {
      addPtStHeaders(headers, values, seen, title, value)
      i++
    }
  }

  // "Minutos jugados": etiqueta sola, valor (PT, Total, ST) dos filas después.
  const tiemposRow = pageRows.find(r =>
    r.cells.some(c => c.text.trim().toLowerCase() === 'primer tiempo') &&
    r.cells.some(c => c.text.trim().toLowerCase() === 'segundo tiempo'))
  if (tiemposRow) {
    const idx = pageRows.indexOf(tiemposRow)
    const valueRow = pageRows[idx + 1]
    if (valueRow && valueRow.cells.length === 3 && valueRow.cells.every(c => parseNumber(c.text) !== null)) {
      const sorted = [...valueRow.cells].sort((a, b) => a.x - b.x)
      headers.push('Minutos jugados (PT)', 'Minutos jugados', 'Minutos jugados (ST)')
      values.push(parseNumber(sorted[0].text), parseNumber(sorted[1].text), parseNumber(sorted[2].text))
    }
  }

  if (headers.length === 1) return null

  const row: PdfTableRow = { name: playerName, values }
  return { headers, rows: [row], preambleLines: extractContext(pageRows) }
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/features/gps/parser/parsePowerBiReport.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/gps/parser/parsePowerBiReport.ts \
        src/features/gps/parser/parsePowerBiReport.test.ts \
        src/features/gps/parser/__fixtures__/powerbi-steimbach.pdf
git commit -m "feat(gps): parsePowerBiReport lee el detalle PT/ST de reportes Power BI/Catapult"
```

---

### Task 9: Enchufar `parsePowerBiReport` en `parsePdf`

**Files:**
- Modify: `src/features/gps/parser/parsePdf.ts`
- Modify: `src/features/gps/parser/parsePdf.test.ts`

**Interfaces:**
- Consumes: `parsePowerBiReport` (Task 8).
- No cambia la firma pública de `parseGpsPdf`.

- [ ] **Step 1: Agregar el test de integración**

Agregar a `src/features/gps/parser/parsePdf.test.ts`:

```ts
it('con el jugador elegido, lee un reporte Power BI/Catapult de un partido', async () => {
  const result = await parseGpsPdf(fixture('powerbi-steimbach.pdf'), {
    roster: BASE_AGENCY_PLAYERS,
    lookup: buildAliasLookup(metrics, aliases),
    presetPlayerName: 'Alexis Steimbach',
  })

  expect(result.players).toHaveLength(1)
  expect(result.players[0].rawName).toBe('Alexis Steimbach')
  expect(result.context.rival).toBe('River Plate')

  const idx = result.columns.findIndex(c => c.header === 'Distancia total (m) (PT)')
  expect(result.players[0].values[idx]).toBe(5334)
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/features/gps/parser/parsePdf.test.ts`
Expected: FAIL — `parseGpsPdf` todavía no intenta `parsePowerBiReport`, así que no
encuentra tabla ni tarjetas y tira `GpsParseError`.

- [ ] **Step 3: Enchufarlo como tercer fallback**

En `src/features/gps/parser/parsePdf.ts`, agregar el import:

```ts
import { parsePowerBiReport } from './parsePowerBiReport'
```

Y cambiar:

```ts
const table = buildTable(rows) ?? (opts.presetPlayerName ? buildCardTable(rows, opts.presetPlayerName) : null)
```

por:

```ts
const table = buildTable(rows)
  ?? (opts.presetPlayerName ? buildCardTable(rows, opts.presetPlayerName) : null)
  ?? (opts.presetPlayerName ? parsePowerBiReport(rows, opts.presetPlayerName) : null)
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/features/gps/parser/parsePdf.test.ts`
Expected: PASS (todos, incluyendo el nuevo).

- [ ] **Step 5: Correr toda la suite de GPS**

Run: `npx vitest run src/features/gps`
Expected: PASS (todos los tests de la Fase 1 y la Fase 2 juntos).

- [ ] **Step 6: Probar a mano en el navegador**

Run: `npm run dev`, ir a `/carga-gps`, pestaña "Automática", elegir "Alexis Steimbach"
en el dropdown de "¿De qué jugador es el archivo?", subir
`Reporte F2 (L) vs River (Steimbach).pdf` (Descargas). Verificar:
- La revisión muestra los 8 valores PT/ST + minutos, con rival "River Plate"
  prefilleado.
- El mapeo de columnas permite crear métricas nuevas para "Distancia total (m) (PT)"
  etc. igual que con cualquier otro PDF.
- **No guardar** (el usuario pidió solo dejar la plataforma lista, no cargar datos).

- [ ] **Step 7: Commit**

```bash
git add src/features/gps/parser/parsePdf.ts src/features/gps/parser/parsePdf.test.ts
git commit -m "feat(gps): parseGpsPdf reconoce reportes Power BI/Catapult de un partido"
```

---

## Verificación final

- [ ] **Typecheck completo:** `npx tsc --noEmit -p .` → sin errores.
- [ ] **Suite completa:** `npx vitest run` → todo verde (incluye lo ya existente, sin
  regresiones).
- [ ] **Build:** `npm run build` → sin errores (confirma que no quedó ningún import
  roto ni código muerto que rompa el bundle de producción).
