import { describe, it, expect } from 'vitest'
import { splitName, matchRosterName } from './matchPlayers'
import { BASE_AGENCY_PLAYERS } from '@/constants/agencyPlayers'

const roster = BASE_AGENCY_PLAYERS

describe('splitName', () => {
  it('separa nombre y apellido', () => {
    expect(splitName('Gonzalo González')).toEqual({ given: ['gonzalo'], surname: 'gonzalez' })
    expect(splitName('Juan Ignacio Díaz')).toEqual({ given: ['juan', 'ignacio'], surname: 'diaz' })
  })

  it('mantiene juntos los apellidos con partícula', () => {
    expect(splitName('Francesco Lo Celso')).toEqual({ given: ['francesco'], surname: 'lo celso' })
  })
})

describe('matchRosterName', () => {
  it('matchea "Apellido Inicial" como viene en el PDF de Estudiantes', () => {
    expect(matchRosterName('Gonzalez G', roster)).toEqual(['Gonzalo González'])
  })

  it('matchea apellido compuesto solo', () => {
    expect(matchRosterName('Lo Celso', roster)).toEqual(['Francesco Lo Celso'])
  })

  it('matchea el formato "I. Apellido" y el nombre completo', () => {
    expect(matchRosterName('A. Steimbach', roster)).toEqual(['Alexis Steimbach'])
    expect(matchRosterName('Alexis Steimbach', roster)).toEqual(['Alexis Steimbach'])
  })

  it('devuelve todos los candidatos cuando el apellido es ambiguo', () => {
    expect(matchRosterName('Watson', roster).sort()).toEqual(['Franco Watson', 'Nicolás Watson'])
    expect(matchRosterName('F. Paradela', roster).sort()).toEqual(['Federico Paradela', 'Francesco Paradela'])
  })

  it('ignora acentos y puntos', () => {
    expect(matchRosterName('Diaz', roster)).toEqual(['Juan Ignacio Díaz'])
  })

  it('devuelve vacío para jugadores que no son de la agencia', () => {
    expect(matchRosterName('Ojeda', roster)).toEqual([])
    expect(matchRosterName('Quiroga', roster)).toEqual([])
  })
})
