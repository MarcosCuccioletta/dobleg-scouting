import { describe, it, expect } from 'vitest'
import { mapSquadPositionToSpanish, manualExternalToEnriched } from './manualExternalPlayer'
import type { ManualExternalPlayerRow } from '@/services/manualExternalPlayersService'

describe('mapSquadPositionToSpanish', () => {
  it('mapea las 4 posiciones genericas de API-Football', () => {
    expect(mapSquadPositionToSpanish('Goalkeeper')).toBe('Arquero')
    expect(mapSquadPositionToSpanish('Defender')).toBe('Defensor Central')
    expect(mapSquadPositionToSpanish('Midfielder')).toBe('Volante central')
    expect(mapSquadPositionToSpanish('Attacker')).toBe('Delantero')
  })

  it('devuelve string vacio para una posicion desconocida o null, sin crashear', () => {
    expect(mapSquadPositionToSpanish('Wingback')).toBe('')
    expect(mapSquadPositionToSpanish(null)).toBe('')
  })
})

function mkRow(over: Partial<ManualExternalPlayerRow> = {}): ManualExternalPlayerRow {
  return {
    api_player_id: 123,
    full_name: 'Juan Pérez',
    team: 'Temperley',
    position: 'Defensor Central',
    age: 22,
    photo: 'https://example.com/foto.png',
    ...over,
  }
}

describe('manualExternalToEnriched', () => {
  it('llena los campos disponibles y deja el resto en blanco/0', () => {
    const player = manualExternalToEnriched(mkRow(), 6.2)
    expect(player.Jugador).toBe('Juan Pérez')
    expect(player.Equipo).toBe('Temperley')
    expect(player['Posición']).toBe('Defensor Central')
    expect(player.Edad).toBe('22')
    expect(player.ageNum).toBe(22)
    expect(player.Imagen).toBe('https://example.com/foto.png')
    expect(player.source).toBe('externo')
    expect(player.ggScore).toBe(6.2)
    expect(player.Liga).toBe('')
    expect(player.marketValueRaw).toBe(0)
    expect(player['Partidos jugados']).toBe('')
  })

  it('no crashea con age y photo null, y ggScore null', () => {
    const player = manualExternalToEnriched(mkRow({ age: null, photo: null }), null)
    expect(player.Edad).toBe('')
    expect(player.ageNum).toBe(0)
    expect(player.Imagen).toBe('')
    expect(player.ggScore).toBeNull()
  })
})
