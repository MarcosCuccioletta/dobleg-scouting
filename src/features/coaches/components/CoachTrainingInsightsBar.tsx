import type { TrainingInsights } from '@/features/coaches/trainingInsights'

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 22c4.5 0 7.5-3 7.5-7 0-3.5-2-5.5-3-7.5-.5 2-1.5 3-2.5 3 .5-3-1-6-4-7 .5 3-1 5-2.5 7C6 12.5 4.5 14 4.5 16c0 4 3 6 7.5 6z"
      />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <circle cx="12" cy="12" r="0.5" strokeWidth={2} />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

export default function CoachTrainingInsightsBar({ insights }: { insights: TrainingInsights }) {
  if (!insights.hasEnoughData) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {insights.streakDays > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-500/10 text-orange-500 px-3 py-1.5 rounded-full">
          <FlameIcon className="w-4 h-4" />
          {insights.streakDays} {insights.streakDays === 1 ? 'día seguido' : 'días seguidos'}
        </span>
      )}
      {insights.topFocus && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-full">
          <TargetIcon className="w-4 h-4" />
          Foco: {insights.topFocus.tag}
        </span>
      )}
      {insights.overloadWarning && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-500/10 text-red-500 px-3 py-1.5 rounded-full">
          <WarningIcon className="w-4 h-4" />
          Varios días de alta intensidad seguidos
        </span>
      )}
    </div>
  )
}
