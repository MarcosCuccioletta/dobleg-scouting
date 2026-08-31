import { useEffect, useState } from 'react'
import {
  listTacticalBoards,
  createTacticalBoard,
  updateTacticalBoard,
  renameTacticalBoard,
  deleteTacticalBoard,
  type TacticalBoard,
  type BoardMarker,
  type BoardAnnotation,
  type MarkerTeam,
  type AnnotationColor,
  type ZoneShape,
} from '@/services/tacticalBoardService'
import { fetchSquadCached, fetchSeasonFixtures, fetchFixtureLineups, type SquadPlayer } from '@/services/footballApiService'
import { fetchSquadProfiles, type SquadPlayerProfile } from '@/services/coachService'
import TacticalBoardPitch, { type BoardTool } from './TacticalBoardPitch'
import TacticalBoardToolbar from './TacticalBoardToolbar'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { mirrorFormationForRival, nextMarkerPosition, nearestFormationSlotKey, formationSlotPositions } from '@/features/coaches/tacticalBoardPrefill'
import { mapLineupToSlots, type LineupPlayerForPrefill } from '@/features/coaches/futureSquadPrefill'
import { isMatchFinished } from '@/utils/coachCalendar'
import { FORMATIONS, POSITION_KEY_API_MAP, FORMATION_POSITION_API_OVERRIDES } from '@/constants/formations'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { Position } from '@/types/scoring'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGE_LOCALES } from '@/constants/translations'

// Grupo generico (API-Football) de cada posicion fina -- fallback para sugerir
// jugadores del plantel cuando todavia no tienen fila en Supabase con `primary_position`
// (frecuente en ligas con poca cobertura, como la de Temperley).
const COARSE_GROUP_BY_POSITION: Record<Position, string> = {
  ARQ: 'Goalkeeper',
  LD: 'Defender',
  CB: 'Defender',
  LI: 'Defender',
  VC: 'Midfielder',
  VI: 'Midfielder',
  EXT: 'Attacker',
  DEL: 'Attacker',
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function uid(): string {
  return crypto.randomUUID()
}

// Arma los 22 markers de arranque (11 propios reales del ultimo partido jugado + 11
// rivales genericos del lado espejado) para que la primera vez que un entrenador entra
// a la pestana ya vea la cancha poblada, sin tener que crear ni nombrar una pizarra antes.
// Mismo patron de datos que buildPrefill en CoachFutureSquadTab.tsx.
async function buildDefaultBoardMarkers(coach: AgencyCoach): Promise<{ markers: BoardMarker[]; formationType: string }> {
  const markers: BoardMarker[] = []
  let formationType = '4-3-3'
  let ownStartXI: LineupPlayerForPrefill[] = []

  if (coach.apiTeamId && coach.leagueSeason) {
    const fixtures = await fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason)
    const lastPlayed = fixtures.filter(f => isMatchFinished(f.statusShort)).sort((a, b) => b.timestamp - a.timestamp)[0]
    if (lastPlayed) {
      const lineups = await fetchFixtureLineups(lastPlayed.fixtureId)
      const ownLineup = lineups.find(l => l.team.id === coach.apiTeamId)
      if (ownLineup) {
        formationType = ownLineup.formation ?? '4-3-3'
        ownStartXI = ownLineup.startXI.map(({ player }) => ({ id: player.id, name: player.name, number: player.number }))
      }
    }
  }

  const { formationType: resolvedFormation, slots } = mapLineupToSlots(ownStartXI, formationType)
  for (const slot of slots) {
    if (slot.source !== 'squad' || slot.playerId === null) continue
    const pos = FORMATIONS[resolvedFormation].positions.find(p => p.key === slot.slotKey)!
    markers.push({
      id: crypto.randomUUID(),
      kind: 'player',
      team: 'propio',
      label: slot.playerNumber != null ? String(slot.playerNumber) : (slot.playerName ?? '').split(' ').slice(-1)[0],
      playerId: slot.playerId as number,
      x: pos.x,
      y: pos.y,
    })
  }

  const rivalPositions = mirrorFormationForRival(resolvedFormation)
  rivalPositions.forEach((pos, i) => {
    markers.push({
      id: crypto.randomUUID(),
      kind: 'generic',
      team: 'rival',
      label: String(i + 1),
      playerId: null,
      x: pos.x,
      y: pos.y,
    })
  })

  return { markers, formationType: resolvedFormation }
}

