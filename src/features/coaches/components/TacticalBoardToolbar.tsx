import { COLOR_META, COLOR_ORDER } from '@/features/coaches/tacticalBoardConstants'
import type { AnnotationColor, MarkerTeam } from '@/services/tacticalBoardService'
import type { BoardTool } from './TacticalBoardPitch'

const TOOL_META: { id: BoardTool; label: string }[] = [
  { id: 'mover', label: 'Mover' },
  { id: 'lapiz', label: 'Lápiz' },
  { id: 'flecha', label: 'Flecha' },
  { id: 'zona', label: 'Zona' },
  { id: 'texto', label: 'Texto' },
]

export default function TacticalBoardToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  markerTeam,
  onMarkerTeamChange,
  onAddGeneric,
  onAddPlayer,
  onAddBall,
  onUndo,
  onClearAll,
  canUndo,
  ballAlreadyPlaced,
}: {
  tool: BoardTool
  onToolChange: (tool: BoardTool) => void
  color: AnnotationColor
  onColorChange: (color: AnnotationColor) => void
  markerTeam: MarkerTeam
  onMarkerTeamChange: (team: MarkerTeam) => void
  onAddGeneric: () => void
  onAddPlayer: () => void
  onAddBall: () => void
  onUndo: () => void
  onClearAll: () => void
  canUndo: boolean
  ballAlreadyPlaced: boolean
}) {
  return (
    <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TOOL_META.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onToolChange(t.id)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
              tool === t.id
                ? 'bg-brand-green text-apple-gray-900'
                : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tool !== 'mover' && (
        <div className="flex items-center gap-1.5">
          {COLOR_ORDER.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              title={COLOR_META[c].label}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c ? 'border-brand-green scale-110' : 'border-apple-gray-200 dark:border-apple-gray-600'
              }`}
              style={{ backgroundColor: COLOR_META[c].hex }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-apple-gray-200/60 dark:border-apple-gray-700/40">
        <div className="flex items-center gap-1 bg-apple-gray-100 dark:bg-apple-gray-700 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => onMarkerTeamChange('propio')}
            className={`min-h-[28px] px-2.5 rounded-full text-2xs font-semibold transition-colors ${
              markerTeam === 'propio' ? 'bg-white dark:bg-apple-gray-900 text-apple-gray-800 dark:text-white shadow' : 'text-apple-gray-500'
            }`}
          >
            Propio
          </button>
          <button
            type="button"
            onClick={() => onMarkerTeamChange('rival')}
            className={`min-h-[28px] px-2.5 rounded-full text-2xs font-semibold transition-colors ${
              markerTeam === 'rival' ? 'bg-white dark:bg-apple-gray-900 text-apple-gray-800 dark:text-white shadow' : 'text-apple-gray-500'
            }`}
          >
            Rival
          </button>
        </div>
        <button
          type="button"
          onClick={onAddGeneric}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          + Ficha
        </button>
        <button
          type="button"
          onClick={onAddPlayer}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          + Jugador
        </button>
        <button
          type="button"
          onClick={onAddBall}
          disabled={ballAlreadyPlaced}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300 disabled:opacity-40"
        >
          + Pelota
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="min-h-[36px] px-3 rounded-full text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 disabled:opacity-40"
        >
          Deshacer
        </button>
        <button type="button" onClick={onClearAll} className="min-h-[36px] px-3 rounded-full text-xs font-semibold text-red-500">
          Borrar todo
        </button>
      </div>
    </div>
  )
}
