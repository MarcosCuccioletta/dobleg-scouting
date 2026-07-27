import { describe, it, expect } from 'vitest'
import { buildInformeHtml, ratingColor, comparePercentile, type InsightsExport } from './exportInformeHTML'
import { translateTransferType } from './i18n'
import type { Informe, MetricDef, MetricStat } from './types'
import type { InformeEnrichment } from './useInformeEnrichment'
import type { PlayerTransfer } from '@/services/footballApiService'

const emptyEnrichment: InformeEnrichment = {
  isInternal: false, hasPhysical: false, physicalTiles: [], physicalMatches: 0,
  physicalEvolution: [], levelEvolution: [], levelByMatch: [], levelByWeek: [], levelByMonth: [],
  marketEvolution: [], continuity: null, last5: [], injuries: [], loading: false,
}

function makeDef(over: Partial<MetricDef>): MetricDef {
  return { key: 'k', label: 'k', short: 'k', unit: '', higherIsBetter: true, ...over }
}

function makeInforme(over: Partial<Informe> = {}): Informe {
  return {
    id: 'i1',
    createdAt: '',
    updatedAt: '',
    contextoComparacion: 'Contexto de prueba',
    fotoDataUrl: null,
    protagonistIndex: 0,
    comparePlayerIndices: [],
    content: {
      nombre: 'Jugador Ejemplo',
      club: 'Club X',
      posicion: 'DEL',
      rol: 'Extremo',
      edad: '22',
      nacionalidad: 'ARG',
      liga: 'Liga X',
      contrato: '2027',
      valorMercado: '5M',
      hideMainStats: false,
      rating: '7.2',
      pj: '10',
      minutos: '900',
      goles: '3',
      asistencias: '2',
      lecturaAutor: '',
      lecturaTexto: '',
      videoUrl: '',
      transfermarktUrl: '',
      representante: 'Doble G',
      ultimos5: [],
      hideComparables: false,
      comparables: [],
      comparaciones: '',
    },
    charts: { radar: [], bar: [], numbers: [], scatters: [] },
    headers: ['Jugador', 'Goles'],
    rows: [{ Jugador: 'Jugador Ejemplo', Goles: 3 }],
    columnMap: {},
    ...over,
  }
}

const emptyStats: MetricStat[] = []
const emptyMatrix: Record<string, (number | null)[]> = {}
const emptyDefs: MetricDef[] = []

