import { useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import MarketNotesPanel from './MarketNotesPanel'
import AssigneeSelect from './AssigneeSelect'
import PlayerLinkField from './PlayerLinkField'
import { NEGOTIATION_STATUS_LABEL } from './NegotiationCard'
import { updateNegotiationStatus, reassignNegotiation, linkNegotiationPlayer } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import { TeamLogo, PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
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
  const [reassigning, setReassigning] = useState(false)
  const [linking, setLinking] = useState(false)
  const [pendingApiId, setPendingApiId] = useState<number | null>(null)

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
    }
  }

  const handleSaveLink = async () => {
    if (pendingApiId == null) return
    const ok = await linkNegotiationPlayer(negotiation.id, pendingApiId, 'externo')
    if (ok) {
      onUpdated({ ...negotiation, player_api_id: pendingApiId, player_source: 'externo' })
      setLinking(false)
    }
  }

  const photoUrl = buildPlayerPhotoUrl(negotiation.player_api_id)

  return (
    <MobileSheet open={open} onClose={onClose} title="Negociación">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TeamLogo src={negotiation.team_logo} className="w-12 h-12 drop-shadow-md flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-apple-gray-800 dark:text-white truncate">{negotiation.team_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <PlayerPhoto src={photoUrl} name={negotiation.player_name} size="sm" />
              <span className="text-sm text-apple-gray-600 dark:text-apple-gray-300 truncate">{negotiation.player_name}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Estado</label>
          <select
            value={negotiation.status}
            onChange={e => handleStatusChange(e.target.value as NegotiationStatus)}
            className="input-apple text-sm w-full"
          >
            {(Object.keys(NEGOTIATION_STATUS_LABEL) as NegotiationStatus[]).map(s => (
              <option key={s} value={s}>{NEGOTIATION_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {(negotiation.contact_name || negotiation.contact_role) && (
          <p className="text-xs text-apple-gray-500">
            Contacto: {negotiation.contact_name}{negotiation.contact_role ? ` · ${negotiation.contact_role}` : ''}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-2xs text-apple-gray-400">Responsable</p>
            <p className="text-sm text-apple-gray-700 dark:text-apple-gray-200 truncate">{negotiation.assigned_to_name || 'Sin asignar'}</p>
          </div>
          <button onClick={() => setReassigning(r => !r)} className="text-xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
            Reasignar
          </button>
        </div>
        {reassigning && <AssigneeSelect value={negotiation.assigned_to_id} onChange={handleReassign} />}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-2xs text-apple-gray-400">
            {negotiation.player_api_id ? `Vinculado a la API (#${negotiation.player_api_id})` : 'Sin vincular a la API'}
          </p>
          <button onClick={() => setLinking(l => !l)} className="text-xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
            Vincular jugador
          </button>
        </div>
        {linking && (
          <div className="space-y-2">
            <PlayerLinkField playerName={negotiation.player_name} playerApiId={negotiation.player_api_id} onChange={setPendingApiId} />
            <button
              onClick={handleSaveLink}
              disabled={pendingApiId == null}
              className="text-xs font-semibold text-white bg-brand-green px-3 py-1.5 rounded-lg hover:bg-emerald-600 disabled:opacity-50"
            >
              Guardar vínculo
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-apple-gray-100 dark:border-apple-gray-700">
          <MarketNotesPanel
            target={{ negotiationId: negotiation.id }}
            onFollowupSynced={date => onUpdated({ ...negotiation, next_followup_date: date })}
          />
        </div>
      </div>
    </MobileSheet>
  )
}
