# Oportunidades: boost por contrato + widget de Inicio por puesto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los jugadores con contrato por vencer pronto suben de posición en el ranking de Oportunidades, y el widget de Inicio pasa de mostrar 1 tarjeta rotativa a un top-8 navegable por cada una de las 8 posiciones.

**Architecture:** Todo el cálculo es client-side sobre datos que ya trae el RPC `fetch_recent_form` (sin tocar Supabase). Dos funciones nuevas puramente síncronas en `src/utils/opportunities.ts` (`opportunityScoreFor`, `topByPosition`) consumidas por el widget de Inicio (`OpportunityHero.tsx`, rediseño completo) y por la página `/oportunidades` (`OpportunitiesPage.tsx`, un cambio de una línea en el orden).

**Tech Stack:** React 18 + TypeScript, Vitest para tests, Tailwind CSS.

## Global Constraints

- El número de Score GG que se muestra en cualquier tarjeta sigue siendo `recent_avg` tal cual lo devuelve el RPC — el `opportunity_score` (con boost) se usa únicamente para ordenar, nunca se muestra ni reemplaza esa marca.
- Orden fijo de posiciones en todo el feature: `['ARQ', 'LD', 'CB', 'LI', 'VC', 'VI', 'EXT', 'DEL']`.
- Boost máximo por contrato: `1.5` puntos, alcanzado a `0` meses; `0` de boost a partir de `12` meses o sin fecha de contrato.
- No se toca el RPC `fetch_recent_form` ni ninguna migración de Supabase.

---

### Task 1: `contractBoostFor` y `opportunityScoreFor` en `opportunities.ts`

**Files:**
- Modify: `src/utils/opportunities.ts`
- Test: `src/utils/opportunities.test.ts`

**Interfaces:**
- Consumes: `monthsToContractEnd(date: string | null): number | null` (ya existe en el mismo archivo), `RecentFormPlayer` de `@/types/scoring`.
- Produces: `contractBoostFor(contractEndDate: string | null): number`, `opportunityScoreFor(p: RecentFormPlayer): number`, constantes `CONTRACT_BOOST_MAX = 1.5` y `CONTRACT_BOOST_MONTHS = 12` — usadas por el Task 2 y por `OpportunitiesPage.tsx` (Task 4).

- [x] **Step 1: Escribir los tests que fallan**

En `src/utils/opportunities.test.ts`, cambiar la línea de import del principio del archivo de:

```ts
import { marketTagsFor } from './opportunities'
```

a:

```ts
import { marketTagsFor, contractBoostFor, opportunityScoreFor } from './opportunities'
```

Y agregar al final del archivo (después del `describe('marketTagsFor', ...)` existente, sin tocarlo):

```ts
function dateInMonths(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

describe('contractBoostFor', () => {
  it('boost máximo cuando el contrato vence este mes', () => {
    expect(contractBoostFor(dateInMonths(0))).toBeCloseTo(1.5, 1)
  })
  it('boost a mitad de camino a los 6 meses', () => {
    expect(contractBoostFor(dateInMonths(6))).toBeCloseTo(0.75, 1)
  })
  it('boost cero a los 12 meses', () => {
    expect(contractBoostFor(dateInMonths(12))).toBeCloseTo(0, 1)
  })
  it('boost cero más allá de 12 meses', () => {
    expect(contractBoostFor(dateInMonths(24))).toBe(0)
  })
  it('boost cero sin fecha de contrato', () => {
    expect(contractBoostFor(null)).toBe(0)
  })
  it('contrato ya vencido satura en el boost máximo', () => {
    expect(contractBoostFor(dateInMonths(-3))).toBeCloseTo(1.5, 1)
  })
})

describe('opportunityScoreFor', () => {
  it('suma el score reciente y el boost por contrato', () => {
    const p = mk({ recent_avg: 7, contract_end_date: dateInMonths(6) })
    expect(opportunityScoreFor(p)).toBeCloseTo(7.75, 1)
  })
  it('sin contrato, el opportunity_score es igual al recent_avg', () => {
    const p = mk({ recent_avg: 7, contract_end_date: null })
    expect(opportunityScoreFor(p)).toBe(7)
  })
})
```

Nota: `mk(...)` ya está definido arriba en el archivo — no crear una segunda copia.

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- opportunities.test.ts`
Expected: FAIL — `contractBoostFor` y `opportunityScoreFor` no existen todavía (`does not provide an export named 'contractBoostFor'`).

- [x] **Step 3: Implementar**

Agregar en `src/utils/opportunities.ts`, después de `monthsToContractEnd` y antes de `detectOpportunities`:

```ts
export const CONTRACT_BOOST_MAX = 1.5
export const CONTRACT_BOOST_MONTHS = 12

