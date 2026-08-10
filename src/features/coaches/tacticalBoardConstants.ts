import type { AnnotationColor } from '@/services/tacticalBoardService'

export const COLOR_META: Record<AnnotationColor, { hex: string; label: string }> = {
  white:   { hex: '#FFFFFF', label: 'Blanco' },
  yellow:  { hex: '#FACC15', label: 'Amarillo' },
  red:     { hex: '#EF4444', label: 'Rojo' },
  skyblue: { hex: '#38BDF8', label: 'Celeste' },
  black:   { hex: '#000000', label: 'Negro' },
}

export const COLOR_ORDER: AnnotationColor[] = ['white', 'yellow', 'red', 'skyblue', 'black']
