// Reemplazo local de `https://deno.land/std/assert/mod.ts` para que los tests de
// las edge functions puedan correr bajo vitest, que no resuelve imports por URL.
// El alias está en `vitest.config.ts`; en Deno se sigue usando el módulo real.
import { expect } from 'vitest'

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  expect(actual, msg).toEqual(expected)
}

export function assertAlmostEquals(
  actual: number,
  expected: number,
  tolerance = 1e-7,
  msg?: string,
): void {
  expect(Math.abs(actual - expected), msg ?? `${actual} ≉ ${expected}`).toBeLessThanOrEqual(tolerance)
}

export function assert(expr: unknown, msg?: string): void {
  expect(Boolean(expr), msg).toBe(true)
}

export function assertExists<T>(actual: T, msg?: string): void {
  expect(actual ?? null, msg).not.toBeNull()
}
