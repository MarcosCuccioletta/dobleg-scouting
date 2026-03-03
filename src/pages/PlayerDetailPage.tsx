import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useData } from '@/context/DataContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import ScoreBar from '@/components/ui/ScoreBar'
import ContractBadge from '@/components/ui/ContractBadge'
import PlayerRadarChart from '@/components/charts/PlayerRadarChart'
import EvolutionChart from '@/components/charts/EvolutionChart'
import MarketValueChart from '@/components/charts/MarketValueChart'
import { SpeedometerGroup } from '@/components/charts/Speedometer'
import { exportPlayerToPdf } from '@/utils/pdfExport'
import { normalizeName } from '@/utils/scoring'
import { POSITION_MAP, DISPLAY_POSITION_MAP, DISPLAY_METRICS } from '@/constants/scoring'
import type { EnrichedPlayer, SubjectiveMetric } from '@/types'

// ─── PLAYER COMMENTS SYSTEM ───────────────────────────────────────────────────

interface PlayerComment {
  id: string
  playerKey: string  // normalized player name + team
  sentiment: 'positive' | 'neutral' | 'negative'
  text: string
  author: string
  createdAt: string
}

function getCommentsKey(): string {
  return 'player_comments_v1'
}

function loadComments(): PlayerComment[] {
  try {
    return JSON.parse(localStorage.getItem(getCommentsKey()) || '[]')
  } catch {
    return []
  }
}

function saveComments(comments: PlayerComment[]): void {
  localStorage.setItem(getCommentsKey(), JSON.stringify(comments))
}

function getPlayerKey(player: EnrichedPlayer): string {
  return `${normalizeName(player.Jugador)}|${normalizeName(player.Equipo)}`
}

interface CommentsProps {
  player: EnrichedPlayer
}

