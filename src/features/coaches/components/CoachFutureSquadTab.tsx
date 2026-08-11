import { useEffect, useState } from 'react'
import {
  getFutureSquad,
  saveFutureSquad,
  type FutureSquadSlot,
  type FutureSquadBaja,
} from '@/services/futureSquadService'
import { mapLineupToSlots, type LineupPlayerForPrefill } from '@/features/coaches/futureSquadPrefill'
import FutureSquadPitch from './FutureSquadPitch'
import FutureSquadPlayerPicker from './FutureSquadPlayerPicker'
import { FORMATIONS } from '@/constants/formations'
import { fetchSquadCached, fetchSeasonFixtures, fetchFixtureLineups, type SquadPlayer } from '@/services/footballApiService'
import type { PlayerWithScore } from '@/types/scoring'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function uid(): string {
  return crypto.randomUUID()
}

function emptySlots(formationType: string): FutureSquadSlot[] {
  return (FORMATIONS[formationType] ?? FORMATIONS['4-3-3']).positions.map(pos => ({
    slotKey: pos.key,
    source: null,
    playerId: null,
    playerName: null,
    playerNumber: null,
    ggScore: null,
  }))
}

async function buildPrefill(coach: AgencyCoach): Promise<{ formationType: string; slots: FutureSquadSlot[] }> {
  if (!coach.apiTeamId || !coach.leagueSeason) return { formationType: '4-3-3', slots: emptySlots('4-3-3') }

  const fixtures = await fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason)
  const lastPlayed = fixtures
    .filter(f => f.statusShort === 'FT')
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  if (!lastPlayed) return { formationType: '4-3-3', slots: emptySlots('4-3-3') }

  const lineups = await fetchFixtureLineups(lastPlayed.fixtureId)
  const ownLineup = lineups.find(l => l.team.id === coach.apiTeamId)
  if (!ownLineup) return { formationType: '4-3-3', slots: emptySlots('4-3-3') }

  const startXI: LineupPlayerForPrefill[] = ownLineup.startXI.map(({ player }) => ({
    id: player.id,
    name: player.name,
    number: player.number,
  }))
  return mapLineupToSlots(startXI, ownLineup.formation ?? '4-3-3')
}

