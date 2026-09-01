import { useEffect, useMemo, useRef, useState } from 'react'
import { useScoreLookup } from '@/hooks/usePlayerStats'
import { normalizeName } from '@/utils/scoring'
import { buildPlayerPhotoUrl, computeAge } from '@/utils/marketAlerts'
import { fetchPlayerIdentity, canonicalPositionLabel, type PlayerIdentity } from '@/services/marketService'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { useLanguage } from '@/context/LanguageContext'

export interface ResolvedPlayerIdentity {
  name: string
  age: number | null
  /** Posición canónica en español (ej. "Volante interno"), para autocompletar
   * la búsqueda de club a la que se engancha la negociación. Null si el
   * jugador no tiene posición cargada. */
  position: string | null
}

const MAX_RESULTS = 8

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
  const [query, setQuery] = useState(playerName)
  const [open, setOpen] = useState(false)
  const [resolved, setResolved] = useState<PlayerIdentity | null>(null)
  const [resolving, setResolving] = useState(false)
  const [manualIdOpen, setManualIdOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Búsqueda por nombre entre los jugadores con score (ya cargados en memoria
  // por useScoreLookup, sin ida y vuelta extra al servidor). El jefe tipea
  // "zapelli" y ve las coincidencias — no necesita saber ningún ID.
  const results = useMemo(() => {
    const q = normalizeName(query.trim())
    if (q.length < 2) return []
    const matches = []
    for (const entry of lookup.values()) {
      if (normalizeName(entry.name).includes(q)) matches.push(entry)
      if (matches.length >= MAX_RESULTS) break
    }
    return matches
  }, [lookup, query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Resuelve la identidad real contra `players` cada vez que cambia el id
  // confirmado (elegido de la lista, o tipeado a mano como fallback).
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
      onResolved?.(identity ? { name: identity.name, age: computeAge(identity.birth_date), position: canonicalPositionLabel(identity.primary_position) } : null)
      if (identity) setQuery(identity.name)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerApiId])

  const handleSelect = (id: number, name: string) => {
    onChange(id)
    setQuery(name)
    setOpen(false)
  }

  const photoUrl = resolved?.photo ?? buildPlayerPhotoUrl(playerApiId)
  const resolvedAge = resolved ? computeAge(resolved.birth_date) : null

  return (
    <div className="space-y-2">
      <div className="relative" ref={ref}>
        <div className="flex items-center gap-3">
          <PlayerPhoto src={photoUrl} name={playerName} size="sm" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); if (playerApiId != null) onChange(null) }}
            onFocus={() => setOpen(true)}
            placeholder={t('mercado.buscarJugadorPlaceholder')}
            className="input-apple text-sm flex-1"
          />
        </div>
        {open && results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 shadow-lg">
            {results.map(entry => {
              const age = computeAge(entry.birth_date)
              const details = [
                entry.position,
                entry.team_name,
                age != null ? `${age} ${t('externo.anios')}` : null,
              ].filter(Boolean).join(' · ')
              return (
                <button
                  key={entry.player_id}
                  type="button"
                  onClick={() => handleSelect(entry.player_id, entry.name)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700/50 transition-colors"
                >
                  <PlayerPhoto src={buildPlayerPhotoUrl(entry.player_id)} name={entry.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-sm text-apple-gray-800 dark:text-white truncate">{entry.name}</span>
                    <span className="block text-2xs text-apple-gray-400 truncate">{details}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
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

      {!manualIdOpen ? (
        <button type="button" onClick={() => setManualIdOpen(true)} className="text-2xs text-apple-gray-400 hover:text-apple-gray-600 underline">
          {t('mercado.noAparecePorId')}
        </button>
      ) : (
        <input
          type="number"
          value={playerApiId ?? ''}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            onChange(Number.isFinite(n) ? n : null)
          }}
          placeholder={t('mercado.idJugadorPlaceholder')}
          className="input-apple text-sm w-full"
        />
      )}
    </div>
  )
}
