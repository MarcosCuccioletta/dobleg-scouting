import { useInformeInsights, DEFAULT_INSIGHTS_CONFIG } from '@/features/informes/useInformeInsights'
import { renderItem, renderTile } from '@/features/informes/insights/text'
import { BLOCK_IDS, type InsightBlockId, type InsightsConfig, type PeriodMode } from '@/features/informes/insights/types'
import type { Informe } from '@/features/informes/types'

const cardClass = 'rounded-2xl border border-apple-gray-200 dark:border-apple-gray-800 bg-white dark:bg-apple-gray-900 p-5'
const labelClass = 'block text-xs uppercase tracking-wide text-apple-gray-500 dark:text-apple-gray-400 mb-1'
const smallInputClass = 'w-full px-2 py-1.5 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-apple-gray-50 dark:bg-apple-gray-800 text-apple-gray-900 dark:text-white text-xs'

const PERIOD_LABEL: Record<PeriodMode, string> = {
  signing: 'Desde su llegada',
  season: 'Temporada',
  last10: 'Últimos 10',
  custom: 'Rango',
}

const BLOCK_LABEL: Record<InsightBlockId, string> = {
  continuidad: 'Continuidad',
  ofensivo: 'Peso ofensivo',
  plantel: 'Su lugar en el plantel',
  rendimiento: 'Rendimiento',
  resultados: 'Impacto en resultados',
}

const WARNING_TEXT: Record<string, string> = {
  goalsMismatch: 'Los goles del club no coinciden entre fixtures y planilla del plantel: probablemente falte una competencia. Podés pisar el total a mano.',
  shortSample: 'Muestra corta (menos de 3 partidos): no se calculan promedios ni rankings del plantel.',
  noTeamFixtures: 'No hay partidos del club en este período: los bloques que dependen del equipo quedan afuera.',
}

interface Props {
  informe: Informe
  onChange: (informe: Informe) => void
}

