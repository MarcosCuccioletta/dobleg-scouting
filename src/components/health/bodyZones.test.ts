import { describe, it, expect } from 'vitest'
import { BODY_ZONES, VIEW_W, VIEW_H, zonesFromInjuryType } from './bodyZones'

describe('BODY_ZONES', () => {
  it('no tiene ids repetidos dentro de una misma vista', () => {
    for (const view of ['front', 'back'] as const) {
      const ids = BODY_ZONES.filter(z => z.view === view).map(z => z.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('todas las zonas caen dentro del lienzo de la figura', () => {
    for (const z of BODY_ZONES) {
      expect(z.x).toBeGreaterThanOrEqual(0)
      expect(z.y).toBeGreaterThanOrEqual(0)
      expect(z.x + z.w).toBeLessThanOrEqual(VIEW_W)
      expect(z.y + z.h).toBeLessThanOrEqual(VIEW_H)
    }
  })

  it('los pares izquierda/derecha son espejo respecto del centro', () => {
    const byId = new Map(BODY_ZONES.map(z => [`${z.view}:${z.id}`, z]))
    for (const z of BODY_ZONES) {
      if (!z.id.endsWith('_izq')) continue
      const right = byId.get(`${z.view}:${z.id.replace(/_izq$/, '_der')}`)
      expect(right, `falta el par de ${z.id}`).toBeDefined()
      expect(right!.y).toBe(z.y)
      expect(right!.h).toBe(z.h)
      expect(right!.w).toBe(z.w)
      // Espejo: el centro de ambas debe estar a la misma distancia del eje.
      const centerL = z.x + z.w / 2
      const centerR = right!.x + right!.w / 2
      expect(Math.abs(VIEW_W - centerL - centerR)).toBeLessThanOrEqual(1)
    }
  })

  it('las piernas quedan sobre la silueta medida (izq 30-48, der 52-70)', () => {
    const leg = BODY_ZONES.find(z => z.id === 'cuadriceps_izq')!
    expect(leg.x).toBeGreaterThanOrEqual(30)
    expect(leg.x + leg.w).toBeLessThanOrEqual(48)
    const legR = BODY_ZONES.find(z => z.id === 'cuadriceps_der')!
    expect(legR.x).toBeGreaterThanOrEqual(52)
    expect(legR.x + legR.w).toBeLessThanOrEqual(70)
  })
})

describe('zonesFromInjuryType', () => {
  it('reconoce las lesiones más comunes de la API', () => {
    expect(zonesFromInjuryType('Knee Injury')).toEqual(['rodilla_izq', 'rodilla_der'])
    expect(zonesFromInjuryType('Hamstring Injury')).toEqual(['isquio_izq', 'isquio_der'])
    expect(zonesFromInjuryType('Ankle Injury')).toEqual(['tobillo_izq', 'tobillo_der'])
    expect(zonesFromInjuryType('Calf Injury')).toEqual(['gemelo_izq', 'gemelo_der'])
  })

  it('respeta el lado cuando el texto lo aclara', () => {
    expect(zonesFromInjuryType('Left Knee Injury')).toEqual(['rodilla_izq'])
    expect(zonesFromInjuryType('Right ankle sprain')).toEqual(['tobillo_der'])
  })

  it('entiende castellano y acentos', () => {
    expect(zonesFromInjuryType('Lesión de rodilla')).toEqual(['rodilla_izq', 'rodilla_der'])
    expect(zonesFromInjuryType('Desgarro de isquiotibiales')).toEqual(['isquio_izq', 'isquio_der'])
  })

  it('las zonas sin lados devuelven una sola', () => {
    expect(zonesFromInjuryType('Concussion')).toEqual(['cabeza'])
    expect(zonesFromInjuryType('Lower back pain')).toEqual(['lumbar'])
  })

  it('no marca nada cuando no reconoce la lesión', () => {
    expect(zonesFromInjuryType('Illness')).toEqual([])
    expect(zonesFromInjuryType('Suspended')).toEqual([])
    expect(zonesFromInjuryType('')).toEqual([])
  })

  it('cada zona devuelta existe en el mapa', () => {
    const ids = new Set(BODY_ZONES.map(z => z.id))
    const samples = [
      'Knee Injury', 'Hamstring Injury', 'Groin Injury', 'Shoulder Injury',
      'Achilles tendon rupture', 'Thigh Injury', 'Hip Injury', 'Broken rib',
      'Muscle Injury', 'Back Injury', 'Foot Injury', 'Neck Injury',
    ]
    for (const s of samples) {
      for (const id of zonesFromInjuryType(s)) {
        expect(ids.has(id), `${s} -> ${id} no existe`).toBe(true)
      }
    }
  })
})
