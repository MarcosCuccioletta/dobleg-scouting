import { describe, it, expect } from 'vitest'
import { aggregateAchievementsByYear, resolveAchievementPlayer, type AgencyAchievement } from './agencyAchievements'
import type { AgencyPlayer } from './agencyPlayers'

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

describe('resolveAchievementPlayer', () => {
  const players: AgencyPlayer[] = [
    {
      shortName: 'M. Vera',
      fullName: 'Mauricio Vera',
      image: null,
      contractEnd: null,
      marketValue: null,
      team: 'Bhayangkara FC',
      apiTeamId: 2443,
      isReserve: false,
    },
  ]

  it('matchea por nombre completo tolerando acentos/mayúsculas', () => {
    const achievement: AgencyAchievement = {
      playerName: 'MÁURICIO VÉRA',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementPlayer(achievement, players)?.shortName).toBe('M. Vera')
  })

  it('devuelve null si no hay match en el roster', () => {
    const achievement: AgencyAchievement = {
      playerName: 'Jugador Inexistente',
      type: 'liga',
      competition: 'X',
      club: 'Y',
      year: 2023,
    }
    expect(resolveAchievementPlayer(achievement, players)).toBeNull()
  })
})
