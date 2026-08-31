// src/features/coaches/trainingConstants.ts
import type { TrainingSessionType } from '@/services/coachService'

export const TYPE_META: Record<TrainingSessionType, { labelKey: string; badgeClass: string; dotClass: string }> = {
  tactico: { labelKey: 'trainingType.tactico', badgeClass: 'bg-blue-500/10 text-blue-500', dotClass: 'bg-blue-500' },
  fisico: { labelKey: 'trainingType.fisico', badgeClass: 'bg-orange-500/10 text-orange-500', dotClass: 'bg-orange-500' },
  recuperacion: { labelKey: 'trainingType.recuperacion', badgeClass: 'bg-teal-500/10 text-teal-500', dotClass: 'bg-teal-500' },
  set_pieces: { labelKey: 'trainingType.setPieces', badgeClass: 'bg-purple-500/10 text-purple-500', dotClass: 'bg-purple-500' },
  pre_rival: { labelKey: 'trainingType.preRival', badgeClass: 'bg-red-500/10 text-red-500', dotClass: 'bg-red-500' },
  otro: {
    labelKey: 'trainingType.otro',
    badgeClass: 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400',
    dotClass: 'bg-apple-gray-400',
  },
}

// Los valores de FOCUS_TAGS se guardan tal cual en `focus_tags` en la DB (igual que
// Posición/Rol en Evaluar) — no traducirlos ahí rompería el matching. Solo la
// etiqueta visible se traduce, vía este mapa.
export const FOCUS_TAGS = [
  'Finalización',
  'Posesión',
  'Pressing',
  'Transiciones',
  'ABP',
  'Físico aeróbico',
  'Fuerza',
  'Táctico defensivo',
  'Táctico ofensivo',
] as const

export const FOCUS_TAG_LABEL_KEY: Record<string, string> = {
  'Finalización': 'trainingFocus.finalizacion',
  'Posesión': 'trainingFocus.posesion',
  'Pressing': 'trainingFocus.pressing',
  'Transiciones': 'trainingFocus.transiciones',
  'ABP': 'matchNotes.abp',
  'Físico aeróbico': 'trainingFocus.fisicoAerobico',
  'Fuerza': 'trainingFocus.fuerza',
  'Táctico defensivo': 'trainingFocus.tacticoDefensivo',
  'Táctico ofensivo': 'trainingFocus.tacticoOfensivo',
}
