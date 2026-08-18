import { TeamLogo } from '@/components/ui/PlayerPhoto'
import type { ClubNeed } from '@/types/market'

const NEED_STATUS_LABEL: Record<ClubNeed['status'], string> = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
}

const NEED_STATUS_COLOR: Record<ClubNeed['status'], string> = {
  abierto: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  cerrado: 'bg-apple-gray-100 text-apple-gray-600 dark:bg-apple-gray-700 dark:text-apple-gray-300',
}

export default function NeedCard({ need, onClick }: { need: ClubNeed; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-4 hover:shadow-apple-md dark:hover:shadow-apple-dark-md transition-all"
    >
      <div className="flex items-center gap-3 mb-2">
        <TeamLogo src={need.team_logo} className="w-10 h-10 drop-shadow-md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-apple-gray-800 dark:text-white truncate">{need.team_name}</p>
          {need.assigned_to_name && (
            <p className="text-xs text-apple-gray-400">Responsable: {need.assigned_to_name}</p>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-2xs font-semibold flex-shrink-0 ${NEED_STATUS_COLOR[need.status]}`}>
          {NEED_STATUS_LABEL[need.status]}
        </span>
      </div>
      <p className="text-sm font-medium text-apple-gray-700 dark:text-apple-gray-200">{need.position_label}</p>
      {need.next_followup_date && (
        <div className="mt-3 pt-3 border-t border-apple-gray-100 dark:border-apple-gray-700 text-xs text-apple-gray-500">
          Seguimiento: {need.next_followup_date}
        </div>
      )}
    </button>
  )
}
