import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import ClubTransferBadge from './ClubTransferBadge'
import AssigneeSelect from './AssigneeSelect'
import PlayerLinkField from './PlayerLinkField'
import MarketNotesPanel from './MarketNotesPanel'
import { NEGOTIATION_STATUS_LABEL_KEY, NEGOTIATION_STATUS_COLOR } from './marketLabels'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
import { updateNegotiationStatus, reassignNegotiation, linkNegotiationPlayer, isMarketLinkAdmin } from '@/services/marketService'
import type { Negotiation, NegotiationStatus } from '@/types/market'

export default function NegotiationRow({
  negotiation,
  onUpdated,
  defaultExpanded = false,
  overdue = false,
}: {
  negotiation: Negotiation
  onUpdated: (n: Negotiation) => void
  defaultExpanded?: boolean
  overdue?: boolean
}) {
  const { user, userDisplayName } = useAuth()
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (defaultExpanded) rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [reassigning, setReassigning] = useState(false)
  const [linking, setLinking] = useState(false)
  const [pendingApiId, setPendingApiId] = useState<number | null>(null)
  const [pendingIdentity, setPendingIdentity] = useState<{ name: string; age: number | null } | null>(null)
  const [notesRefreshSignal, setNotesRefreshSignal] = useState(0)

  const canLink = isMarketLinkAdmin(user?.email)
  const photoUrl = buildPlayerPhotoUrl(negotiation.player_api_id)

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

  return (
    <div
      ref={rowRef}
      className={`bg-white dark:bg-apple-gray-800 rounded-xl border overflow-hidden transition-all ${defaultExpanded ? 'border-brand-green ring-1 ring-brand-green/30' : 'border-apple-gray-200 dark:border-apple-gray-700'}`}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex flex-col gap-2 sm:grid sm:grid-cols-[auto_minmax(0,2fr)_7rem_7rem_5.5rem] sm:items-center sm:gap-3 px-4 py-3 sm:py-3.5 text-left hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700/40 transition-colors font-sans"
      >
        <div className="flex items-center gap-3 min-w-0 sm:contents">
          <div className="flex items-center gap-2 flex-shrink-0">
            <svg className={`w-4 h-4 text-apple-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <ClubTransferBadge
              currentLogo={negotiation.current_team_logo}
              currentName={negotiation.current_team_name}
              targetLogo={negotiation.team_logo}
              targetName={negotiation.team_name}
            />
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none">
            <PlayerPhoto src={photoUrl} name={negotiation.player_name} size="sm" />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-apple-gray-800 dark:text-white truncate">{negotiation.player_name}</p>
              <p className="text-2xs text-apple-gray-400 truncate">
                {negotiation.current_team_name ?? t('mercado.jugadorLibre')} → {negotiation.team_name ?? t('mercado.quedaLibre')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pl-[3.25rem] sm:pl-0 sm:contents">
          <span className={`inline-flex max-w-full px-2 py-1 rounded-full text-2xs font-semibold truncate ${NEGOTIATION_STATUS_COLOR[negotiation.status]}`}>
            {t(NEGOTIATION_STATUS_LABEL_KEY[negotiation.status])}
          </span>
          <span className="text-2xs text-apple-gray-400 truncate min-w-0">{negotiation.assigned_to_name || '—'}</span>
          <span className={`text-2xs tabular-nums ml-auto sm:ml-0 sm:text-right ${overdue ? 'text-red-500 font-semibold' : 'text-apple-gray-400'}`}>
            {negotiation.next_followup_date ?? '—'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-apple-gray-100 dark:border-apple-gray-700 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div>
              <label className="block text-2xs font-medium text-apple-gray-400 mb-1">{t('mercado.estado')}</label>
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
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xs font-medium text-apple-gray-400 mb-1">{t('mercado.responsable')}</p>
                <p className="text-sm text-apple-gray-700 dark:text-apple-gray-200 truncate">{negotiation.assigned_to_name || t('mercado.sinAsignar')}</p>
              </div>
              <button onClick={() => setReassigning(r => !r)} className="text-xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
                {t('mercado.reasignar')}
              </button>
            </div>
            {reassigning && <div className="sm:col-span-2"><AssigneeSelect value={negotiation.assigned_to_id} onChange={handleReassign} /></div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-2xs font-medium text-apple-gray-400 mb-0.5">{t('mercado.representante')}</p>
              <p className="text-apple-gray-700 dark:text-apple-gray-200">{negotiation.agent_name || '—'}</p>
            </div>
            <div>
              <p className="text-2xs font-medium text-apple-gray-400 mb-0.5">{t('mercado.contactoClubActual')}</p>
              <p className="text-apple-gray-700 dark:text-apple-gray-200">{negotiation.current_club_contact_name || '—'}</p>
            </div>
            <div>
              <p className="text-2xs font-medium text-apple-gray-400 mb-0.5">{t('mercado.contactoClubDestino')}</p>
              <p className="text-apple-gray-700 dark:text-apple-gray-200">
                {negotiation.target_club_contact_name || '—'}{negotiation.target_club_contact_role ? ` · ${negotiation.target_club_contact_role}` : ''}
              </p>
            </div>
          </div>

          {canLink && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
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
      )}
    </div>
  )
}
