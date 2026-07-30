import { describe, it, expect } from 'vitest'
import { mergeAgencyIntoInternal } from './DataContext'
import type { AgencyPlayer } from '@/constants/agencyPlayers'
import type { EnrichedPlayer } from '@/types'

function player(over: Partial<EnrichedPlayer> & Pick<EnrichedPlayer, 'Jugador'>): EnrichedPlayer {
  return {
    Liga: '', Equipo: '', 'Posición': '', Edad: '', 'País de nacimiento': '', Pie: '', Altura: '',
    'Valor de mercado (Transfermarkt)': '', 'Vencimiento contrato': '', 'Partidos jugados': '',
    'Minutos jugados': '', Goles: '', xG: '', Asistencias: '', xA: '', 'Posición específica': '',
    id: '', Transfermkt: '', Representante: '', Imagen: '', ggScore: null, ggScorePercentile: null,
    source: 'interno', contractStatus: 'ok', monthsRemaining: null, marketValueFormatted: '',
    marketValueRaw: 0, minutesPlayed: 0, ageNum: 0,
    ...over,
  }
}

const agency = (over: Partial<AgencyPlayer> & Pick<AgencyPlayer, 'shortName' | 'fullName'>): AgencyPlayer => ({
  image: null, contractEnd: null, marketValue: null, team: '', apiTeamId: null, isReserve: false,
  ...over,
})

describe('mergeAgencyIntoInternal', () => {
  it('pisa el Equipo del CSV legacy con el team curado en agencyPlayers, para un jugador que ya tenía fila propia', () => {
    // Como el CSV "J. Postigo, ..., Quilmes" — desactualizado desde que ficha por Acassuso.
    const baseInternal = [player({ Jugador: 'J. Postigo', Equipo: 'Quilmes' })]
    const roster = [agency({ shortName: 'J. Postigo', fullName: 'Joaquin Postigo', team: 'Acassuso' })]

    const merged = mergeAgencyIntoInternal(baseInternal, [], roster)

    expect(merged).toHaveLength(1)
    expect(merged[0].Equipo).toBe('Acassuso')
  })

  it('sigue agregando jugadores de la agencia que no están en internal', () => {
    const roster = [agency({ shortName: 'N. Jugador', fullName: 'Nuevo Jugador', team: 'Independiente' })]

    const merged = mergeAgencyIntoInternal([], [], roster)

    expect(merged).toHaveLength(1)
    expect(merged[0].Jugador).toBe('Nuevo Jugador')
    expect(merged[0].Equipo).toBe('Independiente')
  })

  it('no toca el Equipo de jugadores que no son de la agencia (sin roster cargado todavía)', () => {
    const baseInternal = [player({ Jugador: 'Ajeno Cualquiera', Equipo: 'Boca' })]

    const merged = mergeAgencyIntoInternal(baseInternal, [], [])

    expect(merged[0].Equipo).toBe('Boca')
  })

  it('saca del listado a quien ya no está en el roster (Álvaro López deja la agencia)', () => {
    const baseInternal = [
      player({ Jugador: 'Álvaro López', Equipo: 'Albion' }),
      player({ Jugador: 'J. Postigo', Equipo: 'Quilmes' }),
    ]
    const roster = [agency({ shortName: 'J. Postigo', fullName: 'Joaquin Postigo', team: 'Acassuso' })]

    const merged = mergeAgencyIntoInternal(baseInternal, [], roster)

    expect(merged.map(p => p.Jugador)).toEqual(['J. Postigo'])
  })

  it('completa Edad y Posición de un alta nueva sin fila propia, a partir de birthDate/position', () => {
    const roster = [agency({
      shortName: 'F. Loyola', fullName: 'Favian Loyola', team: 'Audax Italiano',
      birthDate: '2005-05-18', position: 'Volante interno',
    })]

    const merged = mergeAgencyIntoInternal([], [], roster)

    expect(merged[0]['Posición']).toBe('Volante interno')
    expect(merged[0]['Posición específica']).toBe('Volante interno')
    expect(Number(merged[0].Edad)).toBeGreaterThanOrEqual(20)
    expect(merged[0].ageNum).toBe(Number(merged[0].Edad))
  })
})