function PlayerPickerModal({
  players,
  suggestedIds,
  title,
  onSelect,
  onClose,
}: {
  players: SquadPlayer[]
  suggestedIds?: Set<number>
  title?: string
  onSelect: (player: SquadPlayer) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const filtered = players
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aSuggested = suggestedIds?.has(a.id) ? 0 : 1
      const bSuggested = suggestedIds?.has(b.id) ? 0 : 1
      return aSuggested - bSuggested
    })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-apple-gray-800 rounded-apple-lg max-w-sm w-full max-h-[70vh] overflow-hidden shadow-apple-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-apple-gray-200 dark:border-apple-gray-700">
          {title && <p className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-2">{title}</p>}
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('tacticalBoard.buscarJugadorPlaceholder')}
            className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm text-apple-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/40"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700/40 transition-colors"
            >
              <span className="text-sm font-semibold text-apple-gray-800 dark:text-white">{p.name}</span>
              {p.number != null && <span className="text-xs text-apple-gray-400">#{p.number}</span>}
              {suggestedIds?.has(p.id) && (
                <span className="text-2xs font-semibold text-brand-green ml-auto">{t('tacticalBoard.sugerido')}</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-apple-gray-400 text-center py-8">{t('tacticalBoard.sinResultados')}</p>}
        </div>
      </div>
    </div>
  )
}

export default function CoachTacticalBoardTab({ coach }: { coach: AgencyCoach }) {
  const { t, language } = useLanguage()
  const locale = LANGUAGE_LOCALES[language]
  // Desktop (lg+, 1024px): la cancha se ve horizontal y mas grande, con la barra de
  // herramientas al costado en vez de arriba, para aprovechar el ancho disponible.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [boards, setBoards] = useState<TacticalBoard[] | null>(null)
  const [current, setCurrent] = useState<TacticalBoard | null>(null)
  const [markers, setMarkers] = useState<BoardMarker[]>([])
  const [annotations, setAnnotations] = useState<BoardAnnotation[]>([])
  const [tool, setTool] = useState<BoardTool>('mover')
  const [color, setColor] = useState<AnnotationColor>('white')
  const [zoneShape, setZoneShape] = useState<ZoneShape>('circulo')
  const [markerTeam, setMarkerTeam] = useState<MarkerTeam>('propio')
  const [ownFormation, setOwnFormation] = useState('4-3-3')
  const [rivalFormation, setRivalFormation] = useState('4-3-3')
  const [squad, setSquad] = useState<SquadPlayer[]>([])
  const [squadProfiles, setSquadProfiles] = useState<Record<number, SquadPlayerProfile>>({})
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [changingMarkerId, setChangingMarkerId] = useState<string | null>(null)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showNewInput, setShowNewInput] = useState(false)
  const [newName, setNewName] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [creating, setCreating] = useState(false)
  // Snapshot (JSON) de markers/annotations tal como estan guardados en el servidor. Sirve solo
  // para mostrar el aviso de "cambios sin guardar" -- no persiste entre desmontajes del tab.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const hasUnsavedChanges = current !== null && savedSnapshot !== null && JSON.stringify({ markers, annotations }) !== savedSnapshot

  async function reloadBoards() {
    setBoards(await listTacticalBoards(coach.key))
  }

  useEffect(() => {
    let active = true
    listTacticalBoards(coach.key).then(async b => {
      if (!active) return
      if (b.length > 0) {
        // Siempre entrar viendo una cancha: se auto-abre la mas reciente (listTacticalBoards
        // ya ordena por updated_at desc) en vez de dejar "Sin pizarra abierta" y forzar a
        // pasar por "Cargar" cada vez que se entra a la pestana.
        setBoards(b)
        const mostRecent = b[0]
        setCurrent(mostRecent)
        setMarkers(mostRecent.markers)
        setAnnotations(mostRecent.annotations)
        setSavedSnapshot(JSON.stringify({ markers: mostRecent.markers, annotations: mostRecent.annotations }))
        return
      }
      // Primera vez sin ninguna pizarra guardada: se arma y se muestra una por
      // defecto con los 11 propios reales + 11 rivales genericos, sin que el
      // usuario tenga que crear ni nombrar nada primero.
      const { markers, formationType } = await buildDefaultBoardMarkers(coach)
      if (!active) return
      setOwnFormation(formationType)
      const board = await createTacticalBoard(coach.key, 'Titular', markers)
      if (!active) return
      if (board) {
        setCurrent(board)
        setMarkers(board.markers)
        setAnnotations(board.annotations)
        setSavedSnapshot(JSON.stringify({ markers: board.markers, annotations: board.annotations }))
        setBoards([board])
      } else {
        // No se pudo crear (migracion no corrida, etc.) -- se cae al estado vacio
        // de siempre, con los botones Nueva/Cargar disponibles.
        setBoards([])
      }
    }).catch(err => {
      // Cualquier falla no prevista en el prellenado (API caida, formacion desconocida,
      // etc.) no puede dejar `boards` en null para siempre -- eso deja la pestana trabada
      // en el spinner de carga indefinidamente, sin cancha ni forma de recuperarse salvo
      // recargar la pagina.
      console.error('Error cargando/prellenando pizarras tacticas:', err)
      if (active) setBoards([])
    })
    return () => {
      active = false
    }
  }, [coach.key])

  useEffect(() => {
    if (!coach.apiTeamId) return
    let active = true
    fetchSquadCached(coach.apiTeamId).then(async s => {
      if (!active) return
      setSquad(s)
      const profiles = await fetchSquadProfiles(s.map(p => p.id))
      if (active) setSquadProfiles(profiles)
    })
    return () => {
      active = false
    }
  }, [coach.apiTeamId])

  function loadBoard(board: TacticalBoard) {
    setCurrent(board)
    setMarkers(board.markers)
    setAnnotations(board.annotations)
    setSavedSnapshot(JSON.stringify({ markers: board.markers, annotations: board.annotations }))
    setShowLoadModal(false)
  }

  async function handleCreate() {
    if (!newName.trim() || creating) return
    setCreating(true)
    const board = await createTacticalBoard(coach.key, newName.trim())
    setCreating(false)
    if (board) {
      loadBoard(board)
      await reloadBoards()
      setShowNewInput(false)
      setNewName('')
    } else {
      // Tabla/funcionalidad todavia no disponible en el servidor (ej. migracion sin correr) u otro
      // error -- avisar en vez de cerrar el modal en silencio, y dejar reintentar sin reescribir el nombre.
      window.alert(t('tacticalBoard.errorCrear'))
    }
  }

  async function handleSave() {
    if (!current) return
    setSaveStatus('saving')
    const res = await updateTacticalBoard(current.id, markers, annotations)
    if (!res.success) {
      setSaveStatus('error')
      return
    }
    setSavedSnapshot(JSON.stringify({ markers, annotations }))
    await reloadBoards()
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  }

  async function handleRename() {
    if (!current || !renameValue.trim()) return
    const res = await renameTacticalBoard(current.id, renameValue.trim())
    if (!res.success) {
      window.alert(t('tacticalBoard.errorRenombrar'))
      return
    }
    setCurrent({ ...current, name: renameValue.trim() })
    await reloadBoards()
    setRenaming(false)
  }

  async function handleDelete(board: TacticalBoard) {
    const ok = window.confirm(t('tacticalBoard.confirmarBorrarPizarra').replace('{name}', board.name))
    if (!ok) return
    const res = await deleteTacticalBoard(board.id)
    if (!res.success) {
      window.alert(t('tacticalBoard.errorBorrarPizarra'))
      return
    }
    if (current?.id === board.id) {
      setCurrent(null)
      setMarkers([])
      setAnnotations([])
      setSavedSnapshot(null)
    }
    await reloadBoards()
  }

  function addGenericMarker() {
    const count = markers.filter(m => m.kind === 'generic' && m.team === markerTeam).length
    const pos = nextMarkerPosition(markers, markerTeam, markerTeam === 'propio' ? ownFormation : rivalFormation)
    setMarkers([
      ...markers,
      { id: uid(), kind: 'generic', team: markerTeam, label: String(count + 1), playerId: null, x: pos.x, y: pos.y },
    ])
  }

  function addPlayerMarker(player: SquadPlayer) {
    const pos = nextMarkerPosition(markers, 'propio', ownFormation)
    setMarkers([
      ...markers,
      {
        id: uid(),
        kind: 'player',
        team: 'propio',
        label: player.number != null ? String(player.number) : player.name.split(' ').slice(-1)[0],
        playerId: player.id,
        x: pos.x,
        y: pos.y,
      },
    ])
    setShowPlayerPicker(false)
  }

  function replaceMarkerPlayer(player: SquadPlayer) {
    if (!changingMarkerId) return
    setMarkers(markers.map(m => (
      m.id === changingMarkerId
        ? { ...m, kind: 'player', playerId: player.id, label: player.number != null ? String(player.number) : player.name.split(' ').slice(-1)[0] }
        : m
    )))
    setChangingMarkerId(null)
  }

  // Reacomoda las fichas de un equipo a los 11 slots de la formacion elegida (en el
  // orden en que ya estaban, preservando cual ficha es cual jugador) -- si hay mas de
  // 11 fichas de ese equipo (fichas genericas de mas), las que sobran caen en cascada.
  // El updater de setMarkers tiene que ser puro (React 18 StrictMode lo invoca 2 veces
  // en desarrollo) -- el indice de cada ficha dentro del equipo se calcula con
  // .filter().indexOf() en vez de mutar una variable externa en cada llamada.
  function repositionTeamMarkers(team: MarkerTeam, formationType: string) {
    const slots = formationSlotPositions(team, formationType)
    setMarkers(prev => {
      const teamMarkerIds = prev.filter(m => m.team === team).map(m => m.id)
      return prev.map(m => {
        if (m.team !== team) return m
        const teamIndex = teamMarkerIds.indexOf(m.id)
        const slot = slots[teamIndex]
        if (slot) return { ...m, x: slot.x, y: slot.y }
        const n = teamIndex - slots.length
        return { ...m, x: 50 + (n % 5) * 6, y: 50 + Math.floor(n / 5) * 6 }
      })
    })
  }

  function handleOwnFormationChange(next: string) {
    setOwnFormation(next)
    repositionTeamMarkers('propio', next)
  }

  function handleRivalFormationChange(next: string) {
    setRivalFormation(next)
    repositionTeamMarkers('rival', next)
  }

  function addBallMarker() {
    if (markers.some(m => m.kind === 'ball')) return
    // La pelota no compite por slots de formacion -- un unico punto neutral cerca
    // del centro, pero no exactamente sobre el circulo central (mas facil de
    // distinguir de una ficha si alguna cae cerca).
    setMarkers([...markers, { id: uid(), kind: 'ball', team: null, label: '', playerId: null, x: 50, y: 46 }])
  }

  function handleUndo() {
    setAnnotations(annotations.slice(0, -1))
  }

  function handleClearAll() {
    if (annotations.length === 0) return
    const ok = window.confirm(t('tacticalBoard.confirmarBorrarDibujos'))
    if (!ok) return
    setAnnotations([])
  }

  if (boards === null) return <LoadingSpinner message={t('tacticalBoard.cargando')} />

  const changingMarker = changingMarkerId ? markers.find(m => m.id === changingMarkerId) ?? null : null
  let changingSlotLabel: string | null = null
  const suggestedIds = new Set<number>()
  if (changingMarker) {
    const slotKey = nearestFormationSlotKey(changingMarker, ownFormation)
    changingSlotLabel = FORMATIONS[ownFormation]?.positions.find(p => p.key === slotKey)?.key ?? slotKey
    const allowed = FORMATION_POSITION_API_OVERRIDES[ownFormation]?.[slotKey] ?? POSITION_KEY_API_MAP[slotKey] ?? []
    for (const p of squad) {
      const profile = squadProfiles[p.id]
      const matches = profile?.primary_position
        ? allowed.includes(profile.primary_position as Position)
        : allowed.some(pos => COARSE_GROUP_BY_POSITION[pos] === p.position)
      if (matches) suggestedIds.add(p.id)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        {current ? (
          renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                className="min-h-[36px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 text-sm"
              />
              <button type="button" onClick={() => void handleRename()} className="text-xs font-semibold text-brand-green">
                {t('tacticalBoard.guardarNombre')}
              </button>
              <button type="button" onClick={() => setRenaming(false)} className="text-xs text-apple-gray-400">
                {t('perfil.cancelar')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenaming(true)
                setRenameValue(current.name)
              }}
              className="text-sm font-semibold text-apple-gray-800 dark:text-white hover:text-brand-green transition-colors"
            >
              {current.name}
            </button>
          )
        ) : (
          <span className="text-sm text-apple-gray-400">{t('tacticalBoard.sinPizarraAbierta')}</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowNewInput(true)}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          {t('tacticalBoard.nueva')}
        </button>
        <button
          type="button"
          onClick={() => setShowLoadModal(true)}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          {t('formacion.cargar')}
        </button>
        {saveStatus === 'error' && <span className="text-xs text-red-500">{t('coachNotes.errorGuardar')}</span>}
        {saveStatus !== 'error' && hasUnsavedChanges && <span className="text-xs text-amber-500">{t('tacticalBoard.cambiosSinGuardar')}</span>}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!current || saveStatus === 'saving'}
          className="min-h-[36px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-xs font-semibold disabled:opacity-50"
        >
          {saveStatus === 'saving'
            ? t('coachNotes.guardando')
            : saveStatus === 'saved'
              ? t('coachNotes.guardado')
              : saveStatus === 'error'
                ? t('coachNotes.reintentar')
                : t('coachNotes.guardar')}
        </button>
      </div>

      {current ? (
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
          <div className="lg:w-72 flex-shrink-0">
            <TacticalBoardToolbar
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              zoneShape={zoneShape}
              onZoneShapeChange={setZoneShape}
              markerTeam={markerTeam}
              onMarkerTeamChange={setMarkerTeam}
              ownFormation={ownFormation}
              onOwnFormationChange={handleOwnFormationChange}
              rivalFormation={rivalFormation}
              onRivalFormationChange={handleRivalFormationChange}
              onAddGeneric={addGenericMarker}
              onAddPlayer={() => setShowPlayerPicker(true)}
              onAddBall={addBallMarker}
              onUndo={handleUndo}
              onClearAll={handleClearAll}
              canUndo={annotations.length > 0}
              ballAlreadyPlaced={markers.some(m => m.kind === 'ball')}
            />
          </div>
          <div className="flex-1 min-w-0">
            <TacticalBoardPitch
              markers={markers}
              annotations={annotations}
              tool={tool}
              color={color}
              zoneShape={zoneShape}
              onMarkersChange={setMarkers}
              onAnnotationsChange={setAnnotations}
              orientation={isDesktop ? 'horizontal' : 'vertical'}
              onChangePlayerClick={setChangingMarkerId}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-apple-gray-400 max-w-xs">{t('tacticalBoard.vacioMensaje')}</p>
        </div>
      )}

      {showPlayerPicker && <PlayerPickerModal players={squad} onSelect={addPlayerMarker} onClose={() => setShowPlayerPicker(false)} />}

      {changingMarker && (
        <PlayerPickerModal
          players={squad}
          suggestedIds={suggestedIds}
          title={t('tacticalBoard.jugadorSugeridoPara').replace('{slot}', changingSlotLabel ?? '')}
          onSelect={replaceMarkerPlayer}
          onClose={() => setChangingMarkerId(null)}
        />
      )}

      {showNewInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowNewInput(false)}>
          <div className="bg-white dark:bg-apple-gray-800 rounded-apple-lg p-5 max-w-sm w-full shadow-apple-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">{t('tacticalBoard.nuevaPizarraTitulo')}</h3>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder={t('tacticalBoard.nombrePlaceholder')}
              className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNewInput(false)} className="flex-1 min-h-[40px] rounded-lg text-sm text-apple-gray-500">
                {t('perfil.cancelar')}
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!newName.trim() || creating}
                className="flex-1 min-h-[40px] rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                {creating ? t('tacticalBoard.creando') : t('tacticalBoard.crear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowLoadModal(false)}>
          <div
            className="bg-white dark:bg-apple-gray-800 rounded-apple-lg max-w-md w-full max-h-[70vh] overflow-hidden shadow-apple-lg flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-apple-gray-200 dark:border-apple-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">{t('tacticalBoard.pizarrasGuardadas')}</h3>
              <button type="button" onClick={() => setShowLoadModal(false)} className="text-apple-gray-400" aria-label={t('coachDetail.cerrar')}>
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {boards.map(b => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b border-apple-gray-100 dark:border-apple-gray-700/40">
                  <button type="button" onClick={() => loadBoard(b)} className="text-left flex-1">
                    <p className="text-sm font-semibold text-apple-gray-800 dark:text-white">{b.name}</p>
                    <p className="text-xs text-apple-gray-400">
                      {new Date(b.updated_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                  <button type="button" onClick={() => void handleDelete(b)} className="text-xs text-red-500 font-semibold ml-3">
                    {t('informes.borrar')}
                  </button>
                </div>
              ))}
              {boards.length === 0 && <p className="text-sm text-apple-gray-400 text-center py-8">{t('tacticalBoard.sinPizarrasGuardadas')}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
