import { describe, it, expect } from 'vitest'
import { mergeCalendarEvents, isMatchFinished } from './coachCalendar'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'

function mkFixture(over: Partial<AgencyFixture> = {}): AgencyFixture {
  return {
    fixtureId: 1, date: '2026-08-15T18:00:00+00:00', timestamp: 0,
    venue: 'Estadio', city: 'Temperley', status: 'Not Started', statusShort: 'NS', elapsed: null,
    leagueName: 'Primera Nacional', leagueLogo: '', leagueCountry: 'Argentina', leagueFlag: null, round: '',
    homeTeam: { id: 454, name: 'Temperley', logo: '' }, awayTeam: { id: 1, name: 'Rival', logo: '' },
    goalsHome: null, goalsAway: null, isHome: true, players: [], ...over,
  }
}

function mkSession(over: Partial<CoachTrainingSession> = {}): CoachTrainingSession {
  return {
    id: 1, coach_key: 'domingo', session_date: '2026-08-14', session_time: '10:00',
    type: 'tactico', title: 'Táctico pre-rival', notes: null,
    created_at: '', updated_at: '', ...over,
  }
}

describe('mergeCalendarEvents', () => {
  it('agrupa partidos y entrenamientos en el mismo día por fecha', () => {
    const fixtures = [mkFixture({ date: '2026-08-15T18:00:00+00:00' })]
    const sessions = [mkSession({ session_date: '2026-08-15' })]
    const merged = mergeCalendarEvents(fixtures, sessions)
    const day = merged.get('2026-08-15')
    expect(day?.fixtures).toHaveLength(1)
    expect(day?.sessions).toHaveLength(1)
  })

  it('días distintos quedan en entradas separadas', () => {
    const fixtures = [mkFixture({ date: '2026-08-15T18:00:00+00:00' })]
    const sessions = [mkSession({ session_date: '2026-08-14' })]
    const merged = mergeCalendarEvents(fixtures, sessions)
    expect(merged.get('2026-08-15')?.fixtures).toHaveLength(1)
    expect(merged.get('2026-08-15')?.sessions).toHaveLength(0)
    expect(merged.get('2026-08-14')?.sessions).toHaveLength(1)
    expect(merged.get('2026-08-14')?.fixtures).toHaveLength(0)
  })

  it('marca isAbroad cuando la liga no es de Argentina', () => {
    const fixtures = [mkFixture({ date: '2026-08-20T18:00:00+00:00', leagueCountry: 'Paraguay' })]
    const merged = mergeCalendarEvents(fixtures, [])
    expect(merged.get('2026-08-20')?.isAbroad).toBe(true)
  })

  it('isAbroad es false para partidos en Argentina', () => {
    const fixtures = [mkFixture({ date: '2026-08-20T18:00:00+00:00', leagueCountry: 'Argentina' })]
    const merged = mergeCalendarEvents(fixtures, [])
    expect(merged.get('2026-08-20')?.isAbroad).toBe(false)
  })
})

describe('isMatchFinished', () => {
  it('FT, AET y PEN cuentan como terminado', () => {
    expect(isMatchFinished('FT')).toBe(true)
    expect(isMatchFinished('AET')).toBe(true)
    expect(isMatchFinished('PEN')).toBe(true)
  })
  it('NS (not started) no cuenta como terminado', () => {
    expect(isMatchFinished('NS')).toBe(false)
  })
})
