import { useState, useMemo, useEffect } from 'react'
import { useData } from '@/context/DataContext'
import { linkScoutPlayerToDb } from '@/services/scoutPlayersService'
import { fetchPlayersList } from '@/services/playerStatsService'
import { fuzzyMatch } from '@/lib/search'
import type { ScoutPlayer } from '@/types'

interface Props {
  player: ScoutPlayer
  onClose: () => void
  onLinked: (updated: Pick<ScoutPlayer, 'id' | 'player_db_id' | 'player_db_source' | 'supabase_player_id'>) => void
}

interface ResultItem {
  source: 'externo' | 'interno'
  jugador: string
  equipo: string | null
  liga: string | null
  posicion: string | null
  edad: number | null
  rating: number | null
  supabasePlayerId: number | null
}

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

export default function LinkPlayerModal({ player, onClose, onLinked }: Props) {
  const { internal } = useData()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'todos' | 'externo' | 'interno'>('todos')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [externoResults, setExternoResults] = useState<ResultItem[]>([])
  const [externoLoading, setExternoLoading] = useState(false)

  // Debounce: evita golpear la API en cada tecla mientras el usuario escribe.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Búsqueda "externo" en vivo contra Supabase (API-Football/Sofascore) — el CSV
  // legacy de Google Sheets no tiene a todos los jugadores (recién debutados,
  // ligas no cubiertas por la planilla, etc.), por eso una búsqueda que sólo
  // mirara el CSV no encontraba jugadores reales que sí están en la base.
  useEffect(() => {
    if (!debouncedQuery || sourceFilter === 'interno') { setExternoResults([]); return }
    let cancelled = false
    setExternoLoading(true)
    fetchPlayersList({ search: debouncedQuery, pageSize: 30 })
      .then(({ players }) => {
        if (cancelled) return
        setExternoResults(players.map(p => ({
          source: 'externo' as const,
          jugador: p.name,
          equipo: p.team?.name ?? null,
          liga: p.league?.name ?? null,
          posicion: p.primary_position,
          edad: getAge(p.birth_date),
          rating: p.primary_score,
          supabasePlayerId: p.id,
        })))
      })
      .catch(() => { if (!cancelled) setExternoResults([]) })
      .finally(() => { if (!cancelled) setExternoLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, sourceFilter])

  const internoResults = useMemo<ResultItem[]>(() => {
    if (!debouncedQuery || sourceFilter === 'externo') return []
    return internal
      .filter(p => fuzzyMatch(debouncedQuery, p.Jugador) || fuzzyMatch(debouncedQuery, p.Equipo || ''))
      .slice(0, 30)
      .map(p => ({
        source: 'interno' as const,
        jugador: p.Jugador,
        equipo: p.Equipo || null,
        liga: p.Liga || null,
        posicion: p['Posición'] || null,
        edad: p.Edad ? Number(p.Edad) || null : null,
        rating: p.rating ?? null,
        supabasePlayerId: null,
      }))
  }, [debouncedQuery, sourceFilter, internal])

  const results = useMemo<ResultItem[]>(() => {
    if (!debouncedQuery) return []
    return [...externoResults, ...internoResults]
  }, [debouncedQuery, externoResults, internoResults])

  const loading = externoLoading && sourceFilter !== 'interno'

  const handleLink = async (r: ResultItem) => {
    setSaving(true)
    setError(null)
    const ok = await linkScoutPlayerToDb(player.id, r.jugador, r.source, r.supabasePlayerId)
    setSaving(false)
    if (!ok) {
      setError('Error al guardar el vínculo. Intentá de nuevo.')
      return
    }
    onLinked({ id: player.id, player_db_id: r.jugador, player_db_source: r.source, supabase_player_id: r.supabasePlayerId })
    onClose()
  }

  const handleUnlink = async () => {
    setSaving(true)
    setError(null)
    const ok = await linkScoutPlayerToDb(player.id, null, null, null)
    setSaving(false)
    if (!ok) {
      setError('Error al desvincular. Intentá de nuevo.')
      return
    }
    onLinked({ id: player.id, player_db_id: null, player_db_source: null, supabase_player_id: null })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-apple-gray-900 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-apple-gray-100 dark:border-apple-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-apple-gray-900 dark:text-white">
              Vincular jugador a la base de datos
            </h2>
            <p className="text-xs text-apple-gray-500 mt-0.5">
              <span className="font-medium text-brand-green">{player.full_name}</span>
              {player.player_db_id && (
                <span className="ml-2 text-xs text-amber-500">
                  · Vinculado a: {player.player_db_id} ({player.player_db_source})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-apple-gray-400 hover:text-apple-gray-600 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 flex-shrink-0 space-y-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre o equipo..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-apple-gray-50 dark:bg-apple-gray-800 border border-apple-gray-200 dark:border-apple-gray-600 rounded-xl text-apple-gray-900 dark:text-white placeholder:text-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            {(['todos', 'externo', 'interno'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  sourceFilter === s
                    ? 'bg-brand-green text-white'
                    : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-600'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {query.trim().length === 0 ? (
            <p className="text-sm text-apple-gray-400 text-center py-8">
              Escribí el nombre o equipo del jugador
            </p>
          ) : loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-apple-gray-400 text-center py-8">
              Sin resultados para "{query}"
            </p>
          ) : (
            <div className="space-y-1">
              {results.map((p, i) => (
                <button
                  key={`${p.source}-${p.supabasePlayerId ?? p.jugador}-${i}`}
                  onClick={() => !saving && handleLink(p)}
                  disabled={saving}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-brand-green/5 dark:hover:bg-brand-green/10 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-apple-gray-900 dark:text-white truncate group-hover:text-brand-green transition-colors">
                      {p.jugador}
                    </p>
                    <p className="text-xs text-apple-gray-500 truncate">
                      {[p.equipo, p.liga, p.posicion, p.edad ? `${p.edad}a` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {p.rating !== null && p.rating !== undefined && (
                      <span className={`text-xs font-bold tabular-nums ${
                        p.rating >= 6.8 ? 'text-brand-green' :
                        p.rating >= 6.4 ? 'text-emerald-500' :
                        p.rating >= 6.0 ? 'text-amber-500' : 'text-apple-gray-400'
                      }`}>
                        {p.rating.toFixed(1)}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded-md text-2xs font-medium ${
                      p.source === 'externo'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    }`}>
                      {p.source}
                    </span>
                    <svg className="w-4 h-4 text-apple-gray-300 group-hover:text-brand-green transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-apple-gray-100 dark:border-apple-gray-700 flex-shrink-0 flex items-center justify-between">
          {player.player_db_id ? (
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              Desvincular
            </button>
          ) : (
            <div />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-apple-gray-600 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
