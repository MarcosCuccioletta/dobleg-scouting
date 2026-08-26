import { useEffect, useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import MarketNotesPanel from './MarketNotesPanel'
import AssigneeSelect from './AssigneeSelect'
import PlayerLinkField, { type ResolvedPlayerIdentity } from './PlayerLinkField'
import { NEGOTIATION_STATUS_LABEL_KEY } from './NegotiationCard'
import { updateNegotiationStatus, reassignNegotiation, linkNegotiationPlayer, fetchPlayerIdentity } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { TeamLogo, PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { buildPlayerPhotoUrl, computeAge } from '@/utils/marketAlerts'
import type { Negotiation, NegotiationStatus } from '@/types/market'

export default function NegotiationDetailSheet({
  negotiation,
  open,
  onClose,
  onUpdated,
}: {
  negotiation: Negotiation | null
  open: boolean
  onClose: () => void
  onUpdated: (n: Negotiation) => void
}) {
  const { user, userDisplayName } = useAuth()
  const { t } = useLanguage()
  const [reassigning, setReassigning] = useState(false)
  const [linking, setLinking] = useState(false)
  const [pendingApiId, setPendingApiId] = useState<number | null>(null)
  const [pendingIdentity, setPendingIdentity] = useState<ResolvedPlayerIdentity | null>(null)
  const [notesRefreshSignal, setNotesRefreshSignal] = useState(0)
  const [headerAge, setHeaderAge] = useState<number | null>(null)

  // Edad del jugador ya vinculado — se muestra siempre en el encabezado, no
  // sólo mientras se edita el vínculo (a diferencia de la resolución dentro
  // de PlayerLinkField, que sólo corre cuando la sección "Vincular jugador"
  // está abierta).
  useEffect(() => {
    if (!negotiation?.player_api_id) { setHeaderAge(null); return }
    let active = true
    fetchPlayerIdentity(negotiation.player_api_id).then(identity => {
      if (active) setHeaderAge(identity ? computeAge(identity.birth_date) : null)
    })
    return () => { active = false }
  }, [negotiation?.player_api_id])

  if (!negotiation) return null

  const handleStatusChange = async (status: NegotiationStatus) => {
    const ok = await updateNegotiationStatus(negotiation.id, status)
    if (ok) onUpdated({ ...negotiation, status })
  }

  const handleReassign = async (id: number, name: string) => {
    const ok = await reassignNegotiation(negotiation.id, id, name, user?.id ?? null, userDisplayName || 'Usuario')
    if (ok) {
      onUpdated({ ...negotiation, assigned_to_id: id, assigned_to_name: name })
      setReassigning(false)
      setNotesRefreshSignal(s => s + 1)
    }
  }

  const openLinking = () => {
    setPendingApiId(negotiation.player_api_id)
    setPendingIdentity(null)
    setLinking(l => !l)
  }

  const handleSaveLink = async () => {
    if (pendingApiId == null) return
    const ok = await linkNegotiationPlayer(negotiation.id, pendingApiId, 'externo', pendingIdentity?.name)
    if (ok) {
      onUpdated({
        ...negotiation,
        player_api_id: pendingApiId,
        player_source: 'externo',
        player_name: pendingIdentity?.name ?? negotiation.player_name,
      })
      setLinking(false)
    }
  }

  const photoUrl = buildPlayerPhotoUrl(negotiation.player_api_id)

  return (
    <MobileSheet open={open} onClose={onClose} title={t('mercado.negociacionTitulo')}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TeamLogo src={negotiation.team_logo} className="w-12 h-12 drop-shadow-md flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-apple-gray-800 dark:text-white truncate">{negotiation.team_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <PlayerPhoto src={photoUrl} name={negotiation.player_name} size="sm" />
              <span className="text-sm text-apple-gray-600 dark:text-apple-gray-300 truncate">
                {negotiation.player_name}{headerAge != null && ` · ${headerAge} ${t('externo.anios')}`}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">{t('mercado.estado')}</label>
          <select
            value={negotiation.status}
            onChange={e => handleStatusChange(e.target.value as NegotiationStatus)}
            className="input-apple text-sm w-full"
          >
            {(Object.keys(NEGOTIATION_STATUS_LABEL_KEY) as NegotiationStatus[]).map(s => (
              <option key={s} value={s}>{t(NEGOTIATION_STATUS_LABEL_KEY[s])}</option>
            ))}
          </select>
        </div>

        {(negotiation.contact_name || negotiation.contact_role) && (
          <p className="text-xs text-apple-gray-500">
            {t('mercado.contactoConDatos')} {negotiation.contact_name}{negotiation.contact_role ? ` · ${negotiation.contact_role}` : ''}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-2xs text-apple-gray-400">{t('mercado.responsable')}</p>
            <p className="text-sm text-apple-gray-700 dark:text-apple-gray-200 truncate">{negotiation.assigned_to_name || t('mercado.sinAsignar')}</p>
          </div>
          <button onClick={() => setReassigning(r => !r)} className="text-xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
            {t('mercado.reasignar')}
          </button>
        </div>
        {reassigning && <AssigneeSelect value={negotiation.assigned_to_id} onChange={handleReassign} />}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-2xs text-apple-gray-400">
            {negotiation.player_api_id ? t('mercado.vinculadoApi').replace('{id}', String(negotiation.player_api_id)) : t('mercado.sinVincularApi')}
          </p>
          <button onClick={openLinking} className="text-xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
            {t('mercado.vincularJugador')}
          </button>
        </div>
        {linking && (
          <div className="space-y-2">
            <PlayerLinkField
              playerName={negotiation.player_name}
              playerApiId={pendingApiId}
              onChange={setPendingApiId}
              onResolved={setPendingIdentity}
            />
            <button
              onClick={handleSaveLink}
              disabled={pendingApiId == null}
              className="text-xs font-semibold text-white bg-brand-green px-3 py-1.5 rounded-lg hover:bg-emerald-600 disabled:opacity-50"
            >
              {t('mercado.guardarVinculo')}
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-apple-gray-100 dark:border-apple-gray-700">
          <MarketNotesPanel
            target={{ negotiationId: negotiation.id }}
            onFollowupSynced={date => onUpdated({ ...negotiation, next_followup_date: date })}
            refreshSignal={notesRefreshSignal}
          />
        </div>
      </div>
    </MobileSheet>
  )
}
