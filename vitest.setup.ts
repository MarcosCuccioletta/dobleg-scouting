import { it } from 'vitest'

/**
 * Puente para que los tests de las edge functions corran con `npm test`.
 *
 * Están escritos con `Deno.test` porque las functions son Deno, pero Deno no está
 * instalado: en los hechos nunca corrieron. Así fue como sobrevivió, entre otros,
 * el mapeo de columnas invertido en `position-mapper.ts`, que contradecía a sus
 * propios tests. Este shim los ejecuta como tests de vitest sin tocarlos, y sin
 * romperlos para Deno si algún día se instala.
 */
;(globalThis as unknown as { Deno?: unknown }).Deno ??= {
  test: (name: string, fn: () => void | Promise<void>) => it(name, fn),
}
