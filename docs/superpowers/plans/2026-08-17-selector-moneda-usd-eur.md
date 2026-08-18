# Selector de Moneda USD/EUR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a USD/EUR currency toggle next to the dark-mode button that converts every market-value display in the app live, using the day's EUR→USD rate, defaulting to USD.

**Architecture:** A `CurrencyContext` (same pattern as the existing `ThemeContext`) holds the active currency and the day's exchange rate (fetched once/day from Frankfurter.app, cached in localStorage, safe fallback chain). A new currency-aware formatter in `src/utils/scoring.ts` replaces the 9 near-duplicate local `formatValue`/`formatMarketValue` functions scattered across the app. The pre-baked `marketValueFormatted` field on `EnrichedPlayer`/`MonitoringPlayer` is removed from the type entirely — this makes the TypeScript compiler enumerate every remaining consumer, so nothing is left silently stale in one currency while the rest of the app switched.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, Vitest. No new dependencies — Frankfurter.app is called directly with `fetch`, no SDK.

**Spec:** `docs/superpowers/specs/2026-08-17-selector-moneda-usd-eur-design.md`

## Global Constraints

- Default currency is USD; a user who switches to EUR keeps seeing EUR on return visits (persisted in `localStorage`, key `gg-currency`).
- The `CurrencyToggle` button must match `ThemeToggle`'s exact visual pattern (padding, hover, radius, transition) and sit directly beside it in `Navbar.tsx`'s existing responsive right-side cluster — no new responsive breakpoints needed.
- `content.valorMercado` in Informes (free-text, user-editable) is explicitly out of scope for live reconversion — it autofills in the active currency at the moment a player is selected, and is never touched again automatically.
- No new dependency for the exchange-rate fetch — plain `fetch` against Frankfurter.app (`https://api.frankfurter.app/latest?from=EUR&to=USD`), no API key.
- `formatMarketValue(value: number): string` (EUR-only, existing signature) stays untouched and keeps producing the legacy `'Valor de mercado (Transfermarkt)'` string field — only currency-facing *display* surfaces move to the new currency-aware formatter.

---

### Task 1: Exchange rate service

**Files:**
- Create: `src/services/exchangeRateService.ts`
- Create: `src/services/exchangeRateService.test.ts`

**Interfaces:**
- Produces: `export interface ExchangeRate { rate: number; date: string }`, `export const FALLBACK_EUR_USD_RATE = 1.08`, `export async function fetchEurUsdRate(): Promise<ExchangeRate>`. Task 2 (`CurrencyContext`) imports `fetchEurUsdRate` and `FALLBACK_EUR_USD_RATE`.

- [ ] **Step 1: Write the failing tests**

Create `src/services/exchangeRateService.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchEurUsdRate, FALLBACK_EUR_USD_RATE } from './exchangeRateService'

const CACHE_KEY = 'gg-eur-usd-rate'

describe('fetchEurUsdRate', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pide la tasa a Frankfurter y la cachea', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ amount: 1, base: 'EUR', date: '2026-08-15', rates: { USD: 1.0923 } }),
    }))

    const result = await fetchEurUsdRate()

    expect(result).toEqual({ rate: 1.0923, date: '2026-08-15' })
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!)
    expect(cached).toEqual({ rate: 1.0923, date: '2026-08-15' })
  })

  it('no vuelve a pedir si ya hay una tasa cacheada de hoy', async () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: 1.05, date: today }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchEurUsdRate()

    expect(result).toEqual({ rate: 1.05, date: today })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('si el fetch falla, devuelve la última tasa cacheada aunque sea de otro día', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: 1.02, date: '2020-01-01' }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await fetchEurUsdRate()

    expect(result).toEqual({ rate: 1.02, date: '2020-01-01' })
  })

  it('sin cache y sin red, devuelve la tasa de emergencia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await fetchEurUsdRate()

    expect(result.rate).toBe(FALLBACK_EUR_USD_RATE)
  })

  it('si la API responde ok:false, trata igual que un fetch fallido (usa cache/fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await fetchEurUsdRate()

    expect(result.rate).toBe(FALLBACK_EUR_USD_RATE)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/exchangeRateService.test.ts`
Expected: FAIL — cannot find module `./exchangeRateService`.

- [ ] **Step 3: Implement `exchangeRateService.ts`**

Create `src/services/exchangeRateService.ts`:

```ts
export interface ExchangeRate {
  rate: number // 1 EUR = `rate` USD
  date: string // 'YYYY-MM-DD', fecha del dato del BCE
}

// Fijada 2026-08-17 como piso de emergencia si nunca hubo un fetch exitoso
// ni una tasa cacheada — mejor una conversión aproximada que romper la UI.
export const FALLBACK_EUR_USD_RATE = 1.08

const CACHE_KEY = 'gg-eur-usd-rate'

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getCached(): ExchangeRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ExchangeRate
  } catch {
    return null
  }
}

function setCached(rate: ExchangeRate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rate))
  } catch { /* quota */ }
}

export async function fetchEurUsdRate(): Promise<ExchangeRate> {
  const cached = getCached()
  if (cached && cached.date === todayKey()) return cached

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD')
    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`)
    const data = await res.json()
    const rate: ExchangeRate = { rate: data.rates.USD, date: data.date }
    setCached(rate)
    return rate
  } catch {
    if (cached) return cached
    return { rate: FALLBACK_EUR_USD_RATE, date: todayKey() }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/exchangeRateService.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/services/exchangeRateService.ts src/services/exchangeRateService.test.ts
git commit -m "feat(moneda): agrega servicio de tipo de cambio EUR/USD con cache diario"
```

---

### Task 2: `CurrencyContext` + provider mount + type cleanup

**Files:**
- Create: `src/context/CurrencyContext.tsx`
- Modify: `src/main.tsx`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `fetchEurUsdRate`, `FALLBACK_EUR_USD_RATE`, `ExchangeRate` (Task 1).
- Produces: `export type Currency = 'USD' | 'EUR'`, `export function CurrencyProvider({ children }: { children: ReactNode })`, `export function useCurrency(): { currency: Currency; setCurrency: (c: Currency) => void; rate: number; rateDate: string | null }`. Every later task that formats a money value imports `useCurrency` and the currency-aware formatter from Task 3.

- [ ] **Step 1: Create `CurrencyContext.tsx`**

Create `src/context/CurrencyContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchEurUsdRate, FALLBACK_EUR_USD_RATE } from '@/services/exchangeRateService'

