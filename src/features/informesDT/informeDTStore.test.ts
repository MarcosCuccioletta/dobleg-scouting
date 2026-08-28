// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveInformeDT, listInformesDT, loadInformeDT, deleteInformeDT, newInformeDTId } from './informeDTStore'
import type { InformeDT } from './types'

function fakeInforme(id: string): InformeDT {
  return {
    id, createdAt: '2026-08-28T00:00:00Z', updatedAt: '2026-08-28T00:00:00Z',
    coachKey: 'domingo',
    content: {
      nombre: 'Nicolás Domingo', cargo: 'Director Técnico', club: 'Temperley', liga: 'Primera Nacional',
      sistemaHabitual: '4-2-3-1', edad: '41', fotoDataUrl: null,
      record: { pj: 27, ganados: 11, empatados: 11, perdidos: 5, ppg: 1.63, gf: 31, gc: 24, efectividadPct: 54 },
      comparativa: [], radarAxes: [], evolutionCharts: [], sistemas: [],
      disciplina: { faltasPorPartido: 12.7, amarillas: 81, rojas: 2, faltasRivalPorPartido: 12.5 },
      formaReciente: [], experienciaJugador: {
        incluir: false, edad: '', lugarNacimiento: '', altura: '', posicion: '', pieHabil: '', seleccion: '',
        titulos: [], trayectoria: [],
      },
      carreraDT: [],
    },
    matches: [],
  }
}

beforeEach(() => localStorage.clear())

describe('informeDTStore', () => {
  it('guarda y lista informes de DT', () => {
    saveInformeDT(fakeInforme('a'))
    expect(listInformesDT().map(i => i.id)).toEqual(['a'])
  })

  it('carga uno por id', () => {
    saveInformeDT(fakeInforme('b'))
    expect(loadInformeDT('b')?.coachKey).toBe('domingo')
    expect(loadInformeDT('inexistente')).toBeNull()
  })

  it('borra uno por id', () => {
    saveInformeDT(fakeInforme('c'))
    deleteInformeDT('c')
    expect(listInformesDT()).toEqual([])
  })

  it('newInformeDTId genera ids distintos', () => {
    expect(newInformeDTId()).not.toBe(newInformeDTId())
  })

  it('saveInformeDT lanza un error claro cuando se excede la cuota', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => saveInformeDT(fakeInforme('q'))).toThrow(/demasiados informes/)
    spy.mockRestore()
  })
})
