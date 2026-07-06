// Verifies the admin-role RLS paths from a real authenticated session:
// admins read ALL user state, can write content, and can change roles.
// Run after promoting A to admin. Usage:
//   node scripts/check-admin.mjs <admin_email> <admin_pass> <target_user_id?>

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

const [email, password] = process.argv.slice(2)
let failures = 0
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '  ✅ PASS' : '  ❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures++
}

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
if (authErr) { console.error(`sign-in failed: ${authErr.message}`); process.exit(2) }

console.log('\nESAT admin RLS check\n' + '─'.repeat(48))

// Admin reads all user state.
{
  const { data } = await supabase.from('esat_user_state').select('user_id')
  check('admin SELECT esat_user_state sees all rows', (data || []).length >= 2, `${(data || []).length} row(s)`)
}
// Admin reads all profiles.
{
  const { data } = await supabase.from('esat_profiles').select('id, role')
  check('admin SELECT esat_profiles sees all rows', (data || []).length >= 2, `${(data || []).length} row(s)`)
}
// Admin can write content.
{
  const id = `admin-probe-${Date.now()}`
  const { error } = await supabase.from('esat_questions').insert({
    id, module: 'maths1', topic: 'm1-algebra', question: 'probe', options: { A: 'x' }, answer: 'A',
  })
  check('admin CAN insert into esat_questions', !error, error ? error.message : `inserted ${id}`)
  if (!error) await supabase.from('esat_questions').delete().eq('id', id)
}
// Admin can change another user's role, then restore it.
{
  const { data: before } = await supabase.from('esat_profiles').select('id, role').neq('id', auth.user.id).limit(1)
  const target = before?.[0]
  if (target) {
    const { error: up } = await supabase.from('esat_profiles').update({ role: 'contributor' }).eq('id', target.id)
    check('admin CAN change another user\'s role', !up, up ? up.message : `${target.role} → contributor`)
    await supabase.from('esat_profiles').update({ role: target.role }).eq('id', target.id)
  }
}

await supabase.auth.signOut()
console.log('─'.repeat(48))
console.log(failures === 0 ? '✅ ALL ADMIN CHECKS PASSED.\n' : `❌ ${failures} FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
