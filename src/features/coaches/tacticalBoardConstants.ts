import type { AnnotationColor } from '@/services/tacticalBoardService'

export const COLOR_META: Record<AnnotationColor, { hex: string; labelKey: string }> = {
  white:   { hex: '#FFFFFF', labelKey: 'boardColor.blanco' },
  yellow:  { hex: '#FACC15', labelKey: 'boardColor.amarillo' },
  red:     { hex: '#EF4444', labelKey: 'boardColor.rojo' },
  skyblue: { hex: '#38BDF8', labelKey: 'boardColor.celeste' },
  black:   { hex: '#000000', labelKey: 'boardColor.negro' },
}

export const COLOR_ORDER: AnnotationColor[] = ['white', 'yellow', 'red', 'skyblue', 'black']
