import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { db } from './db'

function chain() {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = vi.fn(self)
  builder.eq = vi.fn(self)
  builder.insert = vi.fn(self)
  builder.upsert = vi.fn(self)
  builder.update = vi.fn(self)
  builder.delete = vi.fn(self)
  return builder
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('db', () => {
  it('select agrega el filtro club_id explicito', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').select('*')

    expect(mockFrom).toHaveBeenCalledWith('scout_players')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('club_id', 'dobleg')
  })

  it('insert agrega club_id explicito a un objeto', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').insert({ full_name: 'L. Messi' })

    expect(builder.insert).toHaveBeenCalledWith({ full_name: 'L. Messi', club_id: 'dobleg' }, undefined)
  })

  it('insert agrega club_id explicito a cada fila de un array', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').insert([{ full_name: 'A' }, { full_name: 'B' }])

    expect(builder.insert).toHaveBeenCalledWith(
      [{ full_name: 'A', club_id: 'dobleg' }, { full_name: 'B', club_id: 'dobleg' }],
      undefined
    )
  })

  it('update agrega el filtro club_id explicito', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').update({ status: 'x' })

    expect(builder.update).toHaveBeenCalledWith({ status: 'x' })
    expect(builder.eq).toHaveBeenCalledWith('club_id', 'dobleg')
  })

  it('delete agrega el filtro club_id explicito', () => {
    const builder = chain()
    mockFrom.mockReturnValue(builder)

    db('scout_players').delete()

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('club_id', 'dobleg')
  })
})
