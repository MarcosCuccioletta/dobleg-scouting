import { describe, it, expect } from 'vitest'
import { computeTrainingInsights } from './trainingInsights'
import type { CoachTrainingSession } from '@/services/coachService'

function mkSession(over: Partial<CoachTrainingSession> = {}): CoachTrainingSession {
  return {
    id: 1, coach_key: 'domingo', session_date: '2026-08-10', session_time: null,
    type: 'tactico', title: 'Sesion', notes: null,
    duration_minutes: null, intensity: null, focus_tags: [],
    created_at: '', updated_at: '',
    ...over,
  }
}

describe('computeTrainingInsights', () => {
  it('con menos de 5 sesiones, hasEnoughData es false y el resto queda en blanco', () => {
    const sessions = [mkSession(), mkSession({ id: 2 })]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result).toEqual({ hasEnoughData: false, streakDays: 0, topFocus: null, overloadWarning: false })
  })

  it('calcula la racha de dias consecutivos hasta hoy, cortando en el primer salteado', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-06' }),
      mkSession({ id: 2, session_date: '2026-08-07' }),
      mkSession({ id: 3, session_date: '2026-08-08' }),
      mkSession({ id: 4, session_date: '2026-08-09' }),
      mkSession({ id: 5, session_date: '2026-08-10' }),
      mkSession({ id: 6, session_date: '2026-08-03' }), // salteado antes, no debe sumar
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.streakDays).toBe(5)
  })

  it('si hoy todavia no se cargo nada, la racha arranca del dia cargado mas reciente', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-07' }),
      mkSession({ id: 2, session_date: '2026-08-08' }),
      mkSession({ id: 3, session_date: '2026-08-09' }),
      mkSession({ id: 4, session_date: '2026-08-01' }),
      mkSession({ id: 5, session_date: '2026-08-02' }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.streakDays).toBe(3)
  })

  it('el foco predominante es el tag mas frecuente entre las ultimas 10 sesiones', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01', focus_tags: ['Posesión'] }),
      mkSession({ id: 2, session_date: '2026-08-02', focus_tags: ['Finalización'] }),
      mkSession({ id: 3, session_date: '2026-08-03', focus_tags: ['Finalización'] }),
      mkSession({ id: 4, session_date: '2026-08-04', focus_tags: ['Finalización'] }),
      mkSession({ id: 5, session_date: '2026-08-05', focus_tags: ['Posesión'] }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.topFocus).toEqual({ tag: 'Finalización', count: 3 })
  })

  it('en un empate, gana el tag de la sesion mas reciente', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01', focus_tags: ['Posesión'] }),
      mkSession({ id: 2, session_date: '2026-08-02', focus_tags: ['Finalización'] }),
      mkSession({ id: 3, session_date: '2026-08-03', focus_tags: [] }),
      mkSession({ id: 4, session_date: '2026-08-04', focus_tags: [] }),
      mkSession({ id: 5, session_date: '2026-08-05', focus_tags: [] }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.topFocus).toEqual({ tag: 'Finalización', count: 1 })
  })

  it('sin ningun tag cargado, topFocus es null', () => {
    const sessions = [1, 2, 3, 4, 5].map(n => mkSession({ id: n, session_date: `2026-08-0${n}` }))
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.topFocus).toBeNull()
  })

  it('avisa de sobrecarga si las ultimas 3 sesiones son de intensidad alta sin recuperacion', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01' }),
      mkSession({ id: 2, session_date: '2026-08-02' }),
      mkSession({ id: 3, session_date: '2026-08-08', type: 'tactico', intensity: 4 }),
      mkSession({ id: 4, session_date: '2026-08-09', type: 'fisico', intensity: 5 }),
      mkSession({ id: 5, session_date: '2026-08-10', type: 'tactico', intensity: 4 }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.overloadWarning).toBe(true)
  })

  it('no avisa si alguna de las ultimas 3 es de recuperacion', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01' }),
      mkSession({ id: 2, session_date: '2026-08-02' }),
      mkSession({ id: 3, session_date: '2026-08-08', type: 'tactico', intensity: 4 }),
      mkSession({ id: 4, session_date: '2026-08-09', type: 'recuperacion', intensity: 4 }),
      mkSession({ id: 5, session_date: '2026-08-10', type: 'tactico', intensity: 5 }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.overloadWarning).toBe(false)
  })

  it('no avisa si falta la intensidad en alguna de las ultimas 3', () => {
    const sessions = [
      mkSession({ id: 1, session_date: '2026-08-01' }),
      mkSession({ id: 2, session_date: '2026-08-02' }),
      mkSession({ id: 3, session_date: '2026-08-08', type: 'tactico', intensity: 4 }),
      mkSession({ id: 4, session_date: '2026-08-09', type: 'tactico', intensity: null }),
      mkSession({ id: 5, session_date: '2026-08-10', type: 'tactico', intensity: 5 }),
    ]
    const result = computeTrainingInsights(sessions, '2026-08-10')
    expect(result.overloadWarning).toBe(false)
  })
})
