import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, Mail, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

const field =
  'w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent/50 transition-colors placeholder:text-text-muted'

export default function SignIn() {
  const [mode, setMode] = useState('password') // 'password' | 'magic'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const signInPassword = useCallback(async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (err) { setError('Email or password not recognised.'); setBusy(false) }
  }, [email, password])

  const sendMagicLink = useCallback(async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    })
    setBusy(false)
    if (err) setError('Something went wrong. Try again in a moment.')
    else setMagicSent(true)
  }, [email])

  return (
    <div className="h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="max-w-sm w-full bg-surface border border-border rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap size={18} className="text-accent" />
          <span className="font-display font-700 text-text-primary">ESATprep</span>
        </div>
        <p className="text-[13px] text-text-muted leading-relaxed mb-5">
          Sign in to sync your practice, mocks and progress across devices.
        </p>

        {magicSent ? (
          <div className="text-center py-4">
            <Mail size={22} className="text-accent mx-auto mb-2" />
            <p className="text-sm font-600 text-text-primary mb-1">Sign-in link sent</p>
            <p className="text-xs text-text-muted leading-relaxed">
              Check your inbox at <span className="text-text-secondary">{email}</span> and click the link to sign in.
            </p>
          </div>
        ) : mode === 'password' ? (
          <>
            <form onSubmit={signInPassword} className="space-y-3">
              <input type="email" required autoComplete="email" placeholder="Email address"
                value={email} onChange={e => setEmail(e.target.value)} className={field} />
              <input type="password" required autoComplete="current-password" placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)} className={field} />
              {error && <p className="text-[12px] text-danger px-1">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full py-2.5 rounded-xl font-600 text-[14px] text-on-accent bg-accent transition-opacity hover:opacity-90 disabled:opacity-50">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <button
              onClick={() => { setMode('magic'); setError(null) }}
              className="mt-3 w-full text-center text-[12px] font-600 text-accent hover:opacity-80 transition-opacity inline-flex items-center justify-center gap-1.5"
            >
              <Mail size={12} /> First time? Get a sign-in link
            </button>
          </>
        ) : (
          <>
            <form onSubmit={sendMagicLink} className="space-y-3">
              <input type="email" required autoComplete="email" placeholder="Email address"
                value={email} onChange={e => setEmail(e.target.value)} className={field} />
              {error && <p className="text-[12px] text-danger px-1">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full py-2.5 rounded-xl font-600 text-[14px] text-on-accent bg-accent transition-opacity hover:opacity-90 disabled:opacity-50">
                {busy ? 'Sending…' : 'Send me a sign-in link'}
              </button>
            </form>
            <button
              onClick={() => { setMode('password'); setError(null) }}
              className="mt-3 w-full text-center text-[12px] text-text-muted hover:text-text-secondary transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <KeyRound size={12} /> Sign in with password instead
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
