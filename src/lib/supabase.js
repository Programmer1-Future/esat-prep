import { createClient } from '@supabase/supabase-js'

// ESAT's own Supabase project — never TMUA's. The anon (publishable) key is
// safe to ship in client code by design; all access is enforced server-side by
// Row Level Security. Kept in .env (gitignored) rather than hardcoded so the
// key for a student-data project never lands in source control.
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
const PLACEHOLDER_KEY = 'your-anon-public-key-here'

if (!url || !anonKey || anonKey === PLACEHOLDER_KEY || !/^https?:\/\//i.test(url)) {
  throw new Error(
    'Missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in the ESAT project values (not the placeholder key).'
  )
}

export const supabase = createClient(url, anonKey)
