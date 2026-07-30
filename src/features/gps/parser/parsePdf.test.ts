import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseGpsPdf } from './parsePdf'
import { buildAliasLookup } from './mapColumns'
import { BASE_AGENCY_PLAYERS } from '@/constants/agencyPlayers'
import type { GpsMetric, GpsMetricAlias } from '../types'

function fixture(name: string): ArrayBuffer {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))
  const buf = readFileSync(path)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

const metrics: GpsMetric[] = [
  { id: 1, key: 'distancia_total', label: 'Distancia Total', unit: 'm', decimals: 0, category: 'locomotor', sort_order: 10, is_active: true },
  { id: 2, key: 'vel_max', label: 'Vel Máx', unit: 'km/h', decimals: 1, category: 'locomotor', sort_order: 70, is_active: true },
]
const aliases: GpsMetricAlias[] = [
  { id: 1, metric_id: 1, alias: 'distancia', source: null },
  { id: 2, metric_id: 2, alias: 'v max', source: null },
]

describe('parseGpsPdf', () => {
  it('devuelve sólo los jugadores Doble G con sus valores y el contexto', async () => {
    const result = await parseGpsPdf(fixture('estudiantes-tigre.pdf'), {
      roster: BASE_AGENCY_PLAYERS,
      lookup: buildAliasLookup(metrics, aliases),
      today: new Date('2026-07-29T12:00:00Z'),
    })

    expect(result.players.map(p => p.rawName).sort()).toEqual(['Gonzalez G', 'Lo Celso'])

    const gonzalez = result.players.find(p => p.rawName === 'Gonzalez G')!
    expect(gonzalez.candidates).toEqual(['Gonzalo González'])
    expect(gonzalez.values[2]).toBe(10222)

    expect(result.context.rival).toBe('Tigre')
    expect(result.context.matchDate).toBe('2026-07-25')
  })

  it('marca qué columnas quedaron sin mapear', async () => {
    const result = await parseGpsPdf(fixture('estudiantes-tigre.pdf'), {
      roster: BASE_AGENCY_PLAYERS,
      lookup: buildAliasLookup(metrics, aliases),
    })

    const byHeader = Object.fromEntries(result.columns.map(c => [c.header, c]))
    expect(byHeader['Distancia'].metricKey).toBe('distancia_total')
    expect(byHeader['V Max'].metricKey).toBe('vel_max')
    expect(byHeader['T'].role).toBe('minutes')
    expect(byHeader['Dist Acele'].role).toBe('unmapped')
  })

  it('tira un error claro cuando el PDF no tiene tabla reconocible', async () => {
    await expect(
      parseGpsPdf(new ArrayBuffer(8), { roster: BASE_AGENCY_PLAYERS, lookup: {} }),
    ).rejects.toThrow()
  })

  it('sin jugador elegido, tira un error claro para un reporte OpenField individual (tarjetas, no tabla)', async () => {
    await expect(
      parseGpsPdf(fixture('postigo-individual.pdf'), { roster: BASE_AGENCY_PLAYERS, lookup: {} }),
    ).rejects.toThrow('No encontré una tabla de jugadores en el PDF')
  })

  it('con el jugador elegido, lee el reporte OpenField individual por tarjetas', async () => {
    const result = await parseGpsPdf(fixture('postigo-individual.pdf'), {
      roster: BASE_AGENCY_PLAYERS,
      lookup: buildAliasLookup(metrics, aliases),
      presetPlayerName: 'Joaquin Postigo',
    })

    expect(result.players).toHaveLength(1)
    expect(result.players[0].rawName).toBe('Joaquin Postigo')
    expect(result.players[0].candidates).toEqual(['Joaquin Postigo'])

    const idx = result.columns.findIndex(c => c.header === 'DISTANCIA TOTAL')
    expect(result.players[0].values[idx]).toBe(10829.9)
  })
})