export function contractBoostFor(contractEndDate: string | null): number {
  const months = monthsToContractEnd(contractEndDate)
  if (months === null || months > CONTRACT_BOOST_MONTHS) return 0
  const proximity = 1 - months / CONTRACT_BOOST_MONTHS
  return CONTRACT_BOOST_MAX * Math.min(Math.max(proximity, 0), 1)
}

export function opportunityScoreFor(p: RecentFormPlayer): number {
  return p.recent_avg + contractBoostFor(p.contract_end_date)
}
```

- [x] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- opportunities.test.ts`
Expected: PASS, todos los tests en verde.

- [x] **Step 5: Commit**

```bash
git add src/utils/opportunities.ts src/utils/opportunities.test.ts
git commit -m "feat(oportunidades): boost por contrato en el ranking (opportunityScoreFor)"
```

---

### Task 2: `topByPosition` en `opportunities.ts`

**Files:**
- Modify: `src/utils/opportunities.ts`
- Test: `src/utils/opportunities.test.ts`

**Interfaces:**
- Consumes: `opportunityScoreFor` (Task 1), `Position` de `@/types/scoring`, `RecentFormPlayer`.
- Produces: `OPPORTUNITY_POSITIONS: Position[]`, `topByPosition(players: RecentFormPlayer[], positions?: Position[], n?: number): Record<string, RecentFormPlayer[]>` — usado por `OpportunityHero.tsx` en el Task 3.

- [x] **Step 1: Escribir los tests que fallan**

En `src/utils/opportunities.test.ts`, extender otra vez la línea de import del principio del archivo (la que quedó del Task 1) de:

```ts
import { marketTagsFor, contractBoostFor, opportunityScoreFor } from './opportunities'
```

a:

```ts
import { marketTagsFor, contractBoostFor, opportunityScoreFor, topByPosition, OPPORTUNITY_POSITIONS } from './opportunities'
```

Y agregar al final del archivo:

```ts
describe('topByPosition', () => {
  it('agrupa por posición y ordena por opportunity_score dentro de cada grupo', () => {
    const players = [
      mk({ id: 1, primary_position: 'DEL', recent_avg: 6 }),
      mk({ id: 2, primary_position: 'DEL', recent_avg: 8 }),
      mk({ id: 3, primary_position: 'ARQ', recent_avg: 7 }),
    ]
    const grouped = topByPosition(players, ['ARQ', 'DEL'], 8)
    expect(grouped.DEL.map(p => p.id)).toEqual([2, 1])
    expect(grouped.ARQ.map(p => p.id)).toEqual([3])
  })

  it('devuelve un array vacío (no undefined) para una posición sin candidatos', () => {
    const grouped = topByPosition([], ['ARQ', 'DEL'], 8)
    expect(grouped.ARQ).toEqual([])
    expect(grouped.DEL).toEqual([])
  })

  it('corta en n jugadores por posición', () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      mk({ id: i, primary_position: 'VC', recent_avg: i }))
    const grouped = topByPosition(players, ['VC'], 8)
    expect(grouped.VC).toHaveLength(8)
    expect(grouped.VC[0].id).toBe(9)
  })

  it('OPPORTUNITY_POSITIONS tiene las 8 posiciones en el orden fijo', () => {
    expect(OPPORTUNITY_POSITIONS).toEqual(['ARQ', 'LD', 'CB', 'LI', 'VC', 'VI', 'EXT', 'DEL'])
  })
})
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- opportunities.test.ts`
Expected: FAIL — `topByPosition` y `OPPORTUNITY_POSITIONS` no existen todavía.

- [x] **Step 3: Implementar**

Agregar al final de `src/utils/opportunities.ts`. Requiere importar `Position` — cambiar la línea de import del principio del archivo:

```ts
import type { PlayerWithScore, Position, RecentFormPlayer } from '@/types/scoring'
```

Y agregar al final del archivo:

```ts
export const OPPORTUNITY_POSITIONS: Position[] = ['ARQ', 'LD', 'CB', 'LI', 'VC', 'VI', 'EXT', 'DEL']

export function topByPosition(
  players: RecentFormPlayer[],
  positions: Position[] = OPPORTUNITY_POSITIONS,
  n = 8,
): Record<string, RecentFormPlayer[]> {
  const result: Record<string, RecentFormPlayer[]> = {}
  for (const pos of positions) {
    result[pos] = players
      .filter(p => p.primary_position === pos)
      .sort((a, b) => opportunityScoreFor(b) - opportunityScoreFor(a))
      .slice(0, n)
  }
  return result
}
```

