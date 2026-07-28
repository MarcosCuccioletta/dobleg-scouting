// Normalización de estadísticas crudas, para que una misma columna signifique
// lo mismo venga de API-Football o de Sofascore.

/**
 * Porcentaje de acierto de pase.
 *
 * API-Football devuelve en `passes.accuracy` la **cantidad** de pases acertados,
 * no el porcentaje: hay partidos con 107 sobre 123 pases, que como porcentaje
 * sería imposible. Sofascore, en cambio, ya entrega porcentaje. Sin esta
 * normalización un lateral con 20 de 28 pases entra al scoring como si tuviera
 * 20% de acierto, y `passes_accuracy` pesa entre 10% y 14% del Score GG.
 *
 * Devuelve 0 cuando el jugador no dio pases.
 */
export function pctPasses(total: number | null, accurate: string | number | null): number {
  const t = total ?? 0;
  if (t <= 0) return 0;
  const a = typeof accurate === 'string' ? parseFloat(accurate) : accurate ?? 0;
  if (!Number.isFinite(a) || a <= 0) return 0;
  // Tope en 100: si la fuente manda más acertados que totales, es un dato roto y
  // un porcentaje imposible se propaga al scoring sin que nadie lo note.
  const pct = Math.min(100, (a / t) * 100);
  return Math.round(pct * 100) / 100;
}