export type Currency = 'USD' | 'EUR'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (c: Currency) => void
  rate: number // 1 EUR = `rate` USD
  rateDate: string | null
}

const CurrencyContext = createContext<CurrencyContextType | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => {
    const stored = localStorage.getItem('gg-currency')
    return (stored === 'USD' || stored === 'EUR') ? stored : 'USD'
  })
  const [rate, setRate] = useState(FALLBACK_EUR_USD_RATE)
  const [rateDate, setRateDate] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem('gg-currency', currency)
  }, [currency])

  useEffect(() => {
    let active = true
    fetchEurUsdRate().then(result => {
      if (!active) return
      setRate(result.rate)
      setRateDate(result.date)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, rateDate }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
```

- [ ] **Step 2: Mount `CurrencyProvider` in `main.tsx`**

In `src/main.tsx`, add the import after the `ThemeProvider` import:

```ts
import { CurrencyProvider } from './context/CurrencyContext.tsx'
```

Nest `<CurrencyProvider>` directly inside `<ThemeProvider>`, replacing:

```tsx
      <ThemeProvider>
        <AuthProvider>
```

with:

```tsx
      <ThemeProvider>
        <CurrencyProvider>
        <AuthProvider>
```

and replacing the corresponding closing tags:

```tsx
        </AuthProvider>
      </ThemeProvider>
```

with:

```tsx
        </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
```

(Indentation inside the new provider doesn't need to be perfectly re-flowed for every nested line — the file just needs to stay valid JSX and readable; run a formatter if the project has one configured, otherwise leave the inner indentation as-is.)

- [ ] **Step 3: Remove `marketValueFormatted` from the type definitions**

In `src/types/index.ts`:

Remove line 66 from `MonitoringPlayer` (`marketValueFormatted?: string`) — the interface keeps `marketValueRaw?: number` (line 65) unchanged.

Remove line 198 from `EnrichedPlayer` (`marketValueFormatted: string`) — the interface keeps `marketValueRaw: number` (line 199) unchanged.

This will make the project fail to typecheck everywhere `marketValueFormatted` is still referenced — that is intentional and expected until Tasks 5-9 remove/replace every remaining reference. Do NOT try to fix those other files in this task; that's the rest of this plan.

- [ ] **Step 4: Confirm the expected typecheck failures**

Run: `npx tsc --noEmit -p . 2>&1 | grep -c marketValueFormatted`
Expected: a non-zero count of errors, all mentioning `marketValueFormatted` — this is the compiler enumerating every remaining call site for you, confirming Step 3 took effect. Do not proceed past this task with a clean `tsc` — that would mean the field removal didn't happen.

- [ ] **Step 5: Commit**

```bash
git add src/context/CurrencyContext.tsx src/main.tsx src/types/index.ts
git commit -m "feat(moneda): agrega CurrencyContext y elimina marketValueFormatted del tipo"
```

Note: the repo's typecheck will stay red until Task 9 completes — that's expected mid-plan. Every later task's own Step "Run tests to verify they pass" scopes `tsc` output to files it just touched where noted, and Task 10 does the final whole-repo verification.

---

### Task 3: Currency-aware central formatter

**Files:**
- Modify: `src/utils/scoring.ts`
- Modify: `src/utils/scoring.test.ts` (create if it doesn't exist — check first with `Glob src/utils/scoring.test.ts`; if it exists, add to it, don't replace it)

**Interfaces:**
- Consumes: `Currency` type (Task 2).
- Produces: `export function formatMarketValueInCurrency(valueEUR: number, currency: Currency, rate: number): string`. Tasks 6-9 import this for every currency-facing display.

- [ ] **Step 1: Write the failing tests**

Check whether `src/utils/scoring.test.ts` already exists. If it does, add the new `describe` block to the end of it, keeping the existing content and its imports untouched (just add `formatMarketValueInCurrency` to the existing import line from `./scoring`). If it doesn't exist, create it with just this block:

```ts
import { describe, it, expect } from 'vitest'
import { formatMarketValueInCurrency } from './scoring'

describe('formatMarketValueInCurrency', () => {
  it('formatea en EUR sin convertir', () => {
    expect(formatMarketValueInCurrency(600_000, 'EUR', 1.08)).toBe('€600K')
    expect(formatMarketValueInCurrency(12_000_000, 'EUR', 1.08)).toBe('€12.0M')
  })

  it('convierte a USD multiplicando por la tasa', () => {
    expect(formatMarketValueInCurrency(1_000_000, 'USD', 1.08)).toBe('$1.1M')
    expect(formatMarketValueInCurrency(500_000, 'USD', 1.08)).toBe('$540K')
  })

  it('devuelve "-" para 0 o vacío en cualquier moneda', () => {
    expect(formatMarketValueInCurrency(0, 'USD', 1.08)).toBe('-')
    expect(formatMarketValueInCurrency(0, 'EUR', 1.08)).toBe('-')
  })

  it('redondea K sin decimales y M con 1 decimal, igual que el formateador EUR existente', () => {
    expect(formatMarketValueInCurrency(750_000, 'EUR', 1.08)).toBe('€750K')
    expect(formatMarketValueInCurrency(2_800_000, 'EUR', 1.08)).toBe('€2.8M')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/scoring.test.ts`
Expected: FAIL — `formatMarketValueInCurrency` is not exported from `./scoring`.

- [ ] **Step 3: Implement in `scoring.ts`**

Add this new function to `src/utils/scoring.ts`, right after the existing `formatMarketValue` function (after its closing `}` at line 46). Add the `Currency` type import to the top of the file, in the existing import line — change:

```ts
import { POSITION_MAP } from '@/constants/scoring'
import type { RawExternalPlayer, RawInternalPlayer, EnrichedPlayer } from '@/types'
```

to:

```ts
import { POSITION_MAP } from '@/constants/scoring'
import type { RawExternalPlayer, RawInternalPlayer, EnrichedPlayer } from '@/types'
import type { Currency } from '@/context/CurrencyContext'
```

Then add the new function:

```ts
const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€' }

export function formatMarketValueInCurrency(valueEUR: number, currency: Currency, rate: number): string {
  if (!valueEUR || valueEUR === 0) return '-'
  const value = currency === 'USD' ? valueEUR * rate : valueEUR
  const symbol = CURRENCY_SYMBOL[currency]
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${symbol}${Math.round(value / 1_000)}K`
  return `${symbol}${Math.round(value)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/scoring.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Typecheck the touched files**

Run: `npx tsc --noEmit -p . 2>&1 | grep "src/utils/scoring.ts"`
Expected: no output (no errors in this specific file — the rest of the repo is still expected to show `marketValueFormatted` errors per Task 2, ignore those here)

- [ ] **Step 6: Commit**

```bash
git add src/utils/scoring.ts src/utils/scoring.test.ts
git commit -m "feat(moneda): agrega formatMarketValueInCurrency, formateador central con conversion"
```

---

### Task 4: `CurrencyToggle` UI + Navbar wiring

**Files:**
- Create: `src/components/layout/CurrencyToggle.tsx`
- Modify: `src/components/layout/Navbar.tsx`

**Interfaces:**
- Consumes: `useCurrency` (Task 2).
- Produces: `export default function CurrencyToggle()` — no props, mounted once in `Navbar.tsx`.

- [ ] **Step 1: Create `CurrencyToggle.tsx`**

Create `src/components/layout/CurrencyToggle.tsx`, mirroring `ThemeToggle.tsx`'s exact button styling:

```tsx
import { useCurrency } from '@/context/CurrencyContext'

export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()

  return (
    <button
      onClick={() => setCurrency(currency === 'USD' ? 'EUR' : 'USD')}
      aria-label={currency === 'USD' ? 'Cambiar a euros' : 'Cambiar a dólares'}
      className="relative p-2 rounded-lg bg-apple-gray-100 dark:bg-apple-gray-800 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 transition-all duration-200 ease-apple group"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <span className="text-sm font-bold text-apple-gray-600 dark:text-apple-gray-300 group-hover:text-apple-gray-800 dark:group-hover:text-white transition-colors duration-200 ease-apple">
          {currency === 'USD' ? '$' : '€'}
        </span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Wire into `Navbar.tsx`**

Add the import after the `ThemeToggle` import (line 5):

```ts
import CurrencyToggle from './CurrencyToggle'
```

Replace:

```tsx
          <div className="flex items-center gap-2">
            <PDFBuilderFloatingButton />
            <ThemeToggle />
```

with:

```tsx
          <div className="flex items-center gap-2">
            <PDFBuilderFloatingButton />
            <CurrencyToggle />
            <ThemeToggle />
```

- [ ] **Step 3: Typecheck the touched files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "CurrencyToggle|Navbar.tsx"`
Expected: no output

- [ ] **Step 4: Manual browser verification**

Run the dev server (`npm run dev`), confirm the new `$`/`€` button renders next to the moon/sun icon in the navbar, click it to confirm it toggles the symbol, reload the page to confirm the choice persisted, and check the mobile/tablet layout (resize the browser or use device toolbar) to confirm the button doesn't break the existing responsive header.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/CurrencyToggle.tsx src/components/layout/Navbar.tsx
git commit -m "feat(moneda): agrega boton de moneda junto al de tema en el navbar"
```

---

### Task 5: Remove `marketValueFormatted` generation in `DataContext.tsx` and `scoring.ts`

**Files:**
- Modify: `src/context/DataContext.tsx`
- Modify: `src/utils/scoring.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task only deletes now-invalid assignments to a field that no longer exists on the type (removed in Task 2).

- [ ] **Step 1: Remove the assignment in `scoring.ts`'s `enrichPlayer`**

In `src/utils/scoring.ts`, remove line 135 (`marketValueFormatted: formatMarketValue(marketValueRaw),`) from the object returned by `enrichPlayer`, keeping line 136 (`marketValueRaw,`) as-is.

- [ ] **Step 2: Remove the 9 assignments in `DataContext.tsx`**

In `src/context/DataContext.tsx`, remove each of these lines (only the `marketValueFormatted` line — keep every surrounding line unchanged):

1. Line 58, inside `agencyToEnriched`: remove `marketValueFormatted: formatMarketValue(marketValueRaw),` (keep the `marketValueRaw,` line right after it).
2. Line 236, inside `enrichInternalWithTransfermarktLink`: remove `enriched.marketValueFormatted = formatMarketValue(marketValueRaw)`.
3. Line 296, inside `enrichWithMasDatos`: remove `enriched.marketValueFormatted = formatMarketValue(marketValueRaw)`.
4. Line 481, inside `enrichWithEstimatedValue`: remove `marketValueFormatted: formatMarketValue(estimatedValue),` — but KEEP line 479 (`'Valor de mercado (Transfermarkt)': formatMarketValue(estimatedValue),`) unchanged, that's the legacy EUR-only string field, not the removed one.
5. Lines 508 and 529, inside `enrichWithTransfermarkt`: remove the `const marketValueFormatted = formatMarketValue(marketValueRaw)` declaration (line 508) and the `marketValueFormatted,` line in the returned object (line 529).
6. Lines 796, 813, 842, and 870, inside `linkMonitoringToMetrics`: remove `marketValueFormatted: existingPlayer.marketValueFormatted,` (line 796), remove `let marketValueFormatted = formatMarketValue(marketValueRaw)` (line 813 — change `let marketValueRaw = ...` on the line above it to stay a `let` since it's still reassigned later, just drop the `marketValueFormatted` declaration), remove `marketValueFormatted = formatMarketValue(tmValue)` (line 842, inside the `if (tmValue > 0)` block — leave `marketValueRaw = tmValue` on the line above it untouched), and remove `marketValueFormatted,` from the final returned object (line 870).
7. Line 1043, inside `scoreSeguimientoPlayer`: remove `marketValueFormatted: formatMarketValue(marketValueRaw),`.

After these removals, check whether `formatMarketValue` (the import from `scoring.ts`, line 3) is still used anywhere else in `DataContext.tsx` (it should still be used at line 479 for the legacy `'Valor de mercado (Transfermarkt)'` field) — if some other now-unused import surfaces, remove it, but `formatMarketValue` itself should stay imported.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "DataContext.tsx|scoring.ts"`
Expected: no output for these two files specifically (other files still show `marketValueFormatted` errors until later tasks — that's expected).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all existing tests still pass (this task only removes dead-field assignments, it doesn't change any behavior the existing test suite covers — if any test fails, it means a test was asserting on `marketValueFormatted` directly, which needs updating to match the field's removal, not a sign this task's logic is wrong).

- [ ] **Step 5: Commit**

```bash
git add src/context/DataContext.tsx src/utils/scoring.ts
git commit -m "refactor(moneda): elimina generacion de marketValueFormatted en DataContext"
```

---

### Task 6: Migrate Group A, batch 1 — `DashboardPage.tsx`, `OpportunitiesPage.tsx`, `BusquedaPage.tsx`

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/OpportunitiesPage.tsx`
- Modify: `src/pages/BusquedaPage.tsx`

**Interfaces:**
- Consumes: `useCurrency` (Task 2), `formatMarketValueInCurrency` (Task 3).

- [ ] **Step 1: `DashboardPage.tsx`**

Add the import near the other imports (after the `LoadingSpinner` import area, alongside other `@/` imports already present):

```ts
import { useCurrency } from '@/context/CurrencyContext'
import { formatMarketValueInCurrency } from '@/utils/scoring'
```

Remove the local function (lines 20-25):

```ts
// Helper to format currency
function formatValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`
  return `€${value}`
}
```

Inside the `DashboardPage` component function, add near its other hook calls (alongside `useData()`/`useNavigate()` etc.):

```ts
const { currency, rate } = useCurrency()
```

Replace both call sites:

```ts
                  <p className="text-2xl font-bold text-apple-gray-800 dark:text-white tabular-nums">{formatValue(displayTotal)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-apple-gray-500 dark:text-apple-gray-400">Prom: {formatValue(kpis.totalPlayers > 0 ? displayTotal / kpis.totalPlayers : 0)}</span>
```

with:

```ts
                  <p className="text-2xl font-bold text-apple-gray-800 dark:text-white tabular-nums">{formatMarketValueInCurrency(displayTotal, currency, rate)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-apple-gray-500 dark:text-apple-gray-400">Prom: {formatMarketValueInCurrency(kpis.totalPlayers > 0 ? displayTotal / kpis.totalPlayers : 0, currency, rate)}</span>
```

Also check this file for any other bare `formatValue(` calls beyond these two lines (the earlier exploration only found these two, but re-grep `formatValue(` in this file to be sure before removing the function definition — if there's a third call site not listed here, update it the same way).

- [ ] **Step 2: `OpportunitiesPage.tsx`**

Add the same two imports as Step 1.

Remove the local function (lines 28-32):

```ts
function formatValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`
  return `€${value}`
}
```

Inside the component function, add: `const { currency, rate } = useCurrency()`.

Replace:

```ts
                      {p.market_value_eur ? formatValue(p.market_value_eur) : '—'}
```

with:

```ts
                      {p.market_value_eur ? formatMarketValueInCurrency(p.market_value_eur, currency, rate) : '—'}
```

Re-grep `formatValue(` in this file first to confirm there's only the one call site before deleting the function — update any additional ones found the same way.

- [ ] **Step 3: `BusquedaPage.tsx`**

Add the same two imports as Step 1 (adjust the relative import path style to match this file's existing import conventions — check the top of the file first).

In the `playerToEnriched` function, remove the local `mvFormatted` computation:

```ts
  const mv = p.market_value_eur
  const mvFormatted = mv == null ? '—'
    : mv >= 1_000_000 ? `€${(mv / 1_000_000).toFixed(mv % 1_000_000 === 0 ? 0 : 1)}M`
    : mv >= 1_000 ? `€${(mv / 1_000).toFixed(0)}K`
    : `€${mv}`
```

replacing it with just:

```ts
  const mv = p.market_value_eur
```

Then find where `mvFormatted` was used in the returned object (two spots — one for `'Valor de mercado (Transfermarkt)'`, one for `marketValueFormatted`):
- The `marketValueFormatted: mvFormatted,` line: delete it entirely (the field no longer exists on `EnrichedPlayer` since Task 2).
- The `'Valor de mercado (Transfermarkt)': mvFormatted,` line: this field IS still part of `EnrichedPlayer` (it's the legacy Transfermarkt-sourced string, untouched by this plan) — replace `mvFormatted` there with a call to the existing EUR-only `formatMarketValue` (already used elsewhere in the codebase for this exact field, e.g. `DataContext.tsx`'s `enrichWithEstimatedValue`): `'Valor de mercado (Transfermarkt)': mv == null ? '—' : formatMarketValue(mv),`. Add `formatMarketValue` to this file's import from `@/utils/scoring` alongside the two new imports from Step 1's pattern.

`playerToEnriched` itself doesn't have access to `useCurrency()` (it's a plain function, not inside component render) — this task doesn't need it there, since we removed the `marketValueFormatted` field entirely from this function's output. `PlayerTable.tsx` (Task 9) will format `marketValueRaw` live wherever this data ends up rendered — confirm after Task 9 that any component in `BusquedaPage.tsx`'s own render tree that shows this player's value does so via `marketValueRaw` + `useCurrency()`, not by reading a field this function no longer produces.

- [ ] **Step 4: Typecheck the three touched files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "DashboardPage.tsx|OpportunitiesPage.tsx|BusquedaPage.tsx"`
Expected: no output

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Manual browser check**

Run the dev server, open Panel Interno (portfolio total should show `$` by default), Oportunidades, and Búsqueda — confirm market values render correctly, and toggling the currency button changes them live on all three pages.

- [ ] **Step 7: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/OpportunitiesPage.tsx src/pages/BusquedaPage.tsx
git commit -m "feat(moneda): migra DashboardPage, OpportunitiesPage y BusquedaPage al formateador central"
```

---

### Task 7: Migrate Group A, batch 2 — `ExternalScoutingPage.tsx`, `ComparisonPage.tsx`, `SupabasePlayerDetail.tsx`

**Files:**
- Modify: `src/pages/ExternalScoutingPage.tsx`
- Modify: `src/pages/ComparisonPage.tsx`
- Modify: `src/components/players/SupabasePlayerDetail.tsx`

**Interfaces:**
- Consumes: `useCurrency` (Task 2), `formatMarketValueInCurrency` (Task 3).

- [ ] **Step 1: `ExternalScoutingPage.tsx`**

Add the same two imports as Task 6 Step 1.

Remove the local function (lines 59-63):

```ts
function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}
```

Inside the component, add: `const { currency, rate } = useCurrency()`.

Replace all 3 call sites. This local `formatValue` did NOT include the `€` symbol — callers added it manually — so replacing it with `formatMarketValueInCurrency` (which DOES include the symbol) means removing the manually-added `€` at each call site too:

```ts
              {filters.min_market_value > 0 || filters.max_market_value < 50_000_000
                ? `€${formatValue(filters.min_market_value)} – €${formatValue(filters.max_market_value)}`
                : 'Todos'}
```

becomes (both occurrences — this exact block appears twice, lines ~446-448 and ~725-727):

```ts
              {filters.min_market_value > 0 || filters.max_market_value < 50_000_000
                ? `${formatMarketValueInCurrency(filters.min_market_value, currency, rate)} – ${formatMarketValueInCurrency(filters.max_market_value, currency, rate)}`
                : 'Todos'}
```

and:

```ts
                        <td className="py-2.5 px-3 text-right text-sm text-apple-gray-600 dark:text-apple-gray-300 tabular-nums">
                          {player.market_value_eur
                            ? `€${formatValue(player.market_value_eur)}`
                            : '—'}
                        </td>
```

becomes:

```ts
                        <td className="py-2.5 px-3 text-right text-sm text-apple-gray-600 dark:text-apple-gray-300 tabular-nums">
                          {player.market_value_eur
                            ? formatMarketValueInCurrency(player.market_value_eur, currency, rate)
                            : '—'}
                        </td>
```

- [ ] **Step 2: `ComparisonPage.tsx`**

Add the same two imports.

Remove the local function (lines 36-41):

```ts
function formatMarketValue(mv: number | null): string {
  if (mv == null) return '—'
  if (mv >= 1_000_000) return `€${(mv / 1_000_000).toFixed(mv % 1_000_000 === 0 ? 0 : 1)}M`
  if (mv >= 1_000) return `€${(mv / 1_000).toFixed(0)}K`
  return `€${mv}`
}
```

Inside the component, add: `const { currency, rate } = useCurrency()`.

Replace the call site (around line 347):

```tsx
        <QuickSummaryCard
          label="Valor de Mercado"
          players={players}
          getValue={p => p.market_value_eur ?? null}
          formatValue={v => formatMarketValue(v)}
          higherIsBetter={false}
          winnerLabel="Más económico"
```

with:

```tsx
        <QuickSummaryCard
          label="Valor de Mercado"
          players={players}
          getValue={p => p.market_value_eur ?? null}
          formatValue={v => v == null ? '—' : formatMarketValueInCurrency(v, currency, rate)}
          higherIsBetter={false}
          winnerLabel="Más económico"
```

- [ ] **Step 3: `SupabasePlayerDetail.tsx`**

Add the same two imports.

Remove the local function (lines 30-37):

```ts
function formatMarketValue(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}
```

Inside the component, add: `const { currency, rate } = useCurrency()`.

Replace both call sites (lines 190 and 194 — this local function did not include the `€`, the JSX added it manually):

```tsx
                        <a
                          href={player.transfermarkt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-brand-green hover:underline"
                        >
                          €{formatMarketValue(player.market_value_eur)}
                        </a>
                      ) : (
                        <span className="text-sm font-bold text-brand-green">
                          €{formatMarketValue(player.market_value_eur)}
                        </span>
                      )}
```

with:

```tsx
                        <a
                          href={player.transfermarkt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-brand-green hover:underline"
                        >
                          {formatMarketValueInCurrency(player.market_value_eur, currency, rate)}
                        </a>
                      ) : (
                        <span className="text-sm font-bold text-brand-green">
                          {formatMarketValueInCurrency(player.market_value_eur, currency, rate)}
                        </span>
                      )}
```

- [ ] **Step 4: Typecheck the three touched files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "ExternalScoutingPage.tsx|ComparisonPage.tsx|SupabasePlayerDetail.tsx"`
Expected: no output

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Manual browser check**

Open Scouting Externo (filter bounds display and table "Valor" column), Comparación (Valor de Mercado card), and a player's ficha with `source=externo` (SupabasePlayerDetail) — confirm values render and react to the currency toggle.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ExternalScoutingPage.tsx src/pages/ComparisonPage.tsx src/components/players/SupabasePlayerDetail.tsx
git commit -m "feat(moneda): migra ExternalScoutingPage, ComparisonPage y SupabasePlayerDetail"
```

---

### Task 8: Migrate Group A, batch 3 — chart components and filter sidebar

**Files:**
- Modify: `src/components/charts/PortfolioValueChart.tsx`
- Modify: `src/components/charts/MarketValueChart.tsx`
- Modify: `src/components/filters/FilterSidebar.tsx`

**Interfaces:**
- Consumes: `useCurrency` (Task 2), `formatMarketValueInCurrency` (Task 3).

- [ ] **Step 1: `PortfolioValueChart.tsx`**

Add the same two imports as prior tasks.

Replace the two local functions (lines 14-25):

```ts
function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return `${value}`
}

function formatFullValue(value: number): string {
  if (value >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(2)} millones`
  }
  return `€${value.toLocaleString('es-AR')}`
}
```

with currency-aware versions that take `currency`/`rate` as parameters (this file is a component, so read them from `useCurrency()` at the top of the component body and pass them down to these two functions at each call site — or, simpler and consistent with how the file already calls `formatValue`/`formatFullValue` in many places per the exploration notes, convert both into small wrapper closures defined INSIDE the component body, capturing `currency`/`rate` from the surrounding scope so every existing call site (`CustomTooltip`, header, axes, top gainers/losers — lines 60, 76, 327, 350, 408, 460-461, 497-498, 528 per the exploration) keeps working unchanged, just now currency-aware:

```ts
function formatValue(value: number, currency: Currency, rate: number): string {
  const converted = currency === 'USD' ? value * rate : value
  if (converted >= 1_000_000) return `${(converted / 1_000_000).toFixed(1)}M`
  if (converted >= 1_000) return `${Math.round(converted / 1_000)}K`
  return `${Math.round(converted)}`
}

function formatFullValue(value: number, currency: Currency, rate: number): string {
  const converted = currency === 'USD' ? value * rate : value
  const symbol = currency === 'USD' ? '$' : '€'
  if (converted >= 1_000_000) {
    return `${symbol}${(converted / 1_000_000).toFixed(2)} millones`
  }
  return `${symbol}${converted.toLocaleString('es-AR')}`
}
```

Keep these as standalone functions outside the component (not inside it) — same placement as today, just with the two new parameters. Add `import type { Currency } from '@/context/CurrencyContext'` alongside the other type imports at the top.

Inside the `PortfolioValueChart` component function, add: `const { currency, rate } = useCurrency()`.

Update every call site of `formatValue(x)` to `formatValue(x, currency, rate)`, and every call site of `formatFullValue(x)` to `formatFullValue(x, currency, rate)` — re-grep both function names in this file to find all of them (the exploration counted call sites at lines 60, 76, 327, 350, 408, 460-461, 497-498, 528, but grep to confirm you caught every one, including inside Recharts `tickFormatter`/tooltip prop callbacks where the function might be passed as a reference rather than called directly — those need to become an inline arrow `v => formatValue(v, currency, rate)` instead of a bare function reference).

- [ ] **Step 2: `MarketValueChart.tsx`**

Same pattern as Step 1. Replace the two local functions (lines 13-32):

```ts
function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`
  }
  return `${value}`
}

function formatFullValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `€${millions.toFixed(millions >= 10 ? 0 : 1)} millones`
  }
  if (value >= 1_000) {
    return `€${Math.round(value / 1_000).toLocaleString('es-AR')} mil`
  }
  return `€${value.toLocaleString('es-AR')}`
}
```

with:

```ts
function formatValue(value: number, currency: Currency, rate: number): string {
  const converted = currency === 'USD' ? value * rate : value
  if (converted >= 1_000_000) return `${(converted / 1_000_000).toFixed(1)}M`
  if (converted >= 1_000) return `${Math.round(converted / 1_000)}K`
  return `${Math.round(converted)}`
}

function formatFullValue(value: number, currency: Currency, rate: number): string {
  const converted = currency === 'USD' ? value * rate : value
  const symbol = currency === 'USD' ? '$' : '€'
  if (converted >= 1_000_000) {
    const millions = converted / 1_000_000
    return `${symbol}${millions.toFixed(millions >= 10 ? 0 : 1)} millones`
  }
  if (converted >= 1_000) {
    return `${symbol}${Math.round(converted / 1_000).toLocaleString('es-AR')} mil`
  }
  return `${symbol}${converted.toLocaleString('es-AR')}`
}
```

Add the same `Currency` type import. Inside the `MarketValueChart` component, add `const { currency, rate } = useCurrency()`. Update every call site (tooltip line 76, stats cards 168/177, Y axis 240, legend 283, and any others found by grepping both function names) to pass `currency, rate`.

- [ ] **Step 3: `FilterSidebar.tsx`**

Add the same two imports.

Replace the local function (lines 106-110):

```ts
function formatMV(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `€${Math.round(v / 1_000)}K`
  return v === 0 ? 'Todos' : `€${v}`
}
```

with a version that preserves the `v === 0 → 'Todos'` special case (not present in the central formatter, which returns `-` for falsy values, not `'Todos'` — keep this file's own special-casing on top of the shared conversion logic):

```ts
function formatMV(v: number, currency: Currency, rate: number): string {
  if (v === 0) return 'Todos'
  return formatMarketValueInCurrency(v, currency, rate)
}
```

Add `import type { Currency } from '@/context/CurrencyContext'` alongside the file's other type imports.

Inside the `FilterSidebar` component, add: `const { currency, rate } = useCurrency()`.

Update the two `SliderInput` call sites (lines 484-501):

```tsx
              <SliderInput
                label="Mínimo"
                value={filters.minMarketValue}
                min={0}
                max={maxMarketValue}
                step={250_000}
                onChange={v => update('minMarketValue', v)}
                formatFn={formatMV}
              />
              <SliderInput
                label="Máximo"
                value={filters.maxMarketValue || maxMarketValue}
                min={0}
                max={maxMarketValue}
                step={250_000}
                onChange={v => update('maxMarketValue', v)}
                formatFn={v => v === 0 || v >= maxMarketValue ? 'Sin máx' : formatMV(v)}
              />
```

with:

```tsx
              <SliderInput
                label="Mínimo"
                value={filters.minMarketValue}
                min={0}
                max={maxMarketValue}
                step={250_000}
                onChange={v => update('minMarketValue', v)}
                formatFn={v => formatMV(v, currency, rate)}
              />
              <SliderInput
                label="Máximo"
                value={filters.maxMarketValue || maxMarketValue}
                min={0}
                max={maxMarketValue}
                step={250_000}
                onChange={v => update('maxMarketValue', v)}
                formatFn={v => v === 0 || v >= maxMarketValue ? 'Sin máx' : formatMV(v, currency, rate)}
              />
```

- [ ] **Step 4: Typecheck the three touched files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "PortfolioValueChart.tsx|MarketValueChart.tsx|FilterSidebar.tsx"`
Expected: no output

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Manual browser check**

Open Panel Interno's portfolio evolution chart, a player ficha's market value evolution chart, and the filters sidebar's "Valor mercado" range slider — confirm all three render correctly and react live to the currency toggle.

- [ ] **Step 7: Commit**

```bash
git add src/components/charts/PortfolioValueChart.tsx src/components/charts/MarketValueChart.tsx src/components/filters/FilterSidebar.tsx
git commit -m "feat(moneda): migra graficos de valor y filtro de rango al formateador central"
```

---

### Task 9: Migrate Group B — direct `marketValueFormatted` consumers

**Files:**
- Modify: `src/pages/PlayerDetailPage.tsx`
- Modify: `src/components/players/PlayerTable.tsx`
- Modify: `src/components/pdf/InformeCanvaCard.tsx`
- Modify: `src/utils/pdfExport.ts`

**Interfaces:**
- Consumes: `useCurrency` (Task 2), `formatMarketValueInCurrency` (Task 3).

- [ ] **Step 1: `PlayerDetailPage.tsx`**

Add the same two imports as prior tasks. Inside the main page component, add: `const { currency, rate } = useCurrency()`.

Replace all 3 call sites (lines 1661, 1709, 1979 — re-grep `marketValueFormatted` in this file first to confirm there are exactly 3 and none were missed):

```tsx
                          {player.marketValueFormatted || '—'}
```
→
```tsx
                          {formatMarketValueInCurrency(player.marketValueRaw, currency, rate)}
```
(for the two occurrences at the old lines 1661 and 1979 — `formatMarketValueInCurrency` already returns `'-'` for a zero/falsy raw value, so the `|| '—'` fallback becomes redundant; keep the em-dash style consistent with the rest of this file if you prefer — either `'-'` from the formatter or wrap with `|| '—'` for visual consistency with surrounding dashes, your call, just be consistent across all 3 sites in this file)

```tsx
                      <InfoRow label="Valor de mercado" value={player.marketValueFormatted} />
```
→
```tsx
                      <InfoRow label="Valor de mercado" value={formatMarketValueInCurrency(player.marketValueRaw, currency, rate)} />
```

- [ ] **Step 2: `PlayerTable.tsx`**

Add the same two imports. Inside the `PlayerTable` component, add: `const { currency, rate } = useCurrency()`.

Replace both call sites (lines 246 and 354 — re-grep to confirm none were missed):

```tsx
                <span className="ml-auto text-xs font-medium text-brand-green">{player.marketValueFormatted}</span>
```
→
```tsx
                <span className="ml-auto text-xs font-medium text-brand-green">{formatMarketValueInCurrency(player.marketValueRaw, currency, rate)}</span>
```

```tsx
                  <td className="px-3 py-3 text-right hidden sm:table-cell">
                    <span className="text-apple-gray-600 dark:text-apple-gray-300 text-xs font-medium tabular-nums">
                      {player.marketValueFormatted}
                    </span>
                  </td>
```
→
```tsx
                  <td className="px-3 py-3 text-right hidden sm:table-cell">
                    <span className="text-apple-gray-600 dark:text-apple-gray-300 text-xs font-medium tabular-nums">
                      {formatMarketValueInCurrency(player.marketValueRaw, currency, rate)}
                    </span>
                  </td>
```

The `key: 'marketValueRaw'` in `BASE_COLUMNS`/`BASE_COLUMNS_INTERNAL` (lines 52, 61) stays unchanged — it already sorts by the raw numeric field, not the formatted string, so sorting behavior is unaffected by this migration.

- [ ] **Step 3: `InformeCanvaCard.tsx`**

Add the same two imports. Inside the `InformeCanvaCard` component, add: `const { currency, rate } = useCurrency()`.

Replace line 335:

```ts
  const mv = player.marketValueFormatted && player.marketValueFormatted !== '—' && player.marketValueFormatted !== '' ? player.marketValueFormatted : null
```
→
```ts
  const mvFormatted = formatMarketValueInCurrency(player.marketValueRaw, currency, rate)
  const mv = mvFormatted !== '-' ? mvFormatted : null
```

- [ ] **Step 4: `pdfExport.ts`**

This file is a plain class (`class PDF`), not a React component — it has no access to `useCurrency()`. It needs currency/rate passed in from its caller.

First, find the `FullExportData` interface (around lines 15-25) and add two new required fields to it: `currency: Currency` and `rate: number`. Add `import type { Currency } from '@/context/CurrencyContext'` to this file's imports (alongside the existing `import type { EnrichedPlayer, MarketValueHistoryEntry } from '@/types'` at line 3), and add `import { formatMarketValueInCurrency } from '@/constants/scoring'` — wait, `formatMarketValueInCurrency` lives in `@/utils/scoring`, not `@/constants/scoring` (this file already imports `POSITION_MAP, DISPLAY_METRICS, DISPLAY_POSITION_MAP` from `@/constants/scoring` at line 4 — that's a different module, don't confuse the two). Add a separate import line: `import { formatMarketValueInCurrency } from '@/utils/scoring'`.

Find the `contractInfo` method (line 515) and change its signature from:

```ts
  contractInfo(p: EnrichedPlayer) {
```

to:

```ts
  contractInfo(p: EnrichedPlayer, currency: Currency, rate: number) {
```

Replace line 528:

```ts
    this.doc.text(p.marketValueFormatted || '—', this.M + 6, this.y + 17)
```
→
```ts
    this.doc.text(formatMarketValueInCurrency(p.marketValueRaw, currency, rate), this.M + 6, this.y + 17)
```

Find every call site of `.contractInfo(` inside this file (the method is called from within the same `PDF` class, likely from the top-level `exportPlayerToPdfFull` function around line 628 — grep `.contractInfo(` in this file to find it/them) and update each call to pass the new `currency`/`rate` parameters, sourced from the `data: FullExportData` parameter the enclosing function already receives (e.g. `pdf.contractInfo(player, data.currency, data.rate)`).

Finally, update the call site in `PlayerDetailPage.tsx` (line 1055, inside whatever `onClick`/handler calls `exportPlayerToPdfFull({...})`) to include the two new required fields in the object literal, sourced from this same component's `useCurrency()` call already added in Step 1: `currency, rate,` (shorthand, since the variable names already match).

- [ ] **Step 5: Typecheck the four touched files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "PlayerDetailPage.tsx|PlayerTable.tsx|InformeCanvaCard.tsx|pdfExport.ts"`
Expected: no output

- [ ] **Step 6: Full typecheck — this should now be completely clean**

Run: `npx tsc --noEmit -p .`
Expected: NO errors anywhere in the repo. If anything still mentions `marketValueFormatted`, find it (`grep -rn "marketValueFormatted" src/`) and fix it the same way as the patterns in this plan — Tasks 5-9 were meant to cover every occurrence, but grep is the ground truth over this plan's enumeration.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 8: Manual browser check**

Open a player's ficha (`PlayerDetailPage`, both the top card and the info row), a Scouting Interno/Externo table (`PlayerTable`), export a player to PDF (confirm the value on the PDF matches the currently-selected currency), and export/preview an Informe Canva card — confirm all four surfaces show correct, currency-reactive values.

- [ ] **Step 9: Commit**

```bash
git add src/pages/PlayerDetailPage.tsx src/components/players/PlayerTable.tsx src/components/pdf/InformeCanvaCard.tsx src/utils/pdfExport.ts
git commit -m "feat(moneda): migra ficha de jugador, tabla, export PDF y tarjeta Canva"
```

---

### Task 10: Informes — autocompletar valor de mercado en la moneda activa

**Files:**
- Modify: `src/features/informes/components/Step1Archivo.tsx`

**Interfaces:**
- Consumes: `useCurrency` (Task 2), `formatMarketValueInCurrency` (Task 3).

- [ ] **Step 1: Update `selectDbPlayer`**

Add the same two imports as prior tasks. Inside the component that contains `selectDbPlayer` (check whether `selectDbPlayer` is defined inside the main component function or as a standalone helper — the exploration shows it starting at line 220 as what looks like a component-scope function, confirm this before editing), add `const { currency, rate } = useCurrency()` if it's not already accessible in scope, and replace:

```ts
    const mv = p.market_value_eur
    const mvFormatted = mv == null ? ''
      : mv >= 1_000_000 ? `€${(mv / 1_000_000).toFixed(mv % 1_000_000 === 0 ? 0 : 1)}M`
      : mv >= 1_000 ? `€${(mv / 1_000).toFixed(0)}K`
      : `€${mv}`
```

with:

```ts
    const mv = p.market_value_eur
    const mvFormatted = mv == null ? '' : formatMarketValueInCurrency(mv, currency, rate)
```

Leave the rest of the function (where `mvFormatted` is used to fill `content.valorMercado`, around line 252) untouched — it already does `valorMercado: mvFormatted || informe.content.valorMercado,`, which still works correctly with the new computation.

This makes the Informe's auto-filled market value match whatever currency the user has active at the moment they pick the player — it's still a one-time snapshot into free-text (per this plan's Global Constraints), just now correctly reflecting the current currency instead of always EUR.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "Step1Archivo.tsx"`
Expected: no output

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 4: Manual browser check**

Open the Informes wizard, switch currency to EUR, pick a player from the DB step, confirm the auto-filled "Valor de mercado" field shows `€`; switch currency to USD, pick a different player, confirm it shows `$`.

- [ ] **Step 5: Commit**

```bash
git add src/features/informes/components/Step1Archivo.tsx
git commit -m "feat(moneda): autocompleta valor de mercado en Informes segun moneda activa"
```

---

### Task 11: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new ones from Tasks 1 and 3.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors — this is the definitive confirmation that no `marketValueFormatted` reference survived anywhere in the repo.

- [ ] **Step 3: Grep sweep for anything missed**

Run: `grep -rn "marketValueFormatted" src/ ; grep -rn "'€'\|\"€\"" src/pages src/components/charts src/components/players src/components/filters src/utils/pdfExport.ts src/components/pdf 2>/dev/null`

The first grep should return nothing. The second grep surfaces any remaining hardcoded `€` literal in a currency-display context that this plan's tasks might not have caught (some hits will be legitimate non-currency uses or the still-EUR-only legacy `'Valor de mercado (Transfermarkt)'` field paths — use judgment, but investigate anything that looks like a market-value display still hardcoding the euro symbol).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Full manual browser pass**

Run the dev server, and for each of these pages: toggle currency from USD → EUR → USD, confirming every money value updates immediately without a page reload, and that a page reload after choosing EUR keeps showing EUR (persistence):
- Panel Interno (portfolio totals, evolution chart)
- Scouting Interno / Externo (table "Valor" column, filter sidebar range slider)
- Comparación (Valor de Mercado card)
- Oportunidades (undervalued list)
- Búsqueda de Talento (results table)
- A player's ficha, both `source=interno` and `source=externo` variants (top value card, info row, market value evolution chart)
- Export a player to PDF and confirm the value matches the active currency
- Informes wizard: pick a DB player, confirm the auto-filled value matches the active currency

- [ ] **Step 6: Commit if any fixes were needed**

If Step 3 or Step 5 surfaced any issue, fix it, re-run Steps 1-2, and commit with a message describing the fix. If everything passed cleanly, no commit is needed for this task.
