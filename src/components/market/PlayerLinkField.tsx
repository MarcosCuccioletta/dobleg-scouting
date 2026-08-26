import { useEffect, useMemo, useState } from 'react'
import { useScoreLookup } from '@/hooks/usePlayerStats'
import { normalizeName } from '@/utils/scoring'
import { buildPlayerPhotoUrl, computeAge } from '@/utils/marketAlerts'
import { fetchPlayerIdentity, type PlayerIdentity } from '@/services/marketService'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { useLanguage } from '@/context/LanguageContext'

export interface ResolvedPlayerIdentity {
  name: string
  age: number | null
}

export default function PlayerLinkField({
  playerName,
  playerApiId,
  onChange,
  onResolved,
}: {
  playerName: string
  playerApiId: number | null
  onChange: (id: number | null) => void
  /** Se llama con la identidad real (nombre correcto, edad) apenas se resuelve
   * el id contra la base — o `null` si no hay id o no se encontró nada. El
   * padre la usa para corregir el nombre tipeado al vincular. */
  onResolved?: (identity: ResolvedPlayerIdentity | null) => void
}) {
  const { t } = useLanguage()
  const { lookup } = useScoreLookup()
  const [manualInput, setManualInput] = useState(playerApiId != null ? String(playerApiId) : '')
  const [resolved, setResolved] = useState<PlayerIdentity | null>(null)
  const [resolving, setResolving] = useState(false)

  const suggestion = useMemo(() => {
    if (!playerName.trim()) return null
    const entry = lookup.get(normalizeName(playerName))
    if (!entry || entry.player_id === playerApiId) return null
    return entry
  }, [lookup, playerName, playerApiId])

  // Resuelve la identidad real contra `players` cada vez que cambia el id
  // confirmado — funciona tanto si se llegó clickeando la sugerencia como si
  // se tipeó un id a mano (el caso típico: el jefe escribió mal el nombre al
  // crear la negociación, y quien vincula ya sabe el id correcto de memoria).
  useEffect(() => {
    if (playerApiId == null) {
      setResolved(null)
      onResolved?.(null)
      return
    }
    let active = true
    setResolving(true)
    fetchPlayerIdentity(playerApiId).then(identity => {
      if (!active) return
      setResolving(false)
      setResolved(identity)
      onResolved?.(identity ? { name: identity.name, age: computeAge(identity.birth_date) } : null)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerApiId])

  const photoUrl = resolved?.photo ?? buildPlayerPhotoUrl(playerApiId)
  const resolvedAge = resolved ? computeAge(resolved.birth_date) : null

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
          placeholder={t('mercado.idJugadorPlaceholder')}
          className="input-apple text-sm flex-1"
        />
      </div>
      {resolving && <p className="text-xs text-apple-gray-400">{t('mercado.buscandoJugador')}</p>}
      {!resolving && resolved && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ {resolved.name}{resolvedAge != null ? ` · ${resolvedAge} ${t('externo.anios')}` : ''}
        </p>
      )}
      {!resolving && playerApiId != null && !resolved && (
        <p className="text-xs text-red-500">{t('mercado.jugadorNoEncontrado')}</p>
      )}
      {suggestion && (
        <button
          type="button"
          onClick={() => { onChange(suggestion.player_id); setManualInput(String(suggestion.player_id)) }}
          className="text-xs text-brand-green hover:text-emerald-600 font-medium"
        >
          {t('mercado.esJugadorSugerido').replace('{name}', suggestion.name).replace('{position}', suggestion.position)}
        </button>
      )}
    </div>
  )
}
