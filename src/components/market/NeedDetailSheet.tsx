import { useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import MarketNotesPanel from './MarketNotesPanel'
import AssigneeSelect from './AssigneeSelect'
import { updateNeedStatus, reassignNeed } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import { TeamLogo } from '@/components/ui/PlayerPhoto'
import type { ClubNeed, NeedStatus } from '@/types/market'

const NEED_STATUS_LABEL: Record<NeedStatus, string> = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
}

export default function NeedDetailSheet({
  need,
  open,
  onClose,
  onUpdated,
}: {
  need: ClubNeed | null
  open: boolean
  onClose: () => void
  onUpdated: (n: ClubNeed) => void
}) {
  const { user, userDisplayName } = useAuth()
  const [reassigning, setReassigning] = useState(false)

  if (!need) return null

  const handleStatusChange = async (status: NeedStatus) => {
    const ok = await updateNeedStatus(need.id, status)
    if (ok) onUpdated({ ...need, status })
  }

  const handleReassign = async (id: number, name: string) => {
    const ok = await reassignNeed(need.id, id, name, user?.id ?? null, userDisplayName || 'Usuario')
    if (ok) {
      onUpdated({ ...need, assigned_to_id: id, assigned_to_name: name })
      setReassigning(false)
    }
  }

  return (
    <MobileSheet open={open} onClose={onClose} title="Objetivo">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TeamLogo src={need.team_logo} className="w-12 h-12 drop-shadow-md flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-apple-gray-800 dark:text-white truncate">{need.team_name}</p>
            <p className="text-sm text-apple-gray-600 dark:text-apple-gray-300">{need.position_label}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Estado</label>
          <select
            value={need.status}
            onChange={e => handleStatusChange(e.target.value as NeedStatus)}
            className="input-apple text-sm w-full"
          >
            {(Object.keys(NEED_STATUS_LABEL) as NeedStatus[]).map(s => (
              <option key={s} value={s}>{NEED_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-2xs text-apple-gray-400">Responsable</p>
            <p className="text-sm text-apple-gray-700 dark:text-apple-gray-200 truncate">{need.assigned_to_name || 'Sin asignar'}</p>
          </div>
          <button onClick={() => setReassigning(r => !r)} className="text-xs font-medium text-brand-green hover:text-emerald-600 flex-shrink-0">
            Reasignar
          </button>
        </div>
        {reassigning && <AssigneeSelect value={need.assigned_to_id} onChange={handleReassign} />}

        <div className="pt-2 border-t border-apple-gray-100 dark:border-apple-gray-700">
          <MarketNotesPanel
            target={{ needId: need.id }}
            onFollowupSynced={date => onUpdated({ ...need, next_followup_date: date })}
          />
        </div>
      </div>
    </MobileSheet>
  )
}
