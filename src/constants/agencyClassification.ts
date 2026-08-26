import type { AgencyClass } from '@/services/agencyClassificationService'

export const CLASS_ORDER: AgencyClass[] = ['A', 'B', 'C']

export const CLASS_LABEL_KEY: Record<AgencyClass, string> = {
  A: 'clasificacion.claseA',
  B: 'clasificacion.claseB',
  C: 'clasificacion.claseC',
}

/** Pill (fondo + texto) para badges — mismo criterio de color que el resto de la
 * plataforma (verde = mejor, ambar = medio, gris/neutro = en desarrollo). */
export const CLASS_BADGE_COLOR: Record<AgencyClass, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

/** Punto de color sólido — para columnas/encabezados donde el badge completo
 * ocuparía demasiado espacio (ej. columna de tabla, chip chico en ficha). */
export const CLASS_DOT_COLOR: Record<AgencyClass, string> = {
  A: 'bg-emerald-500',
  B: 'bg-sky-500',
  C: 'bg-amber-500',
}
