import { stripAccents } from './normalize'
import type { ParsedContext } from '../types'

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

const pad = (n: number): string => String(n).padStart(2, '0')

function inferRival(lines: string[]): string | null {
  for (const line of lines) {
    const m = line.match(/\bvs\.?\s+(.+?)\s*(?:\((?:L|V|H|A)\))?\s*$/i)
    if (!m) continue
    const rival = m[1].trim()
    if (rival && rival.length <= 40) return rival
  }
  return null
}

function inferDate(lines: string[], today: Date): string | null {
  for (const line of lines) {
    const iso = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
    if (iso) return iso[0]

    const dmy = line.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
    if (dmy) return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`

    // "25 de Julio": el PDF no trae año, se usa el más reciente que no sea futuro.
    const es = line.match(/\b(\d{1,2})\s+de\s+([a-zá-úñ]+)/i)
    if (es) {
      const month = MONTHS[stripAccents(es[2]).toLowerCase()]
      if (!month) continue
      const day = Number(es[1])
      let year = today.getUTCFullYear()
      if (Date.UTC(year, month - 1, day) > today.getTime()) year -= 1
      return `${year}-${pad(month)}-${pad(day)}`
    }
  }
  return null
}

/**
 * Best effort sobre el texto previo a la tabla. Nunca bloquea: lo que no se puede
 * inferir queda en null y lo completa el usuario en la revisión.
 */
export function inferContext(lines: string[], today: Date = new Date()): ParsedContext {
  return {
    rival: inferRival(lines),
    matchDate: inferDate(lines, today),
    teamText: lines[0]?.trim() || null,
  }
}
