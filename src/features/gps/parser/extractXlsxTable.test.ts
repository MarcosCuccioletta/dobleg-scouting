import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extractXlsxTable } from './extractXlsxTable'

function fixture(name: string): ArrayBuffer {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))
  const buf = readFileSync(path)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('extractXlsxTable', () => {
  it('prioriza la hoja TOTAL cuando el libro tiene varias hojas por tiempo', async () => {
    const grid = await extractXlsxTable(fixture('f3-barracas-central.xlsx'))
    expect(grid).not.toBeNull()
    expect(grid!.headers[0]).toBe('')
    expect(grid!.headers).toContain('DIstancia Mts (m)')
    // 14 jugadores + 1 fila de "Promedio" (buildXlsxTable la descarta después).
    expect(grid!.rows).toHaveLength(15)
    expect(grid!.rows.some(r => String(r[0]) === 'Nicolas Watson')).toBe(true)
  })
})
