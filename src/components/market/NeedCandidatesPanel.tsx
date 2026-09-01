import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import PlayerLinkField from './PlayerLinkField'
import StatusPill from './StatusPill'
import { CANDIDATE_STATUS_ORDER, CANDIDATE_STATUS_LABEL_KEY, CANDIDATE_STATUS_COLOR } from './marketLabels'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
import { useLinkedPlayerAge } from '@/hooks/useLinkedPlayerAge'
import {
  fetchCandidatesFor,
  addCandidate,
  updateCandidateStatus,
  removeCandidate,
  linkCandidatePlayer,
  isMarketLinkAdmin,
} from '@/services/marketService'
import type { NeedCandidate, CandidateStatus } from '@/types/market'

function CandidateRow({
  candidate,
  canLink,
  linking,
  pendingApiId,
  onToggleLink,
  onStatusChange,
  onRemove,
  onLinkChange,
  onLinkResolved,
  onSaveLink,
}: {
  candidate: NeedCandidate
  canLink: boolean
  linking: boolean
  pendingApiId: number | null
  onToggleLink: () => void
  onStatusChange: (status: CandidateStatus) => void
  onRemove: () => void
  onLinkChange: (id: number | null) => void
  onLinkResolved: (identity: { name: string; age: number | null } | null) => void
  onSaveLink: () => void
}) {
  const { t } = useLanguage()
  const candidateStatusLabels = Object.fromEntries(
    CANDIDATE_STATUS_ORDER.map(s => [s, t(CANDIDATE_STATUS_LABEL_KEY[s])]),
  ) as Record<CandidateStatus, string>
  const age = useLinkedPlayerAge(candidate.player_api_id)

  return (
    <div className="rounded-lg bg-apple-gray-50 dark:bg-apple-gray-800/50 p-2.5">
      <div className="flex items-center gap-2.5">
        <PlayerPhoto src={buildPlayerPhotoUrl(candidate.player_api_id)} name={candidate.player_name} size="xs" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-apple-gray-700 dark:text-apple-gray-200 truncate">
            {candidate.player_name}
            {age != null && <span className="text-apple-gray-400">, {age} {t('externo.anios')}</span>}
          </span>
        </span>
        <StatusPill
          value={candidate.status}
          options={CANDIDATE_STATUS_ORDER}
          labels={candidateStatusLabels}
          colors={CANDIDATE_STATUS_COLOR}
          onChange={onStatusChange}
          title={t('mercado.cambiarEstado')}
        />
        {canLink && (
          <button onClick={onToggleLink} className="text-2xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
            {candidate.player_api_id ? '✓' : t('mercado.vincular')}
          </button>
        )}
        <button onClick={onRemove} className="text-apple-gray-300 hover:text-red-500 flex-shrink-0" title={t('mercado.quitar')}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {canLink && linking && (
        <div className="mt-2 space-y-2">
          <PlayerLinkField
            playerName={candidate.player_name}
            playerApiId={pendingApiId}
            onChange={onLinkChange}
            onResolved={onLinkResolved}
          />
          <button
            onClick={onSaveLink}
            disabled={pendingApiId == null}
            className="text-xs font-semibold text-white bg-brand-green px-3 py-1.5 rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {t('mercado.guardarVinculo')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Un club no busca "un" jugador puntual — va evaluando varios candidatos para
 * el mismo puesto a medida que se los ofrecen. Esta lista vive dentro de cada
 * búsqueda (objetivo) y es el registro de "le ofrecimos a X, después a Y".
 */
export default function NeedCandidatesPanel({
  needId,
  onNegotiationMightHaveChanged,
}: {
  needId: number
  /** Cambiar el estado de un candidato acá se sincroniza server-side a la
   * negociación de la que vino (si vino de una) — se llama para que esa
   * lista hermana no quede desactualizada en pantalla. */
  onNegotiationMightHaveChanged?: () => void
}) {
  const { user, userDisplayName } = useAuth()
  const { t } = useLanguage()
  const canLink = isMarketLinkAdmin(user?.email)
  const [candidates, setCandidates] = useState<NeedCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [linkingId, setLinkingId] = useState<number | null>(null)
  const [pendingApiId, setPendingApiId] = useState<number | null>(null)
  const [pendingIdentity, setPendingIdentity] = useState<{ name: string; age: number | null } | null>(null)

  const load = () => {
    setLoading(true)
    fetchCandidatesFor(needId).then(setCandidates).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [needId])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    const candidate = await addCandidate(needId, newName.trim(), user?.id ?? null, userDisplayName || 'Usuario')
    setAdding(false)
    if (candidate) {
      setCandidates(prev => [candidate, ...prev])
      setNewName('')
    }
  }

  const handleStatusChange = async (id: number, status: CandidateStatus) => {
    const ok = await updateCandidateStatus(id, status)
    if (ok) {
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, status } : c))
      if (candidates.find(c => c.id === id)?.negotiation_id) onNegotiationMightHaveChanged?.()
    }
  }

  const handleRemove = async (id: number) => {
    const ok = await removeCandidate(id)
    if (ok) setCandidates(prev => prev.filter(c => c.id !== id))
  }

  const openLinking = (candidate: NeedCandidate) => {
    setLinkingId(l => l === candidate.id ? null : candidate.id)
    setPendingApiId(candidate.player_api_id)
    setPendingIdentity(null)
  }

  const handleSaveLink = async (candidate: NeedCandidate) => {
    if (pendingApiId == null) return
    const ok = await linkCandidatePlayer(candidate.id, pendingApiId, 'externo', pendingIdentity?.name)
    if (ok) {
      setCandidates(prev => prev.map(c => c.id === candidate.id
        ? { ...c, player_api_id: pendingApiId, player_source: 'externo', player_name: pendingIdentity?.name ?? c.player_name }
        : c))
      setLinkingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-apple-gray-500 uppercase tracking-wider">
        {t('mercado.jugadoresPropuestos')} ({candidates.length})
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder={t('mercado.nombreJugadorPlaceholder')}
          className="input-apple text-sm flex-1"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || adding}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 flex-shrink-0"
        >
          {t('mercado.agregar')}
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-xs text-apple-gray-400">{t('mercado.cargandoNotas')}</p>
        ) : candidates.length === 0 ? (
          <p className="text-xs text-apple-gray-400">{t('mercado.sinCandidatos')}</p>
        ) : (
          candidates.map(candidate => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              canLink={canLink}
              linking={linkingId === candidate.id}
              pendingApiId={pendingApiId}
              onToggleLink={() => openLinking(candidate)}
              onStatusChange={status => handleStatusChange(candidate.id, status)}
              onRemove={() => handleRemove(candidate.id)}
              onLinkChange={setPendingApiId}
              onLinkResolved={setPendingIdentity}
              onSaveLink={() => handleSaveLink(candidate)}
            />
          ))
        )}
      </div>
    </div>
  )
}
