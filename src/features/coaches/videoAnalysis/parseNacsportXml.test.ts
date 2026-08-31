import { describe, it, expect } from 'vitest'
import { parseNacsportXml } from './parseNacsportXml'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<file>
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>12.5</start>
      <end>18.2</end>
      <code>Salida en corto</code>
      <label><group>Equipo</group><text>Propio</text></label>
      <label><group>Jugador</group><text>5 - Perez</text></label>
    </instance>
    <instance>
      <ID>2</ID>
      <start>40</start>
      <end>47.3</end>
      <code>Ataque posicional</code>
      <label><group>pos_x</group><text>0.62</text></label>
      <label><group>pos_y</group><text>0.35</text></label>
    </instance>
  </ALL_INSTANCES>
</file>`

describe('parseNacsportXml', () => {
  it('extrae code/start/end/labels de cada instance', () => {
    const { instances } = parseNacsportXml(SAMPLE_XML)
    expect(instances).toHaveLength(2)
    expect(instances[0]).toEqual({
      code: 'Salida en corto',
      start: 12.5,
      end: 18.2,
      labels: [
        { group: 'Equipo', text: 'Propio' },
        { group: 'Jugador', text: '5 - Perez' },
      ],
      x: null,
      y: null,
    })
  })

  it('detecta coordenadas x/y entre los labels cuando estan en formato fraccion 0-1 y las normaliza a 0-100', () => {
    const { instances } = parseNacsportXml(SAMPLE_XML)
    expect(instances[1].x).toBeCloseTo(62, 5)
    expect(instances[1].y).toBeCloseTo(35, 5)
  })

  it('tira un error claro si el archivo no tiene ninguna instance', () => {
    expect(() => parseNacsportXml('<file><ALL_INSTANCES></ALL_INSTANCES></file>')).toThrow(
      'No se encontraron cortes en este archivo',
    )
  })

  it('tira un error claro si el XML esta mal formado', () => {
    expect(() => parseNacsportXml('<file><ALL_INSTANCES><instance>')).toThrow('XML inválido')
  })

  it('ignora un label sin group o sin text en vez de romper', () => {
    const xml = `<file><ALL_INSTANCES><instance>
      <ID>1</ID><start>1</start><end>2</end><code>Test</code>
      <label><group>Solo group</group></label>
      <label><text>Solo text</text></label>
    </instance></ALL_INSTANCES></file>`
    const { instances } = parseNacsportXml(xml)
    expect(instances[0].labels).toEqual([])
  })
})
