import { supabase } from '@/lib/supabase'
import { agencyKey } from '@/services/agencyPlayersService'
import { slugify } from '@/features/gps/parser/normalize'
import type {
  GpsMetric, GpsMetricAlias, GpsEntryRow, GpsEntryInput, GpsMetricCategory,
} from '@/features/gps/types'
import type { GPSEntry } from '@/types'

/** Clave de identidad del jugador: la misma que videos y agencia. */
export const gpsPlayerKey = agencyKey

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export async function fetchGpsCatalog(): Promise<{ metrics: GpsMetric[]; aliases: GpsMetricAlias[] }> {
  const [m, a] = await Promise.all([
    supabase.from('gps_metrics').select('*').order('sort_order'),
    supabase.from('gps_metric_aliases').select('*'),
  ])
  if (m.error) console.error('fetchGpsCatalog metrics error:', m.error)
  if (a.error) console.error('fetchGpsCatalog aliases error:', a.error)
  return {
    metrics: (m.data ?? []) as GpsMetric[],
    aliases: (a.data ?? []) as GpsMetricAlias[],
  }
}

export interface NewMetricInput {
  label: string
  unit?: string
  decimals?: number
  category?: GpsMetricCategory
}

export async function createGpsMetric(
  input: NewMetricInput,
  user?: { id?: string; name?: string },
): Promise<GpsMetric | null> {
  const base = slugify(input.label)
  if (!base) return null
  const { data, error } = await supabase.from('gps_metrics').insert({
    key: base,
    label: input.label.trim(),
    unit: input.unit?.trim() ?? '',
    decimals: input.decimals ?? 0,
    category: input.category ?? 'otro',
    sort_order: 900,
    created_by: user?.id ?? null,
    created_by_name: user?.name ?? null,
  }).select().single()

  if (error) {
    // 23505 = la key ya existe: devolver la métrica existente en vez de fallar.
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('gps_metrics').select('*').eq('key', base).single()
      return (existing as GpsMetric) ?? null
    }
    console.error('createGpsMetric error:', error)
    return null
  }
  return data as GpsMetric
}

/** Guarda que una cabecera de PDF corresponde a una métrica. Idempotente. */
export async function addMetricAlias(
  metricId: number,
  alias: string,
  source?: string | null,
): Promise<boolean> {
  const value = alias.trim().toLowerCase()
  if (!value) return false
  const { error } = await supabase
    .from('gps_metric_aliases')
    .upsert({ metric_id: metricId, alias: value, source: source ?? null }, { onConflict: 'alias' })
  if (error) { console.error('addMetricAlias error:', error); return false }
  return true
}

// ─── Entradas ─────────────────────────────────────────────────────────────────

export async function fetchGpsEntries(): Promise<GpsEntryRow[]> {
  const { data, error } = await supabase
    .from('gps_entries')
    .select('*')
    .order('match_date', { ascending: false })
  if (error) { console.error('fetchGpsEntries error:', error); return [] }
  return (data ?? []) as GpsEntryRow[]
}

export interface SaveResult {
  saved: number
  /** Nombres que ya tenían una carga en esa fecha y no se pisaron. */
  conflicts: string[]
  error: string | null
}

/**
 * Inserta las cargas. Con `replace` pisa la fila existente del mismo jugador y fecha;
 * sin `replace`, las que chocan vuelven en `conflicts` para que la UI pregunte.
 */
export async function saveGpsEntries(
  entries: GpsEntryInput[],
  opts: { replace?: boolean } = {},
): Promise<SaveResult> {
  if (entries.length === 0) return { saved: 0, conflicts: [], error: null }

  const { data: { user } } = await supabase.auth.getUser()
  const rows = entries.map(e => ({
    player_key: gpsPlayerKey(e.playerName),
    player_name: e.playerName,
    match_date: e.matchDate,
    equipo: e.equipo ?? null,
    rival: e.rival ?? null,
    competencia: e.competencia ?? null,
    resultado: e.resultado ?? null,
    minutos: e.minutos ?? null,
    metrics: e.metrics,
    source: e.source,
    file_name: e.fileName ?? null,
    created_by: user?.id ?? null,
    created_by_name: (user?.user_metadata?.full_name as string) || user?.email || null,
    updated_at: new Date().toISOString(),
  }))

  if (opts.replace) {
    const { error } = await supabase
      .from('gps_entries')
      .upsert(rows, { onConflict: 'player_key,match_date' })
    if (error) { console.error('saveGpsEntries error:', error); return { saved: 0, conflicts: [], error: error.message } }
    return { saved: rows.length, conflicts: [], error: null }
  }

  // Sin replace: se insertan de a una para saber cuáles chocaron.
  const conflicts: string[] = []
  let saved = 0
  for (const row of rows) {
    const { error } = await supabase.from('gps_entries').insert(row)
    if (!error) { saved++; continue }
    if (error.code === '23505') { conflicts.push(row.player_name); continue }
    console.error('saveGpsEntries error:', error)
    return { saved, conflicts, error: error.message }
  }
  return { saved, conflicts, error: null }
}

export async function updateGpsEntry(
  id: string,
  patch: Partial<Omit<GpsEntryRow, 'id' | 'created_at'>>,
): Promise<boolean> {
  const { error } = await supabase
    .from('gps_entries')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('updateGpsEntry error:', error); return false }
  return true
}

export async function deleteGpsEntry(id: string): Promise<boolean> {
  const { error } = await supabase.from('gps_entries').delete().eq('id', id)
  if (error) { console.error('deleteGpsEntry error:', error); return false }
  return true
}

// ─── Helpers de lectura ───────────────────────────────────────────────────────

/** Valores ya usados de un campo, para sugerir en los inputs (rival, competencia…). */
export function distinctValues(
  entries: GpsEntryRow[],
  field: 'rival' | 'competencia' | 'equipo',
): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    const v = e[field]?.trim()
    if (v) set.add(v)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * Adaptador a la forma vieja `GPSEntry`. Lo consume `useInformeEnrichment`, que usa
 * seis métricas canónicas. Sin dato → 0, igual que el Sheet original.
 */
export function toLegacyGpsEntry(row: GpsEntryRow, _metrics: GpsMetric[]): GPSEntry {
  const m = (key: string): number => row.metrics?.[key] ?? 0
  return {
    Jugador: row.player_name,
    Fecha: new Date(`${row.match_date}T00:00:00Z`),
    Equipo: row.equipo ?? '',
    Rival: row.rival ?? '',
    Resultado: row.resultado ?? '',
    Competencia: row.competencia ?? '',
    Minutos: row.minutos ?? 0,
    Distancia: m('distancia_total'),
    MetrosPorMin: m('metros_por_min'),
    Dist16_21: m('dist_16_21'),
    Dist21_24: m('dist_21_24'),
    DistOver24: m('dist_over_24'),
    HSR: m('hsr'),
    VelMax: m('vel_max'),
    Sprints: m('sprints'),
    AltaIntensidad: m('alta_intensidad_pct'),
    Acc2: m('acc_over_2'),
    Dec2: m('dec_over_2'),
    Acc3: m('acc_over_3'),
    Dec3: m('dec_over_3'),
    Acc4: m('acc_over_4'),
    Dec4: m('dec_over_4'),
    PlayerLoad: m('player_load'),
    RHIEBouts: m('rhie_bouts'),
  }
}
