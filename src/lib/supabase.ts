import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://<project>.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '<anon key>'
export const isDemoMode =
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY ||
  SUPABASE_URL.includes('<project>') ||
  SUPABASE_ANON_KEY === '<anon key>'

export const db =
  isDemoMode ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