export default function Step3Impacto({ informe, onChange }: Props) {
  const config: InsightsConfig = informe.insights ?? DEFAULT_INSIGHTS_CONFIG
  const { result, loading, squadLeaderMinutes, defaultMinutes } = useInformeInsights(informe)
  const lang = informe.idioma ?? 'es'

  const setConfig = (patch: Partial<InsightsConfig>) =>
    onChange({ ...informe, insights: { ...config, ...patch } })

  const toggleBlock = (id: InsightBlockId) =>
    setConfig({ blocks: config.blocks.includes(id) ? config.blocks.filter(b => b !== id) : [...config.blocks, id] })

  const toggleItem = (id: string) =>
    setConfig({ hiddenItems: config.hiddenItems.includes(id) ? config.hiddenItems.filter(x => x !== id) : [...config.hiddenItems, id] })

  const setOverride = (id: string, text: string) => {
    const next = { ...config.overrides }
    if (text.trim()) next[id] = text
    else delete next[id]
    setConfig({ overrides: next })
  }

  const minMinutes = config.minMinutes ?? defaultMinutes
  const sliderMax = Math.max(90, Math.ceil(squadLeaderMinutes / 45) * 45)

  if (!informe.dbPlayerId) {
    return (
      <div className={cardClass}>
        <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white mb-2">Impacto (datos de la API)</h2>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
          Linkeá el jugador con la base en el paso 1 para calcular las conclusiones automáticas.
        </p>
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white">Impacto (datos de la API)</h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-apple-gray-700 dark:text-apple-gray-200">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => setConfig({ enabled: e.target.checked })}
            className="rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
          />
          Incluir en el informe
        </label>
      </div>

      {!config.enabled ? (
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
          Activalo para agregar la pestaña Impacto con las conclusiones calculadas.
        </p>
      ) : loading ? (
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">Calculando…</p>
      ) : !result ? (
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400">
          No hay partidos de este jugador en la base para calcular el impacto.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Período */}
          <div>
            <span className={labelClass}>Período</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PERIOD_LABEL) as PeriodMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setConfig({ period: { ...config.period, mode } })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    config.period.mode === mode
                      ? 'bg-brand-green text-white border-brand-green'
                      : 'border-apple-gray-200 dark:border-apple-gray-700 text-apple-gray-600 dark:text-apple-gray-300'
                  }`}
                >
                  {PERIOD_LABEL[mode]}
                </button>
              ))}
            </div>
            {config.period.mode === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input type="date" value={config.period.from ?? ''} onChange={e => setConfig({ period: { ...config.period, from: e.target.value } })} className={smallInputClass} />
                <input type="date" value={config.period.to ?? ''} onChange={e => setConfig({ period: { ...config.period, to: e.target.value } })} className={smallInputClass} />
              </div>
            )}
            <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400 mt-1.5">
              Desde {result.period.from}{result.period.to ? ` hasta ${result.period.to}` : ''}
            </p>
          </div>

          {/* Avisos */}
          {result.warnings.map(w => (
            <p key={w} className="text-[11px] px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
              {WARNING_TEXT[w] ?? w}
            </p>
          ))}

          {/* Overrides de totales del club */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={labelClass}>Partidos del club (opcional)</span>
              <input
                type="number"
                value={config.teamMatchesOverride ?? ''}
                onChange={e => setConfig({ teamMatchesOverride: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="auto"
                className={smallInputClass}
              />
            </div>
            <div>
              <span className={labelClass}>Goles del club (opcional)</span>
              <input
                type="number"
                value={config.teamGoalsOverride ?? ''}
                onChange={e => setConfig({ teamGoalsOverride: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="auto"
                className={smallInputClass}
              />
            </div>
          </div>

          {/* Tarjetas */}
          {result.tiles.length > 0 && (
            <div>
              <span className={labelClass}>Tarjetas (clic para incluir o sacar)</span>
              <div className="flex flex-wrap gap-2">
                {result.tiles.map(tile => {
                  const { value, sub } = renderTile(tile, lang)
                  const hidden = config.hiddenItems.includes(tile.id)
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => toggleItem(tile.id)}
                      className={`px-3 py-2 rounded-xl border text-left transition-opacity ${hidden ? 'opacity-40' : ''} border-apple-gray-200 dark:border-apple-gray-700`}
                    >
                      <span className="block text-base font-bold text-apple-gray-900 dark:text-white">{value}</span>
                      <span className="block text-[10px] text-apple-gray-500 dark:text-apple-gray-400">{sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bloques y frases */}
          <div className="space-y-3">
            {BLOCK_IDS.map(blockId => {
              const group = result.groups.find(g => g.id === blockId)
              const active = config.blocks.includes(blockId)
              return (
                <div key={blockId} className="rounded-xl border border-apple-gray-200 dark:border-apple-gray-800 p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none text-apple-gray-800 dark:text-apple-gray-100">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleBlock(blockId)}
                      className="rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
                    />
                    {BLOCK_LABEL[blockId]}
                  </label>

                  {blockId === 'plantel' && active && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className={labelClass}>Minutos mínimos para comparar eficacia</span>
                        <span className="text-xs font-semibold text-brand-green">{minMinutes}′</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        step={45}
                        value={minMinutes}
                        onChange={e => setConfig({ minMinutes: Number(e.target.value) })}
                        className="w-full accent-brand-green"
                      />
                      <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400">
                        {result.qualifiedCount} jugadores del plantel entran en la comparación.
                      </p>
                    </div>
                  )}

                  {active && group && (
                    <ul className="mt-3 space-y-2">
                      {group.items.map(item => {
                        const hidden = config.hiddenItems.includes(item.id)
                        const text = config.overrides[item.id] ?? renderItem(item, lang)
                        return (
                          <li key={item.id} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={!hidden}
                              onChange={() => toggleItem(item.id)}
                              className="mt-1.5 rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
                            />
                            <textarea
                              value={text}
                              onChange={e => setOverride(item.id, e.target.value)}
                              rows={2}
                              className={`${smallInputClass} resize-y ${hidden ? 'opacity-40' : ''}`}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {active && !group && (
                    <p className="mt-2 text-[11px] text-apple-gray-500 dark:text-apple-gray-400">
                      Sin datos suficientes para este bloque en el período elegido.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
