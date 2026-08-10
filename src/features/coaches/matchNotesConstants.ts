import type { MatchNotePhases } from '@/services/coachService'

export const PHASE_META: { key: keyof MatchNotePhases; label: string; placeholder: string }[] = [
  { key: 'defensiva', label: 'Defensiva', placeholder: 'Marca, línea, coberturas...' },
  { key: 'ofensiva', label: 'Ofensiva', placeholder: 'Circulación, generación, definición...' },
  { key: 'transiciones', label: 'Transiciones', placeholder: 'Ataque-defensa y defensa-ataque...' },
  { key: 'abp', label: 'ABP', placeholder: 'Córners, tiros libres, penales...' },
  { key: 'observaciones', label: 'Observaciones', placeholder: 'Otros puntos, contexto del partido...' },
]
