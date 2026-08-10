# Entrenadores — Calendario en vista mensual tipo almanaque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la lista de agenda de 14 días del tab Calendario de un entrenador por un almanaque mensual navegable (mes anterior/siguiente, botón "Hoy"), con un panel de detalle del día seleccionado que reusa las pastillas de partido/entrenamiento ya existentes, y un link al detalle del partido cuando ya se jugó.

**Architecture:** Lógica pura de armado de la grilla del mes en un módulo nuevo y testeado (`src/features/coaches/calendarMonthGrid.ts`). `CoachCalendarTab.tsx` se reescribe para consumirlo, cambiando la fuente de datos de `fetchTeamFixtures` (ventana rodante) a `fetchSeasonFixtures` (temporada completa, ya existe, necesaria para poder navegar a meses ya jugados).

**Tech Stack:** React 18 + TypeScript, React Router (`Link`), Vitest (`.test.ts` de lógica pura).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-10-entrenadores-calendario-almanaque-design.md`.
- Semana de Lunes a Domingo (no Domingo a Sábado).
- Al tocar un día con partido NO se navega directo — se abre/actualiza el panel de detalle debajo del almanaque; desde ahí, solo si el partido ya se jugó (`isMatchFinished`), la pastilla es un link a `/entrenadores/${coach.key}/partido/${fixtureId}`.
- Si `coach.apiTeamId` o `coach.leagueSeason` faltan, se muestra el mismo `EmptyState` que ya existe hoy (mensaje: "No hay datos de equipo disponibles para este entrenador todavía.").
- Sin límites de navegación de mes — un mes sin datos simplemente muestra la grilla sin puntos, no se bloquea la navegación.
- Tests son solo de lógica pura (`.test.ts`), sobre `calendarMonthGrid.ts` — el componente no se testea (mismo criterio ya usado en toda la sección Entrenadores: UI no testeada, lógica extraída y pura sí).
- Seguir el estilo visual y las clases Tailwind ya usadas en `CoachCalendarTab.tsx`/`CoachSummaryTab.tsx` — no introducir un sistema de diseño nuevo.

---

## Task 1: Lógica pura de la grilla mensual

**Files:**
- Create: `src/features/coaches/calendarMonthGrid.ts`
- Create: `src/features/coaches/calendarMonthGrid.test.ts`

**Interfaces:**
- Consumes: `CoachCalendarDay` (`@/utils/coachCalendar`, ya existe: `{ date: string; fixtures: AgencyFixture[]; sessions: CoachTrainingSession[]; isAbroad: boolean }`).
- Produces: `interface MonthGridCell { date: string; dayNumber: number; isCurrentMonth: boolean }`, `buildMonthGrid(year: number, month: number): MonthGridCell[][]` (semanas de Lunes a Domingo, `month` 0-indexado como `Date`), `pickDefaultSelectedDate(grid: MonthGridCell[][], todayKey: string, eventsByDate: Map<string, CoachCalendarDay>): string`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/coaches/calendarMonthGrid.test.ts
import { describe, it, expect } from 'vitest'
import { buildMonthGrid, pickDefaultSelectedDate } from './calendarMonthGrid'
import type { CoachCalendarDay } from '@/utils/coachCalendar'

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

describe('buildMonthGrid', () => {
  it('arma semanas completas: cada fila tiene 7 dias', () => {
    const grid = buildMonthGrid(2024, 3) // abril 2024
    for (const week of grid) expect(week).toHaveLength(7)
  })

  it('la primera celda de cada semana cae en lunes y la ultima en domingo', () => {
    const grid = buildMonthGrid(2024, 3)
    for (const week of grid) {
      expect(parseDateKey(week[0].date).getDay()).toBe(1) // Lunes
      expect(parseDateKey(week[6].date).getDay()).toBe(0) // Domingo
    }
  })

  it('marca isCurrentMonth=true solo para los dias que pertenecen al mes pedido', () => {
    const grid = buildMonthGrid(2024, 3) // abril 2024 tiene 30 dias
    const currentMonthCells = grid.flat().filter(c => c.isCurrentMonth)
    expect(currentMonthCells).toHaveLength(30)
    for (const cell of currentMonthCells) {
      const d = parseDateKey(cell.date)
      expect(d.getMonth()).toBe(3)
      expect(d.getFullYear()).toBe(2024)
    }
  })

  it('un mes que arranca en lunes no tiene relleno del mes anterior', () => {
    const grid = buildMonthGrid(2024, 3) // abril 2024 arranca en lunes
    expect(grid[0][0].isCurrentMonth).toBe(true)
    expect(grid[0][0].dayNumber).toBe(1)
  })

  it('un mes que arranca en domingo rellena los 6 dias previos con el mes anterior', () => {
    const grid = buildMonthGrid(2024, 8) // septiembre 2024 arranca en domingo
    const firstWeek = grid[0]
    expect(firstWeek.slice(0, 6).every(c => !c.isCurrentMonth)).toBe(true)
    expect(firstWeek[6].isCurrentMonth).toBe(true)
    expect(firstWeek[6].dayNumber).toBe(1)
  })

  it('el relleno cruza de diciembre a enero del año siguiente correctamente', () => {
    const grid = buildMonthGrid(2024, 11) // diciembre 2024
    const lastWeek = grid[grid.length - 1]
    const trailing = lastWeek.filter(c => !c.isCurrentMonth)
    expect(trailing.length).toBeGreaterThan(0)
    for (const cell of trailing) {
      const d = parseDateKey(cell.date)
      expect(d.getFullYear()).toBe(2025)
      expect(d.getMonth()).toBe(0) // enero
    }
  })
})

function mkSession(over: Partial<CoachCalendarDay['sessions'][number]> = {}): CoachCalendarDay['sessions'][number] {
  return {
    id: 1, coach_key: 'domingo', session_date: '2024-04-10', session_time: null,
    type: 'tactico', title: 'Táctico', notes: null, created_at: '', updated_at: '',
    ...over,
  }
}

describe('pickDefaultSelectedDate', () => {
  const grid = buildMonthGrid(2024, 3) // abril 2024

  it('si hoy cae en el mes visible, se selecciona hoy', () => {
    const result = pickDefaultSelectedDate(grid, '2024-04-15', new Map())
    expect(result).toBe('2024-04-15')
  })

  it('si hoy no esta en el mes visible y no hay eventos, selecciona el dia 1', () => {
    const result = pickDefaultSelectedDate(grid, '2024-05-15', new Map())
    expect(result).toBe('2024-04-01')
  })

  it('si hoy no esta en el mes visible pero hay eventos, selecciona el primer dia con evento', () => {
    const eventsByDate = new Map<string, CoachCalendarDay>([
      ['2024-04-10', { date: '2024-04-10', fixtures: [], sessions: [mkSession()], isAbroad: false }],
    ])
    const result = pickDefaultSelectedDate(grid, '2024-05-15', eventsByDate)
    expect(result).toBe('2024-04-10')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/coaches/calendarMonthGrid.test.ts`
