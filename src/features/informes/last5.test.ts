import { describe, it, expect } from 'vitest'
import { apiRowsToMatchRows, editableLast5, parseOutcome, resolveLast5, isEmptyMatchRow } from './last5'
import type { Last5Row } from './useInformeEnrichment'
import type { MatchRow } from './types'

const api: Last5Row[] = [
  { rival: 'Pumas', result: '2-1', outcome: 'win', rating: '7.4', minutes: 90, date: '22/07' },
  { rival: 'Toluca', result: '0-0', outcome: 'draw', rating: '6.5', minutes: 87, date: '18/07' },
]

const row = (over: Partial<MatchRow> = {}): MatchRow => ({ rival: '', resultado: '', rating: '', minutos: '', ...over })

describe('resolveLast5', () => {
  it('sin filas propias publica lo de la API', () => {
    expect(resolveLast5([], api)).toBe(api)
    expect(resolveLast5(undefined, api)).toBe(api)
  })

  it('las filas vacías no cuentan como lista propia', () => {
    expect(resolveLast5([row(), row()], api)).toBe(api)
  })

  it('con filas propias publica esas, en ese orden', () => {
    const out = resolveLast5(
      [row({ rival: 'América', resultado: '3-1', rating: '8.1', minutos: '90', fecha: '26/07' }), ...apiRowsToMatchRows(api)],
      api,
    )
    expect(out).toHaveLength(3)
    expect(out[0].rival).toBe('América')
    expect(out[0].outcome).toBe('win')
    expect(out[1].rival).toBe('Pumas')
  })

  it('completa con guiones lo que quedó vacío', () => {
    const out = resolveLast5([row({ rival: 'América' })], api)
    expect(out[0]).toMatchObject({ rival: 'América', result: '—', rating: '—', minutes: 0, outcome: null })
  })
})

describe('parseOutcome', () => {
  it('lee el resultado con los goles propios primero', () => {
    expect(parseOutcome('2-1')).toBe('win')
    expect(parseOutcome('1-1')).toBe('draw')
    expect(parseOutcome('0-3')).toBe('loss')
  })

  it('acepta espacios y otros separadores', () => {
    expect(parseOutcome(' 2 - 0 ')).toBe('win')
    expect(parseOutcome('1:2')).toBe('loss')
  })

  it('sin resultado entendible no arriesga color', () => {
    expect(parseOutcome('')).toBeNull()
    expect(parseOutcome('ganó')).toBeNull()
  })
})

describe('editableLast5', () => {
  it('arranca con los partidos de la API para poder verlos y editarlos', () => {
    const rows = editableLast5([], api)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ rival: 'Pumas', resultado: '2-1', rating: '7.4', minutos: '90', fecha: '22/07' })
  })

  it('si ya hay lista propia, esa manda', () => {
    const mine = [row({ rival: 'América' })]
    expect(editableLast5(mine, api)).toBe(mine)
  })
})

describe('isEmptyMatchRow', () => {
  it('una fila con sólo la fecha sigue estando vacía', () => {
    expect(isEmptyMatchRow(row({ fecha: '26/07' }))).toBe(true)
    expect(isEmptyMatchRow(row({ rival: 'América' }))).toBe(false)
  })
})
