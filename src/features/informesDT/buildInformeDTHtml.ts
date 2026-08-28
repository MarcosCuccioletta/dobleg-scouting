import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import type {
  InformeDT, InformeDTContent, ComparativaMetric, RadarAxisKey, EvolutionChartKey,
  ClubDT, ClubJugador, TituloJugador, FormaRecienteEntry,
} from './types'
import { trophyImageUrl } from './trophyCatalog'

// ─────────────────────────────────────────────────────────────────────────
// Port 1:1 de public/informe-dt-domingo-preview.html a template function.
// El CSS es una copia fiel del mockup (ya validado visualmente); el HTML
// mantiene las mismas clases/estructura, con los datos interpolados desde
// `informe.content` / `informe.matches` en vez de hardcodeados.
// ─────────────────────────────────────────────────────────────────────────

// ── Helpers genéricos ───────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '')
  return parts.join('') || '?'
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts[parts.length - 1] || name
}

function num(dict: Record<string, number | string | null>, key: string): number | null {
  const v = dict[key]
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Formatea un valor de ComparativaMetric respetando su unidad ('%' con 1 decimal, '' con 2 — salvo tirosTotales, 1). */
function decimalsFor(m: Pick<ComparativaMetric, 'key' | 'unit'>): number {
  if (m.unit === '%') return 1
  return m.key === 'tirosTotales' ? 1 : 2
}

function fmtMetricValue(value: number, m: Pick<ComparativaMetric, 'key' | 'unit'>): string {
  return `${value.toFixed(decimalsFor(m))}${m.unit}`
}

// ── Récord / KPIs ───────────────────────────────────────────────────────

function buildKpiGrid(content: InformeDTContent): string {
  const { record } = content
  const diff = record.gf - record.gc
  const diffStr = `${diff >= 0 ? '+' : ''}${diff}`
  return `
    <div class="dg-kpi-grid">
      <div class="dg-kpi"><div class="v green">${record.ppg.toFixed(2)}</div><div class="l">Puntos / partido</div></div>
      <div class="dg-kpi"><div class="v">${record.gf}–${record.gc}</div><div class="l">GF – GC</div></div>
      <div class="dg-kpi"><div class="v">${diffStr}</div><div class="l">Diferencia de gol</div></div>
      <div class="dg-kpi"><div class="v green">${Math.round(record.efectividadPct)}%</div><div class="l">Efectividad</div></div>
    </div>`
}

// ── Comparativa (deltas, colores, anchos de barra) ──────────────────────

/** Delta "a favor del equipo": para PPDA (presión) menor valor propio es mejor, así que se invierte. */
function favorableDelta(m: ComparativaMetric): number {
  return m.key === 'ppda' ? m.rivalValue - m.ownValue : m.ownValue - m.rivalValue
}

function deltaBadge(m: ComparativaMetric): { cls: 'pos' | 'neg' | 'flat'; text: string } {
  const delta = favorableDelta(m)
  const threshold = m.unit === '%' ? 0.5 : Math.max(0.05, Math.abs(m.ownValue - m.rivalValue) * 0.05)
  const cls: 'pos' | 'neg' | 'flat' = Math.abs(delta) < threshold ? 'flat' : delta > 0 ? 'pos' : 'neg'
  const rawDelta = m.ownValue - m.rivalValue
  const sign = rawDelta >= 0 ? '+' : '−'
  const text = `${sign}${Math.abs(rawDelta).toFixed(decimalsFor(m))}${m.unit === '%' ? ' pts' : ''}`
  return { cls, text }
}

/** Ancho de barra: directo si es %, o normalizado a un máx. de 87% contra el mayor de los dos valores si no lo es (misma proporción que usaba el mockup para métricas no-porcentuales como xG/PPDA/tiros). */
function barWidthPct(value: number, own: number, rival: number, unit: '%' | ''): number {
  if (unit === '%') return clamp(value, 0, 100)
  const maxV = Math.max(Math.abs(own), Math.abs(rival), 0.0001)
  return clamp((value / maxV) * 87, 0, 100)
}

function buildCmpRow(m: ComparativaMetric): string {
  const { cls, text } = deltaBadge(m)
  const ownW = barWidthPct(m.ownValue, m.ownValue, m.rivalValue, m.unit)
  const rivalW = barWidthPct(m.rivalValue, m.ownValue, m.rivalValue, m.unit)
  return `
      <div class="cmp-row">
        <div class="cmp-top"><span class="cmp-name">${esc(m.label)}</span><span class="cmp-delta ${cls}">${text}</span></div>
        <div class="cmp-bars">
          <div class="cmp-bar-line"><span class="cmp-bar-tag team">DT</span><div class="cmp-track"><div class="cmp-fill team" style="width:${ownW.toFixed(1)}%"></div></div><span class="cmp-val">${fmtMetricValue(m.ownValue, m)}</span></div>
          <div class="cmp-bar-line"><span class="cmp-bar-tag rival">Rival</span><div class="cmp-track"><div class="cmp-fill rival" style="width:${rivalW.toFixed(1)}%"></div></div><span class="cmp-val">${fmtMetricValue(m.rivalValue, m)}</span></div>
        </div>
      </div>`
}

/** Caja de texto con el mayor punto a favor / en contra frente al rival promedio, calculada de los datos (no texto fijo de un DT en particular). */
function buildInsightBox(metrics: ComparativaMetric[], intro: string): string {
  if (metrics.length === 0) return ''
  const withDelta = metrics.map(m => ({ m, delta: favorableDelta(m) }))
  const best = [...withDelta].sort((a, b) => b.delta - a.delta)[0]
  const worst = [...withDelta].sort((a, b) => a.delta - b.delta)[0]
  if (!best || !worst) return ''
  const bestPart = `destaca en <b style="color:#F5F7FA">${esc(best.m.label)}</b> (${fmtMetricValue(best.m.ownValue, best.m)} vs ${fmtMetricValue(best.m.rivalValue, best.m)})`
  const worstPart = best.m.key === worst.m.key ? '' : ` y su mayor diferencia en contra está en <b style="color:#F5F7FA">${esc(worst.m.label)}</b> (${fmtMetricValue(worst.m.ownValue, worst.m)} vs ${fmtMetricValue(worst.m.rivalValue, worst.m)})`
  return `
          <div style="margin-top:20px; padding:14px 16px; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0; font-size:13px; line-height:1.6; color:#C3C9D1;">
              ${intro} ${bestPart}${worstPart}.
            </p>
          </div>`
}

function buildWinCards(content: InformeDTContent): string {
  const metrica = content.comparativa.filter(m => m.category === 'metrica')
  if (metrica.length === 0) return ''
  const top3 = [...metrica].sort((a, b) => Math.abs(favorableDelta(b)) - Math.abs(favorableDelta(a))).slice(0, 3)
  const cards = top3.map(m => `
            <div class="dg-win-card">
              <p class="dg-win-value">${fmtMetricValue(m.ownValue, m)} <span class="vs">vs ${fmtMetricValue(m.rivalValue, m)}</span></p>
              <p class="dg-win-label">${esc(m.label)} — comparado con el rival promedio</p>
            </div>`).join('')
  return `
          <p class="dg-panel-title">Lo más relevante frente al rival promedio</p>
          <p class="dg-subtitle">Comparado contra el promedio de los ${content.record.pj} rivales enfrentados en el mismo período (mismos partidos, datos Wyscout).</p>
          <div class="dg-wins">${cards}
          </div>`
}

// ── Radar de perfil táctico (1 a 6 ejes, geometría genérica N-gon) ──────

const RADAR_ORDER: RadarAxisKey[] = ['posesion', 'duelos', 'duelosAereos', 'precisionPase', 'xg', 'ppda']
const RADAR_SHORT_LABEL: Record<RadarAxisKey, string> = {
  posesion: 'Posesión', duelos: 'Duelos', duelosAereos: 'Aéreos', precisionPase: 'Precisión pase', xg: 'xG', ppda: 'PPDA',
}
const RADAR_ROW_LABEL: Record<RadarAxisKey, string> = {
  posesion: 'Posesión', duelos: 'Duelos ganados', duelosAereos: 'Duelos aéreos', precisionPase: 'Precisión de pase', xg: 'xG por partido', ppda: 'PPDA (presión)',
}
// Normaliza cada eje a una fracción [0,~1.15] del radio máx. Ejes % van directo; xG/PPDA usan una
// escala de referencia razonable (xG: máx. típico ~2.5/partido; PPDA: invertido, ~20 como referencia
// de "poca presión" — más bajo = más presión = más lejos del centro).
const RADAR_RATIO: Record<RadarAxisKey, (v: number) => number> = {
  posesion: v => clamp(v / 100, 0, 1.15),
  duelos: v => clamp(v / 100, 0, 1.15),
  duelosAereos: v => clamp(v / 100, 0, 1.15),
  precisionPase: v => clamp(v / 100, 0, 1.15),
  xg: v => clamp(v / 2.5, 0, 1.15),
  ppda: v => clamp(1 - v / 20, 0, 1.15),
}

function buildRadarSection(content: InformeDTContent): string {
  const axes = RADAR_ORDER.filter(k => content.radarAxes.includes(k))
  if (axes.length === 0) return ''
  const metricsByKey = new Map(content.comparativa.map(m => [m.key, m]))
  const n = axes.length
  // Un polígono de 1 o 2 puntos no dibuja una figura utilizable (un punto no
  // pinta nada, dos degeneran en un palito): por debajo de 3 ejes se muestra
  // solo la lista de valores propio/rival por eje, sin el SVG del radar.
  const showChart = n >= 3

  const rows: string[] = axes.map(axisKey => {
    const metric = metricsByKey.get(axisKey)
    const ownVal = metric?.ownValue ?? 0
    const rivalVal = metric?.rivalValue ?? 0
    const unit: '%' | '' = metric?.unit ?? ''
    return `<div class="radar-metric-row"><span class="radar-metric-name">${esc(RADAR_ROW_LABEL[axisKey])}</span><span class="radar-metric-vals"><span class="own">${fmtMetricValue(ownVal, { key: axisKey, unit })}</span><span class="sep">/</span><span class="rival">${fmtMetricValue(rivalVal, { key: axisKey, unit })}</span></span></div>`
  })

  const legendName = `${esc(content.club)} (${esc(lastName(content.nombre))})`
  const legend = `
                <div class="dg-legend" style="margin-bottom:10px;">
                  <span class="dg-legend-item"><span class="dg-legend-dot" style="background:#22C55E"></span>${legendName}</span>
                  <span class="dg-legend-item"><span class="dg-legend-dot" style="background:#8A9099"></span>Rival promedio</span>
                </div>`

  const subtitle = showChart
    ? `${n === 6 ? 'Seis' : n} ejes clave del juego, normalizados a una misma escala. Cuanto más lejos del centro, mejor ese aspecto del equipo.`
    : `Comparación directa por eje frente al rival promedio (hacen falta al menos 3 ejes elegidos para dibujar el radar).`

  if (!showChart) {
    return `
          <p class="dg-panel-title dg-mt">Perfil táctico — ${esc(content.club)} vs. rival promedio</p>
          <p class="dg-subtitle">${subtitle}</p>
          <div class="radar-card">
            ${legend}
            ${rows.join('\n            ')}
          </div>`
  }

  const cx = 150, cy = 150, R = 118, labelR = 140
  const angleFor = (i: number) => (i * 2 * Math.PI) / n
  const ptAt = (i: number, radius: number) => {
    const a = angleFor(i)
    return { x: cx + radius * Math.sin(a), y: cy - radius * Math.cos(a) }
  }

  const rings = [0.25, 0.5, 0.75, 1].map(level => {
    const pts = axes.map((_, i) => { const p = ptAt(i, R * level); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,${level === 1 ? 0.10 : 0.08})" stroke-width="1"/>`
  }).join('\n                ')

  const spokes = axes.map((_, i) => {
    const p = ptAt(i, R)
    return `<line x1="150" y1="150" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(255,255,255,0.06)"/>`
  }).join('\n                ')

  const ownPts: string[] = []
  const rivalPts: string[] = []
  axes.forEach((axisKey, i) => {
    const metric = metricsByKey.get(axisKey)
    const ownVal = metric?.ownValue ?? 0
    const rivalVal = metric?.rivalValue ?? 0
    const ratioFn = RADAR_RATIO[axisKey]
    const ownP = ptAt(i, R * ratioFn(ownVal))
    const rivalP = ptAt(i, R * ratioFn(rivalVal))
    ownPts.push(`${ownP.x.toFixed(1)},${ownP.y.toFixed(1)}`)
    rivalPts.push(`${rivalP.x.toFixed(1)},${rivalP.y.toFixed(1)}`)
  })

  const labels = axes.map((axisKey, i) => {
    const a = angleFor(i)
    const sinA = Math.sin(a), cosA = Math.cos(a)
    const x = cx + labelR * sinA
    let y = cy - labelR * cosA
    if (cosA < -0.001) y += 4
    const anchor = sinA > 0.01 ? 'start' : sinA < -0.01 ? 'end' : 'middle'
    return `<text class="radar-axis-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(RADAR_SHORT_LABEL[axisKey])}</text>`
  }).join('\n                ')

  return `
          <p class="dg-panel-title dg-mt">Perfil táctico — ${esc(content.club)} vs. rival promedio</p>
          <p class="dg-subtitle">${subtitle}</p>
          <div class="radar-card">
            <div class="radar-grid">
              <svg viewBox="-55 -5 410 310" width="100%" height="auto" style="max-width:360px; margin:0 auto; display:block; overflow:visible;">
                ${rings}
                ${spokes}
                <polygon points="${rivalPts.join(' ')}" fill="rgba(138,144,153,0.10)" stroke="#8A9099" stroke-width="1.5" stroke-dasharray="4 3"/>
                <polygon points="${ownPts.join(' ')}" fill="rgba(34,197,94,0.16)" stroke="#22C55E" stroke-width="2"/>
                ${labels}
              </svg>
              <div>
                ${legend}
                ${rows.join('\n                ')}
              </div>
            </div>
          </div>`
}

// ── Gráficos de evolución partido a partido (SVG calculado desde matches) ─

const EVOLUTION_ORDER: EvolutionChartKey[] = ['posesion', 'xg', 'duelos', 'duelosAereos', 'ppda']
const EVOLUTION_META: Record<EvolutionChartKey, { title: string; unit: '%' | ''; subtitleBase: string }> = {
  posesion: { title: 'Posesión del balón, %', unit: '%', subtitleBase: 'cada punto es un partido' },
  duelos: { title: 'Duelos ganados, %', unit: '%', subtitleBase: 'cada punto es un partido' },
  duelosAereos: { title: 'Duelos aéreos ganados, %', unit: '%', subtitleBase: 'cada punto es un partido' },
  xg: { title: 'xG (goles esperados)', unit: '', subtitleBase: 'Volumen y calidad de las ocasiones generadas por partido, contra las concedidas.' },
  ppda: { title: 'PPDA (presión)', unit: '', subtitleBase: 'Pases que permite el rival antes de recuperar la pelota — un número más bajo indica presión más intensa.' },
}

/** Extrae own/rival por partido para una métrica de evolución, con el mismo criterio que coachAggregation.ts. */
function extractEvolutionPair(m: WyscoutMatch, key: EvolutionChartKey): { own: number | null; rival: number | null } {
  switch (key) {
    case 'posesion':
      return { own: m.possessionPct, rival: m.possessionPct === null ? null : 100 - m.possessionPct }
    case 'xg':
      return { own: m.xgFor, rival: m.xgAgainst }
    case 'duelos': {
      const o = num(m.rawMetrics, 'duelos_/_ganados_3')
      return { own: o, rival: o === null ? null : 100 - o }
    }
    case 'duelosAereos': {
      const o = num(m.rawMetrics, 'duelos_aereos_/_ganados_3')
      return { own: o, rival: o === null ? null : 100 - o }
    }
    case 'ppda':
      return { own: num(m.rawMetrics, 'ppda'), rival: num(m.rivalRawMetrics, 'ppda') }
  }
}

function buildEvolutionChart(matches: WyscoutMatch[], key: EvolutionChartKey): string {
  const meta = EVOLUTION_META[key]
  const sorted = [...matches].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const points = sorted
    .map(m => ({ ...extractEvolutionPair(m, key), fecha: m.fecha }))
    .filter((p): p is { own: number; rival: number; fecha: string } => p.own !== null && p.rival !== null)

  if (points.length < 2) {
    return `
          <div class="trend-mini-card">
            <h5>${esc(meta.title)}</h5>
            <p class="sub">Datos insuficientes para mostrar la evolución partido a partido.</p>
          </div>`
  }

  const PAD_TOP = 15, PAD_BOTTOM = 125, W = 800
  const allValues = points.flatMap(p => [p.own, p.rival])
  const min = Math.min(...allValues), max = Math.max(...allValues)
  const range = max - min
  const yFor = (v: number) => (range === 0 ? (PAD_TOP + PAD_BOTTOM) / 2 : PAD_TOP + ((max - v) / range) * (PAD_BOTTOM - PAD_TOP))
  const xFor = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W)

  const rivalPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.rival).toFixed(1)}`).join(' ')
  const ownPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.own).toFixed(1)}`).join(' ')
  const lastIdx = points.length - 1

  const subtitle = meta.unit === '%'
    ? `${esc(points[0].fecha)} — ${esc(points[lastIdx].fecha)}, ${meta.subtitleBase} (${min.toFixed(1)}% – ${max.toFixed(1)}% de rango en el período).`
    : meta.subtitleBase

  return `
          <div class="trend-mini-card">
            <h5>${esc(meta.title)}</h5>
            <p class="sub">${subtitle}</p>
            <svg viewBox="0 0 800 140" width="100%" height="120" preserveAspectRatio="none" style="overflow:visible; display:block;">
              <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
              <line x1="0" y1="77.5" x2="800" y2="77.5" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
              <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
              <path d="${rivalPath}" fill="none" stroke="#8A9099" stroke-width="2" stroke-dasharray="5 3" stroke-linecap="round" stroke-linejoin="round" />
              <path d="${ownPath}" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="${xFor(lastIdx).toFixed(1)}" cy="${yFor(points[lastIdx].own).toFixed(1)}" r="4.5" fill="#22C55E" stroke="#14171B" stroke-width="2" />
              <circle cx="${xFor(lastIdx).toFixed(1)}" cy="${yFor(points[lastIdx].rival).toFixed(1)}" r="4.5" fill="#8A9099" stroke="#14171B" stroke-width="2" />
            </svg>
            <div class="trend-caption"><span>${esc(points[0].fecha)}</span><span>Equipo (verde) vs. rival de cada fecha (gris)</span><span>${esc(points[lastIdx].fecha)}</span></div>
          </div>`
}

