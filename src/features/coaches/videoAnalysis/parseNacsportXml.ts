
export interface ParsedInstance {
  code: string
  start: number
  end: number
  labels: { group: string; text: string }[]
  x: number | null
  y: number | null
}

const X_GROUP_NAMES = ['x', 'pos_x', 'posx']
const Y_GROUP_NAMES = ['y', 'pos_y', 'posy']

function textOf(el: Element, tag: string): string {
  return el.querySelector(tag)?.textContent?.trim() ?? ''
}

function parseLabels(instanceEl: Element): { group: string; text: string }[] {
  const labels: { group: string; text: string }[] = []
  instanceEl.querySelectorAll('label').forEach(labelEl => {
    const group = textOf(labelEl, 'group')
    const text = textOf(labelEl, 'text')
    if (group && text) labels.push({ group, text })
  })
  return labels
}

/** Normaliza una coordenada encontrada a 0-100. Fraccion [0,1] -> x100. Ya en [0,100] -> tal cual.
 *  Cualquier otro rango (ej. pixeles de un video en particular) no se puede normalizar sin mas
 *  contexto -- se descarta antes de dibujar un punto en una posicion inventada. */
function normalizeCoord(raw: number): number | null {
  if (raw >= 0 && raw <= 1) return raw * 100
  if (raw >= 0 && raw <= 100) return raw
  return null
}

function extractCoord(labels: { group: string; text: string }[], names: string[]): number | null {
  for (const label of labels) {
    if (!names.includes(label.group.toLowerCase())) continue
    const num = Number(label.text)
    if (!Number.isNaN(num)) return normalizeCoord(num)
  }
  return null
}

export function parseNacsportXml(xmlText: string): { instances: ParsedInstance[]; warnings: string[] } {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML inválido')

  const instanceEls = Array.from(doc.querySelectorAll('instance'))
  if (instanceEls.length === 0) {
    throw new Error('No se encontraron cortes en este archivo — ¿es una exportación de Nacsport?')
  }

  const warnings: string[] = []
  const instances: ParsedInstance[] = instanceEls.map(instanceEl => {
    const code = textOf(instanceEl, 'code')
    const start = Number(textOf(instanceEl, 'start'))
    const end = Number(textOf(instanceEl, 'end'))
    const labels = parseLabels(instanceEl)
    if (!code) warnings.push(`Instancia sin código de categoría (ID ${textOf(instanceEl, 'ID') || '?'})`)
    return {
      code,
      start: Number.isNaN(start) ? 0 : start,
      end: Number.isNaN(end) ? 0 : end,
      labels,
      x: extractCoord(labels, X_GROUP_NAMES),
      y: extractCoord(labels, Y_GROUP_NAMES),
    }
  })

  return { instances, warnings }
}
