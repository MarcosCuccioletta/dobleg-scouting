import { supabase } from '@/lib/supabase'

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