describe('buildInformeHtml', () => {
  it('genera un documento HTML completo con el script de tabs', () => {
    const html = buildInformeHtml({
      informe: makeInforme(),
      stats: emptyStats,
      matrix: emptyMatrix,
      defs: emptyDefs,
    })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('dg-tab')
    expect(html).toContain("addEventListener('click'")
  })

  it('la barra de secciones queda fija arriba, en una sola fila que se desliza', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(html).toContain('class="dg-tabbar-wrap"')
    expect(html).toContain('position: sticky')
    // Una sola fila: se desliza en vez de envolverse en varias.
    expect(html).toContain('overflow-x: auto')
    expect(html).not.toMatch(/\.dg-tabbar \{[^}]*flex-wrap/)
    // Un solo riel con las secciones adentro, no botones sueltos.
    expect(html).toMatch(/\.dg-tabbar \{[^}]*border-radius: 13px/)
    expect(html).toMatch(/\.dg-tab \{[^}]*border: none/)
    // La activa se distingue sola: verde macizo sobre el riel.
    expect(html).toContain('.dg-tab.active')
    expect(html).toContain('background: #22C55E')
    // Estado accesible para lectores de pantalla.
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('aria-selected="false"')
  })

  it('la barra de secciones va antes que la ficha del jugador', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    const bar = html.indexOf('class="dg-tabbar-wrap"')
    const rail = html.indexOf('class="dg-rail"')
    const panel = html.indexOf('class="dg-panel-card"')
    expect(bar).toBeGreaterThan(-1)
    // En el celular el orden del HTML es el orden en pantalla: primero las
    // secciones, después la ficha. Al revés había que scrollear todo el perfil
    // para descubrir que el informe tenía pestañas.
    expect(bar).toBeLessThan(rail)
    expect(rail).toBeLessThan(panel)
    // Y queda fuera del layout de dos columnas: ocupa todo el ancho.
    expect(bar).toBeLessThan(html.indexOf('class="dg-layout"'))
  })

  it('avisa que la fila de secciones sigue, sólo del lado que quedó afuera', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    // Flechas a ambos lados, apagadas por defecto y encendidas por clase.
    expect(html).toContain('dg-more-left')
    expect(html).toContain('dg-more-right')
    expect(html).toMatch(/\.dg-tabbar-more \{[^}]*opacity: 0/)
    expect(html).toContain('.dg-tabbar-frame.can-right .dg-more-right')
    // La clase la maneja el scroll: si no hay nada afuera, no aparece nada.
    expect(html).toContain("classList.toggle('can-right'")
    expect(html).toContain("classList.toggle('can-left'")
    // Empujoncito inicial para que se vea que se desliza.
    expect(html).toContain('scrollWidth > rail.clientWidth')
  })

  it('al tocar una pestaña la centra y sube al inicio de la sección', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(html).toContain('scrollIntoView')
    expect(html).toContain("inline: 'center'")
    expect(html).toContain('scrollBy')
  })

  it('el botón de Transfermarkt se lee como acción y avisa que abre afuera', () => {
    const informe = makeInforme({
      content: { ...makeInforme().content, transfermarktUrl: 'https://www.transfermarkt.com/x/profil/spieler/1' },
    })
    const html = buildInformeHtml({ informe, stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(html).toContain('Ver en Transfermarkt')
    expect(html).toContain('dg-tm-arrow')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer"')
  })

  it('escapa contenido malicioso en vez de insertarlo crudo', () => {
    const informe = makeInforme({
      content: {
        ...makeInforme().content,
        nombre: '<img src=x onerror=alert(1)>',
      },
    })
    const html = buildInformeHtml({
      informe,
      stats: emptyStats,
      matrix: emptyMatrix,
      defs: emptyDefs,
    })
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
  })

  it('descarta URLs javascript: para transfermarkt y no las embebe', () => {
    const informe = makeInforme({
      content: {
        ...makeInforme().content,
        transfermarktUrl: 'javascript:alert(1)',
      },
    })
    const html = buildInformeHtml({
      informe,
      stats: emptyStats,
      matrix: emptyMatrix,
      defs: emptyDefs,
    })
    expect(html).not.toContain('javascript:alert(1)')
  })

  it('valida el id de YouTube antes de embeberlo', () => {
    const withValid = makeInforme({
      content: { ...makeInforme().content, videoUrl: 'https://www.youtube.com/watch?v=abc12345' },
    })
    const htmlValid = buildInformeHtml({
      informe: withValid,
      stats: emptyStats,
      matrix: emptyMatrix,
      defs: emptyDefs,
    })
    // El id validado se embebe en el facade (data-yt) y en la portada; el reproductor
    // se arma al tocar. Basta con que el id aparezca como atributo controlado.
    expect(htmlValid).toContain('data-yt="abc12345"')

    const withInvalid = makeInforme({
      content: { ...makeInforme().content, videoUrl: 'not-a-video-url' },
    })
    const htmlInvalid = buildInformeHtml({
      informe: withInvalid,
      stats: emptyStats,
      matrix: emptyMatrix,
      defs: emptyDefs,
    })
    // URL inválida => no se renderiza el facade de video.
    expect(htmlInvalid).not.toContain('data-yt=')
  })

  it('renderiza el nombre de una métrica del radar', () => {
    const def = makeDef({ key: 'goles', label: 'Goles' })
    const informe = makeInforme({
      charts: { radar: ['goles'], bar: [], numbers: [], scatters: [] },
    })
    const html = buildInformeHtml({
      informe,
      stats: emptyStats,
      matrix: { goles: [3] },
      defs: [def],
    })
    expect(html).toContain('Goles')
  })

  it('incluye la tabla de comparación de jugadores en el panel de Comparaciones cuando hay comparados', () => {
    const def = makeDef({ key: 'goles', label: 'Goles' })
    const informe = makeInforme({
      comparePlayerIndices: [1],
      charts: { radar: ['goles'], bar: [], numbers: [], scatters: [] },
      rows: [
        { Jugador: 'Jugador Ejemplo', Goles: 3 },
        { Jugador: '<b>Rival Peligroso</b>', Goles: 5 },
      ],
    })
    const html = buildInformeHtml({
      informe,
      stats: emptyStats,
      matrix: { goles: [3, 5] },
      defs: [def],
    })
    expect(html).toContain('Detalle por métrica')
    expect(html).toContain('métricas ganadas')
    expect(html).toContain('&lt;b&gt;Rival Peligroso&lt;/b&gt;')
    expect(html).not.toContain('<b>Rival Peligroso</b>')
  })

  it('renderiza los últimos 5 partidos (API) en el panel General con color por resultado', () => {
    const enrichment: InformeEnrichment = {
      ...emptyEnrichment,
      last5: [
        { rival: 'Ajax', result: '2-1', outcome: 'win', rating: '7.4', minutes: 90, date: '03/05' },
        { rival: 'PSV', result: '0-0', outcome: 'draw', rating: '6.8', minutes: 78, date: '27/04' },
      ],
    }
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs, enrichment })
    expect(html).toContain('Últimos 5 partidos')
    expect(html).toContain('Ajax')
    expect(html).toContain('#22C55E') // color de victoria
    expect(html).toContain('dg-result-dot')
  })

  it('no emite la pestaña Comparaciones si no hay comparación, comparables ni notas', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(html).not.toContain('data-panel="comparaciones"')
  })

  it('emite Comparaciones cuando hay comparables cargados y la saca si el usuario la oculta', () => {
    const base = makeInforme().content
    const conComparables = makeInforme({
      content: { ...base, comparables: [{ jugador: 'Otro', club: 'Club Y', rating: '7.0', delta: '+0.2' }] },
    })
    const html = buildInformeHtml({ informe: conComparables, stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(html).toContain('data-panel="comparaciones"')

    const oculta = makeInforme({
      content: { ...conComparables.content, hideComparacionesTab: true },
    })
    const htmlOculto = buildInformeHtml({ informe: oculta, stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(htmlOculto).not.toContain('data-panel="comparaciones"')
  })

  it('saca la pestaña Carrera cuando está tildado ocultarla', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(html).toContain('data-panel="carrera"')

    const oculta = makeInforme({ content: { ...makeInforme().content, hideCarreraTab: true } })
    const htmlOculto = buildInformeHtml({ informe: oculta, stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(htmlOculto).not.toContain('data-panel="carrera"')
  })

  it('oculta la evolución de nivel (y su ayuda) cuando el usuario la saca', () => {
    const enrichment: InformeEnrichment = {
      ...emptyEnrichment,
      levelByMatch: [{ label: '01/03', value: 6.5 }, { label: '08/03', value: 7.1 }],
    }
    const visible = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs, enrichment })
    expect(visible).toContain('Evolución de nivel (Score GG)')

    const informe = makeInforme({ content: { ...makeInforme().content, hideLevelEvo: true } })
    const oculto = buildInformeHtml({ informe, stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs, enrichment })
    expect(oculto).not.toContain('Evolución de nivel (Score GG)')
  })

  it('la continuidad escrita a mano pisa la de la API y "-" saca la tarjeta', () => {
    const enrichment: InformeEnrichment = {
      ...emptyEnrichment,
      continuity: { matches: 8, starts: 6, minutes: 640, last5Played: 5, last5Total: 5, last10Played: 8, last10Total: 10 },
    }
    const informe = makeInforme({
      content: { ...makeInforme().content, continuidad: { matches: '46/46', last10: '-' } },
    })
    const html = buildInformeHtml({ informe, stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs, enrichment })
    expect(html).toContain('46/46')
    expect(html).not.toContain('>8/10<')

    const sinContinuidad = makeInforme({ content: { ...makeInforme().content, hideContinuity: true } })
    const htmlSin = buildInformeHtml({ informe: sinContinuidad, stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs, enrichment })
    expect(htmlSin).not.toContain('Continuidad')
  })

  it('embebe el escudo de liga solo si es un data URL de imagen', () => {
    const ok = buildInformeHtml({ informe: makeInforme({ ligaCrestDataUrl: 'data:image/png;base64,AAAA' }), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(ok).toContain('class="dg-liga-crest"')
    expect(ok).toContain('data:image/png;base64,AAAA')

    const bad = buildInformeHtml({ informe: makeInforme({ ligaCrestDataUrl: 'javascript:alert(1)' }), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(bad).not.toContain('class="dg-liga-crest"')
    expect(bad).not.toContain('javascript:alert(1)')
  })

  it('renderiza traspasos y solo embebe logos con URL http(s)', () => {
    const transfers: PlayerTransfer[] = [
      { date: '2025-07-01', type: 'Transfer', fee: '€5M', teams: { out: { id: 1, name: 'Vélez', logo: 'https://media/v.png' }, in: { id: 2, name: 'Benfica', logo: 'javascript:alert(1)' } } },
    ]
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs, transfers })
    expect(html).toContain('Historial de traspasos')
    expect(html).toContain('Vélez')
    expect(html).toContain('Benfica')
    expect(html).toContain('https://media/v.png')
    expect(html).not.toContain('javascript:alert(1)')
  })

  it('muestra el estado vacío de traspasos cuando no hay', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs, transfers: [] })
    expect(html).toContain('Sin traspasos registrados')
  })

  it('no muestra la 2da línea si falta la liga o las métricas comparables', () => {
    const html = buildInformeHtml({ informe: makeInforme(), stats: emptyStats, matrix: emptyMatrix, defs: emptyDefs })
    expect(html).not.toContain('Comparado vs')
    expect(html).not.toContain('class="dg-inf-rating"')
  })

  it('muestra la 2da línea "Mejor que X%" vs la liga elegida con las métricas seleccionadas', () => {
    const def = makeDef({ key: 'goles', label: 'Goles' })
    const stats: MetricStat[] = [
      { def, value: 3, avg: 1, percentile: 80, avgPercentile: 50, color: 'green', rank: 1, total: 10 },
    ]
    const informe = makeInforme({ compareLeague: 'Liga MX', compareMetrics: ['goles'] })
    const html = buildInformeHtml({ informe, stats, matrix: { goles: [3] }, defs: [def] })
    // content.posicion = 'DEL' en makeInforme(); reusa la key m_ratingVsPos.
    expect(html).toContain('Mejor que el 80% de DEL en Liga MX')
    expect(html).not.toContain('Comparado vs')
  })
})