- [x] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- opportunities.test.ts`
Expected: PASS, todos los tests en verde (incluye los del Task 1).

- [x] **Step 5: Commit**

```bash
git add src/utils/opportunities.ts src/utils/opportunities.test.ts
git commit -m "feat(oportunidades): agrupar top-8 por posición (topByPosition)"
```

---

### Task 3: Rediseño de `OpportunityHero.tsx` — pestañas por puesto

**Files:**
- Modify: `src/components/dashboard/OpportunityHero.tsx` (reemplazo completo del contenido)

**Interfaces:**
- Consumes: `topByPosition`, `OPPORTUNITY_POSITIONS`, `marketTagsFor` de `@/utils/opportunities` (Tasks 1-2); `useRecentForm` de `@/hooks/usePlayerStats` (sin cambios de firma); `displayPosition` de `@/types/scoring`; `excludeAgencyPlayers` de `@/utils/agencyFilter`; `useData` de `@/context/DataContext`; `Sparkline` de `@/components/ui/Sparkline`.
- Produces: el mismo default export `OpportunityHero()`, mismo punto de montaje en `src/pages/HomePage.tsx:612` — no cambia la integración.

No lleva test propio (es un componente visual sin lógica nueva — la lógica de agrupado y boost ya está testeada en el Task 1 y 2). Se verifica manualmente en el Task 5.

- [x] **Step 1: Reemplazar el contenido completo de `src/components/dashboard/OpportunityHero.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRecentForm } from '@/hooks/usePlayerStats'
import { useData } from '@/context/DataContext'
import { excludeAgencyPlayers } from '@/utils/agencyFilter'
import { marketTagsFor, topByPosition, OPPORTUNITY_POSITIONS } from '@/utils/opportunities'
import { displayPosition, type Position } from '@/types/scoring'
import Sparkline from '@/components/ui/Sparkline'

const CHEAP_MAX = 5_000_000, CONTRACT_MAX = 12
const TAG_LABEL = { contract: 'Fin de contrato', cheap: 'Precio bajo' } as const

