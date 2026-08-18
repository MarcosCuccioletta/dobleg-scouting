import { describe, it, expect } from 'vitest'
import { computeAlerts, countMeetings, buildPlayerPhotoUrl, type AlertableItem } from './marketAlerts'

function item(over: Partial<AlertableItem> & Pick<AlertableItem, 'id' | 'kind'>): AlertableItem {
  return { status: 'contactado', assigned_to_id: null, next_followup_date: null, ...over }
}

describe('computeAlerts', () => {
  const today = new Date('2026-08-18')

  it('marca "vencido" un seguimiento con fecha de hoy o anterior', () => {
    const items = [item({ id: 1, kind: 'negotiation', next_followup_date: '2026-08-18' }), item({ id: 2, kind: 'negotiation', next_followup_date: '2026-08-10' })]
    const alerts = computeAlerts(items, today)
    expect(alerts.map(a => a.urgency)).toEqual(['vencido', 'vencido'])
  })

  it('marca "proximo" un seguimiento entre mañana y 3 días', () => {
    const items = [item({ id: 1, kind: 'need', next_followup_date: '2026-08-20' })]
    const alerts = computeAlerts(items, today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('proximo')
  })

  it('no incluye seguimientos a mas de 3 dias', () => {
    const items = [item({ id: 1, kind: 'need', next_followup_date: '2026-08-25' })]
    expect(computeAlerts(items, today)).toHaveLength(0)
  })

  it('no incluye items sin fecha de seguimiento', () => {
    const items = [item({ id: 1, kind: 'negotiation', next_followup_date: null })]
    expect(computeAlerts(items, today)).toHaveLength(0)
  })

  it('excluye negociaciones y objetivos cerrados aunque tengan fecha vencida', () => {
    const items = [
      item({ id: 1, kind: 'negotiation', status: 'cerrado_exitoso', next_followup_date: '2026-08-01' }),
      item({ id: 2, kind: 'negotiation', status: 'cerrado_rechazado', next_followup_date: '2026-08-01' }),
      item({ id: 3, kind: 'need', status: 'cerrado', next_followup_date: '2026-08-01' }),
    ]
    expect(computeAlerts(items, today)).toHaveLength(0)
  })

  it('ordena vencidos antes que proximos', () => {
    const items = [
      item({ id: 1, kind: 'need', next_followup_date: '2026-08-20' }),
      item({ id: 2, kind: 'negotiation', next_followup_date: '2026-08-15' }),
    ]
    const alerts = computeAlerts(items, today)
    expect(alerts.map(a => a.id)).toEqual([2, 1])
  })
})

describe('countMeetings', () => {
  it('cuenta solo las notas marcadas como reunion', () => {
    const notes = [{ is_meeting: true }, { is_meeting: false }, { is_meeting: true }]
    expect(countMeetings(notes)).toBe(2)
  })

  it('con una lista vacia, devuelve 0', () => {
    expect(countMeetings([])).toBe(0)
  })
})

describe('buildPlayerPhotoUrl', () => {
  it('construye la URL de API-Football a partir del id', () => {
    expect(buildPlayerPhotoUrl(5917)).toBe('https://media.api-sports.io/football/players/5917.png')
  })

  it('sin id, devuelve null', () => {
    expect(buildPlayerPhotoUrl(null)).toBeNull()
  })
})