describe('comparePercentile', () => {
  const mk = (key: string, percentile: number | null): MetricStat => ({
    def: makeDef({ key, label: key }),
    value: 1, avg: 1, percentile, avgPercentile: null, color: 'neutral', rank: null, total: 5,
  })

  it('promedia solo las métricas elegidas', () => {
    const stats = [mk('a', 80), mk('b', 40), mk('c', 20)]
    expect(comparePercentile(stats, ['a', 'b'])).toBe(60)
  })

  it('sin métricas elegidas usa todas las que tienen percentil', () => {
    const stats = [mk('a', 90), mk('b', 30), mk('c', null)]
    expect(comparePercentile(stats, undefined)).toBe(60) // (90 + 30) / 2
    expect(comparePercentile(stats, [])).toBe(60)
  })

  it('devuelve null si ninguna métrica comparable tiene percentil', () => {
    const stats = [mk('a', null), mk('b', null)]
    expect(comparePercentile(stats, undefined)).toBeNull()
    expect(comparePercentile(stats, ['a'])).toBeNull()
  })
})

describe('ratingColor', () => {
  it('mapea el rating de la API a color por umbral', () => {
    expect(ratingColor(8)).toBe('#22C55E')
    expect(ratingColor(9.1)).toBe('#22C55E')
    expect(ratingColor(6.5)).toBe('#4ADE80')
    expect(ratingColor(7.9)).toBe('#4ADE80')
    expect(ratingColor(4)).toBe('#F59E0B')
    expect(ratingColor(6.49)).toBe('#F59E0B')
    expect(ratingColor(3.9)).toBe('#EF4444')
    expect(ratingColor(null)).toBe('')
  })
})

