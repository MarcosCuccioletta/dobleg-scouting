import { useMemo, useState } from 'react'
import { useScoreLookup } from '@/hooks/usePlayerStats'
import { normalizeName } from '@/utils/scoring'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'

export default function PlayerLinkField({
  playerName,
  playerApiId,
  onChange,
}: {
  playerName: string
  playerApiId: number | null
  onChange: (id: number | null) => void
}) {
  const { lookup } = useScoreLookup()
  const [manualInput, setManualInput] = useState(playerApiId != null ? String(playerApiId) : '')

  const suggestion = useMemo(() => {
    if (!playerName.trim()) return null
    const entry = lookup.get(normalizeName(playerName))
    if (!entry || entry.player_id === playerApiId) return null
    return entry
  }, [lookup, playerName, playerApiId])

  const photoUrl = buildPlayerPhotoUrl(playerApiId)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <PlayerPhoto src={photoUrl} name={playerName} size="sm" />
        <input
          type="number"
          value={manualInput}
          onChange={e => {
            setManualInput(e.target.value)
            const n = parseInt(e.target.value, 10)
            onChange(Number.isFinite(n) ? n : null)
          }}
          placeholder="ID de jugador en la API (opcional)"
          className="input-apple text-sm flex-1"
        />
      </div>
      {suggestion && (
        <button
          type="button"
          onClick={() => { onChange(suggestion.player_id); setManualInput(String(suggestion.player_id)) }}
          className="text-xs text-brand-green hover:text-emerald-600 font-medium"
        >
          ¿Es {suggestion.name}, {suggestion.position}? Usar este jugador de la API
        </button>
      )}
    </div>
  )
}
