import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// false when env vars are missing — the lobby shows a friendly message instead of crashing
export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!supabaseConfigured) throw new Error('Supabase is not configured (.env.local)');
    client = createClient(url!, anonKey!);
  }
  return client;
}
