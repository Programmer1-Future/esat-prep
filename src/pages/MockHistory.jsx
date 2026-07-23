import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { TimerReset, Play, Plus, X, ChevronRight } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { cn, formatSecs, isoDate } from '../lib/utils'
import { MODULES, getModule } from '../lib/moduleMap'
import { projectScore, formatProjected } from '../lib/mockScore'
import { logEvent } from '../lib/eventLog'
import { useLocalStorage, updateStoredValue } from '../hooks/useLocalStorage'
import { promoteDraftToAbandoned } from '../lib/mockAbandon'

const EMPTY_ROW = () => ({ module: 'maths1', correct: '', total: '27' })

// Manual mock entry — reconciles Phase 4's auto-only sitting history with
// De-TMUA-guide's MockLog.jsx pattern, adapted for per-module scores: a mock
// sat outside the app (real Pearson VUE day, paper mock) lands in the exact
// same esat_mock_sittings shape as an auto-logged sitting, flagged manual:true.
function AddMockModal({ isOpen, onClose }) {
  const [date, setDate] = useState(() => isoDate())
  const [rows, setRows] = useState([EMPTY_ROW()])

  const updateRow = (i, patch) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => rows.length < MODULES.length && setRows(rs => [...rs, EMPTY_ROW()])
  const removeRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i))

  const handleSave = () => {
    const valid = rows.filter(r => r.module && r.correct !== '')
    if (valid.length === 0) return

    const sittingId = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const moduleRecords = valid.map(r => {
      const correct = Math.max(0, Math.min(27, Number(r.correct) || 0))
      const total = Math.max(1, Number(r.total) || 27)
      return { module: r.module, correct, total, projected: projectScore(correct, total), timeTakenSec: null, autoSubmitted: false, manual: true }
    })

    moduleRecords.forEach(rec => {
      logEvent('mock_logged', {
        date, sittingId, module: rec.module, score: rec.correct, total: rec.total,
        projected: rec.projected, timeTaken: null, autoSubmitted: false, manual: true, results: [],
      })
    })

    updateStoredValue('esat_mock_sittings', sittings => [
      ...sittings,
      { id: sittingId, date, ts: new Date().toISOString(), manual: true, modules: moduleRecords },
    ], [])

    setRows([EMPTY_ROW()])
    setDate(isoDate())
    onClose()
  }

  const inputClass = "bg-surface-raised border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log a mock manually">
      <div className="space-y-4">
        <p className="text-xs text-text-muted">For a sitting taken outside the app — a real Pearson VUE day or a paper mock. Enter a raw score per module.</p>
        <div>
          <label className="block text-[11px] text-text-muted mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={cn(inputClass, 'w-full')} />
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.module}
                onChange={e => updateRow(i, { module: e.target.value })}
                className={cn(inputClass, 'flex-1')}
              >
                {MODULES.map(m => <option key={m.id} value={m.id}>{m.short}</option>)}
              </select>
              <input
                type="number" min="0" max="27" value={row.correct}
                onChange={e => updateRow(i, { correct: e.target.value })}
                placeholder="correct" className={cn(inputClass, 'w-20')}
              />
              <span className="text-text-muted text-sm">/</span>
              <input
                type="number" min="1" value={row.total}
                onChange={e => updateRow(i, { total: e.target.value })}
                className={cn(inputClass, 'w-16')}
              />
              {rows.length > 1 && (
                <button onClick={() => removeRow(i)} className="p-1.5 text-text-muted hover:text-danger transition-colors" aria-label="Remove module">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        {rows.length < MODULES.length && (
          <button onClick={addRow} className="flex items-center gap-1.5 text-[11px] text-accent hover:opacity-80 transition-opacity">
            <Plus size={11} /> Add another module
          </button>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="primary" size="md" onClick={handleSave} className="flex-1">Save sitting</Button>
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

// Past sittings, newest first. Scores are shown per module on the 1.0–9.0
// scale — deliberately no total row, no average: ESAT has no combined score.
export default function MockHistory() {
  const [sittings] = useLocalStorage('esat_mock_sittings', [])
  const ordered = useMemo(() => [...sittings].reverse(), [sittings])
  const [showAddModal, setShowAddModal] = useState(false)

  // Soft leave / refresh may leave a draft; promote into Abandoned before listing.
  useEffect(() => {
    promoteDraftToAbandoned()
  }, [])

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Mock History</h1>
          <p className="text-text-muted text-sm mt-1">
            {ordered.length === 0 ? 'No sittings yet.' : `${ordered.length} sitting${ordered.length !== 1 ? 's' : ''} · scored per module, 1.0–9.0`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-text-secondary text-sm font-600 hover:text-text-primary hover:border-accent/30 transition-all duration-150"
          >
            <Plus size={13} /> Log manually
          </button>
          <Link
            to="/mock"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-on-accent text-sm font-600 hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-150"
          >
            <Play size={13} fill="currentColor" /> New mock
          </Link>
        </div>
      </div>

      <AddMockModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      {ordered.length === 0 && (
        <Card className="p-8 text-center">
          <TimerReset size={22} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary mb-1">Sit your first full mock</p>
          <p className="text-xs text-text-muted">Maths 1 plus your optional modules, under real Pearson VUE timing.</p>
        </Card>
      )}

      {ordered.map(s => (
        <Card key={s.id}>
          <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-border-subtle">
            <span className="flex items-center gap-2">
              <span className="text-xs font-600 text-text-secondary tabular">{s.date}</span>
              {s.manual && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-600 uppercase tracking-wide bg-surface-raised border border-border text-text-muted">Manual</span>
              )}
              {s.abandoned && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-600 uppercase tracking-wide bg-warning/10 border border-warning/30 text-warning">Abandoned</span>
              )}
            </span>
            <span className="text-[11px] text-text-muted">{s.modules.length} module{s.modules.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {s.modules.map(r => {
              const m = getModule(r.module)
              return (
                <div
                  key={r.module}
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: `color-mix(in srgb, ${m.color} 30%, transparent)` }}
                >
                  <p className="text-xs font-600 mb-1" style={{ color: m.color }}>{m.short}</p>
                  <p className="font-display font-700 text-3xl tabular tracking-[-0.03em]" style={{ color: m.color }}>
                    {formatProjected(r.projected)}
                  </p>
                  <p className={cn('text-[11px] text-text-muted mt-1 tabular')}>
                    {r.correct}/{r.total} · {formatSecs(r.timeTakenSec)}
                    {r.autoSubmitted && <span className="text-danger"> · timed out</span>}
                  </p>
                </div>
              )
            })}
          </div>
          <Link
            to={`/mocks/${s.id}`}
            className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border-subtle text-xs font-600 text-text-muted hover:text-text-secondary transition-colors"
          >
            {s.manual ? 'View sitting' : 'Review questions'}
            <ChevronRight size={12} />
          </Link>
        </Card>
      ))}
    </motion.div>
  )
}
