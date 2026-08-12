/**
 * Etiquetas y agrupacion para las ~100 metricas crudas que trae el export "Team
 * Stats" de Wyscout (ver `parseWyscoutTeamStats.ts`). Wyscout exporta cada grupo
 * como "intentados / logrados (efectividad%)" en una sola celda -- al pasarlo a
 * grilla plana con `forwardFillHeaders`, el mismo header se repite en las 3
 * columnas resultantes (`clave`, `clave_2`, `clave_3`). Confirmado con datos reales
 * (ej. "pases_/_logrados": 601, "_2": 483, "_3": 80.37 -- 483/601 = 80.37%): el
 * orden es siempre [intentados, logrados, efectividad%].
 */

export type MetricCategory = 'Ofensiva' | 'Defensiva' | 'Posesión y pases' | 'Físico y disciplina'

// Metricas sin variante _2/_3 (valor unico) o que no siguen el patron de grupo.
const SINGLE_LABELS: Record<string, { label: string; category: MetricCategory }> = {
  ppda: { label: 'PPDA (intensidad de presión)', category: 'Defensiva' },
  faltas: { label: 'Faltas cometidas', category: 'Físico y disciplina' },
  despejes: { label: 'Despejes', category: 'Defensiva' },
  duracion: { label: 'Duración del partido', category: 'Físico y disciplina' },
  fuera_de_juego: { label: 'Fuera de juego', category: 'Físico y disciplina' },
  saques_de_meta: { label: 'Saques de meta', category: 'Posesión y pases' },
  tarjetas_rojas: { label: 'Tarjetas rojas', category: 'Físico y disciplina' },
  goles_recibidos: { label: 'Goles recibidos', category: 'Defensiva' },
  interceptaciones: { label: 'Interceptaciones', category: 'Defensiva' },
  tarjetas_amarillas: { label: 'Tarjetas amarillas', category: 'Físico y disciplina' },
  'lanzamiento_largo_%': { label: 'Saque largo del arquero (%)', category: 'Posesión y pases' },
  seleccionar_esquema: { label: 'Formación utilizada', category: 'Físico y disciplina' },
  longitud_media_pases: { label: 'Longitud media de los pases', category: 'Posesión y pases' },
  distancia_media_de_tiro: { label: 'Distancia media de tiro', category: 'Ofensiva' },
  intensidad_de_paso: { label: 'Intensidad de juego (acciones/min)', category: 'Físico y disciplina' },
  promedio_pases_por_posesion_del_balon: { label: 'Pases por posesión (promedio)', category: 'Posesión y pases' },
  pases_en_profundidad_completados: { label: 'Pases en profundidad completados', category: 'Ofensiva' },
}

// Metricas en grupos de 3 (intentados / logrados / %). La clave es la base sin sufijo.
const GROUP_LABELS: Record<string, { label: string; category: MetricCategory }> = {
  'duelos_/_ganados': { label: 'Duelos', category: 'Físico y disciplina' },
  'pases_/_logrados': { label: 'Pases', category: 'Posesión y pases' },
  'centros_/_precisos': { label: 'Centros', category: 'Ofensiva' },
  'penaltis_/_marcados': { label: 'Penaltis', category: 'Ofensiva' },
  'corneres_/_con_remate': { label: 'Córners que terminan en remate', category: 'Ofensiva' },
  'desmarques_/_logrados': { label: 'Desmarques', category: 'Ofensiva' },
  'tiros_/_a_la_porteria': { label: 'Tiros a la portería', category: 'Ofensiva' },
  'duelos_aereos_/_ganados': { label: 'Duelos aéreos', category: 'Defensiva' },
  'pases_largos_/_logrados': { label: 'Pases largos', category: 'Posesión y pases' },
  'tiros_libres_/_con_remate': { label: 'Tiros libres que terminan en remate', category: 'Ofensiva' },
  'contraataques_/_con_remate': { label: 'Contraataques que terminan en remate', category: 'Ofensiva' },
  'duelos_ofensivos_/_ganados': { label: 'Duelos ofensivos', category: 'Ofensiva' },
  'pases_laterales_/_logrados': { label: 'Pases laterales', category: 'Posesión y pases' },
  'duelos_defensivos_/_ganados': { label: 'Duelos defensivos', category: 'Defensiva' },
  'saques_laterales_/_logrados': { label: 'Saques laterales', category: 'Posesión y pases' },
  'pases_hacia_atras_/_logrados': { label: 'Pases hacia atrás', category: 'Posesión y pases' },
  'pases_progresivos_/_precisos': { label: 'Pases progresivos', category: 'Posesión y pases' },
  'pases_hacia_adelante_/_logrados': { label: 'Pases hacia adelante', category: 'Posesión y pases' },
  'tiros_en_contra_/_a_la_porteria': { label: 'Tiros del rival a la portería', category: 'Defensiva' },
  'ataques_posicionales_/_con_remate': { label: 'Ataques posicionales que terminan en remate', category: 'Ofensiva' },
  'entradas_a_ras_de_suelo_/_logradas': { label: 'Entradas (tackles)', category: 'Defensiva' },
  'jugadas_a_balon_parado_/_con_remate': { label: 'Jugadas a balón parado que terminan en remate', category: 'Ofensiva' },
  'pases_en_el_ultimo_tercio_/_logrados': { label: 'Pases al último tercio', category: 'Ofensiva' },
  'tiros_de_fuera_del_area_/_a_la_porteria': { label: 'Tiros de fuera del área a la portería', category: 'Ofensiva' },
}

