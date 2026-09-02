import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { getMyClubId } from './userProfileService'

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = vi.fn(self)
  builder.eq = vi.fn(self)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  return builder
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('getMyClubId', () => {
  it('devuelve el club_id cuando el usuario tiene perfil', async () => {
    mockFrom.mockReturnValue(chain({ data: { club_id: 'dobleg' }, error: null }))
    expect(await getMyClubId('user-1')).toBe('dobleg')
  })

  it('devuelve null cuando el usuario no tiene fila en user_profiles', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }))
    expect(await getMyClubId('user-2')).toBeNull()
  })

  it('devuelve null si Supabase devuelve error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('boom') }))
    expect(await getMyClubId('user-3')).toBeNull()
  })
})
