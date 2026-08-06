import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseGpsXlsx } from './parseXlsx'
import { BASE_AGENCY_PLAYERS } from '@/constants/agencyPlayers'

function fixture(name: string): ArrayBuffer {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))
  const buf = readFileSync(path)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('parseGpsXlsx', () => {
  it('lee la hoja TOTAL y devuelve sólo los jugadores Doble G con sus valores', async () => {
    const result = await parseGpsXlsx(fixture('f3-barracas-central.xlsx'), {
      roster: BASE_AGENCY_PLAYERS,
      lookup: {},
    })

    const matched = result.players.filter(p => p.candidates.length > 0)
    expect(matched.map(p => p.rawName)).toEqual(['Nicolas Watson'])
    expect(matched[0].candidates).toEqual(['Nicolás Watson'])

    const idx = result.columns.findIndex(c => c.header === 'DIstancia Mts (m)')
    expect(matched[0].values[idx]).toBe(8135)

    // la fila "Promedio" de la hoja TOTAL no debe aparecer como jugador.
    expect(result.players.some(p => p.rawName === 'Promedio')).toBe(false)
  })

  it('tira un error claro cuando el Excel no tiene ninguna hoja tabular', async () => {
    await expect(
      parseGpsXlsx(new ArrayBuffer(8), { roster: BASE_AGENCY_PLAYERS, lookup: {} }),
    ).rejects.toThrow()
  })
})
