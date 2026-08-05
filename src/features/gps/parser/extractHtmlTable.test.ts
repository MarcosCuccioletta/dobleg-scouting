import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { extractHtmlTable } from './extractHtmlTable'

// Set up DOM globals without using jsdom environment directive
beforeAll(() => {
  const { window } = new JSDOM('<!DOCTYPE html>')
  globalThis.DOMParser = window.DOMParser as any
})

function fixture(name: string): string {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))
  return readFileSync(path, 'utf8')
}

describe('extractHtmlTable', () => {
  it('lee headers y filas, priorizando data-v sobre el texto visible', () => {
    const table = extractHtmlTable(fixture('loyola-historial.html'))
    expect(table).not.toBeNull()
    expect(table!.headers).toEqual([
      '#', 'Rival', 'Torneo', 'Minutos', 'Dist. Total (m)', 'm/min',
      'HSR (m)', 'Vel. Máx (km/h)', 'Sprints', 'Player Load',
    ])
    expect(table!.rows).toHaveLength(3)
    expect(table!.rows[0]).toEqual(
      ['1', 'U. DE CHILE', 'TORNEO NACIONAL', '14', '1617', '118.4', '240', '28.8', '1', '180'],
    )
    // El texto visible de "Minutos" trae comilla de minuto ("14'"); data-v="14" gana.
    expect(table!.rows[0][3]).toBe('14')
  })

  it('devuelve null si no hay ninguna tabla con más de una fila', () => {
    expect(extractHtmlTable('<html><body><p>sin tabla</p></body></html>')).toBeNull()
    expect(extractHtmlTable('<table><tr><th>Solo header</th></tr></table>')).toBeNull()
  })
})
