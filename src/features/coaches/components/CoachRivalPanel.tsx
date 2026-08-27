import { useEffect, useState } from 'react'
import TeamRosterPanel from './TeamRosterPanel'
import CoachStreakStrip from './CoachStreakStrip'
import { fetchTeamFixtures } from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'
import { useLanguage } from '@/context/LanguageContext'

export default function CoachRivalPanel({ teamId, teamName }: { teamId: number; teamName: string }) {
  const { t } = useLanguage()
  const [fixtures, setFixtures] = useState<AgencyFixture[] | null>(null)

  useEffect(() => {
    let active = true
    fetchTeamFixtures(teamId).then(f => {
      if (active) setFixtures(f)
    })
    return () => {
      active = false
    }
  }, [teamId])

  return (
    <div className="mt-4 pt-4 border-t border-apple-gray-200/60 dark:border-apple-gray-700/40">
      <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">{t('coachDetail.rachaReciente')}</p>
      {fixtures && <CoachStreakStrip fixtures={fixtures} />}
      <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mt-4 mb-2">{t('coachDetail.tabPlantel')}</p>
      <TeamRosterPanel teamId={teamId} teamName={teamName} />
    </div>
  )
}
