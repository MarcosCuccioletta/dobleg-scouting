// De valores calculados a frases. Acá vive el tono: la misma métrica se enuncia
// distinto según el número ("más de uno de cada cuatro" vs el porcentaje pelado).
// Todo pasa por el diccionario de i18n para que el informe siga siendo multiidioma.

import { hasKey, t, type Lang } from '@/features/informes/i18n'
import type { InsightItem, InsightTile } from './types'

/**
 * Traduce con variante singular: si el conteo es 1 y existe `<clave>_one`, usa esa.
 * Evita el "Se perdió 1 partidos por lesión" sin duplicar todo el diccionario.
 */
function tn(lang: Lang, key: string, count: number, vars: Record<string, string | number>): string {
  const one = `${key}_one`
  return count === 1 && hasKey(one) ? t(lang, one, vars) : t(lang, key, vars)
}

const COMMA_LANGS: Lang[] = ['es', 'pt', 'it', 'fr']

function decimalSep(s: string, lang: Lang): string {
  return COMMA_LANGS.includes(lang) ? s.replace('.', ',') : s
}

/** Formatea números respetando el separador decimal del idioma. */
export function formatNum(n: number, lang: Lang): string {
  if (Number.isInteger(n)) return String(n)
  return decimalSep(String(Math.round(n * 100) / 100), lang)
}

/**
 * Promedios con decimales fijos. Un promedio que dice "1 puntos por partido" o
 * "7 de Score GG" se lee como un conteo, no como una media.
 */
export function formatAvg(n: number, lang: Lang, decimals = 1): string {
  return decimalSep(n.toFixed(decimals), lang)
}

function vars(values: InsightItem['values'], lang: Lang): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(values)) {
    out[k] = typeof v === 'number' ? formatNum(v, lang) : v
  }
  return out
}

/** Frase verbal ("el que más goles convirtió") y sustantivo ("2º en goles"). */
const CUMULATIVE_LABEL: Record<string, { verb: string; noun: string }> = {
  'plantel.goals': { verb: 'imp_m_goals', noun: 'imp_n_goals' },
  'plantel.assists': { verb: 'imp_m_assists', noun: 'imp_n_assists' },
  'plantel.ga': { verb: 'imp_m_ga', noun: 'imp_n_ga' },
  'plantel.keyPasses': { verb: 'imp_m_keyPasses', noun: 'imp_n_keyPasses' },
  'plantel.minutes': { verb: 'imp_m_minutes', noun: 'imp_n_minutes' },
}

const RATE_LABEL: Record<string, { prefix: string; suffix: string }> = {
  'plantel.duelPct': { prefix: 'imp_m_duelPct', suffix: 'imp_m_duelPct_suffix' },
  'plantel.dribblePct': { prefix: 'imp_m_dribblePct', suffix: 'imp_m_dribblePct_suffix' },
}

export function renderItem(item: InsightItem, lang: Lang): string {
  const v = vars(item.values, lang)

  switch (item.id) {
    case 'cont.pj':
      return Number(item.values.pct) >= 100
        ? tn(lang, 'imp_cont_pj_all', Number(item.values.teamMatches), v)
        : t(lang, 'imp_cont_pj', v)
    case 'cont.titulares':
      return t(lang, 'imp_cont_titulares', v)
    case 'cont.minutos':
      return t(lang, 'imp_cont_minutos', v)
    case 'cont.lesiones':
      return tn(lang, 'imp_cont_lesiones', Number(item.values.missed), v)

    case 'ofe.participaciones':
      return t(lang, 'imp_ofe_participaciones', v)
    case 'ofe.share': {
      const pct = Number(item.values.pct)
      if (pct >= 33) return t(lang, 'imp_ofe_share_third', v)
      if (pct >= 25) return t(lang, 'imp_ofe_share_strong', v)
      return t(lang, 'imp_ofe_share', v)
    }
    case 'ofe.promedio':
      return t(lang, 'imp_ofe_promedio', {
        ...v,
        perMatch: formatAvg(Number(item.values.perMatch), lang, 2),
        goalsPerMatch: formatAvg(Number(item.values.goalsPerMatch), lang, 2),
        assistsPerMatch: formatAvg(Number(item.values.assistsPerMatch), lang, 2),
      })
    case 'ofe.cada':
      return tn(lang, 'imp_ofe_cada', Number(item.values.every), v)

    case 'plantel.score':
      return item.values.rank === 1 ? t(lang, 'imp_plantel_score_first', v) : t(lang, 'imp_plantel_score', v)
    case 'plantel.position':
      return t(lang, 'imp_plantel_position', v)

    case 'rend.promedio':
      return t(lang, 'imp_rend_promedio', { ...v, avg: formatAvg(Number(item.values.avg), lang) })
    case 'rend.mejor':
      return t(lang, 'imp_rend_mejor', { ...v, best: formatAvg(Number(item.values.best), lang) })
    case 'rend.tendencia': {
      const key = item.values.direction === 'up' ? 'imp_rend_up'
        : item.values.direction === 'down' ? 'imp_rend_down'
        : 'imp_rend_flat'
      return t(lang, key, {
        ...v,
        recent: formatAvg(Number(item.values.recent), lang),
        previous: formatAvg(Number(item.values.previous), lang),
      })
    }
    case 'rend.sobrePromedio':
      return t(lang, 'imp_rend_sobre', v)
    case 'rend.percentil':
      return t(lang, 'imp_rend_percentil', v)

    case 'res.record':
      return t(lang, 'imp_res_record', v)
    case 'res.conSinEl':
      return t(lang, 'imp_res_conSinEl', {
        ...v,
        withPpg: formatAvg(Number(item.values.withPpg), lang, 2),
        withoutPpg: formatAvg(Number(item.values.withoutPpg), lang, 2),
      })
  }

  if (CUMULATIVE_LABEL[item.id]) {
    const { verb, noun } = CUMULATIVE_LABEL[item.id]
    const first = item.values.rank === 1
    return t(lang, first ? 'imp_plantel_first' : 'imp_plantel_rank', {
      ...v,
      metric: t(lang, first ? verb : noun),
    })
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
      return { value: formatAvg(Number(tile.values.avg), lang), sub: t(lang, 'imp_tile_score') }
    default:
      return { value: '', sub: '' }
  }
}
