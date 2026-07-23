import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, RotateCcw, ChevronRight, Check, X, Clock, Zap } from 'lucide-react'
import { Card } from '../components/ui/Card'
import questionsData from '../data/questions.json'
import { cn, isoDate, formatSecs } from '../lib/utils'
import {
  MODULES,
  topicIdForQuestion,
  questionsForTopics,
  questionsForModules,
  countByTopic,
  getTopicName,
  getModuleColor,
  moduleForTopic,
  getModule,
} from '../lib/moduleMap'
import { logEvent } from '../lib/eventLog'
import { enqueueMisses, enqueueSkips } from '../lib/reviewQueue'
import { ERROR_TAGS } from '../lib/errorTags'
import { updateStoredValue, useLocalStorage } from '../hooks/useLocalStorage'
import { MathText, InlineMath } from '../components/ui/TechniqueRenderer'
import { QuestionExplanation, hasExplanation } from '../components/questions/QuestionExplanation'
import { parseDiagrams } from '../lib/diagrams'
import { DiagramFigure } from '../components/ui/Diagram'
import { OriginBadge } from '../components/ui/Origin'
import { selectAdaptive } from '../lib/adaptive'
import { studentQuestions } from '../lib/studentBank'
import { getEvents } from '../lib/eventLog'

// ─── Options ───────────────────────────────────────────────────────────────────
const TIMER_OPTIONS = [
  { label: 'No limit', value: 0 },
  { label: '2:30', value: 150 },
  { label: '2:00', value: 120 },
  { label: '1:29 (ESAT pace)', value: 89 },
  { label: '1:00', value: 60 },
  { label: '0:45', value: 45 },
]

const QCOUNT_OPTIONS = [5, 10, 20, 27]      // 27 = one real ESAT module's worth
const DIFF_OPTIONS = [1, 2, 3, 4, 5]

// ─── Shuffle ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Timer ring ─────────────────────────────────────────────────────────────────
function TimerRing({ seconds, totalSeconds }) {
  if (!totalSeconds) return null
  const pct = seconds / totalSeconds
  const r = 20, circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  const color = pct > 0.5 ? 'var(--accent)' : pct > 0.25 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgb(var(--c-border-subtle))" strokeWidth="3" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="absolute text-xs font-mono font-600 tabular" style={{ color }}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </div>
  )
}

