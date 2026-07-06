import { createClient } from '@supabase/supabase-js'

// ESAT's own Supabase project — never TMUA's. The anon (publishable) key is
// safe to ship in client code by design; all access is enforced server-side by
// Row Level Security. Kept in .env (gitignored) rather than hardcoded so the
// key for a student-data project never lands in source control.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in the ESAT project values.'
  )
}

export const supabase = createClient(url, anonKey)
