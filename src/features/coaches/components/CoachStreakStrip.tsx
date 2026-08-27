import { buildStreak, RESULT_STYLES } from '../matchResult'
import type { AgencyFixture } from '@/types/footballApi'
import { useLanguage } from '@/context/LanguageContext'

export default function CoachStreakStrip({ fixtures }: { fixtures: AgencyFixture[] }) {
  const { t } = useLanguage()
  const streak = buildStreak(fixtures)
  if (streak.length === 0) return null

  return (
    <div className="flex items-center gap-1" aria-label={t('coachDetail.rachaAriaLabel')}>
      {streak.map(s => (
        <span
          key={s.fixtureId}
          className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
            s.result ? RESULT_STYLES[s.result] : RESULT_STYLES.E
          }`}
        >
          {s.result ?? '–'}
        </span>
      ))}
    </div>
  )
}
