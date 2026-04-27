import { supabase } from '@/lib/supabase'

/**
 * Small helper for `user_preferences` (persistent per user, no local/session storage).
 * For structured values, store JSON strings; for simple strings/booleans you can store plain strings.
 */

export async function getUserPreference(key: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .maybeSingle()
  return (data?.value as string | null) ?? null
}

export async function setUserPreference(key: string, value: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_preferences').upsert(
    { user_id: user.id, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' }
  )
}

