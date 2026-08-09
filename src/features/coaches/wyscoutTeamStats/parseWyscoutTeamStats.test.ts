import { describe, it, expect } from 'vitest'
import { buildWyscoutMatches, type WyscoutRawRow } from './parseWyscoutTeamStats'

// Simula el resultado de leer 2 filas de un partido (fila propia + fila rival)
// ya con headers de grupo forward-filled, como las devolvería el paso de
// lectura del xlsx (fecha, partido, competencia, equipo, goles, xg, posesion,
// + 2 columnas extra de ejemplo para raw_metrics).
function mkRawRow(over: Partial<WyscoutRawRow> = {}): WyscoutRawRow {
  return {
    fecha: '2026-08-02',
    partido: 'Temperley - Gimnasia y Tiro 1:2',
    competencia: 'Argentina. Primera Nacional',
    equipo: 'Temperley',
    goles: 1,
    xg: 1.15,
    posesion: 64.09,
    extra: { tiros: 16, pases: 601 },
    ...over,
  }
}

describe('buildWyscoutMatches', () => {
  it('empareja la fila propia con la del rival y arma un WyscoutMatch', () => {
    const propia = mkRawRow({ equipo: 'Temperley', goles: 1, xg: 1.15, posesion: 64.09 })
    const rival = mkRawRow({ equipo: 'Gimnasia y Tiro', goles: 2, xg: 1.18, posesion: 35.91 })
    const matches = buildWyscoutMatches([propia, rival], 'Temperley')
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      fecha: '2026-08-02',
      equipoPropio: 'Temperley',
      equipoRival: 'Gimnasia y Tiro',
      xgFor: 1.15,
      xgAgainst: 1.18,
      possessionPct: 64.09,
    })
  })

  it('matchea el nombre propio sin importar tildes/mayusculas', () => {
    const propia = mkRawRow({ equipo: 'TEMPERLEY' })
    const rival = mkRawRow({ equipo: 'Gimnasia y Tiro' })
    const matches = buildWyscoutMatches([propia, rival], 'témperley')
    expect(matches).toHaveLength(1)
    expect(matches[0].equipoPropio).toBe('TEMPERLEY')
  })

  it('descarta un par de filas donde ninguna es el equipo propio', () => {
    const a = mkRawRow({ equipo: 'Equipo A', partido: 'Equipo A - Equipo B 0:0' })
    const b = mkRawRow({ equipo: 'Equipo B', partido: 'Equipo A - Equipo B 0:0' })
    const matches = buildWyscoutMatches([a, b], 'Temperley')
    expect(matches).toHaveLength(0)
  })

  it('procesa varios partidos (varios pares) en un solo llamado', () => {
    const rows: WyscoutRawRow[] = [
      mkRawRow({ fecha: '2026-08-02', partido: 'P1', equipo: 'Temperley' }),
      mkRawRow({ fecha: '2026-08-02', partido: 'P1', equipo: 'Rival 1' }),
      mkRawRow({ fecha: '2026-07-26', partido: 'P2', equipo: 'Rival 2' }),
      mkRawRow({ fecha: '2026-07-26', partido: 'P2', equipo: 'Temperley' }),
    ]
    const matches = buildWyscoutMatches(rows, 'Temperley')
    expect(matches).toHaveLength(2)
  })
})
