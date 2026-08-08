import { useEffect, useState } from 'react'
import { fetchSquadCached, type SquadPlayer } from '@/services/footballApiService'
import { fetchSquadMinutes } from '@/services/coachService'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: 'Arquero',
  Defender: 'Defensor',
  Midfielder: 'Mediocampista',
  Attacker: 'Delantero',
}

// Orden futbolístico habitual: arqueros, defensores, mediocampistas, delanteros.
const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Attacker: 3,
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-apple-gray-400 max-w-xs">{message}</p>
    </div>
  )
}

export default function TeamRosterPanel({ teamId }: { teamId: number }) {
  const [squad, setSquad] = useState<SquadPlayer[] | null>(null)
  const [minutes, setMinutes] = useState<Record<number, { minutes: number; matches: number }>>({})

  useEffect(() => {
    let active = true
    setSquad(null)
    setMinutes({})
    fetchSquadCached(teamId).then(async players => {
      if (!active) return
      setSquad(players)
      const ids = players.map(p => p.id)
      const m = await fetchSquadMinutes(ids)
      if (active) setMinutes(m)
    })
    return () => {
      active = false
    }
  }, [teamId])

  if (squad === null) return <LoadingSpinner message="Cargando plantel..." />
  if (squad.length === 0) return <EmptyState message="No se pudo cargar el plantel." />

  const sorted = [...squad].sort((a, b) => {
    const posA = a.position ? POSITION_ORDER[a.position] ?? 99 : 99
    const posB = b.position ? POSITION_ORDER[b.position] ?? 99 : 99
    if (posA !== posB) return posA - posB
    return (a.number ?? 999) - (b.number ?? 999)
  })

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 animate-fade-in">
      {sorted.map(player => {
        const stats = minutes[player.id]
        return (
          <div
            key={player.id}
            className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-3 sm:p-4 flex flex-col items-center text-center transition-transform duration-200 ease-apple hover:-translate-y-0.5"
          >
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2 flex-shrink-0">
              {player.photo ? (
                <img
                  src={player.photo}
                  alt=""
                  className="w-full h-full rounded-full object-cover ring-2 ring-apple-gray-200/60 dark:ring-apple-gray-700/40"
                />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-sm bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400 ring-2 ring-apple-gray-200/60 dark:ring-apple-gray-700/40">
                  {initialsOf(player.name)}
                </div>
              )}
              {player.number != null && (
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-green text-apple-gray-900 text-2xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-apple-gray-800">
                  {player.number}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-apple-gray-800 dark:text-white leading-tight truncate w-full">
              {player.name}
            </p>
            <p className="text-2xs font-medium uppercase tracking-wide text-apple-gray-400 mt-0.5">
              {player.position ? POSITION_LABEL[player.position] ?? player.position : '—'}
            </p>
            {stats && (
              <span className="mt-1.5 text-2xs font-medium px-1.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green">
                {stats.minutes}' · {stats.matches} PJ (30d)
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
