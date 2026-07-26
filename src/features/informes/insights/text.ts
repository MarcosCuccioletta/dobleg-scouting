// De valores calculados a frases. Acá vive el tono: la misma métrica se enuncia
// distinto según el número ("más de uno de cada cuatro" vs el porcentaje pelado).
// Todo pasa por el diccionario de i18n para que el informe siga siendo multiidioma.

import { t, type Lang } from '@/features/informes/i18n'
import type { InsightItem, InsightTile } from './types'

/** Formatea números respetando el separador decimal del idioma. */
export function formatNum(n: number, lang: Lang): string {
  if (Number.isInteger(n)) return String(n)
  const fixed = String(Math.round(n * 100) / 100)
  return lang === 'es' || lang === 'pt' || lang === 'it' || lang === 'fr'
    ? fixed.replace('.', ',')
    : fixed
}

function vars(values: InsightItem['values'], lang: Lang): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(values)) {
    out[k] = typeof v === 'number' ? formatNum(v, lang) : v
  }
  return out
}

const CUMULATIVE_LABEL: Record<string, string> = {
  'plantel.goals': 'imp_m_goals',
  'plantel.assists': 'imp_m_assists',
  'plantel.ga': 'imp_m_ga',
  'plantel.keyPasses': 'imp_m_keyPasses',
  'plantel.minutes': 'imp_m_minutes',
}

const RATE_LABEL: Record<string, { prefix: string; suffix: string }> = {
  'plantel.duelPct': { prefix: 'imp_m_duelPct', suffix: 'imp_m_duelPct_suffix' },
  'plantel.dribblePct': { prefix: 'imp_m_dribblePct', suffix: 'imp_m_dribblePct_suffix' },
}

export function renderItem(item: InsightItem, lang: Lang): string {
  const v = vars(item.values, lang)

  switch (item.id) {
    case 'cont.pj':
      return Number(item.values.pct) >= 100 ? t(lang, 'imp_cont_pj_all', v) : t(lang, 'imp_cont_pj', v)
    case 'cont.titulares':
      return t(lang, 'imp_cont_titulares', v)
    case 'cont.minutos':
      return t(lang, 'imp_cont_minutos', v)
    case 'cont.lesiones':
      return t(lang, 'imp_cont_lesiones', v)

    case 'ofe.participaciones':
      return t(lang, 'imp_ofe_participaciones', v)
    case 'ofe.share': {
      const pct = Number(item.values.pct)
      if (pct >= 33) return t(lang, 'imp_ofe_share_third', v)
      if (pct >= 25) return t(lang, 'imp_ofe_share_strong', v)
      return t(lang, 'imp_ofe_share', v)
    }
    case 'ofe.promedio':
      return t(lang, 'imp_ofe_promedio', v)
    case 'ofe.cada':
      return t(lang, 'imp_ofe_cada', v)

    case 'plantel.score':
      return item.values.rank === 1 ? t(lang, 'imp_plantel_score_first', v) : t(lang, 'imp_plantel_score', v)
    case 'plantel.position':
      return t(lang, 'imp_plantel_position', v)

    case 'rend.promedio':
      return t(lang, 'imp_rend_promedio', v)
    case 'rend.mejor':
      return t(lang, 'imp_rend_mejor', v)
    case 'rend.tendencia': {
      const key = item.values.direction === 'up' ? 'imp_rend_up'
        : item.values.direction === 'down' ? 'imp_rend_down'
        : 'imp_rend_flat'
      return t(lang, key, v)
    }
    case 'rend.sobrePromedio':
      return t(lang, 'imp_rend_sobre', v)
    case 'rend.percentil':
      return t(lang, 'imp_rend_percentil', v)

    case 'res.record':
      return t(lang, 'imp_res_record', v)
    case 'res.conSinEl':
      return t(lang, 'imp_res_conSinEl', v)
  }

  if (CUMULATIVE_LABEL[item.id]) {
    const metric = t(lang, CUMULATIVE_LABEL[item.id])
    const key = item.values.rank === 1 ? 'imp_plantel_first' : 'imp_plantel_rank'
    return t(lang, key, { ...v, metric })
  }

  if (RATE_LABEL[item.id]) {
    // "Gana el 61,5% de sus duelos: el mejor entre los 14 jugadores con más de 400 minutos."
    // El verbo va en {metric} y el sustantivo en {what}: cada idioma los ordena a su manera.
    const { prefix, suffix } = RATE_LABEL[item.id]
    const key = item.values.rank === 1 ? 'imp_plantel_rate_first' : 'imp_plantel_rate'
    return t(lang, key, { ...v, metric: t(lang, prefix), what: t(lang, suffix) })
  }

  return ''
}

export function renderTile(tile: InsightTile, lang: Lang): { value: string; sub: string } {
  const v = vars(tile.values, lang)
  switch (tile.id) {
    case 'tile.pj':
      return { value: `${v.played}/${v.teamMatches}`, sub: t(lang, 'imp_tile_pj') }
    case 'tile.ga':
      return { value: String(v.ga), sub: t(lang, 'imp_tile_ga', v) }
    case 'tile.share':
      return { value: `${v.pct}%`, sub: t(lang, 'imp_tile_share') }
    case 'tile.score':
      return { value: String(v.avg), sub: t(lang, 'imp_tile_score') }
    default:
      return { value: '', sub: '' }
  }
}
