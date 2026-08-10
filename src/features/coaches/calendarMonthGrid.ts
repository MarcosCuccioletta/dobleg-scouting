import type { CoachCalendarDay } from '@/utils/coachCalendar'

export interface MonthGridCell {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
}

function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** getDay() de JS es 0=Domingo..6=Sabado; esto lo convierte a 0=Lunes..6=Domingo. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** Arma las semanas (Lunes a Domingo) que cubren el mes `month` (0-indexado) del año `year`, rellenando con dias del mes anterior/siguiente hasta completar semanas enteras. */
export function buildMonthGrid(year: number, month: number): MonthGridCell[][] {
  const firstOfMonth = new Date(year, month, 1)
  const start = new Date(year, month, 1 - mondayIndex(firstOfMonth))

  const lastOfMonth = new Date(year, month + 1, 0)
  const end = new Date(year, month, lastOfMonth.getDate() + (6 - mondayIndex(lastOfMonth)))

  const cells: MonthGridCell[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    cells.push({
      date: formatDateKey(cursor),
      dayNumber: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === month && cursor.getFullYear() === year,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const weeks: MonthGridCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Hoy si cae en el mes visible; si no, el primer dia del mes visible con eventos; si no hay ninguno, el dia 1. */
export function pickDefaultSelectedDate(
  grid: MonthGridCell[][],
  todayKey: string,
  eventsByDate: Map<string, CoachCalendarDay>,
): string {
  const currentMonthCells = grid.flat().filter(c => c.isCurrentMonth)

  const todayCell = currentMonthCells.find(c => c.date === todayKey)
  if (todayCell) return todayCell.date

  const firstWithEvents = currentMonthCells.find(c => {
    const day = eventsByDate.get(c.date)
    return !!day && (day.fixtures.length > 0 || day.sessions.length > 0)
  })
  if (firstWithEvents) return firstWithEvents.date

  return currentMonthCells[0].date
}
