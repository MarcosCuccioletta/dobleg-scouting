import { COLOR_META, COLOR_ORDER } from '@/features/coaches/tacticalBoardConstants'
import { FORMATIONS } from '@/constants/formations'
import type { AnnotationColor, MarkerTeam, ZoneShape } from '@/services/tacticalBoardService'
import type { BoardTool } from './TacticalBoardPitch'
import { useLanguage } from '@/context/LanguageContext'

const TOOL_META: { id: BoardTool; labelKey: string }[] = [
  { id: 'mover', labelKey: 'boardTool.mover' },
  { id: 'lapiz', labelKey: 'boardTool.lapiz' },
  { id: 'flecha', labelKey: 'boardTool.flecha' },
  { id: 'zona', labelKey: 'boardTool.zona' },
]

export default function TacticalBoardToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  zoneShape,
  onZoneShapeChange,
  markerTeam,
  onMarkerTeamChange,
  ownFormation,
  onOwnFormationChange,
  rivalFormation,
  onRivalFormationChange,
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
  zoneShape: ZoneShape
  onZoneShapeChange: (shape: ZoneShape) => void
  markerTeam: MarkerTeam
  onMarkerTeamChange: (team: MarkerTeam) => void
  ownFormation: string
  onOwnFormationChange: (formation: string) => void
  rivalFormation: string
  onRivalFormationChange: (formation: string) => void
  onAddGeneric: () => void
  onAddPlayer: () => void
  onAddBall: () => void
  onUndo: () => void
  onClearAll: () => void
  canUndo: boolean
  ballAlreadyPlaced: boolean
}) {
  const { t } = useLanguage()
  return (
    <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 pb-1 border-b border-apple-gray-200/60 dark:border-apple-gray-700/40">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-apple-gray-800 dark:bg-white flex-shrink-0" />
          <select
            value={ownFormation}
            onChange={e => onOwnFormationChange(e.target.value)}
            className="min-h-[32px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 text-2xs font-semibold text-apple-gray-700 dark:text-apple-gray-300"
          >
            {Object.keys(FORMATIONS).map(f => (
              <option key={f} value={f}>{FORMATIONS[f].name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
          <select
            value={rivalFormation}
            onChange={e => onRivalFormationChange(e.target.value)}
            className="min-h-[32px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-2 text-2xs font-semibold text-apple-gray-700 dark:text-apple-gray-300"
          >
            {Object.keys(FORMATIONS).map(f => (
              <option key={f} value={f}>{FORMATIONS[f].name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TOOL_META.map(meta => (
          <button
            key={meta.id}
            type="button"
            onClick={() => onToolChange(meta.id)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
              tool === meta.id
                ? 'bg-brand-green text-apple-gray-900'
                : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
            }`}
          >
            {t(meta.labelKey)}
          </button>
        ))}
      </div>

      {tool !== 'mover' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {COLOR_ORDER.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                title={t(COLOR_META[c].labelKey)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  color === c ? 'border-brand-green scale-110' : 'border-apple-gray-200 dark:border-apple-gray-600'
                }`}
                style={{ backgroundColor: COLOR_META[c].hex }}
              />
            ))}
          </div>

          {tool === 'zona' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onZoneShapeChange('circulo')}
                aria-label={t('tacticalBoard.zonaCircular')}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${zoneShape === 'circulo' ? 'border-brand-green' : 'border-apple-gray-200 dark:border-apple-gray-600'}`}
              >
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current text-apple-gray-500 dark:text-apple-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => onZoneShapeChange('cuadrado')}
                aria-label={t('tacticalBoard.zonaRectangular')}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${zoneShape === 'cuadrado' ? 'border-brand-green' : 'border-apple-gray-200 dark:border-apple-gray-600'}`}
              >
                <span className="w-3.5 h-3.5 border-2 border-current text-apple-gray-500 dark:text-apple-gray-400" />
              </button>
            </div>
          )}
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
            {t('tacticalBoard.propio')}
          </button>
          <button
            type="button"
            onClick={() => onMarkerTeamChange('rival')}
            className={`min-h-[28px] px-2.5 rounded-full text-2xs font-semibold transition-colors ${
              markerTeam === 'rival' ? 'bg-white dark:bg-apple-gray-900 text-apple-gray-800 dark:text-white shadow' : 'text-apple-gray-500'
            }`}
          >
            {t('evaluar.rival')}
          </button>
        </div>
        <button
          type="button"
          onClick={onAddGeneric}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          {t('tacticalBoard.agregarFicha')}
        </button>
        <button
          type="button"
          onClick={onAddPlayer}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300"
        >
          {t('tacticalBoard.agregarJugador')}
        </button>
        <button
          type="button"
          onClick={onAddBall}
          disabled={ballAlreadyPlaced}
          className="min-h-[36px] px-3 rounded-full bg-apple-gray-100 dark:bg-apple-gray-700 text-xs font-semibold text-apple-gray-600 dark:text-apple-gray-300 disabled:opacity-40"
        >
          {t('tacticalBoard.agregarPelota')}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="min-h-[36px] px-3 rounded-full text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 disabled:opacity-40"
        >
          {t('tacticalBoard.deshacer')}
        </button>
        <button type="button" onClick={onClearAll} className="min-h-[36px] px-3 rounded-full text-xs font-semibold text-red-500">
          {t('tacticalBoard.borrarTodo')}
        </button>
      </div>
    </div>
  )
}
