import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayersList } from '@/hooks/usePlayerStats'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import ScoreBar from '@/components/ui/ScoreBar'
import CopyChartButton from '@/components/ui/CopyChartButton'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { displayPosition } from '@/types/scoring'
import type { PlayerWithScore, Position } from '@/types/scoring'
import { computeSimilarity } from '@/utils/similarity'

const STORAGE_KEY = 'similar-players-state-v2'

export default function SimilarPlayersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithScore | null>(null)
  const [restored, setRestored] = useState(false)

  /**
   * La búsqueda va contra la base, no sobre una tanda ya cargada. Antes se traían
   * los 500 mejores por score y se filtraba en el navegador: cualquier jugador fuera
   * de ese top era imposible de encontrar (había 3.614 con 5+ partidos, y el 500º
   * ya estaba en 7.1 de score).
   */
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const { players: searchMatches, loading: loadingSearch, error: errorAll } = usePlayersList(
    debouncedSearch.length >= 2
      ? { search: debouncedSearch, pageSize: 10, min_matches: 5 }
      : { pageSize: 0 }
  )

  // Once a player is selected, load the pool for the same position
  const selectedPosition = selectedPlayer?.primary_position ?? null

  // El pool es TODA la posición: la más numerosa tiene ~740 jugadores. Con un tope
  // de 300 se comparaba sólo contra los de mejor score, y los parecidos reales de un
  // jugador de mitad de tabla quedaban afuera.
  const { players: poolPlayers, loading: loadingPool } = usePlayersList(
    selectedPosition
      ? { positions: [selectedPosition], pageSize: 1000, min_matches: 5 }
      : { pageSize: 0 }
  )

  // Restore state from sessionStorage on mount. Se guarda el jugador entero y no su
  // id: la búsqueda ya no trae una lista completa donde buscarlo.
  useEffect(() => {
    if (restored) return
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { searchText, player } = JSON.parse(saved)
        if (searchText) setSearch(searchText)
        if (player?.id) setSelectedPlayer(player as PlayerWithScore)
      }
    } catch {
      // Ignore
    }
    setRestored(true)
  }, [restored])

  // Save state to sessionStorage when it changes
  useEffect(() => {
    if (!restored) return
    const state = {
      searchText: search,
      player: selectedPlayer,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [search, selectedPlayer, restored])

  // Resultados del buscador: vienen de la base ya filtrados por nombre.
  const searchResults = search.trim().length >= 2 ? searchMatches : []

  // Compute similarity when base player and pool are ready
  const similarPlayers = useMemo(() => {
    if (!selectedPlayer || !selectedPosition) return []
    const baseScore = selectedPlayer.season_scores[0]
    if (!baseScore) return []

    const others = poolPlayers
      .filter(p => p.id !== selectedPlayer.id && p.season_scores.length > 0)
      .map(p => ({ player: p, score: p.season_scores[0] }))

    const ranked = computeSimilarity(baseScore, others, selectedPosition as Position)
    return ranked.slice(0, 10)
  }, [selectedPlayer, selectedPosition, poolPlayers])

  // Ya no hay carga inicial: la página abre vacía y busca cuando escribís.
  const loading = !!selectedPlayer && loadingPool

  if (errorAll) return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
      <EmptyState title="Error al cargar datos" description={errorAll} icon="error" />
    </div>
  )

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight">
          Jugadores Similares
        </h1>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 mt-1">
          Busca un jugador para encontrar los 10 más similares según su posición y métricas futbolísticas
        </p>
      </div>

      {/* Search */}
      <div className="card-apple p-6 mb-6">
        <label className="block text-sm font-medium text-apple-gray-700 dark:text-apple-gray-300 mb-2">
          Seleccionar jugador
        </label>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar jugador por nombre..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              if (!e.target.value.trim()) setSelectedPlayer(null)
            }}
            className="input-apple pl-10 pr-4 w-full max-w-md"
          />
          {/* Dropdown results */}
          {searchResults.length > 0 && !selectedPlayer && (
            <div className="absolute z-20 mt-1 w-full max-w-md bg-white dark:bg-apple-gray-800 border border-apple-gray-200 dark:border-apple-gray-700 rounded-xl shadow-lg overflow-hidden">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPlayer(p)
                    setSearch(p.name)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700 transition-colors flex items-center gap-3"
                >
                  <PlayerPhoto src={p.photo} name={p.name} size="sm" rounded="full" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-apple-gray-800 dark:text-white truncate">{p.name}</div>
                    <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400 truncate">
                      {p.team?.name} · {displayPosition(p.primary_position)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {search.trim().length >= 2 && !selectedPlayer && (
          <p className="text-xs text-apple-gray-400 mt-2">
            {loadingSearch
              ? 'Buscando…'
              : searchResults.length === 0
                ? `Sin resultados para «${search.trim()}». Se buscan jugadores con 5 partidos o más en la temporada.`
                : `${searchResults.length} resultado(s)`}
          </p>
        )}
      </div>

      {/* Selected player card */}
      {selectedPlayer && (
        <div className="card-apple p-6 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <PlayerPhoto src={selectedPlayer.photo} name={selectedPlayer.name} size="md" rounded="full" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-apple-gray-800 dark:text-white">{selectedPlayer.name}</h2>
              <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
                {selectedPlayer.team?.name} · {displayPosition(selectedPlayer.primary_position)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mb-1">Score GG</div>
              <ScoreBar score={selectedPlayer.primary_score} size="sm" scale="10" />
            </div>
            <button
              onClick={() => {
                setSelectedPlayer(null)
                setSearch('')
              }}
              className="p-2 text-apple-gray-400 hover:text-apple-gray-600 dark:hover:text-apple-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Similar players results */}
      {selectedPlayer && (
        <div id="similar-players-container" className="card-apple overflow-hidden">
          <div className="px-6 py-4 border-b border-apple-gray-200/50 dark:border-apple-gray-700/50 bg-apple-gray-50 dark:bg-apple-gray-800/50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-apple-gray-800 dark:text-white">
                10 Jugadores más similares
              </h3>
              <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mt-0.5">
                Basado en métricas de rendimiento para {displayPosition(selectedPosition) || 'la posición'}
              </p>
            </div>
            <CopyChartButton targetId="similar-players-container" filename={`similares_${selectedPlayer.name.replace(/\s+/g, '_')}`} />
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <LoadingSpinner message="Calculando similares..." />
            </div>
          ) : similarPlayers.length === 0 ? (
            <div className="p-8 text-center text-apple-gray-500 dark:text-apple-gray-400">
              No se encontraron jugadores similares para esta posición.
            </div>
          ) : (
            <div className="divide-y divide-apple-gray-100 dark:divide-apple-gray-700/50">
              {similarPlayers.map(({ player, similarity }, index) => {
                return (
                  <button
                    key={player.id}
                    onClick={() => {
                      navigate(`/jugador/${encodeURIComponent(player.name)}?source=externo&apiId=${player.id}`)
                    }}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-apple-gray-50 dark:hover:bg-apple-gray-800/50 transition-colors text-left"
                  >
                    {/* Rank */}
                    <div className="w-8 h-8 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 flex items-center justify-center text-sm font-semibold text-apple-gray-600 dark:text-apple-gray-300">
                      {index + 1}
                    </div>

                    {/* Player image */}
                    <PlayerPhoto src={player.photo} name={player.name} size="md" rounded="full" />

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-apple-gray-800 dark:text-white truncate">{player.name}</div>
                      <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400 truncate">
                        {player.team?.name}
                      </div>
                    </div>

                    {/* Score GG */}
                    <div className="w-16 sm:w-24">
                      <ScoreBar score={player.primary_score} size="md" scale="10" />
                    </div>

                    {/* Similarity */}
                    <div className="w-14 sm:w-20 text-right">
                      <div className="text-xs text-apple-gray-400 dark:text-apple-gray-500">Similitud</div>
                      <div className={`text-sm font-bold ${
                        similarity >= 80 ? 'text-emerald-500' :
                        similarity >= 60 ? 'text-amber-500' :
                        'text-orange-500'
                      }`}>
                        {similarity}%
                      </div>
                    </div>

                    {/* Arrow */}
                    <svg className="w-4 h-4 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selectedPlayer && (
        <div className="card-apple p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-apple-gray-300 dark:text-apple-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-apple-gray-700 dark:text-apple-gray-300 mb-2">
            Busca un jugador
          </h3>
          <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 max-w-md mx-auto">
            Escribe el nombre de un jugador para encontrar otros con características similares basándose en sus métricas de rendimiento.
          </p>
        </div>
      )}
    </div>
  )
}
