import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight, Pencil, Zap } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useEvents } from '../lib/eventLog'
import { useReviewQueue, getDueEntries } from '../lib/reviewQueue'
import { getModule } from '../lib/moduleMap'
import { formatProjected } from '../lib/mockScore'
import { getModuleModel, getModuleForecast, getModuleMocks } from '../lib/studentModel'
import { ThreeStateBar, ThreeStateLegend } from '../components/ui/ThreeState'
import { cn, isoDate } from '../lib/utils'

const DEFAULT_EXAM_DATE = '2026-10-14'
const OPTIONAL_MODULE_IDS = ['maths2', 'physics', 'chemistry', 'biology']

// ─── Exam date + countdown ──────────────────────────────────────────────────────
function daysUntil(examDate) {
  return Math.max(0, Math.ceil((new Date(examDate + 'T09:00:00') - Date.now()) / 86400000))
}

function ExamCountdown({ examDate, setExamDate }) {
  const [editing, setEditing] = useState(false)
  const daysLeft = useMemo(() => daysUntil(examDate), [examDate])
  return (
    <Card className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <CalendarClock size={18} className="text-accent" />
        <div>
          <p className="text-sm font-600 text-text-primary tabular">
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} until ESAT
          </p>
          <p className="text-[11px] text-text-muted tabular">
            {new Date(examDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
      {editing ? (
        <input
          type="date"
          value={examDate}
          min={isoDate()}
          onChange={e => { if (e.target.value) setExamDate(e.target.value) }}
          onBlur={() => setEditing(false)}
          autoFocus
          className="bg-surface-raised border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-600 text-text-muted hover:text-text-secondary hover:border-accent/30 transition-colors"
        >
          <Pencil size={11} /> Change date
        </button>
      )}
    </Card>
  )
}

// ─── Module picker — the app's onboarding surface for esat_modules ──────────────
function ModulePicker({ chosen, setChosen }) {
  const optional = chosen.filter(id => OPTIONAL_MODULE_IDS.includes(id))
  const toggle = (id) => {
    const next = optional.includes(id) ? optional.filter(x => x !== id)
      : optional.length >= 2 ? optional
      : [...optional, id]
    setChosen(['maths1', ...next])
  }
  return (
    <Card>
      <div className="px-4 pt-3 pb-2 border-b border-border-subtle flex items-baseline justify-between">
        <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Your modules</span>
        <span className="text-[11px] text-text-muted">Maths 1 + up to 2 optional</span>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        <span className="px-3 py-2 rounded-xl border border-accent/30 bg-accent/5 text-sm font-600 text-accent">
          Maths 1 <span className="opacity-60 font-400">· compulsory</span>
        </span>
        {OPTIONAL_MODULE_IDS.map(id => {
          const m = getModule(id)
          const sel = optional.includes(id)
          const blocked = !sel && optional.length >= 2
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={blocked}
              className={cn(
                'px-3 py-2 rounded-xl border text-sm font-600 transition-all duration-150',
                sel ? '' : blocked ? 'border-border text-text-muted/50 cursor-not-allowed' : 'border-border text-text-muted hover:text-text-secondary'
              )}
              style={sel ? {
                color: m.color,
                backgroundColor: `color-mix(in srgb, ${m.color} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`,
              } : {}}
            >
              {m.short}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Sparkline of projected mock scores on the fixed 1–9 scale ──────────────────
function ScoreSparkline({ mocks, color }) {
  if (mocks.length < 2) return null
  const pts = mocks.slice(-10)
  const width = 200, height = 44, padX = 4, padY = 5
  const coords = pts.map((m, i) => {
    const x = padX + (i / (pts.length - 1)) * (width - padX * 2)
    const y = padY + (1 - (m.projected - 1) / 8) * (height - padY * 2)
    return { x, y }
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-11" aria-hidden>
      <polyline
        points={coords.map(c => `${c.x},${c.y}`).join(' ')}
        fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.8"
      />
      {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 2.5 : 1.5} fill={color} />)}
    </svg>
  )
}

// ─── Module scorecard — one per chosen module, side by side ─────────────────────
function ModuleScorecard({ moduleId, events, examDate }) {
  const m = getModule(moduleId)
  const model = useMemo(() => getModuleModel(events, moduleId), [events, moduleId])
  const forecast = useMemo(() => getModuleForecast({ events, moduleId, examDate }), [events, moduleId, examDate])
  const mocks = useMemo(() => getModuleMocks(events, moduleId), [events, moduleId])

  const basisCopy = forecast === null ? null
    : forecast.basis === 'mocks' ? `fit over ${forecast.mockCount} mocks`
    : forecast.basis === 'mock' ? `avg of last ${Math.min(forecast.mockCount, 3)} mock${forecast.mockCount > 1 ? 's' : ''}`
    : 'practice accuracy trend'

  return (
    <Card className="flex flex-col">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <p className="text-sm font-600" style={{ color: m.color }}>{m.name}</p>
          {forecast?.slopePerWeek != null && forecast.slopePerWeek !== 0 && (
            <span className={cn('text-[11px] font-600 tabular', forecast.slopePerWeek > 0 ? 'text-success' : 'text-danger')}>
              {forecast.slopePerWeek > 0 ? '+' : ''}{forecast.slopePerWeek}/wk
            </span>
          )}
        </div>
        {forecast ? (
          <>
            <div className="font-display font-700 text-5xl tabular tracking-[-0.03em] mt-2" style={{ color: m.color }}>
              {formatProjected(forecast.projected)}
            </div>
            <p className="text-[10px] font-600 uppercase tracking-widest text-text-muted mt-1">
              projected on exam day · {basisCopy}
            </p>
          </>
        ) : (
          <div className="mt-2 py-3">
            <p className="text-sm text-text-secondary">No signal yet.</p>
            <p className="text-[11px] text-text-muted mt-0.5">Practice or sit a mock to see a projection.</p>
          </div>
        )}
      </div>

      <div className="px-5">
        <ScoreSparkline mocks={mocks} color={m.color} />
      </div>

      <div className="px-5 pb-4 pt-2 mt-auto border-t border-border-subtle">
        {model.attempts > 0 ? (
          <>
            <div className="flex justify-between text-[11px] text-text-muted mb-1.5 tabular">
              <span>{model.attempts} attempts · {Math.round((model.accuracy ?? 0) * 100)}% correct</span>
              {model.slow > 0 && <span className="text-warning font-600">{model.slow} slow</span>}
            </div>
            <ThreeStateBar wrong={model.wrong} slow={model.slow} fast={model.fast} />
          </>
        ) : (
          <p className="text-[11px] text-text-muted">Nothing attempted in this module yet.</p>
        )}
      </div>
    </Card>
  )
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const events = useEvents()
  const queue = useReviewQueue()
  const [chosenRaw, setChosen] = useLocalStorage('esat_modules', [])
  const [examDate, setExamDate] = useLocalStorage('esat_exam_date', DEFAULT_EXAM_DATE)

  const chosen = useMemo(() => {
    const optional = chosenRaw.filter(id => OPTIONAL_MODULE_IDS.includes(id)).slice(0, 2)
    return ['maths1', ...optional]
  }, [chosenRaw])

  const dueCount = useMemo(() => getDueEntries(queue).length, [queue])

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">
            Each module is scored 1.0–9.0 on its own — there is no combined ESAT score.
          </p>
        </div>
        {dueCount > 0 && (
          <button
            onClick={() => navigate('/practice')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-warning/40 bg-warning/10 text-warning text-xs font-600 hover:opacity-90 transition-opacity"
          >
            <Zap size={12} /> {dueCount} review{dueCount !== 1 ? 's' : ''} due
          </button>
        )}
      </div>

      <ExamCountdown examDate={examDate} setExamDate={setExamDate} />

      {/* Hero: side-by-side scorecards, one per chosen module */}
      <div className={cn('grid gap-3', chosen.length === 1 ? 'grid-cols-1' : chosen.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3')}>
        {chosen.map(id => (
          <ModuleScorecard key={id} moduleId={id} events={events} examDate={examDate} />
        ))}
      </div>
      <ThreeStateLegend />

      <ModulePicker chosen={chosen} setChosen={setChosen} />

      <Link
        to="/insights"
        className="flex items-center justify-between px-5 py-3.5 rounded-xl border border-border text-sm font-600 text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
      >
        Where should I focus? — per-topic and cross-module breakdown
        <ChevronRight size={15} />
      </Link>
    </motion.div>
  )
}
