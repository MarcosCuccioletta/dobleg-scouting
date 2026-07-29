import { describe, it, expect } from 'vitest'
import { makeAgencyMatcher, excludeAgencyPlayers } from './agencyFilter'
import type { AgencyPlayer } from '@/constants/agencyPlayers'

const player = (fullName: string, shortName: string): AgencyPlayer => ({
  fullName, shortName, image: null, contractEnd: null, marketValue: null,
  team: '', apiTeamId: null, isReserve: false,
})

const roster: AgencyPlayer[] = [
  player('Alexis Steimbach', 'A. Steimbach'),
  player('Juan Ignacio Díaz', 'J. Díaz'),
  player('Gonzalo González', 'Gonzalo González'),
]

describe('makeAgencyMatcher', () => {
  const isAgency = makeAgencyMatcher(roster)

  it('reconoce el nombre completo', () => {
    expect(isAgency('Alexis Steimbach')).toBe(true)
    expect(isAgency('alexis steimbach')).toBe(true)
  })

  it('reconoce el formato corto de la API', () => {
    expect(isAgency('A. Steimbach')).toBe(true)
  })

  it('reconoce al jugador cuando el nombre está escrito distinto', () => {
    // La API lo lista sin el segundo nombre.
    expect(isAgency('Juan Díaz')).toBe(true)
  })

  it('ignora acentos', () => {
    expect(isAgency('Gonzalo Gonzalez')).toBe(true)
  })

  it('no marca a jugadores ajenos', () => {
    expect(isAgency('Lionel Messi')).toBe(false)
    expect(isAgency('Franco Steimbach')).toBe(false)   // otro nombre, mismo apellido
    expect(isAgency('')).toBe(false)
  })
})

describe('excludeAgencyPlayers', () => {
  it('saca a los de la agencia y deja el resto', () => {
    const list = [{ name: 'Alexis Steimbach' }, { name: 'Lionel Messi' }, { name: 'J. Díaz' }]
    expect(excludeAgencyPlayers(list, roster)).toEqual([{ name: 'Lionel Messi' }])
  })

  it('con roster vacío no filtra nada (no esconde jugadores si la lista no cargó)', () => {
    const list = [{ name: 'Alexis Steimbach' }]
    expect(excludeAgencyPlayers(list, [])).toEqual(list)
  })
})
