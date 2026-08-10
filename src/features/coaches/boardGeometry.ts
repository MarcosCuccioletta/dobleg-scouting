/** Satura un valor al rango [0, 100] -- coordenadas de la cancha son porcentajes. */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
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
