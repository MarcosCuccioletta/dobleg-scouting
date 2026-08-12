import { describe, expect, it } from 'vitest'
import { formatWyscoutMetricLabel, groupWyscoutMetricKeys } from './metricLabels'

describe('formatWyscoutMetricLabel', () => {
  it('etiquetas de nivel superior tienen nombre curado', () => {
    expect(formatWyscoutMetricLabel('possession_pct')).toBe('Posesión (%)')
    expect(formatWyscoutMetricLabel('xg_for')).toBe('xG a favor')
    expect(formatWyscoutMetricLabel('xg_against')).toBe('xG en contra')
  })

  it('metricas de valor unico usan su label curado', () => {
    expect(formatWyscoutMetricLabel('ppda')).toBe('PPDA (intensidad de presión)')
    expect(formatWyscoutMetricLabel('faltas')).toBe('Faltas cometidas')
  })

  it('grupo base (sin sufijo) se etiqueta como "intentados"', () => {
    expect(formatWyscoutMetricLabel('pases_/_logrados')).toBe('Pases — intentados')
  })

  it('sufijo _2 se etiqueta como "logrados"', () => {
    expect(formatWyscoutMetricLabel('pases_/_logrados_2')).toBe('Pases — logrados')
  })

  it('sufijo _3 se etiqueta como "% efectividad"', () => {
    expect(formatWyscoutMetricLabel('pases_/_logrados_3')).toBe('Pases — % efectividad')
  })

  it('clave sin label curado cae a un prettify generico', () => {
    expect(formatWyscoutMetricLabel('metrica_rara_nueva')).toBe('Metrica rara nueva')
  })
})

describe('groupWyscoutMetricKeys', () => {
  it('agrupa por categoria en el orden fijo Ofensiva, Defensiva, Posesión y pases, Físico y disciplina', () => {
    const groups = groupWyscoutMetricKeys(['ppda', 'xg_for', 'possession_pct', 'faltas'])
    expect(groups.map(g => g.category)).toEqual(['Ofensiva', 'Defensiva', 'Físico y disciplina'])
  })

  it('claves sin label curado van a "Otras métricas" al final', () => {
    const groups = groupWyscoutMetricKeys(['xg_for', 'algo_desconocido'])
    expect(groups[groups.length - 1].category).toBe('Otras métricas')
    expect(groups[groups.length - 1].options[0].key).toBe('algo_desconocido')
  })

  it('saca la formacion (texto, no graficable) del listado', () => {
    const groups = groupWyscoutMetricKeys(['seleccionar_esquema', 'ppda'])
    const allKeys = groups.flatMap(g => g.options.map(o => o.key))
    expect(allKeys).not.toContain('seleccionar_esquema')
    expect(allKeys).toContain('ppda')
  })

  it('cada opcion trae su label formateado', () => {
    const groups = groupWyscoutMetricKeys(['xg_for'])
    expect(groups[0].options[0]).toEqual({ key: 'xg_for', label: 'xG a favor', category: 'Ofensiva' })
  })
})
