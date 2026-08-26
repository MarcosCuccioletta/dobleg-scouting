import { useEffect, useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import TeamSearchSelect from './TeamSearchSelect'
import AssigneeSelect from './AssigneeSelect'
import { createClubNeed } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import type { ClubNeed, MarketTeamSearchResult } from '@/types/market'

export default function NewNeedForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (need: ClubNeed) => void }) {
  const { user, userDisplayName } = useAuth()
  const [team, setTeam] = useState<MarketTeamSearchResult | null>(null)
  const [positionLabel, setPositionLabel] = useState('')
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [assigneeName, setAssigneeName] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = team != null && positionLabel.trim().length > 0

  // Reiniciar el formulario cada vez que se abre la hoja: MobileSheet no desmonta
  // sus hijos al cerrar (retorna null visualmente pero mantiene el árbol montado),
  // así que sin este efecto el estado local sobrevive a un cierre por backdrop
  // sin guardar y reaparece con datos de un intento abandonado al reabrir.
  useEffect(() => {
    if (!open) return
    setTeam(null)
    setPositionLabel('')
    setAssigneeId(null)
    setAssigneeName('')
    setFollowupDate('')
    setSaving(false)
    setError('')
  }, [open])

  const handleSave = async () => {
    if (!team || !positionLabel.trim()) return
    setSaving(true)
    setError('')
    const result = await createClubNeed(
      {
        team_id: team.id,
        team_name: team.name,
        team_logo: team.logo,
        position_label: positionLabel.trim(),
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
    setPositionLabel('')
    setAssigneeId(null)
    setAssigneeName('')
    setFollowupDate('')
    onClose()
  }

  return (
    <MobileSheet open={open} onClose={onClose} title="Nuevo objetivo">
      <div className="space-y-4 p-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Club</label>
          <TeamSearchSelect value={team} onChange={setTeam} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">¿Qué busca?</label>
          <input
            type="text"
            value={positionLabel}
            onChange={e => setPositionLabel(e.target.value)}
            placeholder="Ej: Lateral derecho"
            className="input-apple text-sm w-full"
          />
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
          {saving ? 'Guardando...' : 'Guardar objetivo'}
        </button>
      </div>
    </MobileSheet>
  )
}