Expected: FAIL — el módulo no existe todavía.

- [ ] **Step 3: Implementar `calendarMonthGrid.ts`**

```ts
// src/features/coaches/calendarMonthGrid.ts
import type { CoachCalendarDay } from '@/utils/coachCalendar'

export interface MonthGridCell {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
}

function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** getDay() de JS es 0=Domingo..6=Sabado; esto lo convierte a 0=Lunes..6=Domingo. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** Arma las semanas (Lunes a Domingo) que cubren el mes `month` (0-indexado) del año `year`, rellenando con dias del mes anterior/siguiente hasta completar semanas enteras. */
export function buildMonthGrid(year: number, month: number): MonthGridCell[][] {
  const firstOfMonth = new Date(year, month, 1)
  const start = new Date(year, month, 1 - mondayIndex(firstOfMonth))

  const lastOfMonth = new Date(year, month + 1, 0)
  const end = new Date(year, month, lastOfMonth.getDate() + (6 - mondayIndex(lastOfMonth)))

  const cells: MonthGridCell[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    cells.push({
      date: formatDateKey(cursor),
      dayNumber: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === month && cursor.getFullYear() === year,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const weeks: MonthGridCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Hoy si cae en el mes visible; si no, el primer dia del mes visible con eventos; si no hay ninguno, el dia 1. */
export function pickDefaultSelectedDate(
  grid: MonthGridCell[][],
  todayKey: string,
  eventsByDate: Map<string, CoachCalendarDay>,
): string {
  const currentMonthCells = grid.flat().filter(c => c.isCurrentMonth)

  const todayCell = currentMonthCells.find(c => c.date === todayKey)
  if (todayCell) return todayCell.date

  const firstWithEvents = currentMonthCells.find(c => {
    const day = eventsByDate.get(c.date)
    return !!day && (day.fixtures.length > 0 || day.sessions.length > 0)
  })
  if (firstWithEvents) return firstWithEvents.date

  return currentMonthCells[0].date
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/coaches/calendarMonthGrid.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/coaches/calendarMonthGrid.ts src/features/coaches/calendarMonthGrid.test.ts
git commit -m "feat(entrenadores): armado puro de la grilla mensual del calendario"
```

---

## Task 2: `CoachCalendarTab.tsx` — reescritura a vista de almanaque