describe('translateTransferType', () => {
  it('traduce free/loan/transfer y respeta fee y N/A', () => {
    expect(translateTransferType('Free', 'es')).toBe('Libre')
    expect(translateTransferType('Loan', 'it')).toBe('Prestito')
    expect(translateTransferType('Transfer', 'pt')).toBe('Transferência')
    expect(translateTransferType('€ 5M', 'es')).toBe('€ 5M')
    expect(translateTransferType('N/A', 'es')).toBe('—')
    expect(translateTransferType('', 'en')).toBe('—')
  })
})

describe('buildInformeHtml — pestaña Impacto', () => {
  function insightsFixture(): InsightsExport {
    return {
      config: {
        enabled: true,
        period: { mode: 'season' as const },
        blocks: ['continuidad' as const, 'ofensivo' as const],
        hiddenItems: ['cont.minutos'],
        overrides: { 'cont.titulares': 'Texto escrito a mano.' },
      },
      result: {
        period: { mode: 'season' as const, from: '2026-01-01', to: null, anchorDate: null },
        tiles: [
          { id: 'tile.pj', render: 'dots' as const, values: { played: 15, teamMatches: 18, pct: 83.3 }, dots: { filled: 15, total: 18 } },
          { id: 'tile.share', render: 'donut' as const, values: { pct: 28, ga: 7, teamGoals: 25 }, pct: 28 },
        ],
        groups: [
          {
            id: 'continuidad' as const,
            items: [
              { id: 'cont.pj', values: { played: 15, teamMatches: 18, pct: 83.3 }, tone: 'neutral' as const },
              { id: 'cont.titulares', values: { starts: 12, played: 15, pct: 80 }, tone: 'strong' as const },
              { id: 'cont.minutos', values: { minutes: 1136, pct: 70 }, tone: 'neutral' as const },
            ],
          },
          {
            id: 'ofensivo' as const,
            items: [{ id: 'ofe.share', values: { ga: 7, teamGoals: 25, pct: 28 }, tone: 'strong' as const }],
          },
        ],
        warnings: [],
        minMinutes: 400,
        qualifiedCount: 14,
      },
    }
  }

  const baseArgs = () => ({
    informe: makeInforme(),
    stats: emptyStats,
    matrix: emptyMatrix,
    defs: emptyDefs,
  })

  it('agrega la pestaña cuando hay insights habilitados', () => {
    const html = buildInformeHtml({ ...baseArgs(), insights: insightsFixture() })
    expect(html).toContain('data-tab="impacto"')
    expect(html).toContain('data-panel="impacto"')
  })

  it('no agrega la pestaña si está deshabilitada', () => {
    const ins = insightsFixture()
    ins.config.enabled = false
    const html = buildInformeHtml({ ...baseArgs(), insights: ins })
    expect(html).not.toContain('data-panel="impacto"')
  })

  it('respeta las frases ocultas y los textos reescritos', () => {
    const html = buildInformeHtml({ ...baseArgs(), insights: insightsFixture() })
    expect(html).toContain('Texto escrito a mano.')
    expect(html).not.toContain('1136')
  })

  it('dibuja el donut del share', () => {
    const html = buildInformeHtml({ ...baseArgs(), insights: insightsFixture() })
    expect(html).toContain('28%')
    expect(html).toContain('stroke-dasharray')
  })

  it('no filtra bloques desactivados en la config', () => {
    const ins = insightsFixture()
    ins.config.blocks = ['continuidad']
    const html = buildInformeHtml({ ...baseArgs(), insights: ins })
    expect(html).toContain('Texto escrito a mano.')
    expect(html).not.toContain('de los 25 goles del equipo')
  })
})

