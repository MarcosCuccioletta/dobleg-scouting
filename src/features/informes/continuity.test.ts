import { describe, it, expect } from 'vitest'
import { autoContinuityValues, continuityTiles } from './continuity'
import type { Continuity } from './useInformeEnrichment'

const c: Continuity = {
  matches: 8, starts: 6, minutes: 640,
  last5Played: 5, last5Total: 5,
  last10Played: 8, last10Total: 10,
}

describe('autoContinuityValues', () => {
  it('formatea lo que trae la API', () => {
    expect(autoContinuityValues(c)).toEqual({
      matches: '8', starts: '6', minutes: '640', last5: '5/5', last10: '8/10',
    })
  })

  it('devuelve vacíos si no hay datos', () => {
    expect(autoContinuityValues(null)).toEqual({
      matches: '', starts: '', minutes: '', last5: '', last10: '',
    })
  })
})

describe('continuityTiles', () => {
  it('usa los valores de la API cuando no hay nada escrito', () => {
    const tiles = continuityTiles({}, c, 'es')
    expect(tiles.map(t => t.value)).toEqual(['8', '6', '640', '5/5', '8/10'])
  })

  it('lo escrito a mano pisa a la API', () => {
    const tiles = continuityTiles({ continuidad: { matches: '46/46' } }, c, 'es')
    expect(tiles[0].value).toBe('46/46')
    expect(tiles[1].value).toBe('6')
  })

  it('"-" saca esa tarjeta', () => {
    const tiles = continuityTiles({ continuidad: { last5: '-', last10: '—' } }, c, 'es')
    expect(tiles).toHaveLength(3)
    expect(tiles.map(t => t.key)).toEqual(['matches', 'starts', 'minutes'])
  })

  it('el bloque oculto no devuelve nada', () => {
    expect(continuityTiles({ hideContinuity: true }, c, 'es')).toEqual([])
  })

  it('sin datos de la API igual muestra lo escrito a mano', () => {
    const tiles = continuityTiles({ continuidad: { matches: '46', minutes: '4.100' } }, null, 'es')
    expect(tiles.map(t => t.value)).toEqual(['46', '4.100'])
  })

  it('traduce las etiquetas al idioma del informe', () => {
    const es = continuityTiles({}, c, 'es')
    const en = continuityTiles({}, c, 'en')
    expect(es[0].label).not.toBe(en[0].label)
  })
})