export default function OpportunityHero() {
  const navigate = useNavigate()
  const { players: allPlayers, loading } = useRecentForm({
    windowMonths: 3, cheapMaxValue: CHEAP_MAX, contractMaxMonths: CONTRACT_MAX, limit: 200,
  })
  // Un jugador que ya representamos no es una oportunidad de mercado.
  const { agencyPlayers } = useData()
  const players = useMemo(
    () => excludeAgencyPlayers(allPlayers, agencyPlayers),
    [allPlayers, agencyPlayers],
  )
  const grouped = useMemo(() => topByPosition(players, OPPORTUNITY_POSITIONS, 8), [players])

  const [activePos, setActivePos] = useState<Position>(OPPORTUNITY_POSITIONS[0])
  const [userSelected, setUserSelected] = useState(false)

  // Por defecto arranca en la primera posición con candidatos. Una vez que el
  // usuario toca una pestaña, no la volvemos a mover por debajo suyo.
  useEffect(() => {
    if (userSelected || loading) return
    const firstNonEmpty = OPPORTUNITY_POSITIONS.find(pos => grouped[pos].length > 0)
    if (firstNonEmpty) setActivePos(firstNonEmpty)
  }, [grouped, loading, userSelected])

  const activePlayers = grouped[activePos] ?? []

  if (loading || players.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-apple-gray-800 dark:text-white">
          Oportunidades de mercado
        </h2>
        <Link
          to="/oportunidades"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-green hover:text-emerald-600 transition-colors"
        >
          Ver más oportunidades
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-thin">
        {OPPORTUNITY_POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => { setUserSelected(true); setActivePos(pos) }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              pos === activePos
                ? 'bg-brand-green text-apple-gray-900'
                : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400'}`}
          >
            {displayPosition(pos)}
          </button>
        ))}
      </div>

      {activePlayers.length === 0 ? (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-5 text-sm text-apple-gray-400">
          Sin oportunidades por ahora en {displayPosition(activePos)}.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1">
          {activePlayers.map(p => {
            const tags = marketTagsFor(p, { cheapMaxValue: CHEAP_MAX, contractMaxMonths: CONTRACT_MAX })
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/jugador/${encodeURIComponent(p.name)}?source=externo&apiId=${p.id}`)}
                className="cursor-pointer flex-shrink-0 w-64 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 hover:shadow-apple-md transition-all"
              >
                <div className="flex items-center gap-3">
                  {p.photo
                    ? <img src={p.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                    : <div className="w-12 h-12 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-apple-gray-800 dark:text-white truncate">{p.name}</h3>
                      {p.on_the_rise && <span className="text-brand-green text-xs font-semibold flex-shrink-0">▲</span>}
                    </div>
                    <p className="text-xs text-apple-gray-500 truncate">
                      {[p.team?.name, p.league_name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(t => (
                      <span key={t} className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green">{TAG_LABEL[t]}</span>
                    ))}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-brand-green tabular-nums leading-none">{p.recent_avg.toFixed(1)}</p>
                    <p className="text-2xs text-apple-gray-400">{p.recent_matches} PJ</p>
                  </div>
                </div>
                <div className="mt-1.5 flex justify-end"><Sparkline values={p.recent_scores} /></div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

- [x] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `OpportunityHero.tsx`.

- [x] **Step 3: Commit**

```bash
git add src/components/dashboard/OpportunityHero.tsx
git commit -m "feat(oportunidades): widget de Inicio con pestañas por puesto (top 8 c/u)"
```

---

### Task 4: Ordenar `/oportunidades` por `opportunity_score`

**Files:**
- Modify: `src/pages/OpportunitiesPage.tsx:11-16` (import) y `src/pages/OpportunitiesPage.tsx:82-115` (`filteredPlayers`)

**Interfaces:**
- Consumes: `opportunityScoreFor` de `@/utils/opportunities` (Task 1).
- Produces: mismo `filteredPlayers` que ya consume el render de la grilla — solo cambia el orden, no el tipo ni el resto del contrato.

- [x] **Step 1: Agregar el import**

En `src/pages/OpportunitiesPage.tsx`, la importación actual (línea 11-16) es:

```ts
import {
  marketTagsFor,
  ageFromBirthDate,
  monthsToContractEnd,
  type MarketTag,
} from '@/utils/opportunities'
```

Reemplazar por:

```ts
import {
  marketTagsFor,
  ageFromBirthDate,
  monthsToContractEnd,
  opportunityScoreFor,
  type MarketTag,
} from '@/utils/opportunities'
```

- [x] **Step 2: Ordenar antes de devolver `filteredPlayers`**

En el mismo archivo, el `useMemo` de `filteredPlayers` termina hoy así (alrededor de la línea 106-115):

```ts
    // Contrato
    if (maxContract !== null) {
      result = result.filter(p => {
        const months = monthsToContractEnd(p.contract_end_date)
        return months !== null && months >= 0 && months <= maxContract
      })
    }

    return result
  }, [players, tagsById, typeFilter, positionFilter, minAge, maxAge, minValue, maxValue, maxContract])
```

Cambiar el `return result` final por:

```ts
    // Contrato
    if (maxContract !== null) {
      result = result.filter(p => {
        const months = monthsToContractEnd(p.contract_end_date)
        return months !== null && months >= 0 && months <= maxContract
      })
    }

    // Ranking: Score GG reciente + boost por cercanía a fin de contrato.
    return [...result].sort((a, b) => opportunityScoreFor(b) - opportunityScoreFor(a))
  }, [players, tagsById, typeFilter, positionFilter, minAge, maxAge, minValue, maxValue, maxContract])
```

`[...result]` es necesario porque cuando no hay filtros activos `result` es la misma referencia que `players` (el array que viene del hook) — ordenar in-place la mutaría.

- [x] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [x] **Step 4: Commit**

```bash
git add src/pages/OpportunitiesPage.tsx
git commit -m "feat(oportunidades): ordenar la grilla por opportunity_score (boost de contrato)"
```

---

### Task 5: Verificación final

**Files:** ninguno nuevo — corre la suite completa y hace un smoke test manual.

- [x] **Step 1: Correr toda la suite de tests**

Run: `npm test`
Expected: PASS, incluye los tests de `opportunities.test.ts` de los Tasks 1-2 y el resto de la suite sin regresiones.

- [x] **Step 2: Typecheck y build completo**

Run: `npm run build`
Expected: compila sin errores (incluye `tsc` + bundle de Vite).

- [x] **Step 3: Smoke test manual en el navegador**

Run: `npm run dev`, abrir `http://localhost:5173`.

- En Inicio: la sección "Oportunidades de mercado" muestra 8 pestañas (ARQ, LD, DFC, LI, VC, VI, EXT, DEL) y al tocar cada una aparece un carrusel horizontal con hasta 8 jugadores. El link "Ver más oportunidades" sigue llevando a `/oportunidades`.
- En `/oportunidades`: los jugadores con "Fin de contrato" y pocos meses restantes aparecen más arriba que antes en relación a su Score GG (comparar contra el orden que tenía antes del cambio, si se puede).
- Confirmar que el número mostrado en cada tarjeta (Home y `/oportunidades`) sigue siendo el Score GG puro (`recent_avg`), no un valor con el boost sumado.

- [x] **Step 4: Commit final si hubo ajustes del smoke test**

Solo si el Step 3 encontró algo para corregir — de lo contrario no hay nada que commitear en esta tarea.
