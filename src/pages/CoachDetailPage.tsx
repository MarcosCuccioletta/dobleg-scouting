import { useParams, Link, useSearchParams } from 'react-router-dom'
import { getCoachByKey } from '@/constants/agencyCoaches'
import CoachSummaryTab from '@/features/coaches/components/CoachSummaryTab'
import CoachBioTab from '@/features/coaches/components/CoachBioTab'
import TeamRosterPanel from '@/features/coaches/components/TeamRosterPanel'
import CoachLeagueTab from '@/features/coaches/components/CoachLeagueTab'
import CoachCalendarTab from '@/features/coaches/components/CoachCalendarTab'
import CoachTrainingTab from '@/features/coaches/components/CoachTrainingTab'
import CoachNotesTab from '@/features/coaches/components/CoachNotesTab'
import CoachTacticalBoardTab from '@/features/coaches/components/CoachTacticalBoardTab'
import CoachFutureSquadTab from '@/features/coaches/components/CoachFutureSquadTab'

type CoachTab = 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'pizarra' | 'plantel_futuro' | 'reserva'

const TABS: { id: CoachTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'plantel', label: 'Plantel' },
  { id: 'liga', label: 'Liga' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'entrenamientos', label: 'Entrenamientos' },
  { id: 'notas', label: 'Notas de partidos' },
  { id: 'pizarra', label: 'Pizarra' },
  { id: 'plantel_futuro', label: 'Plantel futuro' },
]

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function CoachDetailPage() {
  const { coachKey } = useParams<{ coachKey: string }>()
  const coach = coachKey ? getCoachByKey(coachKey) : undefined
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const isValidTab = (val: string): val is CoachTab =>
    ['resumen', 'plantel', 'liga', 'calendario', 'entrenamientos', 'notas', 'pizarra', 'plantel_futuro', 'reserva'].includes(val)
  const activeTab: CoachTab = tabParam && isValidTab(tabParam) ? tabParam : 'resumen'
  const setActiveTab = (tab: CoachTab) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    next.set('tab', tab)
    return next
  }, { replace: true })

  if (!coach) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center animate-fade-in">
        <div className="w-20 h-20 bg-apple-gray-100 dark:bg-apple-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-apple dark:shadow-apple-dark">
          <svg className="w-10 h-10 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-apple-gray-800 dark:text-white mb-1.5">Entrenador no encontrado</h1>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 mb-5">
          No pudimos encontrar a este entrenador en el plantel técnico de Doble G.
        </p>
        <Link
          to="/entrenadores"
          className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-sm font-semibold transition-transform duration-200 ease-apple hover:-translate-y-0.5"
        >
          Volver a Entrenadores
        </Link>
      </div>
    )
  }

  const isActive = coach.status === 'activo'

  const backLink = (
    <Link
      to="/entrenadores"
      className="inline-flex items-center gap-2 text-sm text-apple-gray-500 dark:text-apple-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors mb-4"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Volver a Entrenadores
    </Link>
  )

  const avatar = (sizeClasses: string) =>
    coach.photo ? (
      <img
        src={coach.photo}
        alt=""
        className={`${sizeClasses} rounded-full object-cover flex-shrink-0 ring-2 ring-offset-2 dark:ring-offset-apple-gray-900 ${
          isActive ? 'ring-brand-green/40' : 'ring-apple-gray-200 dark:ring-apple-gray-700'
        }`}
      />
    ) : (
      <div
        className={`${sizeClasses} rounded-full flex-shrink-0 flex items-center justify-center font-bold bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400 ring-2 ring-offset-2 dark:ring-offset-apple-gray-900 ${
          isActive ? 'ring-brand-green/40' : 'ring-apple-gray-200 dark:ring-apple-gray-700'
        }`}
      >
        {initialsOf(coach.fullName)}
      </div>
    )

  const SIN_CLUB_TAB_IDS: CoachTab[] = ['resumen', 'entrenamientos', 'pizarra']

  const tabs = isActive
    ? (coach.reserveApiTeamId ? [...TABS, { id: 'reserva' as CoachTab, label: 'Reserva' }] : TABS)
    : TABS.filter(t => SIN_CLUB_TAB_IDS.includes(t.id))

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
      {backLink}

      <div className="flex items-center gap-4 mb-6">
        {avatar('w-16 h-16 sm:w-20 sm:h-20 text-lg sm:text-xl')}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight truncate">
            {coach.fullName}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 mt-1 text-sm font-medium ${
              isActive ? 'text-brand-green' : 'text-apple-gray-500 dark:text-apple-gray-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isActive ? 'bg-brand-green animate-pulse-soft' : 'bg-apple-gray-300 dark:bg-apple-gray-600'
              }`}
            />
            <span className="truncate">{isActive ? coach.club : 'Sin club actualmente'}</span>
          </span>
        </div>
      </div>

      {/* Tab bar: horizontal scroll on narrow viewports, never wraps/clips. Cada botón cumple min-h-[40px] para target táctil. */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-thin [-webkit-overflow-scrolling:touch]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[40px] px-4 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-apple ${
              tab.id === activeTab
                ? 'bg-brand-green text-apple-gray-900'
                : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cada Task 11-16 agrega su bloque acá, condicionado por activeTab === 'resumen' | 'plantel' | 'liga' | 'calendario' | 'entrenamientos' | 'notas' | 'reserva' */}
      {activeTab === 'resumen' && (coach.apiTeamId ? <CoachSummaryTab coach={coach} /> : <CoachBioTab coach={coach} />)}
      {activeTab === 'plantel' && coach.apiTeamId && <TeamRosterPanel teamId={coach.apiTeamId} teamName={coach.club ?? ''} />}
      {activeTab === 'reserva' && coach.reserveApiTeamId && (
        <TeamRosterPanel teamId={coach.reserveApiTeamId} teamName={coach.club ? `${coach.club} (Reserva)` : 'Reserva'} />
      )}
      {activeTab === 'liga' && coach.leagueApiId && <CoachLeagueTab coach={coach} />}
      {activeTab === 'calendario' && <CoachCalendarTab key={coach.key} coach={coach} />}
      {activeTab === 'entrenamientos' && <CoachTrainingTab coach={coach} />}
      {activeTab === 'notas' && <CoachNotesTab coach={coach} />}
      {activeTab === 'pizarra' && <CoachTacticalBoardTab key={coach.key} coach={coach} />}
      {activeTab === 'plantel_futuro' && <CoachFutureSquadTab key={coach.key} coach={coach} />}
    </div>
  )
}
