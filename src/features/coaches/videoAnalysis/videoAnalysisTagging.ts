import { normalizeName } from '@/utils/scoring'

export type ActionPhase = 'defensiva' | 'ofensiva' | 'transicion' | 'abp' | 'otro'

// Diccionario semilla de terminos comunes de botoneras de videoanalisis en espanol.
// Ampliable: si un XML real trae un codigo que no matchea nada, se agrega aca.
const PHASE_KEYWORDS: { phase: ActionPhase; keywords: string[] }[] = [
  { phase: 'transicion', keywords: ['transicion'] },
  { phase: 'abp', keywords: ['abp', 'corner', 'tiro libre', 'penal', 'saque de banda'] },
  { phase: 'defensiva', keywords: ['presion', 'repliegue', 'marca', 'recuperacion', 'defensiv'] },
  { phase: 'ofensiva', keywords: ['salida', 'ataque', 'posesion', 'ofensiv', 'finalizacion', 'remate', 'gestacion'] },
]

export function classifyPhase(code: string): ActionPhase {
  const normalized = normalizeName(code)
  for (const { phase, keywords } of PHASE_KEYWORDS) {
    if (keywords.some(k => normalized.includes(k))) return phase
  }
  return 'otro'
}

interface ZoneRect { x1: number; y1: number; x2: number; y2: number }

// Sistema 0-100 igual que markers/FORMATIONS: y=0 arco rival, y=100 arco propio;
// x=0 banda izquierda, x=100 banda derecha (vista desde el propio equipo atacando hacia arriba).
const ZONE_KEYWORDS: { zone: ZoneRect; keywords: string[] }[] = [
  { zone: { x1: 0, y1: 0, x2: 33, y2: 100 }, keywords: ['izquierda', 'carril 1', 'carril 2'] },
  { zone: { x1: 67, y1: 0, x2: 100, y2: 100 }, keywords: ['derecha', 'carril 4', 'carril 5'] },
  { zone: { x1: 33, y1: 0, x2: 67, y2: 100 }, keywords: ['centro', 'central', 'carril 3'] },
  { zone: { x1: 0, y1: 0, x2: 100, y2: 33 }, keywords: ['ofensiv', 'zona rival', 'tercio rival'] },
  { zone: { x1: 0, y1: 67, x2: 100, y2: 100 }, keywords: ['salida', 'defensiv', 'tercio propio'] },
]

export function inferZoneRect(code: string): ZoneRect | null {
  const normalized = normalizeName(code)
  for (const { zone, keywords } of ZONE_KEYWORDS) {
    if (keywords.some(k => normalized.includes(k))) return zone
  }
  return null
}
