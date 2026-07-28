// supabase/functions/_shared/stats-normalize.test.ts

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { pctPasses } from './stats-normalize.ts';

Deno.test('pctPasses: convierte el conteo de API-Football a porcentaje', () => {
  // Caso real: Gonzalo González vs Tigre, 20 pases acertados de 28.
  // La fila de Sofascore del mismo partido guarda 71.43.
  assertEquals(pctPasses(28, '20'), 71.43);
});

Deno.test('pctPasses: conteos por encima de 100 probaban que no era porcentaje', () => {
  assertEquals(pctPasses(123, '107'), 86.99);
  assertEquals(pctPasses(110, '103'), 93.64);
});

Deno.test('pctPasses: nunca supera 100', () => {
  for (const [total, acc] of [[28, '20'], [123, '107'], [101, '96'], [50, '50']] as const) {
    const v = pctPasses(total, acc);
    assertEquals(v <= 100, true, `${total}/${acc} dio ${v}`);
  }
});

Deno.test('pctPasses: si la fuente manda mas acertados que totales, tope en 100', () => {
  assertEquals(pctPasses(28, '30'), 100);
});

Deno.test('pctPasses: sin pases devuelve 0 en vez de dividir por cero', () => {
  assertEquals(pctPasses(0, '0'), 0);
  assertEquals(pctPasses(null, '5'), 0);
  assertEquals(pctPasses(10, null), 0);
});