const SUFFIX_LABEL: Record<'2' | '3', string> = {
  '2': 'logrados',
  '3': '% efectividad',
}

/** Separa una clave cruda en {base, suffix}: "pases_/_logrados_2" -> {base: "pases_/_logrados", suffix: "2"}. */
function splitKey(rawKey: string): { base: string; suffix: '2' | '3' | null } {
  const match = rawKey.match(/^(.*)_(\d)$/)
  if (match && (match[2] === '2' || match[2] === '3')) {
    return { base: match[1], suffix: match[2] }
  }
  return { base: rawKey, suffix: null }
}

function prettifyFallback(rawKey: string): string {
  return rawKey
    .replace(/_\/_/g, ' / ')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

export interface MetricOption {
  key: string
  label: string
  category: MetricCategory | 'Otras métricas'
}

/** Etiqueta legible para una clave cruda de `raw_metrics` (o de nivel superior como xg_for). */
export function formatWyscoutMetricLabel(rawKey: string): string {
  if (rawKey === 'possession_pct') return 'Posesión (%)'
  if (rawKey === 'xg_for') return 'xG a favor'
  if (rawKey === 'xg_against') return 'xG en contra'

  if (SINGLE_LABELS[rawKey]) return SINGLE_LABELS[rawKey].label

  const { base, suffix } = splitKey(rawKey)
  if (suffix && GROUP_LABELS[base]) {
    return `${GROUP_LABELS[base].label} — ${SUFFIX_LABEL[suffix]}`
  }
  if (suffix === null && GROUP_LABELS[base]) {
    return `${GROUP_LABELS[base].label} — intentados`
  }
  return prettifyFallback(rawKey)
}

function categoryOf(rawKey: string): MetricCategory | 'Otras métricas' {
  if (rawKey === 'possession_pct' || rawKey === 'xg_for') return 'Ofensiva'
  if (rawKey === 'xg_against') return 'Defensiva'
  if (SINGLE_LABELS[rawKey]) return SINGLE_LABELS[rawKey].category
  const { base } = splitKey(rawKey)
  if (GROUP_LABELS[base]) return GROUP_LABELS[base].category
  return 'Otras métricas'
}

const CATEGORY_ORDER: (MetricCategory | 'Otras métricas')[] = [
  'Ofensiva', 'Defensiva', 'Posesión y pases', 'Físico y disciplina', 'Otras métricas',
]

/** Claves que no tiene sentido graficar como serie numerica (texto libre, ej. formacion). */
const NON_NUMERIC_KEYS = new Set(['seleccionar_esquema'])

/**
 * Arma las opciones del selector de metrica, agrupadas por categoria y en el
 * mismo orden en toda la app (Ofensiva, Defensiva, Posesión y pases, Físico y
 * disciplina, Otras métricas al final para las claves sin etiqueta curada).
 */
export function groupWyscoutMetricKeys(rawKeys: string[]): { category: string; options: MetricOption[] }[] {
  const filtered = rawKeys.filter(k => !NON_NUMERIC_KEYS.has(k))
  const byCategory = new Map<string, MetricOption[]>()
  for (const key of filtered) {
    const category = categoryOf(key)
    const option: MetricOption = { key, label: formatWyscoutMetricLabel(key), category }
    if (!byCategory.has(category)) byCategory.set(category, [])
    byCategory.get(category)!.push(option)
  }
  return CATEGORY_ORDER
    .filter(cat => byCategory.has(cat))
    .map(category => ({ category, options: byCategory.get(category)! }))
}
