import { supabase } from '@/lib/supabase'

export type MarkerTeam = 'propio' | 'rival'
export type MarkerKind = 'generic' | 'player' | 'ball'

export interface BoardMarker {
  id: string
  kind: MarkerKind
  team: MarkerTeam | null   // null solo para la pelota
  label: string              // lo que se ve en la ficha: numero, apellido, o vacio (pelota)
  playerId: number | null    // id de API-Football, solo si kind === 'player'
  x: number                  // % del ancho de la cancha, 0-100
  y: number                  // % del alto de la cancha, 0-100
}

export type AnnotationColor = 'white' | 'yellow' | 'red' | 'skyblue' | 'black'

export interface FreehandAnnotation { id: string; kind: 'freehand'; color: AnnotationColor; points: { x: number; y: number }[] }
export interface ArrowAnnotation    { id: string; kind: 'arrow';    color: AnnotationColor; x1: number; y1: number; x2: number; y2: number }
export interface ZoneAnnotation     { id: string; kind: 'zone';     color: AnnotationColor; x1: number; y1: number; x2: number; y2: number }
export interface TextAnnotation     { id: string; kind: 'text';     color: AnnotationColor; x: number; y: number; text: string }

export type BoardAnnotation = FreehandAnnotation | ArrowAnnotation | ZoneAnnotation | TextAnnotation

export interface TacticalBoard {
  id: number
  coach_key: string
  name: string
  markers: BoardMarker[]
  annotations: BoardAnnotation[]
  created_at: string
  updated_at: string
}

export async function listTacticalBoards(coachKey: string): Promise<TacticalBoard[]> {
  const { data, error } = await supabase
    .from('coach_tactical_boards')
    .select('*')
    .eq('coach_key', coachKey)
    .order('updated_at', { ascending: false })

  if (error || !data) {
    console.error('Error listando pizarras tacticas:', error)
    return []
  }
  return data as unknown as TacticalBoard[]
}

export async function createTacticalBoard(
  coachKey: string,
  name: string,
  initialMarkers: BoardMarker[] = [],
): Promise<TacticalBoard | null> {
  const { data, error } = await supabase
    .from('coach_tactical_boards')
    .insert({ coach_key: coachKey, name, markers: initialMarkers, annotations: [] })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creando pizarra tactica:', error)
    return null
  }
  return data as unknown as TacticalBoard
}

export async function updateTacticalBoard(
  id: number,
  markers: BoardMarker[],
  annotations: BoardAnnotation[],
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_tactical_boards')
    .update({ markers, annotations, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error guardando pizarra tactica:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function renameTacticalBoard(id: number, name: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_tactical_boards')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error renombrando pizarra tactica:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteTacticalBoard(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_tactical_boards').delete().eq('id', id)

  if (error) {
    console.error('Error borrando pizarra tactica:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