// ─── Setup screen ───────────────────────────────────────────────────────────────
// initialConfig deep-links from Notes' "Practice this topic" (location.state):
// { topicIds, qCount, timerSecs } — seeds the setup screen, doesn't lock it.
function SetupScreen({ onStart, onStartSmart, allQuestions, chosenModuleIds, initialConfig, savedSession, onResume, onDiscardSession }) {
  const counts = useMemo(() => countByTopic(allQuestions), [allQuestions])
  // Only modules that actually have questions are selectable.
  const availableModules = useMemo(
    () => MODULES.filter(m => m.topics.some(t => counts[t.id] > 0)),
    [counts]
  )
  const defaultModules = useMemo(() => {
    const withData = availableModules.map(m => m.id)
    const chosen = chosenModuleIds.filter(id => withData.includes(id))
    return chosen.length > 0 ? chosen : withData
  }, [availableModules, chosenModuleIds])

  const [selectedModules, setSelectedModules] = useState(() => {
    if (initialConfig?.moduleIds?.length) {
      const allowed = new Set(availableModules.map(m => m.id))
      const fromState = initialConfig.moduleIds.filter(id => allowed.has(id))
      if (fromState.length) return fromState
    }
    if (!initialConfig?.topicIds?.length) return defaultModules
    const modIds = new Set()
    for (const t of initialConfig.topicIds) {
      const mod = moduleForTopic(t)
      if (mod) modIds.add(mod)
    }
    return modIds.size > 0 ? [...modIds] : defaultModules
  })
  const topicsForSelectedModules = useMemo(
    () => availableModules
      .filter(m => selectedModules.includes(m.id))
      .flatMap(m => m.topics.filter(t => counts[t.id] > 0).map(t => t.id)),
    [availableModules, selectedModules, counts]
  )
  const [selectedTopics, setSelectedTopics] = useState(() =>
    initialConfig?.topicIds?.length ? initialConfig.topicIds : topicsForSelectedModules
  )
  const [selectedDiffs, setSelectedDiffs] = useState(DIFF_OPTIONS)
  const [timerSecs, setTimerSecs] = useState(() => initialConfig?.timerSecs ?? 89)
  const [qCount, setQCount] = useState(() => initialConfig?.qCount || 10)

  // When the module selection changes, re-seed topic selection to that scope so a
  // deselected module never leaves orphaned topics selected.
  const toggleModule = (id) => {
    setSelectedModules(prevMods => {
      const nextMods = prevMods.includes(id) ? prevMods.filter(x => x !== id) : [...prevMods, id]
      const allowed = new Set(
        availableModules.filter(m => nextMods.includes(m.id))
          .flatMap(m => m.topics.filter(t => counts[t.id] > 0).map(t => t.id))
      )
      setSelectedTopics(prevTopics => {
        const kept = prevTopics.filter(t => allowed.has(t))
        // Newly-added module → auto-select all its topics.
        const added = nextMods.filter(m => !prevMods.includes(m))
        const fresh = availableModules
          .filter(m => added.includes(m.id))
          .flatMap(m => m.topics.filter(t => counts[t.id] > 0).map(t => t.id))
        return [...new Set([...kept, ...fresh])]
      })
      return nextMods
    })
  }

  const toggleTopic = id => setSelectedTopics(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleDiff = d => setSelectedDiffs(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])
  const toggleModuleTopics = (moduleId) => {
    const ids = availableModules.find(m => m.id === moduleId)
      ?.topics.filter(t => counts[t.id] > 0).map(t => t.id) || []
    const allSelected = ids.every(id => selectedTopics.includes(id))
    setSelectedTopics(p => allSelected ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])])
  }

  const available = useMemo(() => {
    let pool = questionsForTopics(allQuestions, selectedTopics)
    if (selectedModules.length) pool = questionsForModules(pool, selectedModules)
    return pool.filter(q => selectedDiffs.includes(q.difficulty))
  }, [allQuestions, selectedTopics, selectedModules, selectedDiffs])

  const actual = Math.min(qCount, available.length)

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-5"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Practice Setup</h1>
        <p className="text-text-muted text-sm mt-1">{allQuestions.length} questions in bank · {available.length} match your filters</p>
      </div>

      {savedSession?.questionIds?.length > 0 && (
        <Card>
          <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-600 text-text-primary">
                Resume unfinished practice
                {(() => {
                  const mods = savedSession.config?.moduleIds || []
                  const labels = mods.map(id => getModule(id)?.short).filter(Boolean)
                  return labels.length ? ` — ${labels.join(', ')}` : ''
                })()}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Q{(savedSession.idx ?? 0) + 1} of {savedSession.questionIds.length}
                {savedSession.savedAt ? ` · saved ${new Date(savedSession.savedAt).toLocaleString('en-GB')}` : ''}
                {' · '}continues the saved session (not your current filters)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onResume}
                className="px-3 py-2 rounded-lg bg-accent text-on-accent text-xs font-600 hover:opacity-90 transition-opacity"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onDiscardSession}
                className="px-3 py-2 rounded-lg border border-border text-xs font-600 text-text-muted hover:text-text-secondary transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-600 text-text-primary flex items-center gap-2">
              <Zap size={14} className="text-accent" /> Smart mix
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Picks from your selected topics using weak areas, freshness, and difficulty fit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => available.length > 0 && onStartSmart({
              moduleIds: selectedModules,
              topicIds: selectedTopics,
              diffs: selectedDiffs,
              timerSecs,
              qCount: actual,
            })}
            disabled={available.length === 0}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-600 transition-opacity',
              available.length > 0
                ? 'bg-accent/15 text-accent border border-accent/30 hover:opacity-90'
                : 'border border-border text-text-muted cursor-not-allowed',
            )}
          >
            Start smart · {actual}
          </button>
        </div>
      </Card>

      {/* Modules — the level above topics */}
      <Card>
        <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
          <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Modules</span>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {availableModules.map(m => {
            const sel = selectedModules.includes(m.id)
            const total = m.topics.reduce((s, t) => s + (counts[t.id] || 0), 0)
            return (
              <button
                key={m.id}
                onClick={() => toggleModule(m.id)}
                className={cn(
                  'px-3 py-2 rounded-xl border text-sm font-600 transition-all duration-150',
                  sel ? '' : 'border-border text-text-muted hover:text-text-secondary'
                )}
                style={sel ? {
                  color: m.color,
                  backgroundColor: `color-mix(in srgb, ${m.color} 10%, transparent)`,
                  borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`,
                } : {}}
              >
                {m.short} <span className="opacity-70 font-500">· {total}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Topics within selected modules */}
      <Card>
        <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
          <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Topics</span>
        </div>
        <div className="p-4 space-y-4">
          {availableModules.filter(m => selectedModules.includes(m.id)).map(m => {
            const selectable = m.topics.filter(t => counts[t.id] > 0)
            const allSel = selectable.length > 0 && selectable.every(t => selectedTopics.includes(t.id))
            return (
              <div key={m.id}>
                <button onClick={() => toggleModuleTopics(m.id)} className="flex items-center gap-2 mb-2 group">
                  <div className={cn(
                    'w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-150',
                    allSel ? 'border-transparent' : 'border-border bg-transparent'
                  )} style={allSel ? { backgroundColor: m.color } : {}}>
                    {allSel && <Check size={9} className="text-background" strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-600" style={{ color: m.color }}>{m.name}</span>
                </button>
                <div className="pl-5 flex flex-wrap gap-2">
                  {selectable.map(topic => {
                    const count = counts[topic.id] || 0
                    const sel = selectedTopics.includes(topic.id)
                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg border text-[11px] font-500 transition-all duration-150',
                          sel ? 'font-600' : 'border-border text-text-muted hover:text-text-secondary'
                        )}
                        style={sel ? {
                          color: m.color,
                          backgroundColor: `color-mix(in srgb, ${m.color} 10%, transparent)`,
                          borderColor: `color-mix(in srgb, ${m.color} 38%, transparent)`,
                        } : {}}
                      >
                        {topic.name} <span className="opacity-70">· {count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {selectedModules.length === 0 && (
            <p className="text-sm text-text-muted">Select a module above to choose topics.</p>
          )}
        </div>
      </Card>

      {/* Difficulty / Timer / Count */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
            <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Difficulty</span>
          </div>
          <div className="p-4 flex gap-2">
            {DIFF_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => toggleDiff(d)}
                className={cn(
                  'flex-1 py-2 rounded-lg border text-xs font-600 transition-all duration-150',
                  selectedDiffs.includes(d)
                    ? 'bg-accent/10 border-accent/40 text-accent'
                    : 'border-border text-text-muted hover:text-text-secondary'
                )}
              >
                {d}★
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
            <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Time / Question</span>
          </div>
          <div className="p-4">
            <select
              value={timerSecs}
              onChange={e => setTimerSecs(Number(e.target.value))}
              className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            >
              {TIMER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </Card>

        <Card>
          <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
            <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Questions</span>
          </div>
          <div className="p-4 flex gap-2">
            {QCOUNT_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setQCount(n)}
                className={cn(
                  'flex-1 py-2 rounded-lg border text-xs font-600 transition-all duration-150',
                  qCount === n
                    ? 'bg-accent/10 border-accent/40 text-accent'
                    : 'border-border text-text-muted hover:text-text-secondary'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Start */}
      <div className="sticky bottom-0 -mx-6 px-6 pb-6 pt-3 bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={() => available.length > 0 && onStart({
            moduleIds: selectedModules, topicIds: selectedTopics, diffs: selectedDiffs, timerSecs, qCount: actual,
          })}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-600 text-base transition-all duration-200',
            available.length > 0
              ? 'bg-accent text-on-accent hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30'
              : 'bg-surface-raised text-text-muted cursor-not-allowed border border-border'
          )}
        >
          <Play size={16} fill="currentColor" />
          {available.length > 0 ? `Start — ${actual} Question${actual !== 1 ? 's' : ''}` : 'No questions match — adjust filters'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Quiz screen ────────────────────────────────────────────────────────────────
function QuizScreen({ questions, timerSecs, onFinish, onProgress, initialIdx = 0, initialResults = [] }) {
  const [idx, setIdx] = useState(initialIdx)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timerSecs || null)
  const [timedOut, setTimedOut] = useState(false)
  const [errorTag, setErrorTag] = useState(null)
  const [results, setResults] = useState(initialResults)
  const intervalRef = useRef(null)
  const qStartRef = useRef(0)
  const elapsedRef = useRef(null)

  const q = questions[idx]
  const isLast = idx === questions.length - 1
  const { stem, diagrams } = useMemo(() => parseDiagrams(q?.question, q?.id), [q])
  const hintText = useMemo(() => {
    if (q?.hint && String(q.hint).trim()) return String(q.hint).trim()
    const label = q?.subtopic || getTopicName(topicIdForQuestion(q))
    return label ? `Think: ${label}` : null
  }, [q])

  // Options shuffled + re-lettered: the stored answer key skews toward B/C, so
  // fixed positions would be guessable (anti-memorisation, carried from TMUA).
  const displayOptions = useMemo(() => shuffle(Object.entries(q?.options || {})), [q])

  useEffect(() => {
    qStartRef.current = Date.now()
    elapsedRef.current = null
    setHintOpen(false)
  }, [idx])

  const handleReveal = useCallback((fromTimeout) => {
    clearInterval(intervalRef.current)
    elapsedRef.current = Math.round((Date.now() - qStartRef.current) / 1000)
    setTimedOut(fromTimeout === 'timeout')
    setRevealed(true)
  }, [])

  useEffect(() => {
    if (!timerSecs) return
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current); handleReveal('timeout'); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [idx, timerSecs, handleReveal])

  const advance = (result) => {
    const newResults = [...results, result]
    setResults(newResults)
    if (isLast) {
      onFinish(newResults)
    } else {
      const nextIdx = idx + 1
      setIdx(nextIdx)
      setSelected(null)
      setRevealed(false)
      setTimedOut(false)
      setErrorTag(null)
      setTimeLeft(timerSecs || null)
      onProgress?.(nextIdx, newResults)
    }
  }

  const buildResult = (outcome, timeSec) => ({
    q,
    qId: q.id,
    module: q.module,
    topicId: topicIdForQuestion(q),
    difficulty: q.difficulty,
    outcome,
    timeSec: timeSec ?? 0,
    selected,
    errorTag: outcome === 'wrong' || outcome === 'timeout' ? errorTag : null,
  })

  const handleSkip = () => {
    clearInterval(intervalRef.current)
    advance(buildResult('skip', Math.round((Date.now() - qStartRef.current) / 1000)))
  }

  const handleNext = () => {
    const outcome = timedOut ? 'timeout'
      : selected === q.answer ? 'correct'
      : selected ? 'wrong'
      : 'skip'
    advance(buildResult(outcome, elapsedRef.current ?? 0))
  }

  if (!q) return null
  const topicColor = getModuleColor(q.module)

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Progress + timer */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-text-muted tabular">Q{idx + 1} / {questions.length}</span>
            <span className="text-[11px] font-600" style={{ color: topicColor }}>
              {getTopicName(topicIdForQuestion(q))}
            </span>
          </div>
          <div className="h-1 bg-surface-raised rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(idx / questions.length) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
        {timerSecs > 0 && <TimerRing seconds={timeLeft ?? timerSecs} totalSeconds={timerSecs} />}
      </div>

      {/* Difficulty */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
              backgroundColor: i < (q.difficulty || 1) ? 'var(--warning)' : 'rgb(var(--c-border))'
            }} />
          ))}
        </div>
        <span className="text-[11px] text-text-muted">Difficulty {q.difficulty}/5</span>
        <OriginBadge origin={q.origin} source={q.source} className="ml-auto" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Question stem (KaTeX) */}
          <div className="text-[16px] text-text-primary leading-[1.7] mb-4 font-body">
            <MathText text={stem} />
          </div>

          {!revealed && hintText && (
            <div className="mb-4">
              {!hintOpen ? (
                <button
                  type="button"
                  onClick={() => setHintOpen(true)}
                  className="text-xs font-600 text-warning/80 hover:text-warning transition-colors"
                >
                  Hint
                </button>
              ) : (
                <div className="rounded-xl border border-warning/25 bg-warning/5 px-3 py-2">
                  <p className="text-[11px] font-600 uppercase tracking-widest text-warning/70 mb-1">Hint</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    <MathText text={hintText} />
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Figures from the source paper — never rendered as stem text */}
          {diagrams.map((d, i) => <DiagramFigure key={i} caption={d.caption} src={d.src} eager />)}

          {/* Options */}
          <div className="space-y-2 mb-5">
            {displayOptions.map(([key, text], i) => {
              const letter = String.fromCharCode(65 + i)
              const isCorrect = key === q.answer
              const isSelected = selected === key
              let style = 'border-border text-text-secondary hover:border-accent/30 hover:text-text-primary hover:bg-surface-raised/60'
              if (revealed) {
                if (isCorrect) style = 'border-success/50 bg-success/10 text-success'
                else if (isSelected && !isCorrect) style = 'border-danger/40 bg-danger/5 text-danger/80'
                else style = 'border-border text-text-muted opacity-50'
              } else if (isSelected) {
                style = 'border-accent/50 bg-accent/10 text-accent'
              }
              return (
                <button
                  key={key}
                  onClick={() => !revealed && setSelected(key)}
                  disabled={revealed}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
                    !revealed && 'hover:-translate-y-px',
                    style
                  )}
                >
                  <span className="text-xs font-mono font-600 w-4 flex-shrink-0 mt-1 tabular">{letter}</span>
                  <span className="text-sm leading-relaxed flex-1"><InlineMath text={String(text)} /></span>
                  {revealed && isCorrect && <Check size={14} className="text-success flex-shrink-0 mt-1" />}
                  {revealed && isSelected && !isCorrect && <X size={14} className="text-danger flex-shrink-0 mt-1" />}
                </button>
              )
            })}
          </div>

          {revealed && timedOut && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-danger/5 border border-danger/20 rounded-xl mb-4">
              <Clock size={13} className="text-danger" />
              <p className="text-xs text-danger/90">Time ran out — counted as a miss.</p>
            </div>
          )}

          {/* Error taxonomy — one-tap "why did I miss it?". Skippable, never blocks
              Next. The tag lands in the ledger and drives the per-topic insight. */}
          {revealed && (timedOut || (selected && selected !== q.answer)) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mb-4"
            >
              <p className="text-[11px] font-600 uppercase tracking-widest text-text-muted mb-2">Why did you miss it? <span className="font-400 normal-case tracking-normal text-text-muted/70">— optional</span></p>
              <div className="flex flex-wrap gap-2">
                {ERROR_TAGS.map(t => {
                  const sel = errorTag === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setErrorTag(sel ? null : t.id)}
                      title={t.hint}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-xs font-600 transition-all duration-150',
                        sel
                          ? 'bg-accent/10 border-accent/40 text-accent'
                          : 'border-border text-text-muted hover:text-text-secondary hover:border-accent/30'
                      )}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {revealed && hasExplanation(q) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="px-4 py-3 bg-accent/5 border border-accent/15 rounded-xl mb-4"
            >
              <QuestionExplanation question={q} />
            </motion.div>
          )}

          {!revealed ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReveal()}
                disabled={!selected && timerSecs === 0}
                className={cn(
                  'flex-1 py-3 rounded-xl font-600 text-sm transition-all duration-150',
                  selected
                    ? 'bg-accent text-on-accent hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30'
                    : 'bg-surface-raised text-text-muted border border-border hover:border-accent/30 hover:text-text-secondary'
                )}
              >
                {selected ? 'Check Answer' : 'Reveal Answer'}
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-3 rounded-xl border border-border text-text-muted text-sm hover:text-text-secondary transition-colors duration-150"
              >
                Skip
              </button>
            </div>
          ) : (
            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-on-accent rounded-xl font-600 text-sm hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-150"
            >
              {isLast ? 'See Results' : 'Next Question'}
              <ChevronRight size={14} />
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Results screen ─────────────────────────────────────────────────────────────
const OUTCOME_LABEL = {
  wrong: { text: 'Wrong', color: 'var(--danger)' },
  timeout: { text: 'Timed out', color: 'var(--warning)' },
  skip: { text: 'Skipped', color: 'var(--muted)' },
}

function ResultsModal({ results, onRetry, onNewQuiz }) {
  const [tab, setTab] = useState('overview')

  const correct = results.filter(r => r.outcome === 'correct').length
  const total = results.length
  const pct = Math.round((correct / total) * 100)
  const missed = results.filter(r => r.outcome !== 'correct')
  const totalTimeSec = results.reduce((s, r) => s + (r.timeSec || 0), 0)
  const avgTime = total > 0 ? totalTimeSec / total : 0

  const band = pct >= 80 ? { label: 'Excellent', color: 'var(--success)' }
    : pct >= 60 ? { label: 'Good', color: 'var(--accent)' }
    : pct >= 40 ? { label: 'Keep going', color: 'var(--warning)' }
    : { label: 'Needs work', color: 'var(--danger)' }

  const byTopic = {}
  results.forEach(r => {
    const key = r.topicId || 'unknown'
    if (!byTopic[key]) byTopic[key] = { correct: 0, total: 0, name: getTopicName(key), color: getModuleColor(r.module) }
    byTopic[key].total++
    if (r.outcome === 'correct') byTopic[key].correct++
  })
  const topicList = Object.entries(byTopic).sort((a, b) => b[1].total - a[1].total)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onNewQuiz}
      style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
    >
      <motion.div
        className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-border">
          <div className="px-6 py-4 text-center">
            <div className="font-display font-700 text-5xl tabular tracking-[-0.03em] mb-1" style={{ color: band.color }}>
              {correct}/{total}
            </div>
            <div className="text-sm text-text-muted">{pct}% · {band.label}</div>
          </div>
          <div className="flex border-t border-border">
            <button
              onClick={() => setTab('overview')}
              className={cn('flex-1 py-3 px-4 text-sm font-600 border-b-2 transition-colors',
                tab === 'overview' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary')}
            >
              Overview
            </button>
            {missed.length > 0 && (
              <button
                onClick={() => setTab('mistakes')}
                className={cn('flex-1 py-3 px-4 text-sm font-600 border-b-2 transition-colors',
                  tab === 'mistakes' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary')}
              >
                {missed.length} Mistakes
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {tab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-surface border border-border/50">
                    <div className="text-2xl font-700 text-success">{correct}</div>
                    <div className="text-xs text-text-muted mt-1">Correct</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-surface border border-border/50">
                    <div className="text-2xl font-700 text-danger">{missed.length}</div>
                    <div className="text-xs text-text-muted mt-1">Missed</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-surface border border-border/50">
                    <div className="text-2xl font-700 text-text-secondary tabular">{formatSecs(avgTime)}</div>
                    <div className="text-xs text-text-muted mt-1">Avg/Question</div>
                  </div>
                </div>

                {topicList.length > 0 && (
                  <div>
                    <p className="text-xs font-600 uppercase tracking-widest text-text-muted mb-3">By Topic</p>
                    <div className="space-y-2">
                      {topicList.map(([topicId, s]) => {
                        const acc = Math.round((s.correct / s.total) * 100)
                        return (
                          <div key={topicId}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-500">{s.name}</span>
                              <span className="text-xs text-text-muted tabular">{s.correct}/{s.total} ({acc}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-border overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                initial={{ width: 0 }} animate={{ width: `${acc}%` }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                style={{ background: acc >= 80 ? 'var(--success)' : acc >= 60 ? 'var(--accent)' : 'var(--warning)' }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'mistakes' && (
              <motion.div key="mistakes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {missed.map((r, i) => {
                  const o = OUTCOME_LABEL[r.outcome] || OUTCOME_LABEL.wrong
                  const { stem, diagrams } = parseDiagrams(r.q.question, r.q.id)
                  const gaveAnswer = r.selected && r.selected !== r.q.answer
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-border/60 bg-surface overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                        <span className="text-xs font-600 tabular text-text-muted">Q{i + 1}</span>
                        <span className="text-xs font-500" style={{ color: getModuleColor(r.module) }}>{getTopicName(r.topicId)}</span>
                        <OriginBadge origin={r.q.origin} source={r.q.source} />
                        <span className="ml-auto px-2 py-0.5 rounded text-xs font-600" style={{ color: o.color, background: `${o.color}15` }}>{o.text}</span>
                      </div>

                      {/* Question stem */}
                      <div className="px-4 text-[15px] text-text-primary leading-relaxed mb-3"><MathText text={stem} /></div>
                      <div className="px-4">{diagrams.map((d, j) => <DiagramFigure key={j} caption={d.caption} src={d.src} />)}</div>

                      {/* Answer comparison — each on its own labelled row */}
                      <div className="px-4 space-y-2">
                        {gaveAnswer && (
                          <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-danger/5 border border-danger/20">
                            <X size={15} className="text-danger mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-600 uppercase tracking-widest text-danger/70 mb-0.5">Your answer</p>
                              <div className="text-sm text-text-primary"><InlineMath text={String(r.q.options?.[r.selected] ?? '')} /></div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-success/5 border border-success/20">
                          <Check size={15} className="text-success mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-600 uppercase tracking-widest text-success/70 mb-0.5">Correct answer</p>
                            <div className="text-sm text-text-primary"><InlineMath text={String(r.q.options?.[r.q.answer] ?? '')} /></div>
                          </div>
                        </div>
                        {r.outcome === 'skip' && !gaveAnswer && (
                          <p className="text-xs text-text-muted px-1">You skipped this one.</p>
                        )}
                        {r.outcome === 'timeout' && !gaveAnswer && (
                          <p className="text-xs text-text-muted px-1">Time ran out before you answered.</p>
                        )}
                      </div>

                      {hasExplanation(r.q) && (
                        <div className="mt-3 px-4 py-3 border-t border-border-subtle bg-accent/[0.03]">
                          <QuestionExplanation question={r.q} />
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-border p-6 flex gap-3 bg-surface">
          <button
            onClick={onRetry}
            className="flex-1 py-2.5 px-4 rounded-lg border border-border text-text-secondary font-600 text-sm hover:text-text-primary hover:border-accent/30 transition-colors"
          >
            <RotateCcw size={13} className="inline mr-2" />Retry same
          </button>
          <button
            onClick={onNewQuiz}
            className="flex-1 py-2.5 px-4 rounded-lg bg-accent text-on-accent font-600 text-sm hover:opacity-90 transition-all"
          >
            New session
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────
const PRACTICE_SESSION_KEY = 'esat_practice_session'

function stripResult(r) {
  return {
    qId: r.qId,
    module: r.module,
    topicId: r.topicId,
    difficulty: r.difficulty,
    outcome: r.outcome,
    timeSec: r.timeSec,
    selected: r.selected,
    errorTag: r.errorTag ?? null,
  }
}

export default function QuestionBank() {
  const location = useLocation()
  const allQuestions = useMemo(
    () => studentQuestions(Array.isArray(questionsData) ? questionsData : questionsData.questions || []),
    [],
  )
  const questionById = useMemo(() => new Map(allQuestions.map(q => [q.id, q])), [allQuestions])
  const [chosenModuleIds] = useLocalStorage('esat_modules', [])
  const [savedSession, setSavedSession] = useLocalStorage(PRACTICE_SESSION_KEY, null)
  const [screen, setScreen] = useState('setup')
  const [quizQuestions, setQuizQuestions] = useState([])
  const [quizConfig, setQuizConfig] = useState(null)
  const [quizResults, setQuizResults] = useState([])
  const [resumeIdx, setResumeIdx] = useState(0)
  const [resumeResults, setResumeResults] = useState([])

  const persistSession = useCallback((config, questions, idx, results) => {
    const payload = {
      config,
      questionIds: questions.map(q => q.id),
      idx,
      results: results.map(stripResult),
      savedAt: new Date().toISOString(),
    }
    setSavedSession(payload)
  }, [setSavedSession])

  const clearSession = useCallback(() => {
    setSavedSession(null)
  }, [setSavedSession])

  const startDrill = useCallback((config) => {
    let pool = questionsForTopics(allQuestions, config.topicIds)
    if (config.moduleIds?.length) pool = questionsForModules(pool, config.moduleIds)
    if (config.diffs) pool = pool.filter(q => config.diffs.includes(q.difficulty))
    const picked = shuffle(pool).slice(0, config.qCount || 10)
    if (picked.length === 0) return
    setQuizQuestions(picked)
    setQuizConfig(config)
    setResumeIdx(0)
    setResumeResults([])
    persistSession(config, picked, 0, [])
    setScreen('quiz')
  }, [allQuestions, persistSession])

  const startSmart = useCallback((config) => {
    let pool = questionsForTopics(allQuestions, config.topicIds)
    if (config.moduleIds?.length) pool = questionsForModules(pool, config.moduleIds)
    if (config.diffs) pool = pool.filter(q => config.diffs.includes(q.difficulty))
    const picked = selectAdaptive(pool, getEvents(), config.qCount || 10)
    if (picked.length === 0) return
    const smartConfig = { ...config, mode: 'smart' }
    setQuizQuestions(picked)
    setQuizConfig(smartConfig)
    setResumeIdx(0)
    setResumeResults([])
    persistSession(smartConfig, picked, 0, [])
    setScreen('quiz')
  }, [allQuestions, persistSession])

  const handleResume = useCallback(() => {
    if (!savedSession?.questionIds?.length) return
    const qs = savedSession.questionIds.map(id => questionById.get(id)).filter(Boolean)
    if (qs.length === 0) {
      clearSession()
      return
    }
    setQuizQuestions(qs)
    setQuizConfig(savedSession.config || {})
    setResumeIdx(Math.min(savedSession.idx ?? 0, qs.length - 1))
    setResumeResults((savedSession.results || []).map(r => ({
      ...r,
      q: questionById.get(r.qId),
    })))
    setScreen('quiz')
  }, [savedSession, questionById, clearSession])

  const handleProgress = useCallback((idx, results) => {
    if (!quizConfig || quizQuestions.length === 0) return
    persistSession(quizConfig, quizQuestions, idx, results)
  }, [quizConfig, quizQuestions, persistSession])

  const handleFinish = (results) => {
    const totalTimeSec = results.reduce((s, r) => s + (r.timeSec || 0), 0)
    const correct = results.filter(r => r.outcome === 'correct').length
    const stripped = results.map(stripResult)

    enqueueMisses(stripped)
    enqueueSkips(stripped)

    logEvent('quiz_completed', {
      config: {
        moduleIds: quizConfig?.moduleIds,
        topicIds: quizConfig?.topicIds,
        timerSecs: quizConfig?.timerSecs ?? null,
        qCount: results.length,
      },
      score: correct,
      total: results.length,
      totalTimeSec,
      results: stripped,
    })

    const today = isoDate()
    updateStoredValue('esat_habits', habits => {
      const entry = habits[today] || { date: today }
      return {
        ...habits,
        [today]: {
          ...entry, date: today,
          hours: Math.round(((entry.hours || 0) + totalTimeSec / 3600) * 100) / 100,
          questionsCompleted: (entry.questionsCompleted || 0) + results.length,
          updatedAt: new Date().toISOString(),
        },
      }
    }, {})

    updateStoredValue('esat_topic_stats', stats => {
      const next = { ...stats }
      stripped.forEach(r => {
        const key = r.topicId || 'unknown'
        const prev = next[key] || { correct: 0, total: 0 }
        next[key] = { correct: prev.correct + (r.outcome === 'correct' ? 1 : 0), total: prev.total + 1 }
      })
      return next
    }, {})

    clearSession()
    setQuizResults(results)
    setScreen('results')
  }

  const handleRetry = () => {
    setQuizQuestions(qs => {
      const next = shuffle(qs)
      if (quizConfig) persistSession(quizConfig, next, 0, [])
      return next
    })
    setResumeIdx(0)
    setResumeResults([])
    setScreen('quiz')
  }

  return (
    <motion.div className="min-h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <AnimatePresence mode="wait">
        {screen === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SetupScreen
              onStart={startDrill}
              onStartSmart={startSmart}
              allQuestions={allQuestions}
              chosenModuleIds={chosenModuleIds}
              initialConfig={location.state}
              savedSession={savedSession}
              onResume={handleResume}
              onDiscardSession={clearSession}
            />
          </motion.div>
        )}
        {screen === 'quiz' && (
          <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <QuizScreen
              questions={quizQuestions}
              timerSecs={quizConfig?.timerSecs || 0}
              onFinish={handleFinish}
              onProgress={handleProgress}
              initialIdx={resumeIdx}
              initialResults={resumeResults}
            />
          </motion.div>
        )}
        {screen === 'results' && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ResultsModal results={quizResults} onRetry={handleRetry} onNewQuiz={() => { clearSession(); setScreen('setup') }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
