import { supabase } from '@/lib/supabase'

export async function getMyClubId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('club_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return (data as { club_id: string }).club_id
}
