function parseArDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// getDay() de JS es 0=Domingo..6=Sabado; esto lo convierte a 0=Lunes..6=Domingo.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** Las 7 fechas (Lunes a Domingo) de la semana que contiene `referenceDateKey`.
 *  Anclado a mediodia (no medianoche) para no depender de bordes de DST. */
export function getWeekDates(referenceDateKey: string): string[] {
  const ref = parseArDateKey(referenceDateKey)
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - mondayIndex(ref), 12)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12)
    dates.push(formatDateKey(d))
  }
  return dates
}
