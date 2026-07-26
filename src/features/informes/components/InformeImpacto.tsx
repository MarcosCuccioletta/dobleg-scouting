import { renderItem, renderTile } from '@/features/informes/insights/text'
import { t, type Lang } from '@/features/informes/i18n'
import type { InsightsConfig, InsightsResult } from '@/features/informes/insights/types'

const DG = {
  cardInner: '#14171B',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F7FA',
  muted: '#8A9099',
  green: '#22C55E',
}

const GROUP_KEY: Record<string, string> = {
  continuidad: 'imp_g_continuidad',
  ofensivo: 'imp_g_ofensivo',
  plantel: 'imp_g_plantel',
  rendimiento: 'imp_g_rendimiento',
  resultados: 'imp_g_resultados',
}

export function periodTitle(result: InsightsResult, lang: Lang): string {
  const { period } = result
  if (period.mode === 'signing' && period.anchorDate) return t(lang, 'imp_since', { date: period.anchorDate })
  if (period.mode === 'last10') return t(lang, 'imp_last10')
  if (period.mode === 'custom') return t(lang, 'imp_range', { from: period.from, to: period.to ?? '' })
  return t(lang, 'imp_season')
}

/** Aro de porcentaje (mismo dibujo que el export). */
function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(100, pct))
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={label}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none" stroke={DG.green} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(c * filled) / 100} ${c}`} transform="rotate(-90 36 36)"
      />
    </svg>
  )
}

function Dots({ filled, total }: { filled: number; total: number }) {
  const shown = Math.min(Math.max(total, 1), 20)
  const filledShown = Math.round((filled / Math.max(total, 1)) * shown)
  return (
    <div className="flex flex-wrap gap-1 mt-1" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i < filledShown ? DG.green : 'rgba(255,255,255,0.18)' }}
        />
      ))}
    </div>
  )
}

interface Props {
  result: InsightsResult
  config: InsightsConfig
  lang: Lang
}

export default function InformeImpacto({ result, config, lang }: Props) {
  const visibleTiles = result.tiles.filter(tile => !config.hiddenItems.includes(tile.id))
  const groups = result.groups
    .filter(g => config.blocks.includes(g.id))
    .map(g => ({ ...g, items: g.items.filter(i => !config.hiddenItems.includes(i.id)) }))
    .filter(g => g.items.length > 0)

  return (
    <div>
      <div className="mb-4">
        <span className="block w-6 h-[2px] rounded-full mb-1.5" style={{ backgroundColor: DG.green }} />
        <h3 className="text-[11px] font-bold uppercase" style={{ letterSpacing: '0.12em', color: DG.muted }}>
          {t(lang, 'tab_impacto')}
        </h3>
        <p className="text-sm mt-1" style={{ color: DG.text }}>{periodTitle(result, lang)}</p>
      </div>

      {visibleTiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {visibleTiles.map(tile => {
            const { value, sub } = renderTile(tile, lang)
            return (
              <div key={tile.id} className="rounded-2xl border p-3" style={{ borderColor: DG.border, backgroundColor: DG.cardInner }}>
                {tile.render === 'donut' && tile.pct != null ? (
                  <div className="flex items-center gap-2">
                    <Donut pct={tile.pct} label={sub} />
                    <span className="text-xl font-bold" style={{ color: DG.text }}>{value}</span>
                  </div>
                ) : (
                  <span className="block text-2xl font-bold" style={{ color: DG.text }}>{value}</span>
                )}
                {tile.render === 'dots' && tile.dots && <Dots filled={tile.dots.filled} total={tile.dots.total} />}
                <span className="block text-[11px] mt-1" style={{ color: DG.muted }}>{sub}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.id}>
            <h4 className="text-xs font-bold uppercase mb-2" style={{ letterSpacing: '0.08em', color: DG.muted }}>
              {t(lang, GROUP_KEY[group.id])}
            </h4>
            <ul className="space-y-1.5">
              {group.items.map(item => (
                <li key={item.id} className="text-sm flex gap-2" style={{ color: DG.text }}>
                  <span style={{ color: DG.green }}>•</span>
                  <span>{config.overrides[item.id] ?? renderItem(item, lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {result.warnings.includes('goalsMismatch') && (
        <p className="text-[11px] mt-4" style={{ color: DG.muted }}>{t(lang, 'imp_note_coverage')}</p>
      )}
    </div>
  )
}
