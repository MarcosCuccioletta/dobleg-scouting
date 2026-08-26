import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { TeamLogo } from '@/components/ui/PlayerPhoto'
import AssigneeSelect from './AssigneeSelect'
import MarketNotesPanel from './MarketNotesPanel'
import NeedCandidatesPanel from './NeedCandidatesPanel'
import { NEED_STATUS_LABEL_KEY, NEED_STATUS_COLOR } from './marketLabels'
import { updateNeedStatus, reassignNeed } from '@/services/marketService'
import type { ClubNeed, NeedStatus } from '@/types/market'

export default function NeedRow({
  need,
  onUpdated,
  defaultExpanded = false,
  overdue = false,
}: {
  need: ClubNeed
  onUpdated: (n: ClubNeed) => void
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
  const [notesRefreshSignal, setNotesRefreshSignal] = useState(0)

  const handleStatusChange = async (status: NeedStatus) => {
    const ok = await updateNeedStatus(need.id, status)
    if (ok) onUpdated({ ...need, status })
  }

  const handleReassign = async (id: number, name: string) => {
    const ok = await reassignNeed(need.id, id, name, user?.id ?? null, userDisplayName || 'Usuario')
    if (ok) {
      onUpdated({ ...need, assigned_to_id: id, assigned_to_name: name })
      setReassigning(false)
      setNotesRefreshSignal(s => s + 1)
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
            <TeamLogo src={need.team_logo} className="w-8 h-8 drop-shadow-md flex-shrink-0" />
          </div>

          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="font-semibold text-sm text-apple-gray-800 dark:text-white truncate">{need.team_name}</p>
            <p className="text-2xs text-apple-gray-400 truncate">{need.position_label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pl-[3.25rem] sm:pl-0 sm:contents">
          <span className={`inline-flex max-w-full px-2 py-1 rounded-full text-2xs font-semibold truncate ${NEED_STATUS_COLOR[need.status]}`}>
            {t(NEED_STATUS_LABEL_KEY[need.status])}
          </span>
          <span className="text-2xs text-apple-gray-400 truncate min-w-0">{need.assigned_to_name || '—'}</span>
          <span className={`text-2xs tabular-nums ml-auto sm:ml-0 sm:text-right ${overdue ? 'text-red-500 font-semibold' : 'text-apple-gray-400'}`}>
            {need.next_followup_date ?? '—'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-apple-gray-100 dark:border-apple-gray-700 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div>
              <label className="block text-2xs font-medium text-apple-gray-400 mb-1">{t('mercado.estado')}</label>
              <select
                value={need.status}
                onChange={e => handleStatusChange(e.target.value as NeedStatus)}
                className="input-apple text-sm w-full"
              >
                {(Object.keys(NEED_STATUS_LABEL_KEY) as NeedStatus[]).map(s => (
                  <option key={s} value={s}>{t(NEED_STATUS_LABEL_KEY[s])}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xs font-medium text-apple-gray-400 mb-1">{t('mercado.responsable')}</p>
                <p className="text-sm text-apple-gray-700 dark:text-apple-gray-200 truncate">{need.assigned_to_name || t('mercado.sinAsignar')}</p>
              </div>
              <button onClick={() => setReassigning(r => !r)} className="text-xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
                {t('mercado.reasignar')}
              </button>
            </div>
            {reassigning && <div className="sm:col-span-2"><AssigneeSelect value={need.assigned_to_id} onChange={handleReassign} /></div>}
          </div>

          <div className="pt-2 border-t border-apple-gray-100 dark:border-apple-gray-700">
            <NeedCandidatesPanel needId={need.id} />
          </div>

          <div className="pt-2 border-t border-apple-gray-100 dark:border-apple-gray-700">
            <MarketNotesPanel
              target={{ needId: need.id }}
              onFollowupSynced={date => onUpdated({ ...need, next_followup_date: date })}
              refreshSignal={notesRefreshSignal}
            />
          </div>
        </div>
      )}
    </div>
  )
}
