// RLS isolation proof for ESAT Phase 7.
//
// Signs in as two separate accounts through the PUBLIC ANON KEY (the exact
// threat model) and proves account B cannot read account A's learning record,
// that a plain 'user' cannot write content, and that a logged-out anon client
// sees nothing.
//
// Setup (one-time): create two test users in Supabase Auth (Dashboard →
// Authentication → Add user, tick "Auto confirm"). Then:
//   node scripts/prove-rls.mjs <A_email> <A_pass> <B_email> <B_pass>
// URL + anon key are read from .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const env = {}
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* .env optional if vars are in process.env */ }
  return env
}

const env = loadEnv()
const SB_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
const [aEmail, aPass, bEmail, bPass] = process.argv.slice(2)

if (!SB_URL || !SB_ANON) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env'); process.exit(2) }
if (!aEmail || !aPass || !bEmail || !bPass) {
  console.error('Usage: node scripts/prove-rls.mjs <A_email> <A_pass> <B_email> <B_pass>'); process.exit(2)
}

const client = () => createClient(SB_URL, SB_ANON, { auth: { persistSession: false, autoRefreshToken: false } })

let failures = 0
function check(name, pass, detail = '') {
  console.log(`${pass ? '  ✅ PASS' : '  ❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures++
}

async function signIn(label, email, password) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) { console.error(`Could not sign in ${label} (${email}): ${error.message}`); process.exit(2) }
  return { c, id: data.user.id }
}

const main = async () => {
  console.log('\nESAT RLS isolation proof\n' + '─'.repeat(48))

  const A = await signIn('A', aEmail, aPass)
  const B = await signIn('B', bEmail, bPass)
  console.log(`A = ${aEmail} (${A.id.slice(0, 8)}…)`)
  console.log(`B = ${bEmail} (${B.id.slice(0, 8)}…)\n`)

  // Each account writes a distinct, identifiable state blob.
  await A.c.from('esat_user_state').upsert({ user_id: A.id, email: aEmail, data: { esat_events: ['A-secret'] }, updated_at: new Date().toISOString() })
  await B.c.from('esat_user_state').upsert({ user_id: B.id, email: bEmail, data: { esat_events: ['B-secret'] }, updated_at: new Date().toISOString() })

  // 1. B's own read returns only B's row.
  {
    const { data } = await B.c.from('esat_user_state').select('user_id, data')
    const onlyB = (data || []).length === 1 && data[0].user_id === B.id
    check('B\'s SELECT * returns only B\'s own row', onlyB, `${(data || []).length} row(s) visible`)
    const leakedA = (data || []).some(r => r.user_id === A.id || JSON.stringify(r.data).includes('A-secret'))
    check('A\'s data is NOT in B\'s result set', !leakedA)
  }

  // 2. B explicitly targeting A's row gets nothing.
  {
    const { data } = await B.c.from('esat_user_state').select('*').eq('user_id', A.id)
    check('B querying A\'s user_id returns 0 rows', (data || []).length === 0, `${(data || []).length} row(s)`)
  }

  // 3. Symmetric: A cannot see B either.
  {
    const { data } = await A.c.from('esat_user_state').select('*').eq('user_id', B.id)
    check('A querying B\'s user_id returns 0 rows', (data || []).length === 0)
  }

  // 4. Logged-out anon client sees nothing.
  {
    const { data, error } = await client().from('esat_user_state').select('*')
    check('anon (logged-out) SELECT returns no rows', (data || []).length === 0, error ? error.message : `${(data || []).length} row(s)`)
  }

  // 5. A plain 'user' cannot write content (contributor boundary).
  {
    const { error } = await B.c.from('esat_questions').insert({
      id: `rls-probe-${Date.now()}`, module: 'maths1', topic: 'm1-algebra',
      question: 'probe', options: { A: 'x' }, answer: 'A',
    })
    check('plain user CANNOT insert into esat_questions', !!error, error ? `blocked: ${error.code || error.message}` : 'INSERT unexpectedly succeeded')
  }

  await A.c.auth.signOut(); await B.c.auth.signOut()

  console.log('─'.repeat(48))
  console.log(failures === 0 ? '✅ ALL CHECKS PASSED — user data is isolated.\n' : `❌ ${failures} CHECK(S) FAILED.\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