describe('buildInformeHtml — preview del link (Open Graph)', () => {
  const baseArgs = () => ({
    informe: makeInforme(),
    stats: emptyStats,
    matrix: emptyMatrix,
    defs: emptyDefs,
  })

  it('sin datos de share no emite ninguna etiqueta og', () => {
    const html = buildInformeHtml(baseArgs())
    expect(html).not.toContain('og:title')
    expect(html).not.toContain('twitter:card')
  })

  it('emite título, descripción y url', () => {
    const html = buildInformeHtml({
      ...baseArgs(),
      share: { url: 'https://dobleg-scouting.netlify.app/i/jugador-abc123.html' },
    })
    expect(html).toContain('<meta property="og:title" content="Informe — Jugador Ejemplo" />')
    expect(html).toContain('<meta property="og:url" content="https://dobleg-scouting.netlify.app/i/jugador-abc123.html" />')
    expect(html).toContain('DEL · 22 años · Liga X')
  })

  it('con imagen agrega la tarjeta grande de twitter y las medidas', () => {
    const html = buildInformeHtml({
      ...baseArgs(),
      share: { url: 'https://x.test/i/a.html', imageUrl: 'https://x.test/i/a.jpg?v=1' },
    })
    expect(html).toContain('<meta property="og:image" content="https://x.test/i/a.jpg?v=1" />')
    expect(html).toContain('<meta property="og:image:width" content="1200" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })

  it('sin imagen no declara og:image ni la tarjeta grande', () => {
    const html = buildInformeHtml({ ...baseArgs(), share: { url: 'https://x.test/i/a.html' } })
    expect(html).not.toContain('og:image')
    expect(html).not.toContain('summary_large_image')
  })

  it('escapa el nombre en los atributos en vez de romper la etiqueta', () => {
    const informe = makeInforme()
    informe.content.nombre = 'Juan "El Loco" <script>'
    const html = buildInformeHtml({ ...baseArgs(), informe, share: { url: 'https://x.test/i/a.html' } })
    expect(html).toContain('&quot;El Loco&quot;')
    expect(html).not.toContain('content="Informe — Juan "El Loco"')
  })

  it('acepta una descripción propia', () => {
    const html = buildInformeHtml({
      ...baseArgs(),
      share: { url: 'https://x.test/i/a.html', description: 'Extremo por izquierda · Doble G' },
    })
    expect(html).toContain('content="Extremo por izquierda · Doble G"')
  })
})
