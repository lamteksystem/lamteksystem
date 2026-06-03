import { createClient } from '@supabase/supabase-js'

/** Vite exposes `import.meta.env`; Node scripts use `process.env` (--env-file). */
function env(key: string): string {
  const vite = typeof import.meta !== 'undefined' && import.meta.env?.[key]
  if (vite != null && String(vite)) return String(vite)
  const node = process.env[key]
  return node != null ? String(node) : ''
}

const supabaseUrl = env('VITE_SUPABASE_URL') || env('SUPABASE_URL')
/** Legacy anon JWT or new publishable key (Dashboard → API). */
const supabaseAnonKey =
  env('VITE_SUPABASE_ANON_KEY') || env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
