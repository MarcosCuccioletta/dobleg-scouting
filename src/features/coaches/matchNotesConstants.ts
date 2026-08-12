import type { MatchNotePhases } from '@/services/coachService'

export const PHASE_META: { key: keyof MatchNotePhases; label: string; placeholder: string }[] = [
  { key: 'defensiva', label: 'Fase defensiva', placeholder: '' },
  { key: 'ofensiva', label: 'Fase ofensiva', placeholder: '' },
  { key: 'transiciones', label: 'Fase de transiciones', placeholder: '' },
  { key: 'abp', label: 'ABP', placeholder: '' },
  { key: 'observaciones', label: 'Observaciones', placeholder: '' },
]
