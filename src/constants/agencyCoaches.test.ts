import { describe, it, expect } from 'vitest'
import { getCoachByKey } from './agencyCoaches'

describe('getCoachByKey', () => {
  it('encuentra a Domingo por key, activo en Temperley', () => {
    const d = getCoachByKey('domingo')
    expect(d?.fullName).toBe('Nicolás Domingo')
    expect(d?.status).toBe('activo')
    expect(d?.apiTeamId).toBe(454)
    expect(d?.leagueApiId).toBe(129)
    expect(d?.leagueSeason).toBe(2026)
  })

  it('encuentra a Stillitano por key, sin club', () => {
    const s = getCoachByKey('stillitano')
    expect(s?.fullName).toBe('Leandro Stillitano')
    expect(s?.status).toBe('sin_club')
    expect(s?.apiTeamId).toBeNull()
  })

  it('devuelve undefined si la key no existe', () => {
    expect(getCoachByKey('inexistente')).toBeUndefined()
  })
})
