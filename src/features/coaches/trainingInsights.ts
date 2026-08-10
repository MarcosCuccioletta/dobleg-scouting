import type { CoachTrainingSession } from '@/services/coachService'

export interface TrainingInsights {
  hasEnoughData: boolean
  streakDays: number
  topFocus: { tag: string; count: number } | null
  overloadWarning: boolean
}

const MIN_SESSIONS_FOR_INSIGHTS = 5
const TOP_FOCUS_WINDOW = 10
const OVERLOAD_WINDOW = 3
const OVERLOAD_MIN_INTENSITY = 4

function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days, 12)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function computeStreakDays(sessions: CoachTrainingSession[], todayKey: string): number {
  const datesWithSession = new Set(sessions.map(s => s.session_date))
  if (datesWithSession.size === 0) return 0

  let cursor: string | undefined
  if (datesWithSession.has(todayKey)) {
    cursor = todayKey
  } else {
    const pastDates = [...datesWithSession].filter(d => d <= todayKey).sort()
    cursor = pastDates[pastDates.length - 1]
  }
  if (!cursor) return 0

  let streak = 0
  let day = cursor
  while (datesWithSession.has(day)) {
    streak++
    day = addDaysToKey(day, -1)
  }
  return streak
}

function computeTopFocus(sessions: CoachTrainingSession[]): { tag: string; count: number } | null {
  const recent = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date)).slice(0, TOP_FOCUS_WINDOW)

  const counts = new Map<string, number>()
  const mostRecentIndex = new Map<string, number>()
  recent.forEach((s, idx) => {
    for (const tag of s.focus_tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
      if (!mostRecentIndex.has(tag)) mostRecentIndex.set(tag, idx)
    }
  })

  if (counts.size === 0) return null

  let bestTag: string | null = null
  let bestCount = 0
  let bestRecency = Infinity
  for (const [tag, count] of counts) {
    const recency = mostRecentIndex.get(tag)!
    if (count > bestCount || (count === bestCount && recency < bestRecency)) {
      bestTag = tag
      bestCount = count
      bestRecency = recency
    }
  }
  return bestTag ? { tag: bestTag, count: bestCount } : null
}

function computeOverloadWarning(sessions: CoachTrainingSession[]): boolean {
  const recent = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date)).slice(0, OVERLOAD_WINDOW)
  if (recent.length < OVERLOAD_WINDOW) return false
  return recent.every(s => s.intensity !== null && s.intensity >= OVERLOAD_MIN_INTENSITY && s.type !== 'recuperacion')
}

export function computeTrainingInsights(sessions: CoachTrainingSession[], todayKey: string): TrainingInsights {
  if (sessions.length < MIN_SESSIONS_FOR_INSIGHTS) {
    return { hasEnoughData: false, streakDays: 0, topFocus: null, overloadWarning: false }
  }
  return {
    hasEnoughData: true,
    streakDays: computeStreakDays(sessions, todayKey),
    topFocus: computeTopFocus(sessions),
    overloadWarning: computeOverloadWarning(sessions),
  }
}
