import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isCloudEnabled = Boolean(url && anon && url.length > 8 && anon.length > 8)

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url!, anon!)
  : null

/** Email technique pour auth par pseudo (Supabase exige un email). */
export function pseudoEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  return `${clean}@luna-casino.players`
}