function buildEvolutionSection(content: InformeDTContent, matches: WyscoutMatch[]): string {
  const keys = EVOLUTION_ORDER.filter(k => content.evolutionCharts.includes(k))
  if (keys.length === 0) return ''
  return `
          <p class="dg-panel-title dg-mt" style="margin-top:4px;">Evolución partido a partido</p>${keys.map(k => buildEvolutionChart(matches, k)).join('')}`
}

// ── Forma reciente (racha) ──────────────────────────────────────────────

function buildFormaRecienteChart(entries: FormaRecienteEntry[]): string {
  if (entries.length < 2) {
    return '<p class="dg-subtitle">Datos insuficientes para mostrar la evolución de puntos.</p>'
  }
  const PAD_TOP = 15, PAD_BOTTOM = 125
  const values = entries.map(e => e.puntosAcumulados)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min
  const yFor = (v: number) => (range === 0 ? (PAD_TOP + PAD_BOTTOM) / 2 : PAD_TOP + ((max - v) / range) * (PAD_BOTTOM - PAD_TOP))
  const xFor = (i: number) => (entries.length === 1 ? 400 : (i / (entries.length - 1)) * 800)
  const path = entries.map((e, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(e.puntosAcumulados).toFixed(1)}`).join(' ')
  const lastIdx = entries.length - 1
  return `
          <svg viewBox="0 0 800 140" width="100%" height="140" preserveAspectRatio="none" style="overflow:visible; display:block;">
            <line x1="0" y1="20" x2="800" y2="20" stroke="rgba(255,255,255,0.07)" stroke-width="1" />
            <line x1="0" y1="70" x2="800" y2="70" stroke="rgba(255,255,255,0.07)" stroke-width="1" />
            <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(255,255,255,0.07)" stroke-width="1" />
            <path d="${path}" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="${xFor(lastIdx).toFixed(1)}" cy="${yFor(entries[lastIdx].puntosAcumulados).toFixed(1)}" r="5" fill="#22C55E" stroke="#0F1114" stroke-width="2" />
          </svg>
          <div class="trend-caption"><span>${esc(entries[0].fecha)}</span><span>Puntos acumulados en el torneo</span><span>${esc(entries[lastIdx].fecha)}</span></div>`
}

function buildRachaPanel(content: InformeDTContent): string {
  const entries = content.formaReciente
  if (entries.length === 0) {
    return `
        <section class="dg-panel" data-panel="racha">
          <p class="dg-panel-title">Forma reciente</p>
          <p class="dg-subtitle">Sin partidos suficientes para calcular la forma reciente.</p>
        </section>`
  }
  const pills = entries.map(e => `<div class="pill ${e.resultado === 'V' ? 'w' : e.resultado === 'E' ? 'd' : 'l'}">${e.resultado}</div>`).join('')
  const v = entries.filter(e => e.resultado === 'V').length
  const eCount = entries.filter(e => e.resultado === 'E').length
  const d = entries.filter(e => e.resultado === 'D').length
  const totalPts = entries[entries.length - 1].puntosAcumulados
  const maxPts = entries.length * 3
  const ppg = totalPts / entries.length
  const vsAvg = ppg > content.record.ppg
    ? ' — por encima del promedio de toda la etapa.'
    : ppg < content.record.ppg
      ? ' — por debajo del promedio de toda la etapa.'
      : '.'
  return `
        <section class="dg-panel" data-panel="racha">
          <p class="dg-panel-title">Forma reciente — últimos ${entries.length} partidos</p>
          <div class="pill-row">
            ${pills}
          </div>
          <p class="dg-subtitle">${v}V · ${eCount}E · ${d}D — ${totalPts} de ${maxPts} puntos posibles (${ppg.toFixed(1)} pts/partido)${vsAvg}</p>
          ${buildFormaRecienteChart(entries)}
        </section>`
}

// ── Sistemas / disciplina ───────────────────────────────────────────────

function buildSistemasRows(content: InformeDTContent): string {
  const max = content.sistemas[0]?.partidos || 1
  return content.sistemas.map(s => `
          <div class="sys-row"><div class="sys-name">${esc(s.formacion)}</div><div class="sys-track"><div class="sys-fill" style="width:${((s.partidos / max) * 100).toFixed(1)}%"></div></div><div class="sys-count">${s.partidos}</div></div>`).join('')
}

// ── Últimos 5 / Carrera / Jugador ────────────────────────────────────────

function buildUltimos5(matches: WyscoutMatch[]): string {
  const sorted = [...matches].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)
  if (sorted.length === 0) return '<p class="dg-muted" style="font-size:12px;">Sin partidos cargados.</p>'
  return sorted.map(m => {
    const own = m.golesFor ?? 0
    const rival = num(m.rawMetrics, 'goles_recibidos') ?? 0
    const color = own > rival ? '#22C55E' : own < rival ? '#EF4444' : '#C3C9D1'
    return `<div class="dg-datarow"><dt><span class="dg-result-dot" style="background:${color}"></span>vs ${esc(m.equipoRival)}</dt><dd>${own}–${rival}</dd></div>`
  }).join('')
}

function buildCareerRows(clubs: ClubDT[]): string {
  if (clubs.length === 0) return '<p class="dg-muted" style="font-size:12px;">Sin clubes cargados.</p>'
  return clubs.map(c => `
            <div class="career-row">
              ${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : ''}
              <div class="name-period">
                <p class="name">${esc(c.club)}</p>
                <p class="period">${esc(c.periodo)}${c.liga ? ` · ${esc(c.liga)}` : ''}</p>
              </div>
            </div>`).join('')
}

function buildTrayectoriaRows(clubs: ClubJugador[]): string {
  if (clubs.length === 0) return '<p class="dg-muted" style="font-size:12px;">Sin trayectoria cargada.</p>'
  return clubs.map(c => `
            <div class="career-row">
              ${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : ''}
              <div class="name-period"><p class="name">${esc(c.club)}</p><p class="period">${esc(c.periodo)}</p></div>
              ${c.cedido ? '<span class="loan-tag">Cedido</span>' : ''}
            </div>`).join('')
}

function buildTrophyGrid(titulos: TituloJugador[]): string {
  if (titulos.length === 0) return '<p class="dg-muted" style="font-size:12px;">Sin títulos cargados.</p>'
  return titulos.map(t => `
          <div class="trophy-card">
            <img class="trophy-icon" src="${esc(trophyImageUrl(t.trofeoKey))}" alt="">
            <div><p class="t-name">${esc(t.nombre)}</p><p class="t-meta">${esc(t.temporada)} · ${esc(t.club)}</p></div>
          </div>`).join('')
}

// ── Función principal ────────────────────────────────────────────────────

export function buildInformeDTHtml(informe: InformeDT): string {
  const { content, matches } = informe
  const wdlTotal = content.record.pj || 1
  const wPct = (content.record.ganados / wdlTotal) * 100
  const dPct = (content.record.empatados / wdlTotal) * 100
  const lPct = (content.record.perdidos / wdlTotal) * 100

  const comparativaMetrica = content.comparativa.filter(m => m.category === 'metrica')
  const comparativaVias = content.comparativa.filter(m => m.category === 'via_generacion')
  const hasPpda = comparativaMetrica.some(m => m.key === 'ppda')

  const sistemasRows = buildSistemasRows(content)

  const disciplina = content.disciplina
  const tarjetasPorPartido = content.record.pj > 0 ? (disciplina.amarillas + disciplina.rojas) / content.record.pj : 0

  const jugadorIncluir = content.experienciaJugador.incluir
  const trayectoria = content.experienciaJugador.trayectoria
  const nCedidos = trayectoria.filter(c => c.cedido).length
  const trayectoriaSubtitle = trayectoria.length === 0
    ? 'Sin trayectoria cargada.'
    : `${trayectoria.length} club${trayectoria.length === 1 ? '' : 'es'} en la trayectoria registrada${nCedidos > 0 ? ` — incluye ${nCedidos} cesión${nCedidos === 1 ? '' : 'es'} a préstamo.` : '.'}`

  const jugadorTab = jugadorIncluir ? `
        <section class="dg-panel" data-panel="jugador">
          <p class="dg-panel-title">Datos del jugador</p>
          <div class="dg-kpi-grid">
            <div class="dg-kpi"><div class="v">${esc(content.experienciaJugador.edad)}</div><div class="l">Edad</div></div>
            <div class="dg-kpi" style="grid-column: span 2;"><div class="v" style="font-size:15px;">${esc(content.experienciaJugador.lugarNacimiento) || '—'}</div><div class="l">Lugar de nacimiento</div></div>
            <div class="dg-kpi"><div class="v" style="font-size:15px;">${esc(content.experienciaJugador.altura) || '—'}</div><div class="l">Altura</div></div>
          </div>
          <div class="dg-kpi-grid" style="margin-top:10px;">
            <div class="dg-kpi"><div class="v" style="font-size:14px;">${esc(content.experienciaJugador.posicion) || '—'}</div><div class="l">Posición habitual</div></div>
            <div class="dg-kpi"><div class="v" style="font-size:15px;">${esc(content.experienciaJugador.pieHabil) || '—'}</div><div class="l">Pie hábil</div></div>
            <div class="dg-kpi"><div class="v" style="font-size:13px; color:#8A9099;">${esc(content.experienciaJugador.seleccion) || 'Sin convocatorias'}</div><div class="l">Selección</div></div>
          </div>

          <p class="dg-panel-title dg-mt">Títulos como jugador</p>
          <div class="trophy-grid">${buildTrophyGrid(content.experienciaJugador.titulos)}
          </div>

          <p class="dg-panel-title dg-mt">Trayectoria como jugador</p>
          <p class="dg-subtitle">${trayectoriaSubtitle}</p>
          <div class="career-list">${buildTrayectoriaRows(trayectoria)}
          </div>
        </section>` : ''

  const tabButtons = [
    '<button class="dg-tab active" data-tab="general">General</button>',
    '<button class="dg-tab" data-tab="rivales">Comparativa vs rivales</button>',
    '<button class="dg-tab" data-tab="sistemas">Sistemas</button>',
    '<button class="dg-tab" data-tab="racha">Racha</button>',
    '<button class="dg-tab" data-tab="carreradt">Carrera como DT</button>',
    jugadorIncluir ? '<button class="dg-tab" data-tab="jugador">Experiencia como jugador</button>' : '',
  ].join('\n      ')

  const carreraCiclosSubtitle = content.carreraDT.length <= 1
    ? 'Primer ciclo como director técnico principal.'
    : `${content.carreraDT.length} ciclos como director técnico.`

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Informe de Entrenador — ${esc(content.nombre)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #08090B;
    color: #F5F7FA;
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    position: relative;
  }
  .dg-bg {
    position: fixed;
    inset: 0;
    background: radial-gradient(1200px 600px at 15% -10%, rgba(34,197,94,0.16), transparent 60%);
    pointer-events: none;
    z-index: 0;
  }
  .dg-container { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 24px 24px 48px; }
  .dg-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .dg-mark { flex-shrink: 0; }
  .dg-header-badge { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #8A9099; }
  .dg-header-agency { margin-inline-start: auto; font-size: 12.5px; font-weight: 600; color: #8A9099; }

  .dg-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }
  @media (max-width: 900px) {
    .dg-layout { grid-template-columns: 1fr; }
    .dg-rail { width: 100%; max-width: 560px; margin: 0 auto; }
  }

  .dg-rail, .dg-panel-card { background: #0F1114; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; }
  .dg-rail { padding: 20px; height: fit-content; }
  .dg-rail-head { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; margin-bottom: 16px; }
  .dg-photo-fallback {
    width: 108px; height: 108px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 800; color: #8A9099;
    background: rgba(255,255,255,0.04); border: 3px solid rgba(255,255,255,0.08);
  }
  .dg-rail-head h2 { margin: 0 0 2px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
  .dg-muted { color: #8A9099; margin: 0; font-size: 13px; }
  .dg-datalist { font-size: 13px; margin: 0 0 16px; }
  .dg-datarow { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .dg-datarow:last-child { border-bottom: none; }
  .dg-datarow dt { margin: 0; color: #8A9099; flex-shrink: 0; }
  .dg-datarow dd { margin: 0; font-weight: 600; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dg-result-dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-inline-end: 6px; vertical-align: middle; }
  .dg-photo { width: 108px; height: 108px; border-radius: 999px; object-fit: cover; border: 3px solid rgba(34,197,94,0.35); display: block; }

  .dg-mainstats { margin-bottom: 16px; }
  .dg-mainstats h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8A9099; margin: 0 0 10px; }
  .dg-mainstats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .dg-stat-item { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; }
  .dg-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #8A9099; }
  .dg-stat-value { font-weight: 700; font-variant-numeric: tabular-nums; font-size: 13px; }

  .dg-panel-card { padding: 20px; min-width: 0; }
  .dg-tabbar-wrap { position: sticky; top: 0; z-index: 30; margin: 0 -24px 16px; padding: 10px 24px 12px; }
  .dg-tabbar { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 13px; background: rgba(20,22,26,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); overflow-x: auto; scrollbar-width: none; }
  .dg-tabbar::-webkit-scrollbar { display: none; }
  .dg-tab { appearance: none; flex: 0 0 auto; padding: 8px 14px; border-radius: 9px; border: none; background: transparent; font: inherit; font-size: 13px; font-weight: 600; line-height: 1; color: #A8AEB6; cursor: pointer; white-space: nowrap; transition: background .16s ease, color .16s ease; }
  .dg-tab:hover { color: #F5F7FA; background: rgba(255,255,255,0.07); }
  .dg-tab.active { background: #22C55E; color: #08090B; font-weight: 700; box-shadow: 0 2px 10px rgba(34,197,94,0.25); }
  .dg-panel { display: none; }
  .dg-panel.active { display: block; }
  .dg-panel-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8A9099; margin: 0 0 6px; }
  .dg-panel-title.dg-mt { margin-top: 26px; }
  .dg-subtitle { margin: 0 0 16px; font-size: 12.5px; color: #C3C9D1; line-height: 1.5; }

  /* KPI grid (Récord) */
  .dg-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
  .dg-kpi { background: #0F1114; padding: 16px 10px; text-align: center; }
  .dg-kpi .v { font-weight: 800; font-size: 22px; font-variant-numeric: tabular-nums; }
  .dg-kpi .v.green { color: #22C55E; }
  .dg-kpi .l { font-size: 10.5px; color: #8A9099; margin-top: 4px; font-weight: 600; letter-spacing: 0.02em; }
  @media (max-width: 560px) { .dg-kpi-grid { grid-template-columns: repeat(2,1fr); } }

  /* Récord V-E-D — barra segmentada, hero propio */
  .wdl-hero { background: #0F1114; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px 20px; margin-bottom: 22px; }
  .wdl-hero-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
  .wdl-counts { display: flex; align-items: baseline; gap: 18px; }
  .wdl-count { display: flex; align-items: baseline; gap: 6px; }
  .wdl-count .n { font-family: inherit; font-weight: 800; font-size: 26px; font-variant-numeric: tabular-nums; }
  .wdl-count.w .n { color: #22C55E; }
  .wdl-count.d .n { color: #C3C9D1; }
  .wdl-count.l .n { color: #EF4444; }
  .wdl-count .k { font-size: 11.5px; color: #8A9099; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .wdl-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; }
  .wdl-bar span { height: 100%; }
  .wdl-bar .w { background: #22C55E; }
  .wdl-bar .d { background: #4A4F57; }
  .wdl-bar .l { background: #EF4444; }

  /* Win cards (insight highlights) */
  .dg-wins { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0 4px; }
  .dg-win-card { background: #14171B; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; }
  .dg-win-value { margin: 0; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: #F5F7FA; }
  .dg-win-value .vs { font-size: 12px; font-weight: 500; color: #8A9099; }
  .dg-win-label { margin: 4px 0 0; font-size: 11.5px; color: #C3C9D1; line-height: 1.4; }

  /* ── Comparativa vs rivales: barras espejadas ─────────────────────────── */
  .dg-legend { display: flex; gap: 16px; margin-bottom: 18px; font-size: 12.5px; }
  .dg-legend-item { display: inline-flex; align-items: center; gap: 6px; color: #F5F7FA; }
  .dg-legend-dot { width: 9px; height: 9px; border-radius: 999px; flex-shrink: 0; }
  .cmp-row { padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .cmp-row:last-child { border-bottom: none; }
  .cmp-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; gap: 10px; }
  .cmp-name { font-size: 13.5px; font-weight: 600; color: #F5F7FA; }
  .cmp-delta { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cmp-delta.pos { color: #22C55E; }
  .cmp-delta.neg { color: #EF4444; }
  .cmp-delta.flat { color: #8A9099; }
  .cmp-bars { display: flex; flex-direction: column; gap: 5px; }
  .cmp-bar-line { display: grid; grid-template-columns: 46px 1fr 52px; align-items: center; gap: 10px; }
  .cmp-bar-tag { font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
  .cmp-bar-tag.team { color: #22C55E; }
  .cmp-bar-tag.rival { color: #8A9099; }
  .cmp-track { height: 9px; background: rgba(255,255,255,0.06); border-radius: 5px; overflow: hidden; }
  .cmp-fill { height: 100%; border-radius: 5px; }
  .cmp-fill.team { background: #22C55E; }
  .cmp-fill.rival { background: #565C64; }
  .cmp-val { font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; color: #F5F7FA; }

  /* Systems (formaciones) */
  .sys-row { display: grid; grid-template-columns: 92px 1fr 34px; align-items: center; gap: 12px; padding: 8px 0; }
  .sys-name { font-weight: 700; font-size: 13.5px; }
  .sys-track { height: 18px; background: rgba(255,255,255,0.06); border-radius: 6px; overflow: hidden; }
  .sys-fill { height: 100%; border-radius: 6px; background: #22C55E; }
  .sys-count { text-align: right; font-size: 12px; color: #8A9099; font-weight: 600; }

  /* Racha / forma */
  .pill-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
  .pill { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
  .pill.w { background: rgba(34,197,94,0.14); color: #22C55E; }
  .pill.d { background: rgba(255,255,255,0.08); color: #C3C9D1; }
  .pill.l { background: rgba(239,68,68,0.14); color: #EF4444; }
  .trend-caption { display: flex; justify-content: space-between; font-size: 11px; color: #8A9099; margin-top: 6px; }

  /* ── Perfil táctico: radar ─────────────────────────────────────────── */
  .radar-card { background: #0F1114; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; margin: 18px 0 4px; }
  .radar-grid { display: grid; grid-template-columns: minmax(230px, 300px) 1fr; gap: 24px; align-items: center; }
  @media (max-width: 700px) { .radar-grid { grid-template-columns: 1fr; } }
  .radar-axis-label { font-size: 10.5px; font-weight: 700; fill: #A8AEB6; }
  .radar-metric-row { display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 12.5px; }
  .radar-metric-row:last-child { border-bottom: none; }
  .radar-metric-name { color: #C3C9D1; }
  .radar-metric-vals { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .radar-metric-vals .own { color: #22C55E; }
  .radar-metric-vals .sep { color: #565C64; margin: 0 4px; font-weight: 400; }
  .radar-metric-vals .rival { color: #8A9099; }

  /* ── Evolución partido a partido: mini line charts ────────────────── */
  .trend-mini-card { background: #14171B; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 14px; }
  .trend-mini-card h5 { margin: 0 0 3px; font-size: 12.5px; font-weight: 700; color: #F5F7FA; }
  .trend-mini-card .sub { margin: 0 0 10px; font-size: 11px; color: #8A9099; }

  /* ── Experiencia como jugador / Carrera como DT ───────────────────── */
  .career-list { display: flex; flex-direction: column; gap: 6px; }
  .career-row { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 10px; background: #14171B; border: 1px solid rgba(255,255,255,0.06); }
  .career-row img { width: 20px; height: 20px; object-fit: contain; flex-shrink: 0; }
  .career-row .name { font-size: 12.5px; font-weight: 600; color: #F5F7FA; line-height: 1.3; }
  .career-row .period { font-size: 10.5px; color: #8A9099; }
  .career-row .name-period { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap; }
  .career-row .loan-tag { font-size: 9.5px; font-weight: 700; color: #D4A72C; background: rgba(212,167,44,0.12); padding: 2px 7px; border-radius: 6px; margin-left: auto; flex-shrink: 0; white-space: nowrap; }

  .trophy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px,1fr)); gap: 12px; margin-bottom: 8px; }
  .trophy-card { background: #14171B; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 16px; display: flex; gap: 12px; align-items: center; }
  .trophy-icon { flex-shrink: 0; width: 56px; height: 56px; object-fit: contain; }
  .trophy-card .t-name { font-size: 12.5px; font-weight: 700; color: #F5F7FA; line-height: 1.35; }
  .trophy-card .t-meta { font-size: 11px; color: #8A9099; margin-top: 4px; }

  .dg-footer { margin-top: 28px; text-align: center; }
  .dg-footer p { margin: 0; font-size: 11.5px; color: #565C64; }
</style>
</head>
<body>
<div class="dg-bg"></div>
<div class="dg-container">

  <header class="dg-header">
    <svg class="dg-mark" width="30" height="30" viewBox="0 0 30 30" fill="none">
      <circle cx="15" cy="15" r="12.5" stroke="#22C55E" stroke-width="2"/>
      <path d="M9 16.5 L13 20.5 L21 10.5" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="dg-header-badge">Informe de entrenador</span>
    <span class="dg-header-agency">Doble G Sports Group</span>
  </header>

  <div class="dg-tabbar-wrap">
    <nav class="dg-tabbar" aria-label="Secciones del informe">
      ${tabButtons}
    </nav>
  </div>

  <div class="dg-layout">
    <aside class="dg-rail">
      <div class="dg-rail-head">
        ${content.fotoDataUrl
          ? `<img class="dg-photo" src="${esc(content.fotoDataUrl)}" alt="${esc(content.nombre)}" />`
          : `<div class="dg-photo-fallback">${esc(initials(content.nombre))}</div>`}
        <div>
          <h2>${esc(content.nombre)}</h2>
          <p class="dg-muted">${esc(content.cargo)}</p>
        </div>
      </div>
      <dl class="dg-datalist">
        <div class="dg-datarow"><dt>Edad</dt><dd>${esc(content.edad)}${content.edad ? ' años' : '—'}</dd></div>
        <div class="dg-datarow"><dt>Club</dt><dd>${esc(content.club)}</dd></div>
        <div class="dg-datarow"><dt>Liga</dt><dd>${esc(content.liga)}</dd></div>
        <div class="dg-datarow"><dt>Sistema habitual</dt><dd>${esc(content.sistemaHabitual)}</dd></div>
        <div class="dg-datarow"><dt>Agencia</dt><dd>Doble G Sports Group</dd></div>
      </dl>
      <div class="dg-mainstats">
        <h4>En ${esc(content.club)}</h4>
        <div class="dg-mainstats-grid">
          <div class="dg-stat-item"><span class="dg-stat-label">PJ</span><span class="dg-stat-value">${content.record.pj}</span></div>
          <div class="dg-stat-item"><span class="dg-stat-label">Efect.</span><span class="dg-stat-value" style="color:#22C55E">${Math.round(content.record.efectividadPct)}%</span></div>
          <div class="dg-stat-item"><span class="dg-stat-label">PPG</span><span class="dg-stat-value">${content.record.ppg.toFixed(2)}</span></div>
        </div>
      </div>
      <div class="dg-mainstats">
        <h4>Últimos 5</h4>
        <div class="dg-datalist" style="margin-bottom:0">
          ${buildUltimos5(matches)}
        </div>
      </div>
    </aside>

    <div class="dg-panel-card">
      <div class="dg-panels">

        <section class="dg-panel active" data-panel="general">
          <p class="dg-panel-title">Récord — ${content.record.pj} partidos dirigidos</p>
          <div class="wdl-hero">
            <div class="wdl-hero-top">
              <div class="wdl-counts">
                <div class="wdl-count w"><span class="n">${content.record.ganados}</span><span class="k">Ganados</span></div>
                <div class="wdl-count d"><span class="n">${content.record.empatados}</span><span class="k">Empatados</span></div>
                <div class="wdl-count l"><span class="n">${content.record.perdidos}</span><span class="k">Perdidos</span></div>
              </div>
              <span style="font-size:12.5px; color:#8A9099;">${wPct.toFixed(1)}% — ${dPct.toFixed(1)}% — ${lPct.toFixed(1)}%</span>
            </div>
            <div class="wdl-bar">
              <span class="w" style="width:${wPct.toFixed(1)}%"></span>
              <span class="d" style="width:${dPct.toFixed(1)}%"></span>
              <span class="l" style="width:${lPct.toFixed(1)}%"></span>
            </div>
          </div>
          ${buildKpiGrid(content)}

          ${buildWinCards(content)}
          ${buildRadarSection(content)}
          ${buildInsightBox(comparativaMetrica, 'Frente al rival promedio, el equipo')}
        </section>

        <section class="dg-panel" data-panel="rivales">
          <p class="dg-panel-title">${esc(content.club)} vs. promedio de rivales enfrentados</p>
          <p class="dg-subtitle">El rival promedio es el promedio de esos mismos ${content.record.pj} adversarios, partido a partido — no un promedio de liga genérico.</p>
          <div class="dg-legend">
            <span class="dg-legend-item"><span class="dg-legend-dot" style="background:#22C55E"></span>${esc(content.club)} (${esc(lastName(content.nombre))})</span>
            <span class="dg-legend-item"><span class="dg-legend-dot" style="background:#565C64"></span>Rival promedio</span>
          </div>
          ${buildEvolutionSection(content, matches)}

          ${comparativaMetrica.length > 0 ? `<p class="dg-panel-title dg-mt">Comparación por métrica — promedio de toda la etapa</p>
          ${comparativaMetrica.map(buildCmpRow).join('')}
          ${hasPpda ? `
          <div class="dg-help" style="margin-top:16px; border-radius:12px; padding:10px 12px; font-size:12px; line-height:1.5; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); color:#8A9099;">
            <span class="dg-help-k" style="color:#22C55E; font-weight:700;">PPDA</span> = pases que permite el rival antes de que el equipo intente recuperar la pelota. Un número más bajo indica presión más intensa; por eso acá que la barra del equipo sea más corta es un signo positivo.
          </div>` : ''}` : ''}

          ${comparativaVias.length > 0 ? `<p class="dg-panel-title dg-mt">Vías de generación de juego — % de esas jugadas que terminan en remate</p>
          <p class="dg-subtitle">De qué manera ataca cada equipo y cuánto de eso se convierte en un tiro.</p>
          ${comparativaVias.map(buildCmpRow).join('')}
          ${buildInsightBox(comparativaVias, 'En las vías de generación de juego, el equipo')}` : ''}
        </section>

        <section class="dg-panel" data-panel="sistemas">
          <p class="dg-panel-title">Sistemas utilizados — ${content.record.pj} partidos</p>
          <p class="dg-subtitle">Formación de inicio declarada por Wyscout en cada partido.</p>
          ${sistemasRows}

          <p class="dg-panel-title dg-mt">Disciplina</p>
          <div class="dg-kpi-grid" style="margin-bottom:0">
            <div class="dg-kpi"><div class="v">${disciplina.faltasPorPartido.toFixed(1)}</div><div class="l">Faltas / partido</div></div>
            <div class="dg-kpi"><div class="v" style="color:#D4A72C">${disciplina.amarillas}</div><div class="l">Amarillas (total)</div></div>
            <div class="dg-kpi"><div class="v" style="color:#EF4444">${disciplina.rojas}</div><div class="l">Rojas (total)</div></div>
            <div class="dg-kpi"><div class="v">${tarjetasPorPartido.toFixed(1)}</div><div class="l">Tarjetas / partido</div></div>
            <div class="dg-kpi"><div class="v">${disciplina.faltasRivalPorPartido.toFixed(1)}</div><div class="l">Faltas rival / partido</div></div>
          </div>
        </section>
${buildRachaPanel(content)}

        <section class="dg-panel" data-panel="carreradt">
          <p class="dg-panel-title">Trayectoria como entrenador</p>
          <p class="dg-subtitle">${carreraCiclosSubtitle}</p>
          <div class="career-list">
            ${buildCareerRows(content.carreraDT)}
          </div>
          <div class="dg-kpi-grid" style="margin-top:14px;">
            <div class="dg-kpi"><div class="v">${content.record.pj}</div><div class="l">Partidos dirigidos</div></div>
            <div class="dg-kpi"><div class="v green">${content.record.ganados}-${content.record.empatados}-${content.record.perdidos}</div><div class="l">V-E-D</div></div>
            <div class="dg-kpi"><div class="v green">${content.record.ppg.toFixed(2)}</div><div class="l">Puntos / partido</div></div>
            <div class="dg-kpi"><div class="v green">${Math.round(content.record.efectividadPct)}%</div><div class="l">Efectividad</div></div>
          </div>
          <div style="margin-top:16px; padding:14px 16px; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0; font-size:13px; line-height:1.6; color:#C3C9D1;">
              Ver el detalle completo del ciclo en ${esc(content.club)} (récord, sistemas, comparativa vs. rivales y forma reciente) en las pestañas <b style="color:#F5F7FA">General</b>, <b style="color:#F5F7FA">Comparativa vs rivales</b>, <b style="color:#F5F7FA">Sistemas</b> y <b style="color:#F5F7FA">Racha</b>.
            </p>
          </div>
        </section>
${jugadorTab}
      </div>
    </div>
  </div>

  <footer class="dg-footer">
    <p>Fuente: Wyscout (export de estadísticas de equipo) · Doble G Sports Group · Generado por Scout Platform</p>
  </footer>
</div>

<script>
  document.querySelectorAll('.dg-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dg-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dg-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector('.dg-panel[data-panel="' + btn.dataset.tab + '"]').classList.add('active');
    });
  });
</script>
</body>
</html>`
}
