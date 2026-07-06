import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag, ChevronLeft, ChevronRight, Grid3x3, PenLine, X, Clock, Play } from 'lucide-react'
import { Card } from '../components/ui/Card'
import questionsData from '../data/questions.json'
import { cn, isoDate, formatSecs } from '../lib/utils'
import { MODULES, getModule, topicIdForQuestion, questionsForModules } from '../lib/moduleMap'
import { logEvent } from '../lib/eventLog'
import { enqueueMisses } from '../lib/reviewQueue'
import { projectScore, formatProjected } from '../lib/mockScore'
import { updateStoredValue, useLocalStorage } from '../hooks/useLocalStorage'
import { MathText } from '../components/ui/TechniqueRenderer'
import { parseDiagrams } from '../lib/diagrams'
import { DiagramNotice } from '../components/ui/Diagram'

// Pearson VUE environment clone. Fidelity rules (per Build Prompt Phase 4):
// one module per timed block, hard 40:00 auto-submit, flag-and-review grid,
// fixed A–E option letters (no shuffling), no calculator affordances, no
// per-question feedback, no scores between modules, scratchpad instead of
// whiteboard. Results reported per module only — never combined.
const MODULE_SECONDS = 40 * 60
const MODULE_QUESTIONS = 27
const OPTIONAL_MODULE_IDS = ['maths2', 'physics', 'chemistry', 'biology']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatClock(secs) {
  const s = Math.max(0, secs)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// ─── Setup ──────────────────────────────────────────────────────────────────────
function MockSetup({ allQuestions, chosenModuleIds, onStart }) {
  const availability = useMemo(() => {
    const map = {}
    for (const m of MODULES) map[m.id] = questionsForModules(allQuestions, [m.id]).length
    return map
  }, [allQuestions])

  const [optional, setOptional] = useState(() =>
    chosenModuleIds.filter(id => OPTIONAL_MODULE_IDS.includes(id) && availability[id] > 0).slice(0, 2)
  )

  const toggle = (id) => setOptional(prev =>
    prev.includes(id) ? prev.filter(x => x !== id)
      : prev.length >= 2 ? prev
      : [...prev, id]
  )

  const sittingModules = ['maths1', ...optional]

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-5"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Mock Exam</h1>
        <p className="text-text-muted text-sm mt-1">
          Full ESAT sitting under Pearson VUE conditions — 27 questions and a hard 40:00 per module,
          flag-and-review navigation, no calculator, on-screen scratchpad only.
        </p>
      </div>

      <Card>
        <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
          <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Your sitting</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-accent/30 bg-accent/5">
            <span className="text-sm font-600 text-accent">Mathematics 1</span>
            <span className="text-[11px] text-text-muted ml-auto">compulsory · first block</span>
          </div>
          <p className="text-[11px] font-600 uppercase tracking-widest text-text-muted pt-1">Optional modules — pick up to 2</p>
          <div className="flex flex-wrap gap-2">
            {OPTIONAL_MODULE_IDS.map(id => {
              const m = getModule(id)
              const count = availability[id]
              const sel = optional.includes(id)
              const disabled = count === 0 || (!sel && optional.length >= 2)
              return (
                <button
                  key={id}
                  onClick={() => !disabled && toggle(id)}
                  disabled={disabled}
                  className={cn(
                    'px-3 py-2 rounded-xl border text-sm font-600 transition-all duration-150',
                    sel ? '' : disabled ? 'border-border text-text-muted/50 cursor-not-allowed' : 'border-border text-text-muted hover:text-text-secondary'
                  )}
                  style={sel ? {
                    color: m.color,
                    backgroundColor: `color-mix(in srgb, ${m.color} 10%, transparent)`,
                    borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`,
                  } : {}}
                >
                  {m.short}{count === 0 && <span className="opacity-60 font-400"> · no questions yet</span>}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 text-sm text-text-secondary leading-relaxed">
          <p className="font-600 text-text-primary mb-1.5">Test-day conditions apply</p>
          <p>
            Each module is a locked timed block: you can move freely and flag questions within it, but once
            you end a module you cannot return. The timer does not pause. At 0:00 the module auto-submits.
            No results are shown between modules — scores appear only after the full sitting, one per module.
          </p>
        </div>
      </Card>

      <button
        onClick={() => onStart(sittingModules)}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-600 text-base bg-accent text-on-accent hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-200"
      >
        <Play size={16} fill="currentColor" />
        Begin sitting — {sittingModules.length} module{sittingModules.length !== 1 ? 's' : ''}
      </button>
    </motion.div>
  )
}

// ─── Module interstitial (no scores shown — VUE fidelity) ──────────────────────
function ModuleIntro({ moduleId, index, total, questionCount, onBegin }) {
  const m = getModule(moduleId)
  return (
    <motion.div
      className="max-w-lg mx-auto p-6 pt-20 text-center"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <p className="text-[11px] font-600 uppercase tracking-widest text-text-muted mb-2">
        Module {index + 1} of {total}
      </p>
      <h1 className="font-display font-700 text-3xl tracking-[-0.02em] mb-3" style={{ color: m.color }}>{m.name}</h1>
      <p className="text-sm text-text-secondary mb-1">{questionCount} questions · 40:00 hard limit</p>
      {questionCount < MODULE_QUESTIONS && (
        <p className="text-xs text-warning mb-1">Bank has only {questionCount} questions for this module — timer stays at 40:00.</p>
      )}
      <p className="text-xs text-text-muted mb-8">The clock starts the moment you begin. It cannot be paused.</p>
      <button
        onClick={onBegin}
        className="px-8 py-3.5 rounded-xl font-600 text-base bg-accent text-on-accent hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-200"
      >
        Begin {m.short}
      </button>
    </motion.div>
  )
}

// ─── Navigator grid — the VUE review screen's core widget ───────────────────────
function statusOf(i, answers, flags) {
  return { answered: answers[i] != null, flagged: flags.has(i) }
}

function NavGrid({ count, answers, flags, currentIdx, onJump, filter }) {
  return (
    <div className="grid grid-cols-9 gap-1.5">
      {Array.from({ length: count }).map((_, i) => {
        const { answered, flagged } = statusOf(i, answers, flags)
        if (filter === 'flagged' && !flagged) return <div key={i} />
        if (filter === 'unanswered' && answered) return <div key={i} />
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={cn(
              'relative h-9 rounded-lg border text-xs font-600 tabular transition-all duration-100',
              i === currentIdx && 'ring-2 ring-accent ring-offset-1 ring-offset-background',
              answered
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'border-border text-text-muted hover:text-text-secondary hover:border-accent/30'
            )}
          >
            {i + 1}
            {flagged && (
              <Flag size={9} className="absolute top-0.5 right-0.5 text-warning" fill="currentColor" />
            )}
          </button>
        )
      })}
    </div>
  )
}

function GridLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/15 border border-accent/40 inline-block" /> Answered</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-border inline-block" /> Unanswered</span>
      <span className="flex items-center gap-1.5"><Flag size={10} className="text-warning" fill="currentColor" /> Flagged</span>
    </div>
  )
}

// ─── Scratchpad — the on-screen whiteboard stand-in ─────────────────────────────
// A typed pad, not a mouse canvas: freehand mouse drawing is *less* faithful to
// the wet-erase board than typing (illegible for algebra), and the constraint
// being simulated is "working lives outside your head, no calculator". One pad
// persists across the whole sitting, like the physical board at VUE.
function Scratchpad({ value, onChange, open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 340, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed right-0 top-0 bottom-0 w-[340px] z-[60] bg-surface border-l border-border shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
            <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted flex items-center gap-2">
              <PenLine size={13} /> Scratchpad
            </span>
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary" aria-label="Close scratchpad">
              <X size={15} />
            </button>
          </div>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Working only — kept for the whole sitting, wiped when it ends."
            className="flex-1 w-full resize-none bg-transparent p-4 text-sm font-mono leading-relaxed text-text-primary placeholder:text-text-muted/60 focus:outline-none"
            spellCheck={false}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

// ─── Timed module block ─────────────────────────────────────────────────────────
// Owns everything inside one 40:00 window: question view, navigator, review
// screen, end-module confirm, auto-submit. Calls onSubmit(answersMap, flagsSet,
// timeSpentMap, secondsUsed) exactly once.
function ExamModule({ moduleId, questions, onSubmit, scratchpad, setScratchpad }) {
  const m = getModule(moduleId)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flags, setFlags] = useState(new Set())
  const [view, setView] = useState('question')       // question | review
  const [reviewFilter, setReviewFilter] = useState('all')
  const [navOpen, setNavOpen] = useState(false)
  const [padOpen, setPadOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [timeLeft, setTimeLeft] = useState(MODULE_SECONDS)

  const endAtRef = useRef(null)
  const timeSpentRef = useRef({})
  const enteredAtRef = useRef(null)
  const submittedRef = useRef(false)
  const idxRef = useRef(0)
  const answersRef = useRef({})
  const flagsRef = useRef(new Set())

  useEffect(() => {
    idxRef.current = idx
    answersRef.current = answers
    flagsRef.current = flags
  }, [idx, answers, flags])

  const accrue = useCallback(() => {
    const now = Date.now()
    const i = idxRef.current
    timeSpentRef.current[i] = (timeSpentRef.current[i] || 0) + (now - enteredAtRef.current) / 1000
    enteredAtRef.current = now
  }, [])

  const goTo = useCallback((next) => {
    accrue()
    setIdx(next)
    setView('question')
    setNavOpen(false)
  }, [accrue])

  const submit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    const now = Date.now()
    const i = idxRef.current
    timeSpentRef.current[i] = (timeSpentRef.current[i] || 0) + (now - enteredAtRef.current) / 1000
    const secondsUsed = MODULE_SECONDS - Math.max(0, Math.round((endAtRef.current - now) / 1000))
    onSubmit(answersRef.current, flagsRef.current, timeSpentRef.current, Math.min(secondsUsed, MODULE_SECONDS))
  }, [onSubmit])

  // Hard countdown — derived from a fixed deadline set once on mount, so tab
  // throttling can't stretch the 40 minutes and per-question renders can't
  // reset it. Auto-submits at zero, bypassing review.
  useEffect(() => {
    const start = Date.now()
    endAtRef.current = start + MODULE_SECONDS * 1000
    enteredAtRef.current = start
    const tick = setInterval(() => {
      const left = Math.round((endAtRef.current - Date.now()) / 1000)
      setTimeLeft(Math.max(0, left))
      if (left <= 0) {
        clearInterval(tick)
        submit()
      }
    }, 250)
    return () => clearInterval(tick)
  }, [submit])

  const q = questions[idx]
  const { stem, diagrams } = useMemo(() => parseDiagrams(q?.question), [q])
  const optionEntries = useMemo(
    () => Object.entries(q?.options || {}).sort(([a], [b]) => a.localeCompare(b)),
    [q]
  )

  const answeredCount = Object.keys(answers).length
  const unansweredCount = questions.length - answeredCount
  const isLast = idx === questions.length - 1
  const low = timeLeft <= 300

  const toggleFlag = () => setFlags(prev => {
    const next = new Set(prev)
    if (next.has(idx)) next.delete(idx); else next.add(idx)
    return next
  })

  const selectAnswer = (letter) => setAnswers(prev =>
    prev[idx] === letter ? (() => { const n = { ...prev }; delete n[idx]; return n })() : { ...prev, [idx]: letter }
  )

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* VUE-style header: exam title, timer, position */}
      <header className="flex-shrink-0 border-b border-border bg-surface">
        <div className="flex items-center justify-between px-5 h-12">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-600 text-text-primary truncate">ESAT — {m.name}</span>
          </div>
          <div className="flex items-center gap-5">
            <span
              className={cn('flex items-center gap-1.5 text-sm font-mono font-600 tabular', low ? 'text-danger' : 'text-text-secondary')}
              aria-live={low ? 'polite' : 'off'}
            >
              <Clock size={13} />
              {formatClock(timeLeft)}
            </span>
            <span className="text-sm text-text-muted tabular">
              Question {Math.min(idx + 1, questions.length)} of {questions.length}
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {view === 'question' ? (
          <div className="max-w-2xl mx-auto p-6">
            {/* Flag for review — checkbox interaction, like VUE */}
            <button
              onClick={toggleFlag}
              className={cn(
                'flex items-center gap-2 mb-5 px-3 py-1.5 rounded-lg border text-xs font-600 transition-all duration-150',
                flags.has(idx)
                  ? 'border-warning/50 bg-warning/10 text-warning'
                  : 'border-border text-text-muted hover:text-text-secondary hover:border-warning/40'
              )}
            >
              <Flag size={12} fill={flags.has(idx) ? 'currentColor' : 'none'} />
              {flags.has(idx) ? 'Flagged for review' : 'Flag for review'}
            </button>

            <div className="text-[16px] text-text-primary leading-[1.7] mb-4 font-body">
              <MathText text={stem} />
            </div>
            {diagrams.map((caption, i) => <DiagramNotice key={i} caption={caption} />)}

            {/* Fixed A–E letters — mock mode never shuffles (exam fidelity) */}
            <div className="space-y-2">
              {optionEntries.map(([letter, text]) => {
                const isSelected = answers[idx] === letter
                return (
                  <button
                    key={letter}
                    onClick={() => selectAnswer(letter)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
                      isSelected
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border text-text-secondary hover:border-accent/30 hover:text-text-primary hover:bg-surface-raised/60'
                    )}
                  >
                    <span className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-600',
                      isSelected ? 'border-accent bg-accent text-on-accent' : 'border-border text-text-muted'
                    )}>
                      {letter}
                    </span>
                    <span className="text-sm leading-relaxed flex-1"><MathText text={String(text)} /></span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          /* ── Review screen — end of module, before submission ── */
          <div className="max-w-2xl mx-auto p-6">
            <h2 className="font-display font-700 text-xl text-text-primary tracking-[-0.02em] mb-1">Review — {m.name}</h2>
            <p className="text-sm text-text-muted mb-4">
              {answeredCount} answered · {unansweredCount} unanswered · {flags.size} flagged.
              Click any question to return to it. Unanswered questions score zero — there is no negative marking,
              so answer everything.
            </p>
            <div className="flex gap-2 mb-4">
              {[['all', 'All'], ['flagged', `Flagged (${flags.size})`], ['unanswered', `Unanswered (${unansweredCount})`]].map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setReviewFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs font-600 transition-all duration-150',
                    reviewFilter === f
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'border-border text-text-muted hover:text-text-secondary'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Card className="p-4 mb-4">
              <NavGrid
                count={questions.length}
                answers={answers} flags={flags} currentIdx={-1}
                onJump={goTo} filter={reviewFilter}
              />
            </Card>
            <GridLegend />
            <button
              onClick={() => setConfirmEnd(true)}
              className="w-full mt-6 py-3.5 rounded-xl font-600 text-sm bg-accent text-on-accent hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-150"
            >
              End module — submit answers
            </button>
          </div>
        )}
      </div>

      {/* Footer nav — Previous | Navigator | Scratchpad | Next/Review */}
      <footer className="flex-shrink-0 border-t border-border bg-surface">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center gap-2">
          <button
            onClick={() => idx > 0 && goTo(idx - 1)}
            disabled={idx === 0 || view === 'review'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-600 transition-all duration-150',
              idx === 0 || view === 'review'
                ? 'border-border text-text-muted/50 cursor-not-allowed'
                : 'border-border text-text-secondary hover:text-text-primary hover:border-accent/30'
            )}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <button
            onClick={() => setNavOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-600 text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all duration-150"
          >
            <Grid3x3 size={14} /> Navigator
          </button>
          <button
            onClick={() => setPadOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-600 transition-all duration-150',
              padOpen ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:text-text-primary hover:border-accent/30'
            )}
          >
            <PenLine size={14} /> Scratchpad
          </button>
          <div className="flex-1" />
          {view === 'question' && (
            isLast ? (
              <button
                onClick={() => { accrue(); setView('review') }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-600 hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-150"
              >
                Review <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => goTo(idx + 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-600 hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-150"
              >
                Next <ChevronRight size={14} />
              </button>
            )
          )}
        </div>
      </footer>

      {/* Navigator overlay (mid-module jump) */}
      <AnimatePresence>
        {navOpen && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNavOpen(false)}
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          >
            <motion.div
              className="bg-background rounded-2xl w-full max-w-md p-5 border border-border"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Navigator</span>
                <button onClick={() => setNavOpen(false)} className="text-text-muted hover:text-text-secondary" aria-label="Close navigator">
                  <X size={15} />
                </button>
              </div>
              <NavGrid
                count={questions.length}
                answers={answers} flags={flags} currentIdx={idx}
                onJump={goTo} filter="all"
              />
              <div className="mt-4"><GridLegend /></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End-module confirm */}
      <AnimatePresence>
        {confirmEnd && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          >
            <motion.div
              className="bg-background rounded-2xl w-full max-w-sm p-6 border border-border text-center"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="font-display font-700 text-lg text-text-primary mb-2">End {m.short}?</h3>
              <p className="text-sm text-text-secondary mb-1">
                {unansweredCount > 0
                  ? `You have ${unansweredCount} unanswered question${unansweredCount !== 1 ? 's' : ''}.`
                  : 'All questions answered.'}
              </p>
              <p className="text-xs text-text-muted mb-5">You cannot return to this module after submitting.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmEnd(false)}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm font-600 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Keep working
                </button>
                <button
                  onClick={submit}
                  className="flex-1 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-600 hover:opacity-90 transition-all"
                >
                  Submit module
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Scratchpad value={scratchpad} onChange={setScratchpad} open={padOpen} onClose={() => setPadOpen(false)} />
    </div>
  )
}

// ─── Sitting results — per-module cards, never a combined figure ────────────────
function SittingResults({ moduleResults, onDone }) {
  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Sitting complete</h1>
        <p className="text-text-muted text-sm mt-1">
          ESAT reports each module independently on the 1.0–9.0 scale — there is no combined score.
        </p>
      </div>

      {moduleResults.map(r => {
        const m = getModule(r.module)
        const answered = r.results.filter(x => x.outcome !== 'skip').length
        return (
          <Card key={r.module}>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-600" style={{ color: m.color }}>{m.name}</p>
                <p className="text-xs text-text-muted mt-1 tabular">
                  {r.correct}/{r.total} correct · {answered}/{r.total} answered · {formatSecs(r.timeTakenSec)} used
                  {r.autoSubmitted && <span className="text-danger"> · auto-submitted at 0:00</span>}
                </p>
              </div>
              <div className="text-right">
                <div className="font-display font-700 text-4xl tabular tracking-[-0.03em]" style={{ color: m.color }}>
                  {formatProjected(r.projected)}
                </div>
                <p className="text-[10px] font-600 uppercase tracking-widest text-text-muted">projected</p>
              </div>
            </div>
          </Card>
        )
      })}

      <p className="text-xs text-text-muted">
        Missed questions have entered your redemption queue and will resurface in practice.
      </p>
      <button
        onClick={onDone}
        className="w-full py-3.5 rounded-xl font-600 text-sm bg-accent text-on-accent hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-150"
      >
        View mock history
      </button>
    </motion.div>
  )
}

// ─── Main sitting orchestrator ──────────────────────────────────────────────────
export default function MockExam() {
  const navigate = useNavigate()
  const allQuestions = useMemo(() => (Array.isArray(questionsData) ? questionsData : questionsData.questions || []), [])
  const [chosenModuleIds] = useLocalStorage('esat_modules', [])
  const [phase, setPhase] = useState('setup')        // setup | intro | exam | results
  const [sitting, setSitting] = useState(null)       // { id, moduleIds, questionsByModule }
  const [moduleIdx, setModuleIdx] = useState(0)
  const [moduleResults, setModuleResults] = useState([])
  const [scratchpad, setScratchpad] = useState('')

  const startSitting = (moduleIds) => {
    const questionsByModule = {}
    for (const id of moduleIds) {
      questionsByModule[id] = shuffle(questionsForModules(allQuestions, [id])).slice(0, MODULE_QUESTIONS)
    }
    setSitting({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, moduleIds, questionsByModule })
    setModuleIdx(0)
    setModuleResults([])
    setScratchpad('')
    setPhase('intro')
  }

  const handleModuleSubmit = (answers, flags, timeSpent, secondsUsed) => {
    const moduleId = sitting.moduleIds[moduleIdx]
    const questions = sitting.questionsByModule[moduleId]
    const autoSubmitted = secondsUsed >= MODULE_SECONDS

    const results = questions.map((q, i) => {
      const selected = answers[i] ?? null
      return {
        qId: q.id,
        module: q.module,
        topicId: topicIdForQuestion(q),
        difficulty: q.difficulty,
        outcome: selected == null ? 'skip' : selected === q.answer ? 'correct' : 'wrong',
        timeSec: Math.round(timeSpent[i] || 0),
        selected,
        flagged: flags.has(i),
        errorTag: null,
      }
    })
    const correct = results.filter(r => r.outcome === 'correct').length
    const projected = projectScore(correct, questions.length)
    const record = {
      module: moduleId, correct, total: questions.length,
      projected, timeTakenSec: secondsUsed, autoSubmitted, results,
    }

    // Per-module ledger event — the Build Prompt's mock_logged shape, with the
    // per-question results[] (incl. timeSec) that Phase 5 insights consume.
    logEvent('mock_logged', {
      date: isoDate(),
      sittingId: sitting.id,
      module: moduleId,
      score: correct,
      total: questions.length,
      projected,
      timeTaken: secondsUsed,
      autoSubmitted,
      results,
    })
    enqueueMisses(results)

    const today = isoDate()
    updateStoredValue('esat_habits', habits => {
      const entry = habits[today] || { date: today }
      return {
        ...habits,
        [today]: {
          ...entry, date: today,
          hours: Math.round(((entry.hours || 0) + secondsUsed / 3600) * 100) / 100,
          questionsCompleted: (entry.questionsCompleted || 0) + questions.length,
          updatedAt: new Date().toISOString(),
        },
      }
    }, {})

    const nextResults = [...moduleResults, record]
    setModuleResults(nextResults)

    if (moduleIdx + 1 < sitting.moduleIds.length) {
      setModuleIdx(i => i + 1)
      setPhase('intro')
    } else {
      // Sitting record for the mock history view — per-module scores only.
      updateStoredValue('esat_mock_sittings', sittings => [
        ...sittings,
        {
          id: sitting.id,
          date: isoDate(),
          ts: new Date().toISOString(),
          modules: nextResults.map(({ module, correct: c, total, projected: p, timeTakenSec, autoSubmitted: auto }) =>
            ({ module, correct: c, total, projected: p, timeTakenSec, autoSubmitted: auto })),
        },
      ], [])
      setScratchpad('')
      setPhase('results')
    }
  }

  const currentModuleId = sitting?.moduleIds[moduleIdx]

  return (
    <AnimatePresence mode="wait">
      {phase === 'setup' && (
        <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <MockSetup allQuestions={allQuestions} chosenModuleIds={chosenModuleIds} onStart={startSitting} />
        </motion.div>
      )}
      {phase === 'intro' && (
        <motion.div key={`intro-${moduleIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModuleIntro
            moduleId={currentModuleId}
            index={moduleIdx}
            total={sitting.moduleIds.length}
            questionCount={sitting.questionsByModule[currentModuleId].length}
            onBegin={() => setPhase('exam')}
          />
        </motion.div>
      )}
      {phase === 'exam' && (
        <ExamModule
          key={`exam-${moduleIdx}`}
          moduleId={currentModuleId}
          questions={sitting.questionsByModule[currentModuleId]}
          onSubmit={handleModuleSubmit}
          scratchpad={scratchpad}
          setScratchpad={setScratchpad}
        />
      )}
      {phase === 'results' && (
        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <SittingResults moduleResults={moduleResults} onDone={() => navigate('/mocks')} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
