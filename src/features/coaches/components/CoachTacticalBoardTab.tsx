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
import TacticalBoardPitch, { type BoardTool } from './TacticalBoardPitch'
import TacticalBoardToolbar from './TacticalBoardToolbar'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { mirrorFormationForRival, nextMarkerPosition } from '@/features/coaches/tacticalBoardPrefill'
import { mapLineupToSlots, type LineupPlayerForPrefill } from '@/features/coaches/futureSquadPrefill'
import { isMatchFinished } from '@/utils/coachCalendar'
import { FORMATIONS } from '@/constants/formations'
import { useMediaQuery } from '@/hooks/useMediaQuery'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function uid(): string {
  return crypto.randomUUID()
}

// Arma los 22 markers de arranque (11 propios reales del ultimo partido jugado + 11
// rivales genericos del lado espejado) para que la primera vez que un entrenador entra
// a la pestana ya vea la cancha poblada, sin tener que crear ni nombrar una pizarra antes.
// Mismo patron de datos que buildPrefill en CoachFutureSquadTab.tsx.
async function buildDefaultBoardMarkers(coach: AgencyCoach): Promise<BoardMarker[]> {
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

  return markers
}

function PlayerPickerModal({
  players,
  onSelect,
  onClose,
}: {
  players: SquadPlayer[]
  onSelect: (player: SquadPlayer) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-apple-gray-800 rounded-apple-lg max-w-sm w-full max-h-[70vh] overflow-hidden shadow-apple-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-apple-gray-200 dark:border-apple-gray-700">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
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
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-apple-gray-400 text-center py-8">Sin resultados.</p>}
        </div>
      </div>
    </div>
  )
}

export default function CoachTacticalBoardTab({ coach }: { coach: AgencyCoach }) {
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
  const [squad, setSquad] = useState<SquadPlayer[]>([])
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
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
      const markers = await buildDefaultBoardMarkers(coach)
      if (!active) return
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
    fetchSquadCached(coach.apiTeamId).then(s => {
      if (active) setSquad(s)
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
      window.alert('No se pudo crear la pizarra. Puede que la funcionalidad todavía no esté disponible en el servidor — probá de nuevo más tarde.')
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
      window.alert('No se pudo renombrar, intentá de nuevo.')
      return
    }
    setCurrent({ ...current, name: renameValue.trim() })
    await reloadBoards()
    setRenaming(false)
  }

  async function handleDelete(board: TacticalBoard) {
    const ok = window.confirm(`¿Borrar la pizarra "${board.name}"?`)
    if (!ok) return
    const res = await deleteTacticalBoard(board.id)
    if (!res.success) {
      window.alert('No se pudo borrar la pizarra, intentá de nuevo.')
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
    const pos = nextMarkerPosition(markers, markerTeam, '4-3-3')
    setMarkers([
      ...markers,
      { id: uid(), kind: 'generic', team: markerTeam, label: String(count + 1), playerId: null, x: pos.x, y: pos.y },
    ])
  }

  function addPlayerMarker(player: SquadPlayer) {
    const pos = nextMarkerPosition(markers, 'propio', '4-3-3')
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
    const ok = window.confirm('¿Borrar todos los dibujos de esta pizarra?')
    if (!ok) return
    setAnnotations([])
  }

  if (boards === null) return <LoadingSpinner message="Cargando pizarras..." />

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
                Guardar nombre
              </button>
              <button type="button" onClick={() => setRenaming(false)} className="text-xs text-apple-gray-400">
                Cancelar
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
          <span className="text-sm text-apple-gray-400">Sin pizarra abierta</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowNewInput(true)}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          Nueva
        </button>
        <button
          type="button"
          onClick={() => setShowLoadModal(true)}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          Cargar
        </button>
        {saveStatus === 'error' && <span className="text-xs text-red-500">Error al guardar</span>}
        {saveStatus !== 'error' && hasUnsavedChanges && <span className="text-xs text-amber-500">Cambios sin guardar</span>}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!current || saveStatus === 'saving'}
          className="min-h-[36px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-xs font-semibold disabled:opacity-50"
        >
          {saveStatus === 'saving'
            ? 'Guardando...'
            : saveStatus === 'saved'
              ? 'Guardado ✓'
              : saveStatus === 'error'
                ? 'Reintentar'
                : 'Guardar'}
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
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-apple-gray-400 max-w-xs">Creá una pizarra nueva o cargá una guardada para empezar.</p>
        </div>
      )}

      {showPlayerPicker && <PlayerPickerModal players={squad} onSelect={addPlayerMarker} onClose={() => setShowPlayerPicker(false)} />}

      {showNewInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowNewInput(false)}>
          <div className="bg-white dark:bg-apple-gray-800 rounded-apple-lg p-5 max-w-sm w-full shadow-apple-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Nueva pizarra</h3>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Ej: Salida en corto vs 4-4-2"
              className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNewInput(false)} className="flex-1 min-h-[40px] rounded-lg text-sm text-apple-gray-500">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!newName.trim() || creating}
                className="flex-1 min-h-[40px] rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear'}
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
              <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Pizarras guardadas</h3>
              <button type="button" onClick={() => setShowLoadModal(false)} className="text-apple-gray-400" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {boards.map(b => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b border-apple-gray-100 dark:border-apple-gray-700/40">
                  <button type="button" onClick={() => loadBoard(b)} className="text-left flex-1">
                    <p className="text-sm font-semibold text-apple-gray-800 dark:text-white">{b.name}</p>
                    <p className="text-xs text-apple-gray-400">
                      {new Date(b.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                  <button type="button" onClick={() => void handleDelete(b)} className="text-xs text-red-500 font-semibold ml-3">
                    Borrar
                  </button>
                </div>
              ))}
              {boards.length === 0 && <p className="text-sm text-apple-gray-400 text-center py-8">Sin pizarras guardadas todavía.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
