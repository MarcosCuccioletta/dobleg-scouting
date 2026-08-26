import { Link } from 'react-router-dom'
import { AGENCY_COACHES } from '@/constants/agencyCoaches'
import { useLanguage } from '@/context/LanguageContext'

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function CoachesListPage() {
  const { t } = useLanguage()
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight">
          {t('nav.entrenadores')}
        </h1>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 mt-0.5">
          {t('coachesList.subtitulo')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {AGENCY_COACHES.map(coach => {
          const isActive = coach.status === 'activo'
          return (
            <Link
              key={coach.key}
              to={`/entrenadores/${coach.key}`}
              className="group flex items-center gap-4 min-h-[96px] bg-white dark:bg-apple-gray-800 rounded-apple-lg border border-apple-gray-200 dark:border-apple-gray-700 shadow-apple dark:shadow-apple-dark p-5 transition-all duration-200 ease-apple hover:shadow-apple-md dark:hover:shadow-apple-dark-md hover:border-apple-gray-300 dark:hover:border-apple-gray-600 hover:-translate-y-0.5"
            >
              {coach.photo ? (
                <img
                  src={coach.photo}
                  alt=""
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0 ring-2 ring-offset-2 dark:ring-offset-apple-gray-800 ${
                    isActive ? 'ring-brand-green/40' : 'ring-apple-gray-200 dark:ring-apple-gray-700'
                  }`}
                />
              ) : (
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex-shrink-0 flex items-center justify-center text-lg sm:text-xl font-bold bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400 ring-2 ring-offset-2 dark:ring-offset-apple-gray-800 ${
                    isActive ? 'ring-brand-green/40' : 'ring-apple-gray-200 dark:ring-apple-gray-700'
                  }`}
                >
                  {initialsOf(coach.fullName)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-apple-gray-800 dark:text-white truncate">
                  {coach.fullName}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 mt-1 text-sm font-medium ${
                    isActive
                      ? 'text-brand-green'
                      : 'text-apple-gray-500 dark:text-apple-gray-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-brand-green animate-pulse-soft' : 'bg-apple-gray-300 dark:bg-apple-gray-600'
                    }`}
                  />
                  <span className="truncate">{isActive ? coach.club : t('coachesList.sinClub')}</span>
                </span>
              </div>

              <svg
                className="w-5 h-5 flex-shrink-0 text-apple-gray-300 dark:text-apple-gray-600 transition-transform duration-200 ease-apple group-hover:translate-x-0.5 group-hover:text-apple-gray-400 dark:group-hover:text-apple-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
