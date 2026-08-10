import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchSquadCached, type SquadPlayer } from '@/services/footballApiService'
import { fetchSquadMinutes } from '@/services/coachService'
import { useData } from '@/context/DataContext'
import { makeAgencyMatcher } from '@/utils/agencyFilter'
import { normalizeName } from '@/utils/scoring'
import { groupSquadByPosition, POSITION_LABEL } from '@/features/coaches/squadGrouping'
import { mapSquadPositionToSpanish } from '@/features/coaches/manualExternalPlayer'
import type { EnrichedPlayer } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

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

interface PlayerLink {
  source: 'interno' | 'externo'
  name: string
}

const CARD_CLASSNAME = 'bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-3 sm:p-4 flex flex-col items-center text-center transition-transform duration-200 ease-apple hover:-translate-y-0.5 w-full'

function RosterPlayerCard({
  player,
  stats,
  link,
  creating,
  onCreateClick,
}: {
  player: SquadPlayer
  stats?: { minutes: number; matches: number }
  link: PlayerLink | null
  creating: boolean
  onCreateClick: () => void
}) {
  const content = (
    <>
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
        {creating && (
          <div className="absolute inset-0 rounded-full bg-white/70 dark:bg-apple-gray-900/70 flex items-center justify-center">
            <span className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
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
    </>
  )

  if (link) {
    return (
      <Link to={`/jugador/${encodeURIComponent(link.name)}?source=${link.source}`} className={CARD_CLASSNAME}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onCreateClick}
      disabled={creating}
      className={`${CARD_CLASSNAME} disabled:cursor-wait`}
    >
      {content}
    </button>
  )
}

export default function TeamRosterPanel({ teamId, teamName }: { teamId: number; teamName: string }) {
  const [squad, setSquad] = useState<SquadPlayer[] | null>(null)
  const [minutes, setMinutes] = useState<Record<number, { minutes: number; matches: number }>>({})
  const [creatingId, setCreatingId] = useState<number | null>(null)
  const { internal, external, agencyPlayers, createManualPlayerAndRefresh } = useData()
  const navigate = useNavigate()

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

  const isAgencyPlayer = makeAgencyMatcher(agencyPlayers)

  const resolveLink = (player: SquadPlayer): PlayerLink | null => {
    if (isAgencyPlayer(player.name)) {
      const match = internal.find((p: EnrichedPlayer) => normalizeName(p.Jugador) === normalizeName(player.name))
      if (match) return { source: 'interno', name: match.Jugador }
    }
    const extMatch = external.find((p: EnrichedPlayer) => normalizeName(p.Jugador) === normalizeName(player.name))
    if (extMatch) return { source: 'externo', name: extMatch.Jugador }
    return null
  }

  const handleCreate = async (player: SquadPlayer) => {
    if (creatingId !== null) return
    setCreatingId(player.id)
    try {
      const created = await createManualPlayerAndRefresh({
        api_player_id: player.id,
        full_name: player.name,
        team: teamName,
        position: mapSquadPositionToSpanish(player.position),
        age: player.age,
        photo: player.photo,
      })
      navigate(`/jugador/${encodeURIComponent(created.Jugador)}?source=externo`)
    } finally {
      setCreatingId(null)
    }
  }

  const groups = groupSquadByPosition(squad)

  return (
    <div className="space-y-6 animate-fade-in">
      {groups.map(group => (
        <div key={group.positionKey}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-apple-gray-400 mb-3">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {group.players.map(player => (
              <RosterPlayerCard
                key={player.id}
                player={player}
                stats={minutes[player.id]}
                link={resolveLink(player)}
                creating={creatingId === player.id}
                onCreateClick={() => void handleCreate(player)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
