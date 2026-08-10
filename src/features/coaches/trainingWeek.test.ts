import { describe, it, expect } from 'vitest'
import { getWeekDates, shiftWeeks } from './trainingWeek'

describe('getWeekDates', () => {
  it('devuelve 7 fechas consecutivas empezando en lunes para una fecha a mitad de semana', () => {
    // 2026-08-12 es un miercoles
    const dates = getWeekDates('2026-08-12')
    expect(dates).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'])
  })

  it('si la fecha de referencia ya es lunes, la semana arranca ahi mismo', () => {
    const dates = getWeekDates('2026-08-10') // lunes
    expect(dates[0]).toBe('2026-08-10')
    expect(dates).toHaveLength(7)
  })

  it('si la fecha de referencia es domingo, es el ultimo dia de esa semana', () => {
    const dates = getWeekDates('2026-08-16') // domingo
    expect(dates[6]).toBe('2026-08-16')
    expect(dates[0]).toBe('2026-08-10')
  })

  it('cruza correctamente de un mes a otro', () => {
    const dates = getWeekDates('2026-08-31') // lunes
    expect(dates[0]).toBe('2026-08-31')
    expect(dates[6]).toBe('2026-09-06')
  })

  it('cruza correctamente de un año a otro', () => {
    const dates = getWeekDates('2025-12-29') // lunes
    expect(dates[0]).toBe('2025-12-29')
    expect(dates[6]).toBe('2026-01-04')
  })
})

describe('shiftWeeks', () => {
  it('retrocede una semana exacta', () => {
    expect(shiftWeeks('2026-08-10', -1)).toBe('2026-08-03')
  })

  it('avanza una semana exacta cruzando de mes', () => {
    expect(shiftWeeks('2026-08-31', 1)).toBe('2026-09-07')
  })
})