**Files:**
- Modify: `src/features/coaches/components/CoachCalendarTab.tsx` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: `buildMonthGrid`, `pickDefaultSelectedDate`, `MonthGridCell` (Task 1); `fetchSeasonFixtures` (`@/services/footballApiService`, ya existe: `(teamId: number, season: number, forceRefresh?: boolean) => Promise<AgencyFixture[]>`); `toArDateKey` (ya existe); `listTrainingSessions` (`@/services/coachService`, ya existe); `isMatchFinished`, `mergeCalendarEvents` (`@/utils/coachCalendar`, ya existen, sin cambios); `AgencyCoach` (`@/constants/agencyCoaches`, ya tiene `leagueSeason?: number | null`).
- Produces: `CoachCalendarTab({ coach }: { coach: AgencyCoach })` — mismo default export y misma firma que hoy, ningún caller cambia (`CoachDetailPage.tsx` sigue llamándolo igual).

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```tsx
// src/features/coaches/components/CoachCalendarTab.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSeasonFixtures, toArDateKey } from '@/services/footballApiService'
import { listTrainingSessions } from '@/services/coachService'
import { isMatchFinished, mergeCalendarEvents } from '@/utils/coachCalendar'
import { buildMonthGrid, pickDefaultSelectedDate, type MonthGridCell } from '@/features/coaches/calendarMonthGrid'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 12 3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12Zm0 0h7.5"
      />
    </svg>
  )
}

/** `key` es una ArDateKey "YYYY-MM-DD". Parsearla directo con `new Date(string)` la
 *  interpreta como medianoche UTC: en un dispositivo con huso negativo (como AR,
 *  UTC-3) el posterior `toLocaleDateString` puede mostrar el día anterior. Se arma
 *  la fecha a partir de sus componentes locales para evitar ese corrimiento. */
function parseArDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export default function CoachCalendarTab({ coach }: { coach: AgencyCoach }) {
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)
  const [sessions, setSessions] = useState<CoachTrainingSession[] | null>(null)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    if (!coach.apiTeamId || !coach.leagueSeason) return
    let active = true
    Promise.all([
      fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason),
      listTrainingSessions(coach.key),
    ]).then(([f, s]) => {
      if (active) {
        setFixtures(f)
        setSessions(s)
      }
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId, coach.leagueSeason, coach.key])

  const todayKey = useMemo(() => toArDateKey(new Date()), [])

  const eventsByDate = useMemo(() => {
    if (!fixtures || !sessions) return null
    return mergeCalendarEvents(fixtures, sessions)
  }, [fixtures, sessions])

  const grid = useMemo(() => buildMonthGrid(visibleMonth.year, visibleMonth.month), [visibleMonth])

  // Selecciona un dia por defecto una sola vez, apenas los datos terminan de cargar.
  // Despues de eso, la seleccion la maneja siempre una accion explicita del usuario
  // (flechas de mes, boton Hoy, tocar una celda) - ver goToMonthWithSelection.
  useEffect(() => {
    if (!eventsByDate || selectedDate !== null) return
    setSelectedDate(pickDefaultSelectedDate(grid, todayKey, eventsByDate))
  }, [eventsByDate, selectedDate, grid, todayKey])

  if (!coach.apiTeamId || !coach.leagueSeason) {
    return <EmptyState message="No hay datos de equipo disponibles para este entrenador todavía." />
  }

  if (eventsByDate === null || selectedDate === null) return <LoadingSpinner message="Cargando calendario..." />

  const goToMonthWithSelection = (year: number, month: number, dateToSelect?: string) => {
    const newGrid = buildMonthGrid(year, month)
    setVisibleMonth({ year, month })
    setSelectedDate(dateToSelect ?? pickDefaultSelectedDate(newGrid, todayKey, eventsByDate))
  }

  const goPrevMonth = () => {
    const d = new Date(visibleMonth.year, visibleMonth.month - 1, 1)
    goToMonthWithSelection(d.getFullYear(), d.getMonth())
  }

  const goNextMonth = () => {
    const d = new Date(visibleMonth.year, visibleMonth.month + 1, 1)
    goToMonthWithSelection(d.getFullYear(), d.getMonth())
  }

  const goToday = () => {
    const now = new Date()
    goToMonthWithSelection(now.getFullYear(), now.getMonth(), todayKey)
  }

  const handleCellClick = (cell: MonthGridCell) => {
    if (cell.isCurrentMonth) {
      setSelectedDate(cell.date)
      return
    }
    const d = parseArDateKey(cell.date)
    goToMonthWithSelection(d.getFullYear(), d.getMonth(), cell.date)
  }

  const monthLabel = capitalize(
    new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
  )
  const isCurrentMonthVisible = (() => {
    const now = new Date()
    return visibleMonth.year === now.getFullYear() && visibleMonth.month === now.getMonth()
  })()

  const selectedDay = eventsByDate.get(selectedDate) ?? {
    date: selectedDate,
    fixtures: [] as AgencyFixture[],
    sessions: [] as CoachTrainingSession[],
    isAbroad: false,
  }
  const selectedParsed = parseArDateKey(selectedDate)
  const selectedWeekday = capitalize(selectedParsed.toLocaleDateString('es-AR', { weekday: 'long' }))
  const selectedMonthLabel = capitalize(selectedParsed.toLocaleDateString('es-AR', { month: 'long' }))

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Mes anterior"
          className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{monthLabel}</span>
          {!isCurrentMonthVisible && (
            <button type="button" onClick={goToday} className="text-2xs font-semibold text-brand-green hover:underline">
              Hoy
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Mes siguiente"
          className="w-9 h-9 flex items-center justify-center rounded-full text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-2xs font-semibold text-apple-gray-400 uppercase py-1">
            {label}
          </div>
        ))}
        {grid.flat().map(cell => {
          const isToday = cell.date === todayKey
          const isSelected = cell.date === selectedDate
          const day = eventsByDate.get(cell.date)
          const hasFixture = !!day && day.fixtures.length > 0
          const hasSession = !!day && day.sessions.length > 0
          const isAbroad = !!day && day.isAbroad

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => handleCellClick(cell)}
              className={`flex flex-col items-center justify-center gap-0.5 aspect-square rounded-apple-lg text-sm transition-colors duration-150 ease-apple ${
                !cell.isCurrentMonth
                  ? 'text-apple-gray-300 dark:text-apple-gray-600'
                  : isSelected
                    ? 'bg-brand-green text-apple-gray-900 font-bold'
                    : isToday
                      ? 'bg-brand-green/10 text-brand-green font-bold'
                      : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800'
              }`}
            >
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
            </button>
          )
        })}
      </div>

      <div className="rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 bg-white dark:bg-apple-gray-800/60 px-4 py-3">
        <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">
          {selectedWeekday} {selectedParsed.getDate()} de {selectedMonthLabel}
        </p>
        {selectedDay.fixtures.length === 0 && selectedDay.sessions.length === 0 ? (
          <p className="text-sm text-apple-gray-300 dark:text-apple-gray-600">Sin actividad este día</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {selectedDay.fixtures.map(f => {
              const opponent = f.isHome ? f.awayTeam : f.homeTeam
              const finished = isMatchFinished(f.statusShort)
              const scoreLabel =
                finished && f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome}-${f.goalsAway}` : null
              const pill = (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-green/10 text-brand-green px-2.5 py-1.5 rounded-full max-w-full">
                  <img src={opponent.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                  <span className="truncate">
                    {f.isHome ? 'vs' : '@'} {opponent.name}
                  </span>
                  {scoreLabel && <span className="font-bold flex-shrink-0">{scoreLabel}</span>}
                </span>
              )
              return finished ? (
                <Link
                  key={f.fixtureId}
                  to={`/entrenadores/${coach.key}/partido/${f.fixtureId}`}
                  className="hover:opacity-80 transition-opacity"
                >
                  {pill}
                </Link>
              ) : (
                <span key={f.fixtureId}>{pill}</span>
              )
            })}
            {selectedDay.sessions.map(s => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300 px-2.5 py-1.5 rounded-full max-w-full"
              >
                <BoltIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{s.title}</span>
              </span>
            ))}
            {selectedDay.isAbroad && (
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-400 flex-shrink-0"
                title="Viaje al exterior"
              >
                <PlaneIcon className="w-3.5 h-3.5" />
              </span>
            )}
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
git add src/features/coaches/components/CoachCalendarTab.tsx
git commit -m "feat(entrenadores): calendario en vista mensual tipo almanaque"
```

---

## Verificación final

- [ ] **Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los 9 nuevos de `calendarMonthGrid.test.ts`.

- [ ] **Typecheck y build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Probar a mano en el navegador** (`npm run dev`, `/entrenadores/domingo`, tab Calendario):
  - Se ve la grilla del mes actual, con el día de hoy resaltado.
  - Los días con partido tienen un puntito verde (o avioncito si es afuera), los días con entrenamiento un puntito gris.
  - Tocar un día actualiza el panel de abajo con el detalle de ese día.
  - Las flechas cambian de mes; un mes sin datos muestra la grilla vacía sin romper nada.
  - Tocar un día de un mes vecino (atenuado) cambia de mes y selecciona ese día.
  - El botón "Hoy" aparece solo cuando no estás en el mes actual, y vuelve a hoy.
  - Tocar la pastilla de un partido ya jugado navega a su página de detalle; un partido futuro no es clickeable.
