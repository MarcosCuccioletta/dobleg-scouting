import { describe, it, expect } from 'vitest'
import { buildInformeDTHtml } from './buildInformeDTHtml'
import type { InformeDT } from './types'

const informe: InformeDT = {
  id: 'dt_1', createdAt: '', updatedAt: '', coachKey: 'domingo',
  content: {
    nombre: 'Nicolás Domingo', cargo: 'Director Técnico', club: 'Temperley', liga: 'Primera Nacional',
    sistemaHabitual: '4-2-3-1', edad: '41', fotoDataUrl: null,
    record: { pj: 27, ganados: 11, empatados: 11, perdidos: 5, ppg: 1.63, gf: 31, gc: 24, efectividadPct: 54 },
    comparativa: [{ key: 'posesion', label: 'Posesión', category: 'metrica', ownValue: 50.2, rivalValue: 49.8, unit: '%', overridden: false }],
    radarAxes: ['posesion'], evolutionCharts: [], sistemas: [{ formacion: '4-2-3-1', partidos: 14 }],
    disciplina: { faltasPorPartido: 12.7, amarillas: 81, rojas: 2, faltasRivalPorPartido: 12.5 },
    formaReciente: [], experienciaJugador: {
      incluir: false, edad: '', lugarNacimiento: '', altura: '', posicion: '', pieHabil: '', seleccion: '',
      titulos: [], trayectoria: [],
    },
    carreraDT: [{ club: 'Temperley', periodo: 'Jul 2026 — actualidad', liga: 'Primera Nacional', logoUrl: null }],
  },
  matches: [],
}

describe('buildInformeDTHtml', () => {
  it('interpola nombre, club y récord', () => {
    const html = buildInformeDTHtml(informe)
    expect(html).toContain('Nicolás Domingo')
    expect(html).toContain('Temperley')
    expect(html).toContain('27')
    expect(html).toContain('54%')
  })

  it('no incluye la pestaña de Experiencia como jugador si incluir=false', () => {
    const html = buildInformeDTHtml(informe)
    expect(html).not.toContain('data-tab="jugador"')
  })

  it('aplica el blur en .dg-tabbar, no en .dg-tabbar-wrap (fix del bug de costura cuadrada)', () => {
    const html = buildInformeDTHtml(informe)
    const wrapRule = html.match(/\.dg-tabbar-wrap\s*\{[^}]*\}/)?.[0] ?? ''
    const tabbarRule = html.match(/\.dg-tabbar\s*\{[^}]*\}/)?.[0] ?? ''
    expect(wrapRule).not.toMatch(/backdrop-filter/)
    expect(tabbarRule).toMatch(/backdrop-filter/)
  })
})
