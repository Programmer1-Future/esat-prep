import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pullState, startSync, stopSync } from '../../lib/cloudSync'
import { SessionContext } from '../../lib/session'
import SignIn from '../../pages/SignIn'

function LoadingOverlay({ label }) {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-[13px] text-text-muted"
      >
        {label}
      </motion.p>
    </div>
  )
}

function SetPasswordScreen({ onDone }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async (e) => {
    e.preventDefault()
    if (pw.length < 8) { setError('At least 8 characters.'); return }
    if (pw !== confirm) { setError('Passwords don’t match.'); return }
    setBusy(true); setError(null)
    const { error: err } = await supabase.auth.updateUser({
      password: pw,
      data: { has_password: true },
    })
    if (err) { setError(err.message); setBusy(false) }
    else onDone()
  }, [pw, confirm, onDone])

  return (
    <div className="h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="max-w-sm w-full bg-surface border border-border rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <Lock size={14} className="text-accent" />
          <h1 className="font-display font-600 text-[17px] text-text-primary">Create your password</h1>
        </div>
        <p className="text-[13px] text-text-muted leading-relaxed mb-5">
          Set a password so you can sign in from the website anytime.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password" required placeholder="Password (8+ characters)"
            value={pw} onChange={e => setPw(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent/50 transition-colors placeholder:text-text-muted"
          />
          <input
            type="password" required placeholder="Confirm password"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent/50 transition-colors placeholder:text-text-muted"
          />
          {error && <p className="text-[12px] text-danger px-1">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full py-2.5 rounded-xl font-600 text-[14px] text-on-accent bg-accent transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Set password & continue →'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// Resolve the signed-in user's role. The signup trigger normally creates the
// profile row; this self-heals (as a plain 'user') if that ever didn't fire.
async function fetchRole(user) {
  const { data } = await supabase
    .from('esat_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (data?.role) return data.role
  await supabase.from('esat_profiles').insert({ id: user.id, email: user.email, role: 'user' })
  return 'user'
}

export function AuthGate({ children }) {
  const [session, setSession] = useState(undefined) // undefined = unknown yet
  // Keyed by user id so a stale sync result never leaks across an account switch.
  const [sync, setSync] = useState({ key: null, status: 'pending', role: null })

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session ?? null))
      .catch(() => setSession(null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      stopSync()
      setSync({ key: null, status: 'pending', role: null })
      return
    }
    let cancelled = false
    setSync({ key: session.user.id, status: 'pending', role: null })
    ;(async () => {
      // A transient pull failure still lets the user work (and sync) locally.
      await pullState(session.user)
      const role = await fetchRole(session.user)
      if (cancelled) return
      startSync(session.user)
      setSync({ key: session.user.id, status: 'ready', role })
    })()
    return () => { cancelled = true }
  }, [session])

  const needsPassword = session?.user && !session.user.user_metadata?.has_password

  if (session === undefined) return <LoadingOverlay label="Loading…" />
  if (session === null) return <SignIn />

  const status = sync.key === session.user.id ? sync.status : 'pending'
  if (status === 'pending') return <LoadingOverlay label="Syncing your learning record…" />
  if (needsPassword) {
    return (
      <SetPasswordScreen
        onDone={() => setSession({
          ...session,
          user: { ...session.user, user_metadata: { ...session.user.user_metadata, has_password: true } },
        })}
      />
    )
  }

  return (
    <SessionContext.Provider value={{ user: session.user, role: sync.role }}>
      {children}
    </SessionContext.Provider>
  )
}
