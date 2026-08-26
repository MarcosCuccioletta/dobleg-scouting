import { useEffect, useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import TeamSearchSelect from './TeamSearchSelect'
import AssigneeSelect from './AssigneeSelect'
import PlayerLinkField, { type ResolvedPlayerIdentity } from './PlayerLinkField'
import { createNegotiation, isMarketLinkAdmin } from '@/services/marketService'
import { isValidFollowupDate } from '@/utils/marketAlerts'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import type { Negotiation, MarketTeamSearchResult } from '@/types/market'

export default function NewNegotiationForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (negotiation: Negotiation) => void }) {
  const { user, userDisplayName } = useAuth()
  const { t } = useLanguage()
  const canLink = isMarketLinkAdmin(user?.email)

  const [playerName, setPlayerName] = useState('')
  const [playerApiId, setPlayerApiId] = useState<number | null>(null)

  const [isFreeAgent, setIsFreeAgent] = useState(false)
  const [currentTeam, setCurrentTeam] = useState<MarketTeamSearchResult | null>(null)
  const [currentClubContact, setCurrentClubContact] = useState('')

  const [noTargetYet, setNoTargetYet] = useState(false)
  const [targetTeam, setTargetTeam] = useState<MarketTeamSearchResult | null>(null)
  const [targetContactName, setTargetContactName] = useState('')
  const [targetContactRole, setTargetContactRole] = useState('')

  const [agentName, setAgentName] = useState('')
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [assigneeName, setAssigneeName] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = playerName.trim().length > 0 && (isFreeAgent || currentTeam != null || noTargetYet || targetTeam != null)

  // Reiniciar el formulario cada vez que se abre la hoja: MobileSheet no desmonta
  // sus hijos al cerrar (retorna null visualmente pero mantiene el árbol montado),
  // así que sin este efecto el estado local sobrevive a un cierre por backdrop
  // sin guardar y reaparece con datos de un intento abandonado al reabrir.
  useEffect(() => {
    if (!open) return
    setPlayerName('')
    setPlayerApiId(null)
    setIsFreeAgent(false)
    setCurrentTeam(null)
    setCurrentClubContact('')
    setNoTargetYet(false)
    setTargetTeam(null)
    setTargetContactName('')
    setTargetContactRole('')
    setAgentName('')
    setAssigneeId(null)
    setAssigneeName('')
    setFollowupDate('')
    setSaving(false)
    setError('')
  }, [open])

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    const result = await createNegotiation(
      {
        team_id: noTargetYet ? null : (targetTeam?.id ?? null),
        team_name: noTargetYet ? null : (targetTeam?.name ?? null),
        team_logo: noTargetYet ? null : (targetTeam?.logo ?? null),
        current_team_id: isFreeAgent ? null : (currentTeam?.id ?? null),
        current_team_name: isFreeAgent ? null : (currentTeam?.name ?? null),
        current_team_logo: isFreeAgent ? null : (currentTeam?.logo ?? null),
        player_name: playerName.trim(),
        player_api_id: playerApiId,
        player_source: playerApiId != null ? 'externo' : null,
        agent_name: agentName.trim() || null,
        target_club_contact_name: targetContactName.trim() || null,
        target_club_contact_role: targetContactRole.trim() || null,
        current_club_contact_name: currentClubContact.trim() || null,
        assigned_to_id: assigneeId,
        assigned_to_name: assigneeName || null,
        next_followup_date: followupDate && isValidFollowupDate(followupDate) ? followupDate : null,
      },
      user?.id ?? null,
      userDisplayName || 'Usuario',
    )
    setSaving(false)
    if (!result) { setError(t('mercado.errorGuardar')); return }
    onCreated(result)
    onClose()
  }

  return (
    <MobileSheet open={open} onClose={onClose} title={t('mercado.nuevaNegociacion')}>
      <div className="space-y-4 p-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">{t('mercado.jugador')}</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder={t('mercado.nombreJugadorPlaceholder')}
            className="input-apple text-sm w-full mb-2"
          />
          {canLink ? (
            <PlayerLinkField
              playerName={playerName}
              playerApiId={playerApiId}
              onChange={setPlayerApiId}
              onResolved={(identity: ResolvedPlayerIdentity | null) => { if (identity) setPlayerName(identity.name) }}
            />
          ) : (
            <p className="text-2xs text-apple-gray-400">{t('mercado.vinculoSoloAdmin')}</p>
          )}
        </div>

        {/* Club actual */}
        <div className="rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-apple-gray-500">{t('mercado.clubActual')}</label>
            <label className="flex items-center gap-1.5 text-2xs text-apple-gray-500 cursor-pointer">
              <input type="checkbox" checked={isFreeAgent} onChange={e => { setIsFreeAgent(e.target.checked); if (e.target.checked) setCurrentTeam(null) }} className="rounded" />
              {t('mercado.jugadorLibre')}
            </label>
          </div>
          {!isFreeAgent && (
            <>
              <TeamSearchSelect value={currentTeam} onChange={setCurrentTeam} />
              <input
                type="text"
                value={currentClubContact}
                onChange={e => setCurrentClubContact(e.target.value)}
                placeholder={t('mercado.directorDeportivoPlaceholder')}
                className="input-apple text-sm w-full"
              />
            </>
          )}
        </div>

        {/* Club destino */}
        <div className="rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-apple-gray-500">{t('mercado.clubDestino')}</label>
            <label className="flex items-center gap-1.5 text-2xs text-apple-gray-500 cursor-pointer">
              <input type="checkbox" checked={noTargetYet} onChange={e => { setNoTargetYet(e.target.checked); if (e.target.checked) setTargetTeam(null) }} className="rounded" />
              {t('mercado.soloLiberarlo')}
            </label>
          </div>
          {!noTargetYet && (
            <>
              <TeamSearchSelect value={targetTeam} onChange={setTargetTeam} />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={targetContactName}
                  onChange={e => setTargetContactName(e.target.value)}
                  placeholder={t('mercado.directorDeportivoPlaceholder')}
                  className="input-apple text-sm w-full"
                />
                <input
                  type="text"
                  value={targetContactRole}
                  onChange={e => setTargetContactRole(e.target.value)}
                  placeholder={t('mercado.cargoPlaceholder')}
                  className="input-apple text-sm w-full"
                />
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">{t('mercado.representante')}</label>
          <input
            type="text"
            value={agentName}
            onChange={e => setAgentName(e.target.value)}
            placeholder={t('mercado.representantePlaceholder')}
            className="input-apple text-sm w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">{t('mercado.responsable')}</label>
          <AssigneeSelect value={assigneeId} onChange={(id, name) => { setAssigneeId(id); setAssigneeName(name) }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">{t('mercado.volverAHablar')}</label>
          <input
            type="date"
            value={followupDate}
            onChange={e => setFollowupDate(e.target.value)}
            min="2020-01-01"
            max="2100-12-31"
            className="input-apple text-sm w-full"
          />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? t('mercado.guardando') : t('mercado.guardarNegociacion')}
        </button>
      </div>
    </MobileSheet>
  )
}
