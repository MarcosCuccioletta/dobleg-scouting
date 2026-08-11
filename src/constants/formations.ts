import type { Position } from '@/types/scoring'

export const FORMATIONS: Record<string, { name: string; positions: { key: string; x: number; y: number }[] }> = {
  '4-3-3': {
    name: '4-3-3',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LB', x: 15, y: 72 },
      { key: 'CB1', x: 35, y: 75 },
      { key: 'CB2', x: 65, y: 75 },
      { key: 'RB', x: 85, y: 72 },
      { key: 'CM1', x: 30, y: 50 },
      { key: 'CM2', x: 50, y: 55 },
      { key: 'CM3', x: 70, y: 50 },
      { key: 'LW', x: 18, y: 25 },
      { key: 'ST', x: 50, y: 20 },
      { key: 'RW', x: 82, y: 25 },
    ],
  },
  '4-4-2': {
    name: '4-4-2',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LB', x: 15, y: 72 },
      { key: 'CB1', x: 35, y: 75 },
      { key: 'CB2', x: 65, y: 75 },
      { key: 'RB', x: 85, y: 72 },
      { key: 'LM', x: 15, y: 48 },
      { key: 'CM1', x: 38, y: 52 },
      { key: 'CM2', x: 62, y: 52 },
      { key: 'RM', x: 85, y: 48 },
      { key: 'ST1', x: 35, y: 22 },
      { key: 'ST2', x: 65, y: 22 },
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LB', x: 15, y: 72 },
      { key: 'CB1', x: 35, y: 75 },
      { key: 'CB2', x: 65, y: 75 },
      { key: 'RB', x: 85, y: 72 },
      { key: 'CDM1', x: 38, y: 58 },
      { key: 'CDM2', x: 62, y: 58 },
      { key: 'LW', x: 18, y: 35 },
      { key: 'CAM', x: 50, y: 38 },
      { key: 'RW', x: 82, y: 35 },
      { key: 'ST', x: 50, y: 18 },
    ],
  },
  '3-5-2': {
    name: '3-5-2',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'CB1', x: 25, y: 75 },
      { key: 'CB2', x: 50, y: 78 },
      { key: 'CB3', x: 75, y: 75 },
      { key: 'LWB', x: 10, y: 50 },
      { key: 'CM1', x: 35, y: 52 },
      { key: 'CM2', x: 50, y: 48 },
      { key: 'CM3', x: 65, y: 52 },
      { key: 'RWB', x: 90, y: 50 },
      { key: 'ST1', x: 38, y: 22 },
      { key: 'ST2', x: 62, y: 22 },
    ],
  },
  '5-3-2': {
    name: '5-3-2',
    positions: [
      { key: 'GK', x: 50, y: 92 },
      { key: 'LWB', x: 10, y: 65 },
      { key: 'CB1', x: 28, y: 75 },
      { key: 'CB2', x: 50, y: 78 },
      { key: 'CB3', x: 72, y: 75 },
      { key: 'RWB', x: 90, y: 65 },
      { key: 'CM1', x: 30, y: 48 },
      { key: 'CM2', x: 50, y: 52 },
      { key: 'CM3', x: 70, y: 48 },
      { key: 'ST1', x: 38, y: 22 },
      { key: 'ST2', x: 62, y: 22 },
    ],
  },
}

// Position key -> API Position[] mapping
export const POSITION_KEY_API_MAP: Record<string, Position[]> = {
  'GK':   ['ARQ'],
  'LB':   ['LI'],
  'RB':   ['LD'],
  'LWB':  ['LI'],
  'RWB':  ['LD'],
  'CB1':  ['CB'],
  'CB2':  ['CB'],
  'CB3':  ['CB'],
  'CDM':  ['VC'],
  'CDM1': ['VC'],
  'CDM2': ['VC'],
  'CM1':  ['VC', 'VI'],
  'CM2':  ['VC', 'VI'],
  'CM3':  ['VC', 'VI'],
  'CAM':  ['VI'],
  'LM':   ['EXT'],
  'RM':   ['EXT'],
  'LW':   ['EXT'],
  'RW':   ['EXT'],
  'ST':   ['DEL'],
  'ST1':  ['DEL'],
  'ST2':  ['DEL'],
}

// Formation-specific overrides for CM positions in 4-3-3
export const FORMATION_POSITION_API_OVERRIDES: Record<string, Record<string, Position[]>> = {
  '4-3-3': {
    'CM1': ['VI'],
    'CM2': ['VC'],
    'CM3': ['VI'],
  },
}

export const POSITION_DISPLAY_NAME: Record<string, string> = {
  'GK':   'Arquero',
  'LB':   'Lateral Izquierdo',
  'RB':   'Lateral Derecho',
  'LWB':  'Lateral Izquierdo',
  'RWB':  'Lateral Derecho',
  'CB1':  'Defensor Central',
  'CB2':  'Defensor Central',
  'CB3':  'Defensor Central',
  'CDM':  'Volante Central',
  'CDM1': 'Volante Central',
  'CDM2': 'Volante Central',
  'CM1':  'Mediocampista',
  'CM2':  'Mediocampista',
  'CM3':  'Mediocampista',
  'CAM':  'Mediapunta',
  'LM':   'Extremo Izquierdo',
  'RM':   'Extremo Derecho',
  'LW':   'Extremo Izquierdo',
  'RW':   'Extremo Derecho',
  'ST':   'Delantero',
  'ST1':  'Delantero',
  'ST2':  'Delantero',
}

export const FORMATION_DISPLAY_OVERRIDES: Record<string, Record<string, string>> = {
  '4-3-3': {
    'CM1': 'Vol. Interno Izq.',
    'CM2': 'Volante Central',
    'CM3': 'Vol. Interno Der.',
  },
}

export const FORMATION_SHORT_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  '4-3-3': {
    'CM1': 'VI',
    'CM2': 'VC',
    'CM3': 'VI',
  },
}
