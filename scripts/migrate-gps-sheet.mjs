/**
 * Migra el Google Sheet GPS_Data a la tabla gps_entries de Supabase. Se corre una
 * sola vez. Los ceros del Sheet significan "no disponible" y no se migran.
 *
 * Dry run:  node scripts/migrate-gps-sheet.mjs
 * En serio: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/migrate-gps-sheet.mjs --apply
 */

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSneBjGlw2I3SyXV-uw1V8Cs_O4lbiQw39melKEZJNhunpshakPrn7AZQBN2L8N9Yw_HA-EeVOt3qvf/pub?gid=1233910424&single=true&output=csv'

/** Cabecera del Sheet → key de gps_metrics. Lo que no está acá es contexto. */
const COLUMN_TO_METRIC = {
  'Distancia (m)': 'distancia_total',
  'Mts/min': 'metros_por_min',
  'Dist 16-21 km/h': 'dist_16_21',
  'Dist 21-24 km/h': 'dist_21_24',
  'Dist >24 km/h': 'dist_over_24',
  'HSR >21 km/h': 'hsr',
  'Vel Max (km/h)': 'vel_max',
  'Sprints': 'sprints',
  '% Alta Intensidad': 'alta_intensidad_pct',
  'Acc >2 m/s': 'acc_over_2',
  'Dec >2 m/s': 'dec_over_2',
  'Acc >3 m/s²': 'acc_over_3',
  'Dec >3 m/s²': 'dec_over_3',
  'Acc >4 m/s': 'acc_over_4',
  'Dec >4 m/s': 'dec_over_4',
  'Player Load': 'player_load',
  'RHIE Bouts': 'rhie_bouts',
}

const APPLY = process.argv.includes('--apply')

/** Igual que agencyKey() del front: NFD, lower, sin acentos ni puntos. */
function playerKey(name) {
  return name.trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\./g, '').replace(/\s+/g, ' ')
}

/** Parser de CSV mínimo con soporte de comillas. */
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function toIsoDate(raw) {
  const s = (raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return null
}

function num(raw) {
  const s = String(raw ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const res = await fetch(CSV_URL)
if (!res.ok) { console.error('No se pudo bajar el CSV:', res.status); process.exit(1) }
const rows = parseCsv(await res.text())
const headers = rows[0].map(h => h.trim())

const entries = []
const skipped = []

for (const row of rows.slice(1)) {
  const get = name => row[headers.indexOf(name)] ?? ''
  const playerName = get('Jugador').trim()
  const matchDate = toIsoDate(get('Fecha'))
  if (!playerName || !matchDate) { skipped.push(`${playerName || '(sin nombre)'} / ${get('Fecha')}`); continue }

  const metrics = {}
  for (const [header, key] of Object.entries(COLUMN_TO_METRIC)) {
    const value = num(get(header))
    // 0 en este Sheet = "no disponible", no un cero real.
    if (value !== null && value !== 0) metrics[key] = value
  }

  entries.push({
    player_key: playerKey(playerName),
    player_name: playerName,
    match_date: matchDate,
    equipo: get('Equipo').trim() || null,
    rival: get('Rival').trim() || null,
    competencia: get('Competencia').trim() || null,
    resultado: get('Resultado').trim() === 'N/A' ? null : (get('Resultado').trim() || null),
    minutos: num(get('Minutos')),
    metrics,
    source: 'manual',
    file_name: 'sheet_gps_data',
  })
}

// El índice único es (player_key, match_date, lower(rival)): si el Sheet trae la misma
// fila dos veces, se queda la última y se avisa. Los partidos que comparten fecha pero
// tienen distinto rival (pasa cuando la fecha cargada es la de subida) se conservan.
const byKey = new Map()
const dupes = []
for (const e of entries) {
  const k = `${e.player_key}|${e.match_date}|${(e.rival ?? '').toLowerCase()}`
  if (byKey.has(k)) dupes.push(`${e.player_name} ${e.match_date} vs ${e.rival ?? '-'}`)
  byKey.set(k, e)
}
const unique = [...byKey.values()]

// El Sheet tiene filas repetidas donde la única diferencia es el encoding del rival
// ("San Mart<?>n" vs "San Martín"). El rival no sirve para detectarlas, pero la
// distancia total sí: mismo jugador, misma fecha y misma distancia es el mismo
// partido. Se conserva la versión sin caracteres rotos.
const broken = s => (s ?? '').includes('�')
const bySignature = new Map()
const encodingDupes = []
for (const e of unique) {
  const k = `${e.player_key}|${e.match_date}|${e.metrics.distancia_total ?? '-'}`
  const prev = bySignature.get(k)
  if (!prev) { bySignature.set(k, e); continue }
  encodingDupes.push(`${e.player_name} ${e.match_date}: "${prev.rival}" / "${e.rival}"`)
  if (broken(prev.rival) && !broken(e.rival)) bySignature.set(k, e)
}
const deduped = [...bySignature.values()]

console.log(`Filas del CSV: ${rows.length - 1}`)
console.log(`A migrar: ${deduped.length}`)
if (encodingDupes.length) console.log(`Repetidas por encoding (se queda la bien escrita): ${encodingDupes.join(' | ')}`)
if (dupes.length) console.log(`Duplicados (se queda el último): ${dupes.join(', ')}`)
if (skipped.length) console.log(`Salteadas por falta de jugador o fecha: ${skipped.join(', ')}`)
console.log("Ejemplo:", JSON.stringify(deduped[0], null, 2))

if (!APPLY) {
  console.log('\nDry run. Volvé a correr con --apply y las credenciales para escribir.')
  process.exit(0)
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const post = await fetch(`${SUPABASE_URL}/rest/v1/gps_entries`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    // Sin merge-duplicates: las filas ya vienen deduplicadas y un choque acá es una
    // señal de que la tabla no estaba vacía, no algo para tapar.
    Prefer: 'return=minimal',
  },
  body: JSON.stringify(deduped),
})

if (!post.ok) {
  console.error('Error insertando:', post.status, await post.text())
  process.exit(1)
}
console.log(`Listo: ${deduped.length} filas migradas.`)
