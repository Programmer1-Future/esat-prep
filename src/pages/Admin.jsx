import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldAlert, Users, FileText, Loader2, AlertTriangle, Trash2, Plus, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MODULES } from '../lib/moduleMap'
import { useSession, canManageContent, canManageUsers } from '../lib/session'

const ASSIGNABLE_ROLES = ['user', 'contributor', 'admin']

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function eventCount(state) {
  const events = state?.data?.esat_events
  return Array.isArray(events) ? events.length : 0
}

// ─── Users panel (admin only) ────────────────────────────────────────────────

function UsersPanel({ currentUserId }) {
  const [profiles, setProfiles] = useState([])
  const [states, setStates] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rowBusy, setRowBusy] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => { setError(null); setLoading(true); setReloadKey(k => k + 1) }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const [pr, st] = await Promise.all([
        supabase.from('esat_profiles').select('*').order('created_at', { ascending: true }),
        supabase.from('esat_user_state').select('user_id, email, updated_at, data'),
      ])
      if (!active) return
      if (pr.error) setError(pr.error.message)
      else setProfiles(pr.data || [])
      if (st.data) {
        const byId = {}
        for (const s of st.data) byId[s.user_id] = s
        setStates(byId)
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [reloadKey])

  const changeRole = useCallback(async (id, role) => {
    setRowBusy(id); setError(null)
    const { error: err } = await supabase.from('esat_profiles').update({ role }).eq('id', id)
    if (err) setError(err.message)
    else setProfiles(prev => prev.map(p => (p.id === id ? { ...p, role } : p)))
    setRowBusy(null)
  }, [])

  const counts = useMemo(() => {
    const c = { admin: 0, contributor: 0, user: 0 }
    for (const p of profiles) if (p.role in c) c[p.role]++
    const events = Object.values(states).reduce((sum, s) => sum + eventCount(s), 0)
    return { total: profiles.length, ...c, events }
  }, [profiles, states])

  if (loading) {
    return <div className="flex items-center gap-2 text-text-muted text-sm py-12 justify-center"><Loader2 size={16} className="animate-spin" /> Loading users…</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Users" value={counts.total} />
        <Stat label="Admins" value={counts.admin} />
        <Stat label="Contributors" value={counts.contributor} />
        <Stat label="Events synced" value={counts.events.toLocaleString()} />
      </div>

      {error && (
        <Card><CardBody><p className="text-danger text-sm flex items-center gap-2"><AlertTriangle size={14} /> {error}</p></CardBody></Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted flex items-center gap-2"><Users size={13} /> People</span>
            <button onClick={reload} className="text-text-muted hover:text-text-secondary transition-colors"><RefreshCw size={13} /></button>
          </div>
        </CardHeader>
        <div>
          {profiles.map(p => {
            const state = states[p.id]
            const isSelf = p.id === currentUserId
            return (
              <div key={p.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 border-b border-border-subtle last:border-b-0 items-center">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {p.email}{isSelf && <span className="text-text-muted text-xs"> (you)</span>}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Joined {formatDate(p.created_at)} · {eventCount(state)} events · {state ? `synced ${formatDate(state.updated_at)}` : 'no cloud state'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {rowBusy === p.id && <Loader2 size={13} className="animate-spin text-text-muted" />}
                  <select
                    value={p.role}
                    disabled={rowBusy === p.id}
                    onChange={e => changeRole(p.id, e.target.value)}
                    className="bg-surface-raised border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 disabled:opacity-50"
                  >
                    {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <Card>
      <CardBody className="!py-3 !px-4">
        <p className="text-[11px] text-text-muted font-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-display font-700 text-text-primary mt-0.5 tabular">{value}</p>
      </CardBody>
    </Card>
  )
}

// ─── Content panel (admin + contributor) ─────────────────────────────────────

function ContentPanel({ userId }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [moduleId, setModuleId] = useState(MODULES[0].id)
  const [topicId, setTopicId] = useState(MODULES[0].topics[0].id)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const topics = useMemo(() => MODULES.find(m => m.id === moduleId)?.topics || [], [moduleId])

  const reload = useCallback(() => { setError(null); setLoading(true); setReloadKey(k => k + 1) }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error: err } = await supabase
        .from('esat_notes')
        .select('*')
        .order('created_at', { ascending: false })
      if (!active) return
      if (err) setError(err.message)
      else setNotes(data || [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [reloadKey])

  const onModuleChange = useCallback((id) => {
    setModuleId(id)
    const first = MODULES.find(m => m.id === id)?.topics[0]
    if (first) setTopicId(first.id)
  }, [])

  const addNote = useCallback(async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setBusy(true); setError(null)
    const { error: err } = await supabase.from('esat_notes').insert({
      module: moduleId, topic: topicId, title: title.trim(), body, created_by: userId,
    })
    if (err) setError(err.message)
    else { setTitle(''); setBody(''); setReloadKey(k => k + 1) }
    setBusy(false)
  }, [moduleId, topicId, title, body, userId])

  const deleteNote = useCallback(async (id) => {
    setError(null)
    const { error: err } = await supabase.from('esat_notes').delete().eq('id', id)
    if (err) setError(err.message)
    else setNotes(prev => prev.filter(n => n.id !== id))
  }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted flex items-center gap-2"><Plus size={13} /> New note</span>
        </CardHeader>
        <CardBody>
          <form onSubmit={addNote} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select value={moduleId} onChange={e => onModuleChange(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50">
                {MODULES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={topicId} onChange={e => setTopicId(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50">
                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 placeholder:text-text-muted" />
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Body (markdown + LaTeX, rendered later by TechniqueRenderer)"
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 placeholder:text-text-muted resize-y" />
            {error && <p className="text-danger text-xs flex items-center gap-2"><AlertTriangle size={13} /> {error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add note
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted flex items-center gap-2"><FileText size={13} /> Notes ({notes.length})</span>
            <button onClick={reload} className="text-text-muted hover:text-text-secondary transition-colors"><RefreshCw size={13} /></button>
          </div>
        </CardHeader>
        <div>
          {loading ? (
            <div className="flex items-center gap-2 text-text-muted text-sm py-8 justify-center"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8">No notes yet. Content lands module-by-module.</p>
          ) : (
            notes.map(n => (
              <div key={n.id} className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{n.title}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{n.module} · {n.topic} · {formatDate(n.created_at)}</p>
                </div>
                <button onClick={() => deleteNote(n.id)} className="text-text-muted hover:text-danger transition-colors p-1"><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user, role } = useSession()
  const [tab, setTab] = useState(canManageUsers(role) ? 'users' : 'content')

  if (!canManageContent(role)) {
    return (
      <div className="p-5 max-w-md mx-auto mt-20">
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <ShieldAlert size={28} className="text-danger mx-auto mb-3" />
              <p className="text-text-primary font-600 text-sm">Not authorised</p>
              <p className="text-text-muted text-xs mt-1.5">This area is for admins and contributors.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  const tabs = [
    ...(canManageUsers(role) ? [{ id: 'users', label: 'Users', icon: Users }] : []),
    { id: 'content', label: 'Content', icon: FileText },
  ]

  return (
    <motion.div
      className="p-5 space-y-4 max-w-3xl mx-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Admin</h1>
        <p className="text-text-muted text-sm mt-1">Signed in as {user?.email} · <span className="text-accent">{role}</span></p>
      </div>

      <div className="flex items-center gap-1 bg-surface-raised/50 border border-border rounded-lg p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-500 transition-all ${active ? 'bg-surface border border-border-subtle text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
              <Icon size={13} className={active ? 'text-accent' : ''} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'users' && canManageUsers(role) && <UsersPanel currentUserId={user?.id} />}
      {tab === 'content' && <ContentPanel userId={user?.id} />}
    </motion.div>
  )
}
