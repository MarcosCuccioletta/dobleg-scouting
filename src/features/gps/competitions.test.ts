import { describe, it, expect } from 'vitest'
import { mergeCompetitions, KNOWN_COMPETITIONS } from './competitions'

describe('mergeCompetitions', () => {
  it('pone primero las ya usadas y después el catálogo', () => {
    const out = mergeCompetitions(['Reserva Argentina'], ['LPF Argentina', 'Copa Libertadores'])
    expect(out).toEqual(['Reserva Argentina', 'LPF Argentina', 'Copa Libertadores'])
  })

  it('no repite una competencia que ya se usó, sin importar mayúsculas', () => {
    const out = mergeCompetitions(['lpf argentina'], ['LPF Argentina', 'Copa Argentina'])
    expect(out).toEqual(['lpf argentina', 'Copa Argentina'])
  })

  it('el catálogo aclara el país sólo en las ligas locales', () => {
    expect(KNOWN_COMPETITIONS).toContain('LPF Argentina')
    expect(KNOWN_COMPETITIONS).toContain('Liga MX México')
    expect(KNOWN_COMPETITIONS).toContain('Copa Libertadores')
    expect(KNOWN_COMPETITIONS.some(c => /Libertadores .+/.test(c))).toBe(false)
  })
})
