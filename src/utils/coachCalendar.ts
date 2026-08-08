import { toArDateKey } from '@/services/footballApiService'
import type { AgencyFixture } from '@/types/footballApi'
import type { CoachTrainingSession } from '@/services/coachService'

export interface CoachCalendarDay {
  date: string
  fixtures: AgencyFixture[]
  sessions: CoachTrainingSession[]
  isAbroad: boolean
}

function isAbroad(fixture: AgencyFixture): boolean {
  return fixture.leagueCountry !== 'Argentina'
}

export function isMatchFinished(statusShort: string): boolean {
  return ['FT', 'AET', 'PEN'].includes(statusShort)
}

function getOrCreate(map: Map<string, CoachCalendarDay>, date: string): CoachCalendarDay {
  let day = map.get(date)
  if (!day) {
    day = { date, fixtures: [], sessions: [], isAbroad: false }
    map.set(date, day)
  }
  return day
}

export function mergeCalendarEvents(
  fixtures: AgencyFixture[],
  sessions: CoachTrainingSession[],
): Map<string, CoachCalendarDay> {
  const map = new Map<string, CoachCalendarDay>()

  for (const f of fixtures) {
    const key = toArDateKey(f.date)
    const day = getOrCreate(map, key)
    day.fixtures.push(f)
    if (isAbroad(f)) day.isAbroad = true
  }

  for (const s of sessions) {
    const day = getOrCreate(map, s.session_date)
    day.sessions.push(s)
  }

  return map
}
