import { useEffect, useState } from 'react'
import { fetchLeagueStandings, type StandingRow } from '@/services/footballApiService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import { useLanguage } from '@/context/LanguageContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StandingsTable from '@/components/shared/StandingsTable'

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

export default function CoachLeagueTab({ coach }: { coach: AgencyCoach }) {
  const { t } = useLanguage()
  const [groups, setGroups] = useState<StandingRow[][] | null>(null)

  useEffect(() => {
    if (!coach.leagueApiId || !coach.leagueSeason) return
    let active = true
    fetchLeagueStandings(coach.leagueApiId, coach.leagueSeason)
      .then(g => {
        if (active) setGroups(g)
      })
      .catch(() => {
        if (active) setGroups([])
      })
    return () => {
      active = false
    }
  }, [coach.leagueApiId, coach.leagueSeason])

  if (!coach.leagueApiId || !coach.leagueSeason) {
    return <EmptyState message={t('coachDetail.ligaSinDatos')} />
  }

  if (groups === null) return <LoadingSpinner message={t('coachDetail.ligaCargando')} />
  if (groups.length === 0) return <EmptyState message={t('coachDetail.ligaError')} />

  return <StandingsTable groups={groups} highlightTeamId={coach.apiTeamId} />
}
