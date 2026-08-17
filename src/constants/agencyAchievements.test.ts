import { describe, it, expect } from 'vitest'
import { aggregateAchievementsByYear, resolveAchievementNavigationTarget, type AgencyAchievement } from './agencyAchievements'

describe('aggregateAchievementsByYear', () => {
  it('devuelve vacío sin logros', () => {
    expect(aggregateAchievementsByYear([])).toEqual([])
  })

  it('rellena con cero los años sin logros en el medio del rango', () => {
    const withGap: AgencyAchievement[] = [
      { playerName: 'A', type: 'liga', competition: 'X', club: 'Y', year: 2022 },
      { playerName: 'B', type: 'copa', competition: 'X', club: 'Y', year: 2024 },
    ]
    const result = aggregateAchievementsByYear(withGap)
    expect(result.map(r => r.year)).toEqual([2022, 2023, 2024])
    expect(result[1].total).toBe(0)
    expect(result[1].byType).toMatchObject({ liga: 0, copa: 0, copa_liga: 0, continental: 0, otro: 0 })
  })

  it('cuenta total y desglose por tipo en el mismo año', () => {
    const sample: AgencyAchievement[] = [
      { playerName: 'Mauricio Vera', type: 'liga', competition: 'Liga Uruguaya', club: 'Nacional', year: 2023 },
      { playerName: 'Gianluca Prestianni', type: 'copa', competition: 'Copa de Portugal', club: 'Benfica', year: 2023 },
      { playerName: 'Gianluca Prestianni', type: 'continental', competition: 'Champions League', club: 'Benfica', year: 2024 },
    ]
    const result = aggregateAchievementsByYear(sample)
    const y2023 = result.find(r => r.year === 2023)!
    expect(y2023.total).toBe(2)
    expect(y2023.byType).toMatchObject({ liga: 1, copa: 1, copa_liga: 0, continental: 0, otro: 0 })
    const y2024 = result.find(r => r.year === 2024)!
    expect(y2024.total).toBe(1)
    expect(y2024.byType.continental).toBe(1)
  })
})

describe('resolveAchievementNavigationTarget', () => {
  const players = [{ Jugador: 'Mauricio Vera' }]

  it('matchea por nombre completo tolerando acentos/mayúsculas', () => {
    const achievement: AgencyAchievement = {
      playerName: 'MÁURICIO VÉRA',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementNavigationTarget(achievement, players)).toBe('Mauricio Vera')
  })

  it('devuelve null si no hay match en el roster', () => {
    const achievement: AgencyAchievement = {
      playerName: 'Jugador Inexistente',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementNavigationTarget(achievement, players)).toBeNull()
  })

  it('el match exacto por nombre completo gana sobre una colisión de identityKey (Federico vs. Francesco Paradela)', () => {
    // Ambos jugadores tienen shortName "F. Paradela" -> misma identityKey "f:paradela".
    // Si el logro es de Federico, la fila interna de Federico debe ganar aunque
    // Francesco aparezca antes en el array (el bug original dependía del orden).
    const rosterWithCollision = [
      { Jugador: 'Francesco Paradela' },
      { Jugador: 'Federico Paradela' },
    ]
    const achievement: AgencyAchievement = {
      playerName: 'Federico Paradela',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementNavigationTarget(achievement, rosterWithCollision)).toBe('Federico Paradela')
  })

  it('sin match exacto, cae a identityKey (short name del sheet reconciliado con el nombre completo del logro)', () => {
    const achievement: AgencyAchievement = {
      playerName: 'Mario Sanabria',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementNavigationTarget(achievement, [{ Jugador: 'M. Sanabria' }])).toBe('M. Sanabria')
  })
})
