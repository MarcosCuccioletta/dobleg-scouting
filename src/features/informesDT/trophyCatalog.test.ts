import { describe, it, expect } from 'vitest'
import { TROPHY_CATALOG, trophyImageUrl } from './trophyCatalog'

describe('trophyImageUrl', () => {
  it('devuelve la ruta pública del trofeo por key', () => {
    expect(trophyImageUrl('sudamericana')).toBe('/trophies/sudamericana.png')
  })
  it('devuelve el genérico si la key no está en el catálogo', () => {
    expect(trophyImageUrl('inventado')).toBe('/trophies/generico.png')
  })
})

describe('TROPHY_CATALOG', () => {
  it('tiene una entrada por cada imagen procesada', () => {
    const keys = TROPHY_CATALOG.map(t => t.key)
    expect(keys).toEqual([
      'sudamericana', 'recopa', 'suruga-bank', 'copa-argentina', 'campeon-argentina', 'primera-nacional', 'generico',
    ])
  })
})
