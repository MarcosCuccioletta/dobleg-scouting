import { useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import TeamSearchSelect from './TeamSearchSelect'
import AssigneeSelect from './AssigneeSelect'
import PlayerLinkField from './PlayerLinkField'
import { createNegotiation } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import type { Negotiation, MarketTeamSearchResult } from '@/types/market'

export default function NewNegotiationForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (negotiation: Negotiation) => void }) {
  const { user, userDisplayName } = useAuth()
  const [team, setTeam] = useState<MarketTeamSearchResult | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [playerApiId, setPlayerApiId] = useState<number | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [assigneeName, setAssigneeName] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = team != null && playerName.trim().length > 0

  const handleSave = async () => {
    if (!team || !playerName.trim()) return
    setSaving(true)
    setError('')
    const result = await createNegotiation(
      {
        team_id: team.id,
        team_name: team.name,
        team_logo: team.logo,
        player_name: playerName.trim(),
        player_api_id: playerApiId,
        player_source: playerApiId != null ? 'interno' : null,
        contact_name: contactName || null,
        contact_role: contactRole || null,
        assigned_to_id: assigneeId,
        assigned_to_name: assigneeName || null,
        next_followup_date: followupDate || null,
      },
      user?.id ?? null,
      userDisplayName || 'Usuario',
    )
    setSaving(false)
    if (!result) { setError('No se pudo guardar. Probá de nuevo.'); return }
    onCreated(result)
    setTeam(null)
    setPlayerName('')
    setPlayerApiId(null)
    setContactName('')
    setContactRole('')
    setAssigneeId(null)
    setAssigneeName('')
    setFollowupDate('')
    onClose()
  }

  return (
    <MobileSheet open={open} onClose={onClose} title="Nueva negociación">
      <div className="space-y-4 p-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Club</label>
          <TeamSearchSelect value={team} onChange={setTeam} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Jugador</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Nombre del jugador"
            className="input-apple text-sm w-full mb-2"
          />
          <PlayerLinkField playerName={playerName} playerApiId={playerApiId} onChange={setPlayerApiId} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Contacto</label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Nombre"
              className="input-apple text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Cargo</label>
            <input
              type="text"
              value={contactRole}
              onChange={e => setContactRole(e.target.value)}
              placeholder="Ej: Director deportivo"
              className="input-apple text-sm w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Responsable</label>
          <AssigneeSelect value={assigneeId} onChange={(id, name) => { setAssigneeId(id); setAssigneeName(name) }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Volver a hablar el (opcional)</label>
          <input
            type="date"
            value={followupDate}
            onChange={e => setFollowupDate(e.target.value)}
            className="input-apple text-sm w-full"
          />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Guardando...' : 'Guardar negociación'}
        </button>
      </div>
    </MobileSheet>
  )
}
