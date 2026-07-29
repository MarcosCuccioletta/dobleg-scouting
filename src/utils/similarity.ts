import type { PlayerSeasonScore, PlayerWithScore, Position } from '@/types/scoring'
import { METRICS_BY_POSITION, getMetricValue, type ApiMetricKey } from '@/constants/apiMetrics'

/**
 * Distancia a porcentaje de similitud, en escala absoluta: cada métrica está
 * normalizada a [0,1], así que la distancia máxima posible entre dos jugadores es
 * √(cantidad de métricas). 100% = mismas métricas.
 *
 * No se normaliza contra los jugadores mostrados: hacerlo le daba 0% al último de
 * la lista aunque fuera el tercero más parecido entre cientos.
 */
export function similarityPercent(distance: number, metricCount: number): number {
  const max = Math.sqrt(Math.max(metricCount, 1))
  if (max === 0) return 100
  return Math.max(0, Math.min(100, Math.round((1 - distance / max) * 100)))
}

export function computeSimilarity(
  base: PlayerSeasonScore,
  others: { player: PlayerWithScore; score: PlayerSeasonScore }[],
  position: Position,
): { player: PlayerWithScore; distance: number; similarity: number }[] {
  const keys: ApiMetricKey[] = METRICS_BY_POSITION[position]
  const all = [base, ...others.map(o => o.score)]
  const ranges = keys.map(k => {
    const vals = all.map(s => getMetricValue(s, k)).filter((v): v is number => v !== null)
    const min = vals.length ? Math.min(...vals) : 0
    const max = vals.length ? Math.max(...vals) : 0
    return { k, min, span: (max - min) || 1 }
  })
  const vec = (s: PlayerSeasonScore) =>
    ranges.map(r => ((getMetricValue(s, r.k) ?? r.min) - r.min) / r.span)
  const b = vec(base)
  return others
    .map(o => {
      const v = vec(o.score)
      const distance = Math.sqrt(v.reduce((acc, x, i) => acc + (x - b[i]) ** 2, 0))
      return { player: o.player, distance, similarity: similarityPercent(distance, keys.length) }
    })
    .sort((a, z) => a.distance - z.distance)
}
