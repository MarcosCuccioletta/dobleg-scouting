import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  AGENCY_ACHIEVEMENTS,
  ACHIEVEMENT_TYPE_LABEL,
  ACHIEVEMENT_TYPE_ORDER,
  aggregateAchievementsByYear,
  resolveAchievementNavigationTarget,
  type AchievementType,
  type YearlyAchievementCount,
} from '@/constants/agencyAchievements'
import { useData } from '@/context/DataContext'

const TYPE_LINE_COLOR: Record<AchievementType, string> = {
  liga: '#22C55E', // brand-green
  copa: '#3B82F6',
  copa_liga: '#A855F7',
  continental: '#F59E0B',
  otro: '#6B7280',
}

const TYPE_FILTER_ALL = 'todos' as const
type TypeFilter = AchievementType | typeof TYPE_FILTER_ALL

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-xl shadow-lg border border-apple-gray-200 dark:border-apple-gray-700 p-4">
      <p className="text-xs text-apple-gray-400 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-apple-gray-600 dark:text-apple-gray-300">{entry.name}:</span>
          <span className="text-xs font-bold text-apple-gray-800 dark:text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AchievementsSection() {
  const navigate = useNavigate()
  const { internal } = useData()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(TYPE_FILTER_ALL)
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())

  const toggleSeries = (name: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const yearlyCounts = useMemo(() => aggregateAchievementsByYear(AGENCY_ACHIEVEMENTS), [])

  const years = useMemo(
    () => Array.from(new Set(AGENCY_ACHIEVEMENTS.map(a => a.year))).sort((a, b) => b - a),
    [],
  )

  const filtered = useMemo(() => {
    return AGENCY_ACHIEVEMENTS.filter(a => {
      if (typeFilter !== TYPE_FILTER_ALL && a.type !== typeFilter) return false
      if (yearFilter !== null && a.year !== yearFilter) return false
      return true
    }).sort((a, b) => b.year - a.year)
  }, [typeFilter, yearFilter])

  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-apple-gray-800 dark:text-white">Logros</h2>
          <p className="text-sm text-apple-gray-500">Títulos ganados por jugadores representados por la agencia</p>
        </div>
      </div>

      <div className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-5">
        {AGENCY_ACHIEVEMENTS.length === 0 ? (
          <p className="text-sm text-apple-gray-500 text-center py-10">
            Todavía no hay logros cargados. Se suman a medida que se van reportando.
          </p>
        ) : (
          <>
            {yearlyCounts.length > 1 && (
              <div className="h-64 mb-6 bg-apple-gray-50/50 dark:bg-apple-gray-800/30 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyCounts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="text-apple-gray-200 dark:text-apple-gray-700"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-apple-gray-500"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-apple-gray-500"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      onClick={(entry: { value?: string }) => entry.value && toggleSeries(entry.value)}
                      wrapperStyle={{ cursor: 'pointer' }}
                      formatter={(value: string) => (
                        <span
                          style={{ opacity: hiddenSeries.has(value) ? 0.4 : 1 }}
                          className="text-apple-gray-600 dark:text-apple-gray-300"
                        >
                          {value}
                        </span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="#22C55E"
                      strokeWidth={2.5}
                      dot
                      hide={hiddenSeries.has('Total')}
                    />
                    {ACHIEVEMENT_TYPE_ORDER.map(type => (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={(row: YearlyAchievementCount) => row.byType[type]}
                        name={ACHIEVEMENT_TYPE_LABEL[type]}
                        stroke={TYPE_LINE_COLOR[type]}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                        hide={hiddenSeries.has(ACHIEVEMENT_TYPE_LABEL[type])}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setTypeFilter(TYPE_FILTER_ALL)}
                className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === TYPE_FILTER_ALL
                    ? 'bg-brand-green text-apple-gray-900'
                    : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
                }`}
              >
                Todos los tipos
              </button>
              {ACHIEVEMENT_TYPE_ORDER.map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
                    typeFilter === type
                      ? 'bg-brand-green text-apple-gray-900'
                      : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
                  }`}
                >
                  {ACHIEVEMENT_TYPE_LABEL[type]}
                </button>
              ))}
              <select
                value={yearFilter ?? ''}
                onChange={e => setYearFilter(e.target.value ? Number(e.target.value) : null)}
                className="min-h-[36px] text-xs font-medium rounded-full border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 px-3 text-apple-gray-700 dark:text-apple-gray-200"
              >
                <option value="">Todos los años</option>
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-apple-gray-500 text-center py-8">
                No hay logros que coincidan con el filtro elegido.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((achievement, i) => {
                  const navigationJugador = resolveAchievementNavigationTarget(achievement, internal)
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        navigationJugador &&
                        navigate(`/jugador/${encodeURIComponent(navigationJugador)}?source=interno`)
                      }
                      disabled={!navigationJugador}
                      className="flex items-center gap-3 p-4 bg-apple-gray-50 dark:bg-apple-gray-700/50 rounded-xl text-left hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors disabled:hover:bg-apple-gray-50 dark:disabled:hover:bg-apple-gray-700/50"
                    >
                      <img
                        src={`/trophies/${achievement.type}.png`}
                        alt=""
                        className="w-14 h-14 object-contain flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-apple-gray-800 dark:text-white text-sm truncate">
                          {achievement.playerName}
                        </p>
                        <p className="text-xs text-apple-gray-500 truncate">{achievement.competition}</p>
                        <p className="text-2xs text-apple-gray-400 truncate">
                          {achievement.club} · {achievement.dateLabel ?? achievement.year}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