export default function CoachFutureSquadTab({ coach }: { coach: AgencyCoach }) {
  const [squad, setSquad] = useState<SquadPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [formationType, setFormationType] = useState('4-3-3')
  const [slots, setSlots] = useState<FutureSquadSlot[]>(emptySlots('4-3-3'))
  const [bajas, setBajas] = useState<FutureSquadBaja[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState<string>('')
  const [pickerSlotKey, setPickerSlotKey] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const [squadData, plan] = await Promise.all([
        coach.apiTeamId ? fetchSquadCached(coach.apiTeamId) : Promise.resolve([]),
        getFutureSquad(coach.key),
      ])
      if (!active) return
      setSquad(squadData)

      if (plan) {
        setFormationType(plan.formation_type)
        setSlots(plan.slots)
        setBajas(plan.bajas)
        setSavedSnapshot(JSON.stringify({ formationType: plan.formation_type, slots: plan.slots, bajas: plan.bajas }))
      } else {
        const prefill = await buildPrefill(coach)
        if (!active) return
        setFormationType(prefill.formationType)
        setSlots(prefill.slots)
        setBajas([])
        setSavedSnapshot('')
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [coach.key, coach.apiTeamId, coach.leagueSeason])

  const hasUnsavedChanges = JSON.stringify({ formationType, slots, bajas }) !== savedSnapshot

  function handleFormationChange(next: string) {
    setFormationType(next)
    setSlots(emptySlots(next))
  }

  function handleSelectSquad(player: SquadPlayer) {
    if (!pickerSlotKey) return
    setSlots(prev => prev.map(s => (
      s.slotKey === pickerSlotKey
        ? { slotKey: s.slotKey, source: 'squad', playerId: player.id, playerName: player.name, playerNumber: player.number, ggScore: null }
        : s
    )))
    setPickerSlotKey(null)
  }

  function handleSelectCandidate(player: PlayerWithScore) {
    if (!pickerSlotKey) return
    setSlots(prev => prev.map(s => (
      s.slotKey === pickerSlotKey
        ? { slotKey: s.slotKey, source: 'candidate', playerId: String(player.id), playerName: player.name, playerNumber: null, ggScore: player.primary_score }
        : s
    )))
    setPickerSlotKey(null)
  }

  function handleRemoveSlot(slotKey: string) {
    const slot = slots.find(s => s.slotKey === slotKey)
    if (!slot || slot.source === null) return

    if (slot.source === 'squad') {
      setBajas(prev => [...prev, { id: uid(), playerId: slot.playerId as number, playerName: slot.playerName as string, reason: '' }])
    }
    setSlots(prev => prev.map(s => (
      s.slotKey === slotKey ? { slotKey: s.slotKey, source: null, playerId: null, playerName: null, playerNumber: null, ggScore: null } : s
    )))
  }

  function handleBajaReasonChange(id: string, reason: string) {
    setBajas(prev => prev.map(b => (b.id === id ? { ...b, reason } : b)))
  }

  function handleRemoveBaja(id: string) {
    setBajas(prev => prev.filter(b => b.id !== id))
  }

  async function handleSave() {
    setSaveStatus('saving')
    const res = await saveFutureSquad(coach.key, formationType, slots, bajas)
    if (!res.success) {
      setSaveStatus('error')
      return
    }
    setSavedSnapshot(JSON.stringify({ formationType, slots, bajas }))
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  }

  const usedSquadIds = new Set(slots.filter(s => s.source === 'squad').map(s => s.playerId as number))
  const usedCandidateIds = new Set(slots.filter(s => s.source === 'candidate').map(s => s.playerId as string))
  const pickerSlot = pickerSlotKey ? slots.find(s => s.slotKey === pickerSlotKey) : null

  if (loading) return <LoadingSpinner message="Cargando plantel a futuro..." />

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 uppercase tracking-wider mb-1">
            Formacion
          </label>
          <select
            value={formationType}
            onChange={e => handleFormationChange(e.target.value)}
            className="input-apple"
          >
            {Object.keys(FORMATIONS).map(f => (
              <option key={f} value={f}>{FORMATIONS[f].name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        {saveStatus === 'error' && <span className="text-xs text-brand-red">Error al guardar</span>}
        {hasUnsavedChanges && saveStatus === 'idle' && <span className="text-xs text-amber-500">Cambios sin guardar</span>}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveStatus === 'saving'}
          className="min-h-[40px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
        >
          {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>

      <FutureSquadPitch
        formationType={formationType}
        slots={slots}
        onSlotClick={setPickerSlotKey}
        onRemoveSlot={handleRemoveSlot}
      />

      <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Bajas planificadas</h3>
        {bajas.length === 0 ? (
          <p className="text-sm text-apple-gray-400">Sin bajas planificadas todavia.</p>
        ) : (
          <div className="space-y-2">
            {bajas.map(b => (
              <div key={b.id} className="flex items-center gap-2">
                <span className="text-sm font-medium text-apple-gray-800 dark:text-white w-32 truncate flex-shrink-0">
                  {b.playerName}
                </span>
                <input
                  value={b.reason}
                  onChange={e => handleBajaReasonChange(b.id, e.target.value)}
                  placeholder="Motivo (opcional)..."
                  className="flex-1 min-h-[36px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm text-apple-gray-800 dark:text-white placeholder:text-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBaja(b.id)}
                  className="text-xs font-semibold text-red-500 flex-shrink-0"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerSlotKey && (
        <FutureSquadPlayerPicker
          slotKey={pickerSlotKey}
          formationType={formationType}
          squad={squad}
          usedSquadIds={pickerSlot?.source === 'squad' ? new Set([...usedSquadIds].filter(id => id !== pickerSlot.playerId)) : usedSquadIds}
          usedCandidateIds={pickerSlot?.source === 'candidate' ? new Set([...usedCandidateIds].filter(id => id !== pickerSlot.playerId)) : usedCandidateIds}
          onSelectSquad={handleSelectSquad}
          onSelectCandidate={handleSelectCandidate}
          onClose={() => setPickerSlotKey(null)}
        />
      )}
    </div>
  )
}