function PlayerComments({ player }: CommentsProps) {
  const [comments, setComments] = useState<PlayerComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [newAuthor, setNewAuthor] = useState(() => {
    try { return localStorage.getItem('comment_author') || '' } catch { return '' }
  })
  const [newSentiment, setNewSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral')
  const [isAdding, setIsAdding] = useState(false)

  const playerKey = getPlayerKey(player)

  // Load comments on mount
  useEffect(() => {
    const all = loadComments()
    setComments(all.filter(c => c.playerKey === playerKey))
  }, [playerKey])

  const handleAddComment = useCallback(() => {
    if (!newComment.trim() || !newAuthor.trim()) return

    const comment: PlayerComment = {
      id: Date.now().toString(),
      playerKey,
      sentiment: newSentiment,
      text: newComment.trim(),
      author: newAuthor.trim(),
      createdAt: new Date().toISOString(),
    }

    const all = loadComments()
    const updated = [...all, comment]
    saveComments(updated)
    setComments(updated.filter(c => c.playerKey === playerKey))

    // Remember author for next time
    localStorage.setItem('comment_author', newAuthor.trim())

    // Reset form
    setNewComment('')
    setNewSentiment('neutral')
    setIsAdding(false)
  }, [newComment, newAuthor, newSentiment, playerKey])

  const handleDeleteComment = useCallback((id: string) => {
    const all = loadComments()
    const updated = all.filter(c => c.id !== id)
    saveComments(updated)
    setComments(updated.filter(c => c.playerKey === playerKey))
  }, [playerKey])

  const sentimentConfig = {
    positive: { icon: '👍', label: 'Positivo', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
    neutral: { icon: '➖', label: 'Neutral', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' },
    negative: { icon: '👎', label: 'Negativo', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-600 dark:text-red-400' },
  }

  return (
    <div className="card-apple p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-300">
          Comentarios del Scout ({comments.length})
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn-apple-primary text-sm px-3 py-1.5"
          >
            + Agregar comentario
          </button>
        )}
      </div>

      {/* Add comment form */}
      {isAdding && (
        <div className="mb-5 p-4 bg-apple-gray-50 dark:bg-apple-gray-800/50 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700">
          {/* Sentiment selector */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-2">
              Valoración
            </label>
            <div className="flex gap-2">
              {(['positive', 'neutral', 'negative'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setNewSentiment(s)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    newSentiment === s
                      ? `${sentimentConfig[s].bg} ${sentimentConfig[s].border} ${sentimentConfig[s].text}`
                      : 'border-apple-gray-200 dark:border-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400 hover:border-apple-gray-300'
                  }`}
                >
                  <span className="mr-1.5">{sentimentConfig[s].icon}</span>
                  {sentimentConfig[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment text */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-2">
              Comentario
            </label>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Escribe tu observación sobre el jugador..."
              className="input-apple w-full h-24 resize-none"
            />
          </div>

          {/* Author */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-2">
              Tu nombre
            </label>
            <input
              type="text"
              value={newAuthor}
              onChange={e => setNewAuthor(e.target.value)}
              placeholder="Nombre del scout..."
              className="input-apple w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => { setIsAdding(false); setNewComment(''); setNewSentiment('neutral') }}
              className="btn-apple-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || !newAuthor.trim()}
              className="btn-apple-primary flex-1 disabled:opacity-50"
            >
              Guardar comentario
            </button>
          </div>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 && !isAdding ? (
        <div className="text-center py-8 text-apple-gray-400 dark:text-apple-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">No hay comentarios aún</p>
          <p className="text-xs mt-1">Sé el primero en agregar una observación</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map(comment => {
              const config = sentimentConfig[comment.sentiment]
              const date = new Date(comment.createdAt)
              return (
                <div
                  key={comment.id}
                  className={`p-4 rounded-xl border ${config.bg} ${config.border}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.icon}</span>
                      <span className={`text-xs font-semibold ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-apple-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Eliminar comentario"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-apple-gray-700 dark:text-apple-gray-300 leading-relaxed mb-3">
                    {comment.text}
                  </p>
                  <div className="flex items-center justify-between text-xs text-apple-gray-500 dark:text-apple-gray-400">
                    <span className="font-medium">{comment.author}</span>
                    <span>
                      {date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

function getSubjectiveGroups(metrics: SubjectiveMetric[], jsk: string) {
  const playerMetrics = metrics.filter(m => String(m.JugadorSK) === String(jsk))
  if (playerMetrics.length === 0) return []

  const grouped = new Map<string, number[]>()
  for (const m of playerMetrics) {
    const tipo = m['Tipo Atributo']
    const num = parseInt(m.numero, 10)
    if (!tipo || isNaN(num) || num < 1) continue
    if (!grouped.has(tipo)) grouped.set(tipo, [])
    grouped.get(tipo)!.push(num)
  }

  return [...grouped.entries()].map(([tipo, nums]) => {
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length
    const attrMap = new Map<string, number>()
    for (const m of playerMetrics.filter(x => x['Tipo Atributo'] === tipo)) {
      const n = parseInt(m.numero, 10)
      if (!isNaN(n)) attrMap.set(m.Atributo, n * 20)
    }
    return {
      tipo,
      averageScore: Math.round(avg * 20),
      attributes: [...attrMap.entries()].map(([name, score]) => ({ name, score })),
    }
  }).slice(0, 4)
}

// Convert raw position (possibly Wyscout code) to display-friendly Spanish name
function getDisplayPosition(rawPosition: string | undefined): string {
  if (!rawPosition) return '—'
  const trimmed = rawPosition.trim()

  // Handle multiple positions like "RCB , LCB" or "RCB / LCB" - convert each and join
  const separator = trimmed.includes(',') ? ',' : trimmed.includes('/') ? '/' : null
  if (separator) {
    const positions = trimmed.split(separator).map(p => p.trim())
    const displayPositions = positions
      .map(p => DISPLAY_POSITION_MAP[p] || p)
      .filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates
    return displayPositions.join(' / ')
  }

  return DISPLAY_POSITION_MAP[trimmed] || trimmed
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '-' || value === '') return null
  return (
    <div className="flex justify-between py-2.5 border-b border-apple-gray-100 dark:border-apple-gray-800/50 last:border-0">
      <span className="text-sm text-apple-gray-500 dark:text-apple-gray-400">{label}</span>
      <span className="text-sm font-medium text-apple-gray-800 dark:text-white text-right ml-4">{value}</span>
    </div>
  )
}

interface MetricWithPercentileProps {
  label: string
  value?: string | number | null
  percentile?: number | null  // 0-100
  showBar?: boolean
}

function MetricRowWithPercentile({ label, value, percentile, showBar = true }: MetricWithPercentileProps) {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'))
  const displayVal = isNaN(num) ? (value || '—') : (num % 1 === 0 ? num.toFixed(0) : num.toFixed(2))

  // Determine quality based on percentile
  const getQualityInfo = (p: number | null | undefined) => {
    if (p === null || p === undefined) return { label: '', color: '', bg: '', textColor: 'text-apple-gray-800 dark:text-white' }
    if (p >= 80) return { label: 'Elite', color: 'bg-emerald-500', bg: 'bg-emerald-500/10', textColor: 'text-emerald-500' }
    if (p >= 60) return { label: 'Bueno', color: 'bg-blue-500', bg: 'bg-blue-500/10', textColor: 'text-blue-500' }
    if (p >= 40) return { label: 'Promedio', color: 'bg-amber-500', bg: 'bg-amber-500/10', textColor: 'text-amber-500' }
    if (p >= 20) return { label: 'Bajo', color: 'bg-orange-500', bg: 'bg-orange-500/10', textColor: 'text-orange-500' }
    return { label: 'Crítico', color: 'bg-red-500', bg: 'bg-red-500/10', textColor: 'text-red-500' }
  }

  const quality = getQualityInfo(percentile)

  return (
    <div className="py-3 border-b border-apple-gray-100 dark:border-apple-gray-800/50 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-apple-gray-500 dark:text-apple-gray-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${quality.textColor}`}>
            {displayVal}
          </span>
          {percentile !== null && percentile !== undefined && (
            <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded ${quality.bg} ${quality.textColor}`}>
              {quality.label}
            </span>
          )}
        </div>
      </div>
      {showBar && percentile !== null && percentile !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-apple-gray-200 dark:bg-apple-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${quality.color}`}
              style={{ width: `${Math.min(100, Math.max(0, percentile))}%` }}
            />
          </div>
          <span className="text-2xs text-apple-gray-400 tabular-nums w-10 text-right">
            Top {100 - Math.round(percentile)}%
          </span>
        </div>
      )}
    </div>
  )
}

// Simple metric row without percentile (for basic stats like games, minutes)
function MetricRow({ label, value }: { label: string; value?: string }) {
  const num = parseFloat(String(value ?? '').replace(',', '.'))
  const displayVal = isNaN(num) ? (value || '—') : (num % 1 === 0 ? num.toFixed(0) : num.toFixed(2))
  return (
    <div className="flex justify-between py-2.5 border-b border-apple-gray-100 dark:border-apple-gray-800/50 last:border-0">
      <span className="text-sm text-apple-gray-500 dark:text-apple-gray-400">{label}</span>
      <span className="text-sm font-semibold text-apple-gray-800 dark:text-white tabular-nums">{displayVal}</span>
    </div>
  )
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const source = (searchParams.get('source') ?? 'externo') as 'externo' | 'interno' | 'seguimiento'
  const overridePosition = searchParams.get('pos') // Position from list (for seguimiento)
  const { external, internal, monitoring, normalized, evolution, subjectiveMetrics, marketValueHistory, loading, error } = useData()
  const [activeTab, setActiveTab] = useState('General')
  const [exporting, setExporting] = useState(false)
  const [comparisonLeague, setComparisonLeague] = useState<string>('all')

  const player: EnrichedPlayer | null = useMemo(() => {
    if (!id) return null
    const decodedId = decodeURIComponent(id)

    if (source === 'interno') {
      return internal.find(p => String(p.id) === decodedId || normalizeName(p.Jugador) === normalizeName(decodedId)) ?? null
    }

    if (source === 'seguimiento') {
      // Find in monitoring and return metricsPlayer
      const monPlayer = monitoring.find(p =>
        normalizeName(p.Jugador) === normalizeName(decodedId) ||
        normalizeName(p['Nombre jugador']) === normalizeName(decodedId)
      )
      return monPlayer?.metricsPlayer ?? null
    }

    return external.find(p => normalizeName(p.Jugador) === normalizeName(decodedId)) ?? null
  }, [id, source, external, internal, monitoring])

  // Get monitoring player data for seguimiento (for WyscoutVideo, etc.)
  const monitoringPlayer = useMemo(() => {
    if (source !== 'seguimiento' || !id) return null
    const decodedId = decodeURIComponent(id)
    return monitoring.find(p =>
      normalizeName(p.Jugador) === normalizeName(decodedId) ||
      normalizeName(p['Nombre jugador']) === normalizeName(decodedId)
    ) ?? null
  }, [id, source, monitoring])

  // Use override position from URL (seguimiento) or player's position
  // For seguimiento, try 'Posición específica' first (has Wyscout codes like RCB, LCB)
  const rawPosition = useMemo(() => {
    if (overridePosition) return overridePosition
    if (!player) return ''
    // Try Posición específica first (usually has Wyscout codes)
    const posEsp = player['Posición específica']?.trim()
    if (posEsp) return posEsp
    // Fallback to regular position
    return player['Posición']?.trim() || ''
  }, [overridePosition, player])

  // Calculate position key for scoring - handle multiple positions like "RCB , LCB" or "RCB / LCB"
  const posKey = useMemo(() => {
    const rawPos = rawPosition.trim()
    // Try direct match first
    if (POSITION_MAP[rawPos]) return POSITION_MAP[rawPos]
    // If multiple positions (comma or slash separated), try each
    const separator = rawPos.includes(',') ? ',' : rawPos.includes('/') ? '/' : null
    if (separator) {
      for (const pos of rawPos.split(separator).map(p => p.trim())) {
        if (POSITION_MAP[pos]) return POSITION_MAP[pos]
      }
    }
    return ''
  }, [rawPosition])

  // Display-friendly position name (Spanish)
  const displayPosition = getDisplayPosition(rawPosition)

  const subjectiveGroups = useMemo(() => {
    if (!player || source !== 'interno') return []
    const jsk = (player as EnrichedPlayer & { jugadorSK?: string }).jugadorSK ?? ''
    if (!jsk) return []
    return getSubjectiveGroups(subjectiveMetrics, jsk)
  }, [player, source, subjectiveMetrics])

  const playerJugadorSK = useMemo(() => {
    if (!player || source !== 'interno') return ''
    return (player as EnrichedPlayer & { jugadorSK?: string }).jugadorSK ?? ''
  }, [player, source])

  const allPlayersForSource = source === 'interno' ? internal : external

  // Calculate percentiles for each metric compared to same position players
  const metricPercentiles = useMemo(() => {
    if (!player || !posKey) return {}

    const allPlayers = [...external, ...internal]
    // Filter players with same position
    const samePosList = allPlayers.filter(p => {
      const pPosKey = POSITION_MAP[p['Posición']?.trim() ?? ''] ?? ''
      return pPosKey === posKey && p.minutesPlayed >= 300 // Minimum minutes threshold
    })

    if (samePosList.length < 5) return {} // Not enough data

    const percentiles: Record<string, number> = {}
    const displayMetricsList = DISPLAY_METRICS[posKey] ?? DISPLAY_METRICS['_default']

    for (const metric of displayMetricsList) {
      // Skip non-numeric metrics
      if (metric === 'Partidos jugados' || metric === 'Minutos jugados') continue

      const playerVal = player[metric]
      const playerNum = typeof playerVal === 'number' ? playerVal : parseFloat(String(playerVal ?? '').replace(',', '.'))

      if (isNaN(playerNum)) continue

      // Get all values for this metric
      const values = samePosList
        .map(p => {
          const v = p[metric]
          return typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
        })
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b)

      if (values.length < 5) continue

      // Calculate percentile (% of players below this value)
      const countBelow = values.filter(v => v < playerNum).length
      const percentile = (countBelow / values.length) * 100

      percentiles[metric] = percentile
    }

    return percentiles
  }, [player, posKey, external, internal])

  // Get available leagues from data
  const availableLeagues = useMemo(() => {
    const allPlayers = [...external, ...internal]
    const leagueSet = new Set<string>()
    for (const p of allPlayers) {
      if (p.Liga) leagueSet.add(p.Liga)
    }
    return [...leagueSet].sort()
  }, [external, internal])

  // Set default comparison league based on player's league
  useEffect(() => {
    if (player) {
      const playerLeague = player.Liga
      // If player's league exists in our database, use it as default
      if (playerLeague && availableLeagues.includes(playerLeague)) {
        setComparisonLeague(playerLeague)
      } else {
        // Player's league not in database, use global average
        setComparisonLeague('all')
      }
    }
  }, [player?.Jugador, player?.Liga, availableLeagues])

  // Filter market value history for this player
  const playerMarketValueHistory = useMemo(() => {
    if (!player || source !== 'interno') return []
    const playerNameNorm = normalizeName(player.Jugador)
    return marketValueHistory.filter(entry => {
      const entryNameNorm = normalizeName(entry.Jugador)
      return entryNameNorm === playerNameNorm
    })
  }, [player, source, marketValueHistory])

  const tabs = source === 'interno'
    ? ['General', 'Radar', 'Valor', 'Evolución']
    : ['General', 'Radar']

  if (loading) return <LoadingSpinner fullScreen message="Cargando ficha del jugador..." />
  if (error) return <EmptyState title="Error" description={error} icon="error" />
  if (!player) return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
      <EmptyState title="Jugador no encontrado" description="No se encontró el jugador solicitado." icon="search" />
    </div>
  )

  const displayMetrics = DISPLAY_METRICS[posKey] ?? DISPLAY_METRICS['_default']
  const contractColor =
    player.contractStatus === 'critical' ? 'text-orange-500'
    : player.contractStatus === 'warning' ? 'text-amber-500'
    : 'text-apple-gray-700 dark:text-apple-gray-300'

  const handleExport = async () => {
    setExporting(true)
    try { await exportPlayerToPdf(player.Jugador) } finally { setExporting(false) }
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 animate-fade-in" id="player-detail-content">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-apple-gray-500 dark:text-apple-gray-400 mb-5">
        <Link to={source === 'interno' ? '/interno' : '/'} className="hover:text-brand-green transition-colors">
          {source === 'interno' ? 'Scout Interno' : 'Scout Externo'}
        </Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-apple-gray-800 dark:text-white font-medium">{player.Jugador}</span>
      </nav>

      {/* Player header */}
      <div className="card-apple p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          {/* Info */}
          <div className="flex items-start gap-5">
            {/* Avatar */}
            {player.Imagen ? (
              <img
                src={player.Imagen}
                alt={player.Jugador}
                className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-apple dark:shadow-apple-dark"
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-apple-gray-100 to-apple-gray-200 dark:from-apple-gray-700 dark:to-apple-gray-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-apple dark:shadow-apple-dark">
                <span className="text-2xl font-bold text-apple-gray-400 dark:text-apple-gray-500">
                  {player.Jugador.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight">{player.Jugador}</h1>
                <ContractBadge status={player.contractStatus} monthsRemaining={player.monthsRemaining} />
              </div>
              <p className="text-apple-gray-500 dark:text-apple-gray-400 text-sm mt-1">
                {player.Equipo || '—'}
                {player.Liga ? ` · ${player.Liga}` : ''}
                {player['País de nacimiento'] ? ` · ${player['País de nacimiento']}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex px-2.5 py-1 bg-apple-gray-100 dark:bg-apple-gray-700 rounded-lg text-xs font-medium text-apple-gray-600 dark:text-apple-gray-300">
                  {displayPosition}
                </span>
                <span className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
                  {player.Edad} años
                  {player.Altura ? ` · ${player.Altura} cm` : ''}
                  {player.Pie ? ` · Pie ${player.Pie}` : ''}
                </span>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {player.Transfermkt && (
              <a
                href={player.Transfermkt}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-apple-secondary text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="hidden sm:inline">Transfermarkt</span>
                <span className="sm:hidden">TM</span>
              </a>
            )}
            {monitoringPlayer?.WyscoutVideo && (
              <a
                href={monitoringPlayer.WyscoutVideo}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-apple-secondary text-sm !bg-red-500/10 !text-red-500 hover:!bg-red-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Video Wyscout</span>
                <span className="sm:hidden">Video</span>
              </a>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-apple-primary text-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Exportar PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-apple-gray-100/50 dark:bg-apple-gray-800/50 rounded-xl p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-apple ${
              activeTab === tab
                ? 'bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white shadow-apple dark:shadow-apple-dark'
                : 'text-apple-gray-500 dark:text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card-apple p-6">

        {/* GENERAL TAB */}
        {activeTab === 'General' && (
          <div className="space-y-8 animate-fade-in">
            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider mb-3">
                    Información Personal
                  </h3>
                  <div className="space-y-0">
                    <InfoRow label="Edad" value={player.Edad ? `${player.Edad} años` : null} />
                    <InfoRow label="Nacionalidad" value={player['País de nacimiento']} />
                    <InfoRow label="Altura" value={player.Altura ? `${player.Altura} cm` : null} />
                    <InfoRow label="Pie dominante" value={player.Pie} />
                    <InfoRow label="Posición específica" value={getDisplayPosition(player['Posición específica'])} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider mb-3">
                    Contrato
                  </h3>
                  <div className="space-y-0">
                    <div className="flex justify-between py-2.5">
                      <span className="text-sm text-apple-gray-500 dark:text-apple-gray-400">Vence</span>
                      <span className={`text-sm font-medium ${contractColor}`}>
                        {player['Vencimiento contrato'] || '—'}
                        {player.monthsRemaining !== null && (
                          <span className="ml-1.5 text-xs font-normal text-apple-gray-400">({player.monthsRemaining}m)</span>
                        )}
                      </span>
                    </div>
                    <InfoRow label="Valor mercado" value={player.marketValueFormatted} />
                  </div>
                </div>
              </div>
              {/* Center: Score GG */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider">
                  Score GG
                </h3>
                <ScoreBar score={player.ggScore} size="lg" />
                {!posKey && (
                  <p className="text-xs text-apple-gray-400">Posición no reconocida para el cálculo.</p>
                )}
              </div>
              {/* Right: Key metrics with percentiles */}
              <div>
                <h3 className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider mb-2">
                  Métricas Clave — {posKey || 'General'}
                </h3>
                <p className="text-2xs text-apple-gray-400 dark:text-apple-gray-500 mb-3">
                  Comparado vs jugadores de su posición
                </p>
                <div className="space-y-0">
                  {displayMetrics.map(metric => {
                    const isBasicStat = metric === 'Partidos jugados' || metric === 'Minutos jugados'
                    const percentile = metricPercentiles[metric]

                    if (isBasicStat) {
                      return <MetricRow key={metric} label={metric} value={String(player[metric] ?? '')} />
                    }

                    return (
                      <MetricRowWithPercentile
                        key={metric}
                        label={metric}
                        value={player[metric]}
                        percentile={percentile}
                        showBar={percentile !== undefined}
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Evaluación Scout - Speedometers (solo para interno) */}
            {source === 'interno' && subjectiveGroups.length > 0 && (
              <div className="pt-6 border-t border-apple-gray-200/50 dark:border-apple-gray-700/50">
                <h3 className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider mb-6">
                  Evaluación Scout
                </h3>
                <SpeedometerGroup groups={subjectiveGroups} />
              </div>
            )}
          </div>
        )}

        {/* RADAR TAB */}
        {activeTab === 'Radar' && (
          <div className="animate-fade-in">
            {/* Header with league selector */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-300">
                  Radar — {displayPosition}
                </h3>
                <p className="text-xs text-apple-gray-400 mt-0.5">
                  Comparando vs {comparisonLeague === 'all' ? 'promedio general (todas las ligas)' : `promedio de ${comparisonLeague}`}
                </p>
              </div>

              {/* League selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-apple-gray-500 dark:text-apple-gray-400">
                  Comparar vs:
                </label>
                <select
                  value={comparisonLeague}
                  onChange={e => setComparisonLeague(e.target.value)}
                  className="input-apple text-sm py-1.5 px-3 pr-8 min-w-[180px]"
                >
                  <option value="all">Todas las ligas</option>
                  {availableLeagues.map(league => (
                    <option key={league} value={league}>
                      {league}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Player league info */}
            {player.Liga && !availableLeagues.includes(player.Liga) && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-medium">{player.Jugador}</span> juega en <span className="font-medium">{player.Liga}</span>,
                  que no está en nuestra base de datos. Por defecto se compara vs el promedio general.
                </p>
              </div>
            )}

            {!posKey ? (
              <EmptyState title="Posición no reconocida" description="No se puede generar el radar para esta posición." />
            ) : (
              <PlayerRadarChart
                player={player}
                allNormalized={normalized}
                allPlayers={[...external, ...internal]}
                comparisonLeague={comparisonLeague}
                overridePosition={rawPosition}
              />
            )}

            {/* Legend explaining comparison */}
            <div className="mt-4 p-4 bg-apple-gray-50 dark:bg-apple-gray-800/50 rounded-lg">
              <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400 leading-relaxed">
                El gráfico muestra las métricas normalizadas del jugador (0-100) comparadas contra el promedio
                de jugadores de la misma posición ({posKey})
                {comparisonLeague !== 'all' ? ` en ${comparisonLeague}` : ' en toda la base de datos'}.
                Un valor de 100 indica el máximo registrado en la métrica.
              </p>
            </div>
          </div>
        )}

        {/* VALOR DE MERCADO TAB */}
        {activeTab === 'Valor' && source === 'interno' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-300">
                  Evolución del Valor de Mercado
                </h3>
                <p className="text-xs text-apple-gray-400 mt-0.5">
                  Historial de valuaciones según Transfermarkt
                </p>
              </div>
              {player.Transfermkt && (
                <a
                  href={player.Transfermkt}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-green hover:underline flex items-center gap-1"
                >
                  Ver en Transfermarkt
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
            <MarketValueChart data={playerMarketValueHistory} playerName={player.Jugador} />
          </div>
        )}

        {/* EVOLUCIÓN TAB */}
        {activeTab === 'Evolución' && source === 'interno' && (
          <div className="animate-fade-in">
            <h3 className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-300 mb-5">
              Evolución por partido
            </h3>
            {playerJugadorSK ? (
              <EvolutionChart evolution={evolution} playerSK={playerJugadorSK} />
            ) : (
              <EmptyState
                title="Sin datos de evolución"
                description="No se encontraron datos de evolución para este jugador."
                icon="search"
              />
            )}
          </div>
        )}
      </div>

      {/* Comments section */}
      <PlayerComments player={player} />
    </div>
  )
}
