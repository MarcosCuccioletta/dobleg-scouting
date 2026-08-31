import type { MatchNotePhases } from '@/services/coachService'

export const PHASE_META: { key: keyof MatchNotePhases; labelKey: string; placeholder: string }[] = [
  { key: 'defensiva', labelKey: 'matchNotes.faseDefensiva', placeholder: '' },
  { key: 'ofensiva', labelKey: 'matchNotes.faseOfensiva', placeholder: '' },
  { key: 'transiciones', labelKey: 'matchNotes.faseTransiciones', placeholder: '' },
  { key: 'abp', labelKey: 'matchNotes.abp', placeholder: '' },
  { key: 'observaciones', labelKey: 'matchNotes.observaciones', placeholder: '' },
]
