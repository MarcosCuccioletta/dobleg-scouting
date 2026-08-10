import { describe, it, expect } from 'vitest'
import { buildMonthGrid, pickDefaultSelectedDate } from './calendarMonthGrid'
import type { CoachCalendarDay } from '@/utils/coachCalendar'

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

describe('buildMonthGrid', () => {
  it('arma semanas completas: cada fila tiene 7 dias', () => {
    const grid = buildMonthGrid(2024, 3) // abril 2024
    for (const week of grid) expect(week).toHaveLength(7)
  })

  it('la primera celda de cada semana cae en lunes y la ultima en domingo', () => {
    const grid = buildMonthGrid(2024, 3)
    for (const week of grid) {
      expect(parseDateKey(week[0].date).getDay()).toBe(1) // Lunes
      expect(parseDateKey(week[6].date).getDay()).toBe(0) // Domingo
    }
  })

  it('marca isCurrentMonth=true solo para los dias que pertenecen al mes pedido', () => {
    const grid = buildMonthGrid(2024, 3) // abril 2024 tiene 30 dias
    const currentMonthCells = grid.flat().filter(c => c.isCurrentMonth)
    expect(currentMonthCells).toHaveLength(30)
    for (const cell of currentMonthCells) {
      const d = parseDateKey(cell.date)
      expect(d.getMonth()).toBe(3)
      expect(d.getFullYear()).toBe(2024)
    }
  })

  it('un mes que arranca en lunes no tiene relleno del mes anterior', () => {
    const grid = buildMonthGrid(2024, 3) // abril 2024 arranca en lunes
    expect(grid[0][0].isCurrentMonth).toBe(true)
    expect(grid[0][0].dayNumber).toBe(1)
  })

  it('un mes que arranca en domingo rellena los 6 dias previos con el mes anterior', () => {
    const grid = buildMonthGrid(2024, 8) // septiembre 2024 arranca en domingo
    const firstWeek = grid[0]
    expect(firstWeek.slice(0, 6).every(c => !c.isCurrentMonth)).toBe(true)
    expect(firstWeek[6].isCurrentMonth).toBe(true)
    expect(firstWeek[6].dayNumber).toBe(1)
  })

  it('el relleno cruza de diciembre a enero del año siguiente correctamente', () => {
    const grid = buildMonthGrid(2024, 11) // diciembre 2024
    const lastWeek = grid[grid.length - 1]
    const trailing = lastWeek.filter(c => !c.isCurrentMonth)
    expect(trailing.length).toBeGreaterThan(0)
    for (const cell of trailing) {
      const d = parseDateKey(cell.date)
      expect(d.getFullYear()).toBe(2025)
      expect(d.getMonth()).toBe(0) // enero
    }
  })
})

function mkSession(over: Partial<CoachCalendarDay['sessions'][number]> = {}): CoachCalendarDay['sessions'][number] {
  return {
    id: 1, coach_key: 'domingo', session_date: '2024-04-10', session_time: null,
    type: 'tactico', title: 'Táctico', notes: null, created_at: '', updated_at: '',
    ...over,
  }
}

describe('pickDefaultSelectedDate', () => {
  const grid = buildMonthGrid(2024, 3) // abril 2024

  it('si hoy cae en el mes visible, se selecciona hoy', () => {
    const result = pickDefaultSelectedDate(grid, '2024-04-15', new Map())
    expect(result).toBe('2024-04-15')
  })

  it('si hoy no esta en el mes visible y no hay eventos, selecciona el dia 1', () => {
    const result = pickDefaultSelectedDate(grid, '2024-05-15', new Map())
    expect(result).toBe('2024-04-01')
  })

  it('si hoy no esta en el mes visible pero hay eventos, selecciona el primer dia con evento', () => {
    const eventsByDate = new Map<string, CoachCalendarDay>([
      ['2024-04-10', { date: '2024-04-10', fixtures: [], sessions: [mkSession()], isAbroad: false }],
    ])
    const result = pickDefaultSelectedDate(grid, '2024-05-15', eventsByDate)
    expect(result).toBe('2024-04-10')
  })
})
