// src/features/coaches/trainingConstants.ts
import type { TrainingSessionType } from '@/services/coachService'

export const TYPE_META: Record<TrainingSessionType, { label: string; badgeClass: string; dotClass: string }> = {
  tactico: { label: 'Táctico', badgeClass: 'bg-blue-500/10 text-blue-500', dotClass: 'bg-blue-500' },
  fisico: { label: 'Físico', badgeClass: 'bg-orange-500/10 text-orange-500', dotClass: 'bg-orange-500' },
  recuperacion: { label: 'Recuperación', badgeClass: 'bg-teal-500/10 text-teal-500', dotClass: 'bg-teal-500' },
  set_pieces: { label: 'Pelota parada', badgeClass: 'bg-purple-500/10 text-purple-500', dotClass: 'bg-purple-500' },
  pre_rival: { label: 'Pre-rival', badgeClass: 'bg-red-500/10 text-red-500', dotClass: 'bg-red-500' },
  otro: {
    label: 'Otro',
    badgeClass: 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400',
    dotClass: 'bg-apple-gray-400',
  },
}

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
