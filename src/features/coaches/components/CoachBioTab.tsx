import { useEffect, useState } from 'react'
import { fetchCoachProfile, type CoachProfile } from '@/services/footballApiService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGE_LOCALES } from '@/constants/translations'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function formatMonthYear(iso: string | null, locale: string): string {
  if (!iso) return '—'
  const [y, m] = iso.split('-').map(Number)
  if (Number.isNaN(y) || Number.isNaN(m)) return '—'
  const date = new Date(y, m - 1, 1)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

function formatCareerEnd(iso: string | null, locale: string, actualidad: string): string {
  if (!iso) return actualidad
  return formatMonthYear(iso, locale)
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

export default function CoachBioTab({ coach }: { coach: AgencyCoach }) {
  const { t, language } = useLanguage()
  const locale = LANGUAGE_LOCALES[language]
  const [profile, setProfile] = useState<CoachProfile | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    fetchCoachProfile(coach.key, coach.fullName, coach.coachApiId).then(p => {
      if (active) setProfile(p)
    })
    return () => {
      active = false
    }
  }, [coach.key, coach.fullName, coach.coachApiId])

  if (profile === undefined) return <LoadingSpinner message={t('coachDetail.bioCargandoPerfil')} />

  if (profile === null) {
    return <EmptyState message={t('coachDetail.bioNoEncontrado')} />
  }

  const bioFacts = [
    profile.age !== null && { label: t('coachDetail.bioEdad'), value: `${profile.age} ${t('externo.anios')}` },
    profile.nationality && { label: t('coachDetail.bioNacionalidad'), value: profile.nationality },
    profile.birthPlace && { label: t('coachDetail.bioLugarNacimiento'), value: `${profile.birthPlace}${profile.birthCountry ? `, ${profile.birthCountry}` : ''}` },
  ].filter((f): f is { label: string; value: string } => Boolean(f))

  return (
    <div className="space-y-6 animate-fade-in">
      {bioFacts.length > 0 && (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {bioFacts.map(fact => (
            <div key={fact.label}>
              <p className="text-2xs font-semibold uppercase text-apple-gray-400 mb-0.5">{fact.label}</p>
              <p className="text-sm font-semibold text-apple-gray-800 dark:text-white">{fact.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-apple-gray-800 dark:text-white">{t('coachDetail.bioTrayectoria')}</h2>
        {profile.career.length === 0 && <EmptyState message={t('coachDetail.bioSinTrayectoria')} />}
        {profile.career.map((entry, i) => (
          <div
            key={`${entry.teamId}-${entry.start ?? i}`}
            className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4"
          >
            <img
              src={entry.teamLogo}
              alt=""
              className="w-8 h-8 object-contain flex-shrink-0"
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{entry.teamName}</p>
              <p className="text-xs text-apple-gray-400">
                {formatMonthYear(entry.start, locale)} — {formatCareerEnd(entry.end, locale, t('coachDetail.bioActualidad'))}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
