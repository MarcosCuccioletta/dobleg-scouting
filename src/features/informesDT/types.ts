import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'

export type RadarAxisKey = 'posesion' | 'duelos' | 'duelosAereos' | 'precisionPase' | 'xg' | 'ppda'
export type EvolutionChartKey = 'posesion' | 'xg' | 'duelos' | 'duelosAereos' | 'ppda'

export interface RecordStats {
  pj: number
  ganados: number
  empatados: number
  perdidos: number
  ppg: number
  gf: number
  gc: number
  efectividadPct: number
}

export interface ComparativaMetric {
  key: string
  label: string
  category: 'metrica' | 'via_generacion' // 'metrica' = sección "Comparación por métrica", 'via_generacion' = sección "Vías de generación de juego" del mockup
  ownValue: number
  rivalValue: number
  unit: '%' | ''
  overridden: boolean // true si el usuario lo corrigió a mano
}

export interface SistemaUsado {
  formacion: string
  partidos: number
}

export interface DisciplinaStats {
  faltasPorPartido: number
  amarillas: number
  rojas: number
  faltasRivalPorPartido: number
}

export interface FormaRecienteEntry {
  resultado: 'V' | 'E' | 'D'
  puntosAcumulados: number
  fecha: string
}

export interface TituloJugador {
  nombre: string
  temporada: string
  club: string
  trofeoKey: string // key del catálogo de trophyCatalog.ts
}

export interface ClubJugador {
  club: string
  periodo: string
  cedido: boolean
  logoUrl: string | null
}

export interface ExperienciaJugador {
  incluir: boolean
  edad: string
  lugarNacimiento: string
  altura: string
  posicion: string
  pieHabil: string
  seleccion: string
  titulos: TituloJugador[]
  trayectoria: ClubJugador[]
}

export interface ClubDT {
  club: string
  periodo: string
  liga: string | null
  logoUrl: string | null
}

export interface InformeDTContent {
  nombre: string
  cargo: string
  club: string
  liga: string
  sistemaHabitual: string
  edad: string
  fotoDataUrl: string | null
  record: RecordStats
  comparativa: ComparativaMetric[]
  radarAxes: RadarAxisKey[]
  evolutionCharts: EvolutionChartKey[]
  sistemas: SistemaUsado[]
  disciplina: DisciplinaStats
  formaReciente: FormaRecienteEntry[]
  experienciaJugador: ExperienciaJugador
  carreraDT: ClubDT[]
}

export interface InformeDT {
  id: string
  createdAt: string
  updatedAt: string
  coachKey: string
  content: InformeDTContent
  matches: WyscoutMatch[] // se guarda para poder re-generar/editar sin re-subir el archivo
}
