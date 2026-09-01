import { supabase } from '@/lib/supabase'
import type { ParsedInstance } from '@/features/coaches/videoAnalysis/parseNacsportXml'

export type BucketKind = 'propio' | 'rival'

export interface VideoAnalysisBucket {
  id: number
  coach_key: string
  kind: BucketKind
  name: string | null
  created_at: string
}

export async function listBuckets(coachKey: string): Promise<VideoAnalysisBucket[]> {
  const { data, error } = await supabase
    .from('coach_video_analysis_buckets')
    .select('*')
    .eq('coach_key', coachKey)
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Error listando buckets de videoanalisis:', error)
    return []
  }
  return data as unknown as VideoAnalysisBucket[]
}

/** Trae el bucket 'propio' del coach, o lo crea si es la primera vez que entra a la pestana. */
export async function ensurePropioBucket(coachKey: string): Promise<VideoAnalysisBucket | null> {
  const existing = await listBuckets(coachKey)
  const propio = existing.find(b => b.kind === 'propio')
  if (propio) return propio

  const { data, error } = await supabase
    .from('coach_video_analysis_buckets')
    .insert({ coach_key: coachKey, kind: 'propio', name: null })
    .select()
    .single()

  if (error || !data) {
    // 23505 = violacion de unique_index (idx_cvab_propio_unique): otra llamada
    // concurrente (React StrictMode en dev, dos pestanas, red lenta) ya gano la
    // carrera y creo el bucket propio -- volver a buscarlo en vez de fallar.
    if (error?.code === '23505') {
      const retry = await listBuckets(coachKey)
      const winner = retry.find(b => b.kind === 'propio')
      if (winner) return winner
    }
    console.error('Error creando bucket propio de videoanalisis:', error)
    return null
  }
  return data as unknown as VideoAnalysisBucket
}

export async function createRivalBucket(coachKey: string, name: string): Promise<VideoAnalysisBucket | null> {
  const { data, error } = await supabase
    .from('coach_video_analysis_buckets')
    .insert({ coach_key: coachKey, kind: 'rival', name })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creando bucket de rival de videoanalisis:', error)
    return null
  }
  return data as unknown as VideoAnalysisBucket
}

export async function deleteBucket(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_video_analysis_buckets').delete().eq('id', id)
  if (error) {
    console.error('Error borrando bucket de videoanalisis:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

const MAX_VIDEO_BYTES = 500 * 1024 * 1024 // 500MB

export interface VideoAnalysisMatch {
  id: number
  bucket_id: number
  match_date: string
  opponent_name: string | null
  instances: ParsedInstance[]
  video_storage_path: string | null
  created_at: string
}

export async function listMatches(bucketId: number): Promise<VideoAnalysisMatch[]> {
  const { data, error } = await supabase
    .from('coach_video_analysis_matches')
    .select('*')
    .eq('bucket_id', bucketId)
    .order('match_date', { ascending: false })

  if (error || !data) {
    console.error('Error listando partidos de videoanalisis:', error)
    return []
  }
  return data as unknown as VideoAnalysisMatch[]
}

export async function createMatch(
  bucketId: number,
  matchDate: string,
  opponentName: string | null,
  instances: ParsedInstance[],
): Promise<VideoAnalysisMatch | null> {
  const { data, error } = await supabase
    .from('coach_video_analysis_matches')
    .insert({ bucket_id: bucketId, match_date: matchDate, opponent_name: opponentName, instances })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creando partido de videoanalisis:', error)
    return null
  }
  return data as unknown as VideoAnalysisMatch
}

export async function deleteMatch(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('coach_video_analysis_matches').delete().eq('id', id)
  if (error) {
    console.error('Error borrando partido de videoanalisis:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** Sube el video completo del partido a Storage y guarda la ruta en el match.
 *  Sin progreso real (supabase-js no lo expone) -- el llamador muestra un estado
 *  binario "subiendo/listo", no un porcentaje. */
export async function uploadMatchVideo(
  coachKey: string,
  bucketId: number,
  matchId: number,
  file: File,
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (file.size > MAX_VIDEO_BYTES) {
    return { success: false, error: 'El video pesa más de 500MB. Comprimilo o subí una versión más liviana.' }
  }

  const ext = file.name.split('.').pop() ?? 'mp4'
  const path = `${coachKey}/${bucketId}/${matchId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('coach-video-analysis')
    .upload(path, file, { upsert: true })

  if (uploadError) {
    console.error('Error subiendo video de videoanalisis:', uploadError)
    return { success: false, error: uploadError.message }
  }

  const { error: updateError } = await supabase
    .from('coach_video_analysis_matches')
    .update({ video_storage_path: path })
    .eq('id', matchId)

  if (updateError) {
    console.error('Error guardando ruta de video de videoanalisis:', updateError)
    return { success: false, error: updateError.message }
  }

  return { success: true, path }
}

export function getMatchVideoUrl(path: string): string {
  return supabase.storage.from('coach-video-analysis').getPublicUrl(path).data.publicUrl
}
