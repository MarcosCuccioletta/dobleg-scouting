import { useState } from 'react'
import TeamSearchSelect from '@/components/market/TeamSearchSelect'
import { linkScoutPlayerClub } from '@/services/scoutPlayersService'
import type { ScoutPlayer } from '@/types'
import type { MarketTeamSearchResult } from '@/types/market'

interface Props {
  player: Pick<ScoutPlayer, 'id' | 'full_name' | 'club_team_id' | 'club'>
  onClose: () => void
  onLinked: () => void
}

/**
 * Vincular el CLUB directo de un jugador en seguimiento — separado del
 * vínculo de jugador (`LinkPlayerModal`), porque varios jugadores en
 * seguimiento (ascenso, reserva) nunca van a estar en la API como jugador,
 * pero su club sí puede estarlo. Reusa el mismo buscador de clubes de
 * Mercado (`TeamSearchSelect`) — mismo `teams`, mismo criterio en toda la
 * plataforma.
 */
export default function LinkClubModal({ player, onClose, onLinked }: Props) {
  const [team, setTeam] = useState<MarketTeamSearchResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!team) return
    setSaving(true)
    setError(null)
    const ok = await linkScoutPlayerClub(player.id, team.id)
    setSaving(false)
    if (!ok) { setError('Error al guardar el vínculo. Intentá de nuevo.'); return }
    onLinked()
    onClose()
  }

  const handleUnlink = async () => {
    setSaving(true)
    setError(null)
    const ok = await linkScoutPlayerClub(player.id, null)
    setSaving(false)
    if (!ok) { setError('Error al desvincular. Intentá de nuevo.'); return }
    onLinked()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-apple-gray-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-apple-gray-100 dark:border-apple-gray-700">
          <div>
            <h2 className="text-base font-semibold text-apple-gray-900 dark:text-white">
              Vincular club
            </h2>
            <p className="text-xs text-apple-gray-500 mt-0.5">
              <span className="font-medium text-brand-green">{player.full_name}</span>
              {player.club && <span className="ml-2 text-apple-gray-400">· {player.club}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-apple-gray-400 hover:text-apple-gray-600 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-2">
          <p className="text-xs text-apple-gray-400">
            Sirve para jugadores que no están en la API (ascenso, reserva, etc.) pero cuyo club sí puede estarlo — así aparece el escudo real igual.
          </p>
          <TeamSearchSelect value={team} onChange={setTeam} />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-apple-gray-100 dark:border-apple-gray-700 flex items-center justify-between">
          {player.club_team_id ? (
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              Desvincular
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-apple-gray-600 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !team}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-green hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
