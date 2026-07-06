// Creates two test users via signUp (idempotent). Email confirmation is then
// forced on via an admin SQL update run separately through the MCP, because the
// anon key cannot confirm emails. For local RLS testing only.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const users = [
  { email: 'esat-test-a@esatprep.co.uk', password: 'esat-test-pw-A1!' },
  { email: 'esat-test-b@esatprep.co.uk', password: 'esat-test-pw-B2!' },
]

for (const u of users) {
  const { data, error } = await supabase.auth.signUp(u)
  if (error && !/already registered/i.test(error.message)) {
    console.error(`signUp ${u.email} failed: ${error.message}`)
    process.exit(1)
  }
  console.log(`${u.email}: ${error ? 'already exists' : `created (${data.user?.id?.slice(0, 8)}…)`}`)
}
console.log('\nNext: force-confirm these emails via admin SQL, then run prove-rls.mjs')
