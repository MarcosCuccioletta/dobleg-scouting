import { describe, it, expect, vi } from 'vitest'
import { fetchAllRows } from './fetchAll.ts'

/** Fuente falsa que se comporta como PostgREST: nunca devuelve más de `pageSize`. */
function fakeSource(total: number, pageSize = 1000) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }))
  return vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, Math.min(to + 1, from + pageSize)),
    error: null,
  }))
}

describe('fetchAllRows', () => {
  it('trae todo cuando hay más filas que una página', async () => {
    const source = fakeSource(2560)
    const rows = await fetchAllRows(source)

    expect(rows).toHaveLength(2560)
    expect(rows[0]).toEqual({ id: 1 })
    expect(rows[2559]).toEqual({ id: 2560 })
    expect(source).toHaveBeenCalledTimes(3)
  })

  it('corta en la primera página incompleta', async () => {
    const source = fakeSource(300)
    expect(await fetchAllRows(source)).toHaveLength(300)
    expect(source).toHaveBeenCalledTimes(1)
  })

  it('no llama de más cuando el total es múltiplo exacto del tamaño de página', async () => {
    const source = fakeSource(2000)
    expect(await fetchAllRows(source)).toHaveLength(2000)
    expect(source).toHaveBeenCalledTimes(3)   // la tercera devuelve vacío y corta
  })

  it('devuelve vacío si no hay filas', async () => {
    expect(await fetchAllRows(fakeSource(0))).toEqual([])
  })

  it('tira el error de la consulta en vez de devolver datos incompletos', async () => {
    const source = vi.fn(async () => ({ data: null, error: { message: 'boom' } }))
    await expect(fetchAllRows(source)).rejects.toThrow('boom')
  })
})
