import { useState, useEffect, useMemo } from 'react'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import {
  fetchRecentEvaluations,
  fetchUnmatchedEvaluations,
  updateEvaluation,
  type ScoutEvaluation,
} from '@/services/scoutEvaluationService'
import { matchScore as sharedMatchScore } from '@/lib/search'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGE_LOCALES } from '@/constants/translations'

// La política RLS real de UPDATE en `scout_evaluations` ya restringe la escritura
// a estos dos emails (verificado contra pg_policies) — esto sólo oculta la UI para
// el resto, coherente con lo que el server ya exige. Sin un concepto de rol en la
// base (AuthContext no tiene campo `role`), se gatea por email como ya hace
// ScoutTrackingGGPage.
const ADMIN_EMAILS = ['marcoscucho99@gmail.com', 'matiassebastianroberti@gmail.com']

function findBestMatches(
  searchName: string,
  searchTeam: string | null,
  searchPosition: string | null,
  players: Array<{ id: string; name: string; team: string; position: string }>
): Array<{ player: typeof players[0]; score: number; reasons: string[] }> {
  const results: Array<{ player: typeof players[0]; score: number; reasons: string[] }> = []

  for (const player of players) {
    let score = sharedMatchScore(searchName, player.name)
    const reasons: string[] = []

    if (score < 10) continue

    if (score >= 50) reasons.push('razonNombreSimilar')

    if (searchTeam && player.team) {
      const teamMatch = sharedMatchScore(searchTeam, player.team)
      if (teamMatch >= 50) {
        score += 20
        reasons.push('razonMismoEquipo')
      }
    }

    if (searchPosition && player.position) {
      const posMatch = sharedMatchScore(searchPosition, player.position)
      if (posMatch >= 50) {
        score += 10
        reasons.push('razonMismaPosicion')
      }
    }

    if (reasons.length > 0 || score >= 30) {
      results.push({ player, score, reasons })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

export default function EvaluationsAdminPage() {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { external, internal } = useData()
  const [evaluations, setEvaluations] = useState<ScoutEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEval, setSelectedEval] = useState<ScoutEvaluation | null>(null)
  const [matchSearch, setMatchSearch] = useState('')
  const [matching, setMatching] = useState(false)
  const [filter, setFilter] = useState<'unmatched' | 'all'>('unmatched')

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email)

  // Load evaluations: recientes (para "Todas") + TODAS las sin vincular (sin
  // recorte, para no perder de vista evaluaciones viejas apenas la tabla crezca).
  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    async function load() {
      setLoading(true)
      const [recent, unmatched] = await Promise.all([
        fetchRecentEvaluations(100),
        fetchUnmatchedEvaluations(),
      ])
      const byId = new Map(recent.map(e => [e.id, e]))
      for (const e of unmatched) byId.set(e.id, e)
      setEvaluations(
        Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
      )
      setLoading(false)
    }
    load()
  }, [isAdmin])

  // Combined player list
  const allPlayers = useMemo(() => {
    const players: Array<{ id: string; name: string; team: string; position: string }> = []

    external.forEach(p => {
      players.push({
        id: p.Jugador,
        name: p.Jugador,
        team: p.Equipo || '',
        position: String(p['Posicion'] || ''),
      })
    })

    internal.forEach(p => {
      if (!players.find(x => x.name === p.Jugador)) {
        players.push({
          id: p.Jugador,
          name: p.Jugador,
          team: p.Equipo || '',
          position: String(p['Posicion'] || ''),
        })
      }
    })

    return players
  }, [external, internal])

  // Filtered evaluations
  const filteredEvaluations = useMemo(() => {
    if (filter === 'unmatched') {
      return evaluations.filter(e => !e.player_id)
    }
    return evaluations
  }, [evaluations, filter])

  // Suggested matches for selected evaluation
  const suggestedMatches = useMemo(() => {
    if (!selectedEval) return []

    // First try with the search input, then with original name
    const searchTerm = matchSearch || selectedEval.player_name

    return findBestMatches(
      searchTerm,
      selectedEval.team,
      selectedEval.position,
      allPlayers
    )
  }, [selectedEval, matchSearch, allPlayers])

  // Handle match
  const handleMatch = async (playerId: string, playerName: string) => {
    if (!selectedEval) return

    setMatching(true)
    const success = await updateEvaluation(selectedEval.id, {
      player_id: playerId,
      player_name: playerName, // Update name to match DB
    })

    if (success) {
      setEvaluations(prev =>
        prev.map(e =>
          e.id === selectedEval.id
            ? { ...e, player_id: playerId, player_name: playerName }
            : e
        )
      )
      setSelectedEval(null)
      setMatchSearch('')
    }
    setMatching(false)
  }

  // Handle skip (mark as new player - keep unmatched)
  const handleSkip = () => {
    setSelectedEval(null)
    setMatchSearch('')
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center py-20">
          <p className="text-apple-gray-500 dark:text-apple-gray-400">
            {t('evaluacionesAdmin.noTienesAcceso')}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-gray-900 dark:text-white mb-2">
            {t('evaluacionesAdmin.titulo')}
          </h1>
          <p className="text-apple-gray-500 dark:text-apple-gray-400">
            {t('evaluacionesAdmin.subtitulo')}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setFilter('unmatched')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === 'unmatched'
                ? 'bg-amber-500 text-white'
                : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-600 dark:text-apple-gray-400'
            }`}
          >
            {t('evaluacionesAdmin.sinVincularCount').replace('{count}', String(evaluations.filter(e => !e.player_id).length))}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-brand-green text-white'
                : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-600 dark:text-apple-gray-400'
            }`}
          >
            {t('evaluacionesAdmin.todasCount').replace('{count}', String(evaluations.length))}
          </button>
        </div>
      </div>

      {/* Evaluations list */}
      <div className="bg-white dark:bg-apple-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {filteredEvaluations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-apple-gray-500">
              {filter === 'unmatched'
                ? t('evaluacionesAdmin.sinEvaluacionesSinVincular')
                : t('evaluacionesAdmin.sinEvaluaciones')}
            </p>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-apple-gray-50 dark:bg-apple-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-apple-gray-500 uppercase">
                  {t('evaluacionesAdmin.colJugador')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-apple-gray-500 uppercase">
                  {t('evaluacionesAdmin.colEquipoPartido')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-apple-gray-500 uppercase">
                  {t('evaluacionesAdmin.colScout')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-apple-gray-500 uppercase">
                  {t('evaluacionesAdmin.colScore')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-apple-gray-500 uppercase">
                  {t('evaluacionesAdmin.colEstado')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-apple-gray-500 uppercase">
                  {t('evaluacionesAdmin.colAccion')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-gray-100 dark:divide-apple-gray-700">
              {filteredEvaluations.map(ev => (
                <tr
                  key={ev.id}
                  className="hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-apple-gray-900 dark:text-white">
                      {ev.player_name}
                    </div>
                    <div className="text-xs text-apple-gray-500">
                      {ev.position}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-apple-gray-700 dark:text-apple-gray-300">
                      {ev.team}
                    </div>
                    <div className="text-xs text-apple-gray-500">
                      vs {ev.rival} - {new Date(ev.match_date).toLocaleDateString(LANGUAGE_LOCALES[language])}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-apple-gray-700 dark:text-apple-gray-300">
                      {ev.scout_name}
                    </div>
                    <div className="text-xs text-apple-gray-500">
                      {new Date(ev.created_at).toLocaleDateString(LANGUAGE_LOCALES[language])}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ev.technical_score && (
                      <span
                        className={`text-lg font-bold ${
                          ev.technical_score >= 8
                            ? 'text-brand-green'
                            : ev.technical_score >= 6
                            ? 'text-emerald-500'
                            : ev.technical_score >= 4
                            ? 'text-amber-500'
                            : 'text-red-500'
                        }`}
                      >
                        {ev.technical_score}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ev.player_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-green/10 text-brand-green text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('evaluacionesAdmin.vinculado')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('evaluacionesAdmin.pendiente')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!ev.player_id && (
                      <button
                        onClick={() => {
                          setSelectedEval(ev)
                          setMatchSearch('')
                        }}
                        className="px-3 py-1.5 rounded-lg bg-brand-green text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
                      >
                        {t('evaluacionesAdmin.vincular')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-apple-gray-100 dark:divide-apple-gray-700">
            {filteredEvaluations.map(ev => (
              <div key={ev.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-apple-gray-900 dark:text-white truncate">
                      {ev.player_name}
                    </div>
                    <div className="text-xs text-apple-gray-500 truncate">
                      {ev.position}{ev.team ? ` · ${ev.team}` : ''}
                    </div>
                  </div>
                  {ev.technical_score != null && (
                    <span className={`text-xl font-bold flex-shrink-0 ${
                      ev.technical_score >= 8 ? 'text-brand-green'
                        : ev.technical_score >= 6 ? 'text-emerald-500'
                        : ev.technical_score >= 4 ? 'text-amber-500'
                        : 'text-red-500'
                    }`}>
                      {ev.technical_score}
                    </span>
                  )}
                </div>
                <div className="text-xs text-apple-gray-500 mt-1.5">
                  vs {ev.rival} · {new Date(ev.match_date).toLocaleDateString(LANGUAGE_LOCALES[language])} · {ev.scout_name}
                </div>
                <div className="flex items-center justify-between gap-3 mt-3">
                  {ev.player_id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-green/10 text-brand-green text-xs font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('evaluacionesAdmin.vinculado')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('evaluacionesAdmin.pendiente')}
                    </span>
                  )}
                  {!ev.player_id && (
                    <button
                      onClick={() => { setSelectedEval(ev); setMatchSearch('') }}
                      className="px-3 py-1.5 rounded-lg bg-brand-green text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex-shrink-0"
                    >
                      {t('evaluacionesAdmin.vincular')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Match modal */}
      {selectedEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleSkip}
          />

          <div className="relative bg-white dark:bg-apple-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-apple-gray-200 dark:border-apple-gray-700">
              <h2 className="text-xl font-bold text-apple-gray-900 dark:text-white">
                {t('evaluacionesAdmin.vincularEvaluacion')}
              </h2>
              <p className="text-apple-gray-500 mt-1">
                {t('evaluacionesAdmin.buscaJugadorEnBase')}
              </p>
            </div>

            <div className="p-6">
              {/* Evaluation info */}
              <div className="bg-apple-gray-50 dark:bg-apple-gray-700/50 rounded-xl p-4 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-apple-gray-900 dark:text-white text-lg">
                      {selectedEval.player_name}
                    </div>
                    <div className="text-sm text-apple-gray-500 mt-1">
                      {selectedEval.team} - {selectedEval.position}
                    </div>
                    <div className="text-sm text-apple-gray-500">
                      {t('evaluacionesAdmin.evaluadoPor')
                        .replace('{scout}', selectedEval.scout_name)
                        .replace('{date}', new Date(selectedEval.match_date).toLocaleDateString(LANGUAGE_LOCALES[language]))}
                    </div>
                  </div>
                  {selectedEval.technical_score && (
                    <div
                      className={`text-2xl font-bold ${
                        selectedEval.technical_score >= 8
                          ? 'text-brand-green'
                          : selectedEval.technical_score >= 6
                          ? 'text-emerald-500'
                          : selectedEval.technical_score >= 4
                          ? 'text-amber-500'
                          : 'text-red-500'
                      }`}
                    >
                      {selectedEval.technical_score}
                    </div>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  value={matchSearch}
                  onChange={e => setMatchSearch(e.target.value)}
                  placeholder={t('evaluacionesAdmin.buscarJugadorPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl bg-apple-gray-50 dark:bg-apple-gray-700 border border-apple-gray-200 dark:border-apple-gray-600 text-apple-gray-800 dark:text-white placeholder-apple-gray-400 focus:outline-none focus:border-brand-green"
                />
              </div>

              {/* Suggested matches */}
              <div className="space-y-2 max-h-64 overflow-auto">
                <p className="text-xs font-medium text-apple-gray-500 uppercase mb-2">
                  {t('evaluacionesAdmin.sugerencias').replace('{count}', String(suggestedMatches.length))}
                </p>

                {suggestedMatches.length === 0 ? (
                  <p className="text-sm text-apple-gray-500 py-4 text-center">
                    {t('evaluacionesAdmin.sinJugadoresSimilares')}
                  </p>
                ) : (
                  suggestedMatches.map(({ player, score, reasons }) => (
                    <button
                      key={player.id}
                      onClick={() => handleMatch(player.id, player.name)}
                      disabled={matching}
                      className="w-full p-3 rounded-xl border border-apple-gray-200 dark:border-apple-gray-600 hover:border-brand-green hover:bg-brand-green/5 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-apple-gray-900 dark:text-white">
                            {player.name}
                          </div>
                          <div className="text-sm text-apple-gray-500">
                            {player.team} - {player.position}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-sm font-bold ${
                              score >= 70
                                ? 'text-brand-green'
                                : score >= 40
                                ? 'text-amber-500'
                                : 'text-apple-gray-400'
                            }`}
                          >
                            {t('evaluacionesAdmin.matchPercent').replace('{score}', String(score))}
                          </div>
                          <div className="text-xs text-apple-gray-400">
                            {reasons.map(r => t(`evaluacionesAdmin.${r}`)).join(', ')}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-6 border-t border-apple-gray-200 dark:border-apple-gray-700 flex justify-between">
              <button
                onClick={handleSkip}
                className="px-4 py-2 rounded-xl text-apple-gray-600 dark:text-apple-gray-400 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors"
              >
                {t('evaluacionesAdmin.omitirJugadorNuevo')}
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2 rounded-xl bg-apple-gray-200 dark:bg-apple-gray-700 text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-300 dark:hover:bg-apple-gray-600 transition-colors"
              >
                {t('evaluacionesAdmin.cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
