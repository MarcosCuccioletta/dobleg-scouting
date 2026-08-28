import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import type {
  RecordStats, ComparativaMetric, SistemaUsado, DisciplinaStats, FormaRecienteEntry,
} from './types'

function num(dict: Record<string, number | string | null>, key: string): number | null {
  const v = dict[key]
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length
}

export function computeRecord(matches: WyscoutMatch[]): RecordStats {
  let ganados = 0, empatados = 0, perdidos = 0, gf = 0, gc = 0
  for (const m of matches) {
    const own = m.golesFor ?? 0
    const rival = num(m.rawMetrics, 'goles_recibidos') ?? 0
    gf += own
    gc += rival
    if (own > rival) ganados++
    else if (own === rival) empatados++
    else perdidos++
  }
  const pj = matches.length
  const puntos = ganados * 3 + empatados
  return {
    pj, ganados, empatados, perdidos,
    ppg: pj === 0 ? 0 : puntos / pj,
    gf, gc,
    efectividadPct: pj === 0 ? 0 : (puntos / (pj * 3)) * 100,
  }
}

type MetricDef = {
  key: string
  label: string
  category: 'metrica' | 'via_generacion'
  unit: '%' | ''
  own: (m: WyscoutMatch) => number | null
  rival: (m: WyscoutMatch) => number | null
}

const ZERO_SUM = (ownKey: string) => (m: WyscoutMatch) => {
  const own = num(m.rawMetrics, ownKey)
  return own === null ? null : 100 - own
}

const COMPARATIVA_METRICS: MetricDef[] = [
  { key: 'posesion', label: 'Posesión del balón', category: 'metrica', unit: '%',
    own: m => m.possessionPct, rival: m => (m.possessionPct === null ? null : 100 - m.possessionPct) },
  { key: 'duelos', label: 'Duelos ganados (total)', category: 'metrica', unit: '%',
    own: m => num(m.rawMetrics, 'duelos_/_ganados_3'), rival: ZERO_SUM('duelos_/_ganados_3') },
  { key: 'duelosAereos', label: 'Duelos aéreos ganados', category: 'metrica', unit: '%',
    own: m => num(m.rawMetrics, 'duelos_aereos_/_ganados_3'), rival: ZERO_SUM('duelos_aereos_/_ganados_3') },
  { key: 'precisionPase', label: 'Precisión de pase', category: 'metrica', unit: '%',
    own: m => num(m.rawMetrics, 'pases_/_logrados_3'), rival: m => num(m.rivalRawMetrics, 'pases_/_logrados_3') },
  { key: 'tirosTotales', label: 'Tiros totales / partido', category: 'metrica', unit: '',
    own: m => num(m.rawMetrics, 'tiros_/_a_la_porteria'), rival: m => num(m.rawMetrics, 'tiros_en_contra_/_a_la_porteria') },
  { key: 'xg', label: 'xG por partido', category: 'metrica', unit: '', own: m => m.xgFor, rival: m => m.xgAgainst },
  { key: 'ppda', label: 'PPDA (presión)', category: 'metrica', unit: '',
    own: m => num(m.rawMetrics, 'ppda'), rival: m => num(m.rivalRawMetrics, 'ppda') },
  { key: 'ataquePosicional', label: 'Ataque posicional (% con remate)', category: 'via_generacion', unit: '%',
    own: m => num(m.rawMetrics, 'ataques_posicionales_/_con_remate_3'), rival: m => num(m.rivalRawMetrics, 'ataques_posicionales_/_con_remate_3') },
  { key: 'contraataque', label: 'Contraataque (% con remate)', category: 'via_generacion', unit: '%',
    own: m => num(m.rawMetrics, 'contraataques_/_con_remate_3'), rival: m => num(m.rivalRawMetrics, 'contraataques_/_con_remate_3') },
  { key: 'balonParado', label: 'Balón parado (% con remate)', category: 'via_generacion', unit: '%',
    own: m => num(m.rawMetrics, 'jugadas_a_balon_parado_/_con_remate_3'), rival: m => num(m.rivalRawMetrics, 'jugadas_a_balon_parado_/_con_remate_3') },
  { key: 'corner', label: 'Córner (% con remate)', category: 'via_generacion', unit: '%',
    own: m => num(m.rawMetrics, 'corneres_/_con_remate_3'), rival: m => num(m.rivalRawMetrics, 'corneres_/_con_remate_3') },
  { key: 'tiroLibre', label: 'Tiro libre (% con remate)', category: 'via_generacion', unit: '%',
    own: m => num(m.rawMetrics, 'tiros_libres_/_con_remate_3'), rival: m => num(m.rivalRawMetrics, 'tiros_libres_/_con_remate_3') },
  { key: 'centros', label: 'Centros (% precisos)', category: 'via_generacion', unit: '%',
    own: m => num(m.rawMetrics, 'centros_/_precisos_3'), rival: m => num(m.rivalRawMetrics, 'centros_/_precisos_3') },
  { key: 'duelosOfensivos', label: 'Duelos ofensivos (% ganados)', category: 'via_generacion', unit: '%',
    own: m => num(m.rawMetrics, 'duelos_ofensivos_/_ganados_3'), rival: m => num(m.rivalRawMetrics, 'duelos_ofensivos_/_ganados_3') },
]

export function computeComparativa(matches: WyscoutMatch[]): ComparativaMetric[] {
  return COMPARATIVA_METRICS.map(def => ({
    key: def.key,
    label: def.label,
    category: def.category,
    ownValue: avg(matches.map(m => def.own(m) ?? 0)),
    rivalValue: avg(matches.map(m => def.rival(m) ?? 0)),
    unit: def.unit,
    overridden: false,
  }))
}

export function computeSistemas(matches: WyscoutMatch[]): SistemaUsado[] {
  const counts = new Map<string, number>()
  for (const m of matches) {
    const formacion = m.rawMetrics['seleccionar_esquema']
    if (!formacion || typeof formacion !== 'string') continue
    counts.set(formacion, (counts.get(formacion) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([formacion, partidos]) => ({ formacion, partidos }))
    .sort((a, b) => b.partidos - a.partidos)
}

export function computeDisciplina(matches: WyscoutMatch[]): DisciplinaStats {
  return {
    faltasPorPartido: avg(matches.map(m => num(m.rawMetrics, 'faltas') ?? 0)),
    amarillas: matches.reduce((s, m) => s + (num(m.rawMetrics, 'tarjetas_amarillas') ?? 0), 0),
    rojas: matches.reduce((s, m) => s + (num(m.rawMetrics, 'tarjetas_rojas') ?? 0), 0),
    faltasRivalPorPartido: avg(matches.map(m => num(m.rivalRawMetrics, 'faltas') ?? 0)),
  }
}

export function computeFormaReciente(matches: WyscoutMatch[], n = 10): FormaRecienteEntry[] {
  const sorted = [...matches].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimos = sorted.slice(-n)
  let acumulado = 0
  return ultimos.map(m => {
    const own = m.golesFor ?? 0
    const rival = num(m.rawMetrics, 'goles_recibidos') ?? 0
    const resultado: 'V' | 'E' | 'D' = own > rival ? 'V' : own === rival ? 'E' : 'D'
    acumulado += resultado === 'V' ? 3 : resultado === 'E' ? 1 : 0
    return { resultado, puntosAcumulados: acumulado, fecha: m.fecha }
  })
}
