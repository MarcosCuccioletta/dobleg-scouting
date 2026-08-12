/** Satura un valor al rango [0, 100] -- coordenadas de la cancha son porcentajes. */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export type PitchOrientation = 'vertical' | 'horizontal'

/**
 * Convierte un punto en coordenadas de datos (x: eje de ancho de formacion, y: eje de
 * ataque -- 100 pegado al arco propio, 0 pegado al arco rival, ver FORMATIONS) a
 * coordenadas de pantalla. En vertical no cambia nada. En horizontal rota 90° sin
 * espejar: el eje de ataque pasa a ser el horizontal de la pantalla (propio a la
 * derecha, rival a la izquierda), y el eje de ancho de formacion pasa al vertical.
 */
export function toScreenPoint(p: { x: number; y: number }, orientation: PitchOrientation): { x: number; y: number } {
  return orientation === 'vertical' ? p : { x: p.y, y: 100 - p.x }
}

/** Inversa exacta de toScreenPoint -- convierte una posicion tocada en pantalla a coordenadas de datos. */
export function fromScreenPoint(p: { x: number; y: number }, orientation: PitchOrientation): { x: number; y: number } {
  return orientation === 'vertical' ? p : { x: 100 - p.y, y: p.x }
}

/** Convierte una lista de puntos del lapiz a un `d` de SVG <path>. */
export function pointsToPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x} ${p.y} L ${p.x} ${p.y}`
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/** Los 2 puntos laterales de la cabeza de una flecha que va de (x1,y1) a (x2,y2). */
export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 3,
): { x: number; y: number }[] {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const spread = Math.PI / 7
  const left = { x: x2 - size * Math.cos(angle - spread), y: y2 - size * Math.sin(angle - spread) }
  const right = { x: x2 - size * Math.cos(angle + spread), y: y2 - size * Math.sin(angle + spread) }
  return [left, { x: x2, y: y2 }, right]
}
