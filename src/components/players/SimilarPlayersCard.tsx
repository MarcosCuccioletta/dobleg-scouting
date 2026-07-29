import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayersList } from '@/hooks/usePlayerStats'
import { computeSimilarity } from '@/utils/similarity'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { getScoreColorClass } from '@/components/ui/ScoreBar'
import { displayPosition } from '@/types/scoring'
import type { PlayerSeasonScore, PlayerWithScore, Position } from '@/types/scoring'

interface Props {
  /** Jugador base: se excluye del ranking. */
  playerId: number
  playerName: string
  position: Position
  /** Fila de temporada del jugador en esa posición (de ahí salen sus métricas). */
  score: PlayerSeasonScore
  /** Cuántos mostrar. */
  limit?: number
}

/** Distancia (0 = idéntico) a un % legible, relativo al más lejano del top. */
function similarityPercent(distance: number, maxDistance: number): number {
  if (maxDistance <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((1 - distance / maxDistance) * 100)))
}

/**
 * Top de jugadores parecidos al de la ficha: misma posición y métricas de
 * rendimiento más cercanas. Usa el mismo cálculo que la página Similares, contra
 * toda la posición, para que los dos lugares digan lo mismo.
 */
export default function SimilarPlayersCard({
  playerId, playerName, position, score, limit = 3,
}: Props) {
  const navigate = useNavigate()

  const { players: pool, loading } = usePlayersList({
    positions: [position],
    pageSize: 1000,
    min_matches: 5,
  })

  const similar = useMemo(() => {
    if (pool.length === 0) return []
    const others = pool
      .filter(p => p.id !== playerId && p.season_scores.length > 0)
      .map(p => ({ player: p, score: p.season_scores[0] }))
    if (others.length === 0) return []
    return computeSimilarity(score, others, position).slice(0, limit)
  }, [pool, playerId, score, position, limit])

  // El 100% se reparte sobre el peor del top, no sobre el total: así el primero
  // siempre queda arriba y se ve la diferencia entre los tres.
  const worst = similar.length > 0 ? Math.max(...similar.map(s => s.distance), 0.001) : 1

  const goTo = (p: PlayerWithScore) =>
    navigate(`/jugador/${encodeURIComponent(p.name)}?source=externo&apiId=${p.id}`)

  return (
    <div className="card-apple p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h4 className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider">
          Jugadores similares
        </h4>
        <span className="text-2xs text-apple-gray-400 shrink-0">{displayPosition(position)}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-14 rounded-apple bg-apple-gray-100 dark:bg-apple-gray-700/40 animate-pulse" />
          ))}
        </div>
      ) : similar.length === 0 ? (
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
          No hay con quién comparar a {playerName} todavía: hacen falta más jugadores
          con datos en {displayPosition(position)}.
        </p>
      ) : (
        <div className="space-y-2">
          {similar.map(({ player, distance }) => {
            const pct = similarityPercent(distance, worst)
            const pScore = player.season_scores[0]?.avg_score ?? null
            return (
              <button
                key={player.id}
                onClick={() => goTo(player)}
                className="w-full flex items-center gap-3 p-2.5 rounded-apple border border-apple-gray-100 dark:border-apple-gray-700 hover:border-brand-green/60 hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700/30 transition-colors text-left"
              >
                <PlayerPhoto src={player.photo} name={player.name} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-apple-gray-800 dark:text-white truncate">
                    {player.name}
                  </div>
                  <div className="text-2xs text-apple-gray-500 dark:text-apple-gray-400 truncate">
                    {player.team?.name ?? 'Sin club'}
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-green" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-sm font-semibold tabular-nums ${pScore !== null ? getScoreColorClass(pScore) : 'text-apple-gray-400'}`}>
                    {pScore !== null ? pScore.toFixed(1) : '—'}
                  </div>
                  <div className="text-2xs text-apple-gray-400 tabular-nums">{pct}% símil</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
