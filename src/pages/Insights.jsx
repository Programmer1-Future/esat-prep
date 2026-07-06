import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Copy, Check } from 'lucide-react'
import { useEvents } from '../lib/eventLog'
import { errorTypeByTopic } from '../lib/insights'
import { errorTagLabel } from '../lib/errorTags'
import { getModule, getTopicName, getModuleColor } from '../lib/moduleMap'
import { threeStateByTopic, threeStateByDifficulty, getModuleAttention } from '../lib/studentModel'
import { useReviewQueue, getDueEntries } from '../lib/reviewQueue'
import { ACHIEVEMENTS, useAchievements } from '../lib/achievements'
import { buildAIContext } from '../lib/aiContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { ThreeStateBar, ThreeStateLegend } from '../components/ui/ThreeState'
import { cn, formatSecs, formatDate } from '../lib/utils'

const DEFAULT_EXAM_DATE = '2026-10-14'

function CopyContextButton({ events, examDate, chosenModules }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    const text = buildAIContext({ events, examDate, chosenModules })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // clipboard unavailable (e.g. http) — show the text for manual copy
      window.prompt('Copy your AI study context:', text)
    }
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy a full summary of your learning data to paste into any AI tutor"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] text-text-muted hover:text-text-secondary hover:border-accent/30 transition-colors"
    >
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
      {copied ? 'Copied — paste into any AI' : 'Copy AI context'}
    </button>
  )
}

const OPTIONAL_MODULE_IDS = ['maths2', 'physics', 'chemistry', 'biology']

// The sentence each topic card leads with. Three-state first (speed vs accuracy),
// then the error taxonomy refines *why* the wrong ones are wrong.
function topicSentence(row, errors) {
  if (row.attempts < 3) return 'Too few attempts to call it yet.'
  if (row.wrongShare >= 0.4) {
    const err = errors?.[row.topicId]
    if (err && err.dominant && err.total - err.counts.untagged > 0) {
      const share = Math.round((err.counts[err.dominant] / err.total) * 100)
      return `Accuracy is the problem — misses are mostly ${errorTagLabel(err.dominant).toLowerCase()} (${share}%).`
    }
    return 'Accuracy is the problem. Tag your misses to see why.'
  }
  if (row.slowShare >= 0.3) return 'Accuracy is fine — speed is what costs you marks here.'
  if (row.riskShare <= 0.2) return 'Solid: fast and accurate.'
  return 'Mixed picture — a few slow solves and a few misses.'
}

function AttentionCard({ rows }) {
  return (
    <Card>
      <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
        <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Which module needs attention</span>
      </div>
      <div className="divide-y divide-border-subtle">
        {rows.map((r, i) => {
          const m = getModule(r.moduleId)
          return (
            <div key={r.moduleId} className="flex items-center gap-3 px-4 py-3">
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-700 tabular flex-shrink-0',
                i === 0 ? 'bg-danger/10 text-danger' : 'bg-surface-raised text-text-muted'
              )}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-600" style={{ color: m.color }}>
                  {m.name}
                  {i === 0 && <span className="ml-2 text-[10px] font-600 uppercase tracking-widest text-danger">focus here</span>}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">{r.reason}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function PaceCard({ diffs }) {
  const withData = diffs.filter(d => d.attempts > 0)
  if (withData.length === 0) return null
  return (
    <Card>
      <div className="px-4 pt-3 pb-2 border-b border-border-subtle flex items-baseline justify-between">
        <span className="text-[11px] font-600 uppercase tracking-widest text-text-muted">Pace vs target by difficulty</span>
        <span className="text-[11px] text-text-muted">89s/question budget, weighted by difficulty</span>
      </div>
      <div className="p-4 space-y-3">
        {withData.map(d => (
          <div key={d.difficulty}>
            <div className="flex justify-between text-[11px] mb-1 tabular">
              <span className="text-text-secondary font-600">{d.difficulty}★ <span className="text-text-muted font-400">target {formatSecs(d.target)}</span></span>
              <span className={cn(
                d.avgTimeSec != null && d.avgTimeSec > d.target ? 'text-warning font-600' : 'text-text-muted'
              )}>
                {d.avgTimeSec != null ? `avg ${formatSecs(d.avgTimeSec)}` : 'no timing data'} · {d.attempts} attempts
              </span>
            </div>
            <ThreeStateBar wrong={d.wrong} slow={d.slow} fast={d.fast} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function TopicCard({ row, errors }) {
  const err = errors?.[row.topicId]
  const taggedCounts = err
    ? Object.entries(err.counts).filter(([tag, n]) => n > 0 && tag !== 'untagged')
    : []
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-600" style={{ color: getModuleColor(row.moduleId) }}>
            {getTopicName(row.topicId)}
          </span>
          <span className="text-xs text-text-muted tabular">
            {row.attempts} attempt{row.attempts !== 1 ? 's' : ''}
            {row.skips > 0 && ` · ${row.skips} skipped`}
          </span>
        </div>
        <p className="text-xs text-text-secondary mb-3">{topicSentence(row, errors)}</p>

        <ThreeStateBar wrong={row.wrong} slow={row.slow} fast={row.fast} height="h-2" />

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
          {row.wrong > 0 && (
            <span className="text-[11px] tabular" style={{ color: 'var(--danger)' }}>
              <span className="font-600">{row.wrong}</span> wrong
            </span>
          )}
          {row.slow > 0 && (
            <span className="text-[11px] tabular" style={{ color: 'var(--warning)' }}>
              <span className="font-600">{row.slow}</span> slow correct
            </span>
          )}
          {row.fast > 0 && (
            <span className="text-[11px] tabular" style={{ color: 'var(--success)' }}>
              <span className="font-600">{row.fast}</span> fast correct
            </span>
          )}
          {row.avgCorrectSecs != null && (
            <span className="text-[11px] text-text-muted tabular ml-auto">
              correct answers avg {formatSecs(row.avgCorrectSecs)}
            </span>
          )}
        </div>

        {taggedCounts.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-border-subtle">
            <span className="text-[11px] text-text-muted">Why the misses:</span>
            {taggedCounts.map(([tag, n]) => (
              <span key={tag} className="text-[11px] text-text-muted tabular">
                <span className="text-text-secondary font-600">{n}</span> {errorTagLabel(tag).toLowerCase()}
              </span>
            ))}
            {err.counts.untagged > 0 && (
              <span className="text-[11px] text-text-muted/70 tabular">{err.counts.untagged} untagged</span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Insights() {
  const events = useEvents()
  const queue = useReviewQueue()
  const unlockedAchievements = useAchievements()
  const [chosenRaw] = useLocalStorage('esat_modules', [])
  const [examDate] = useLocalStorage('esat_exam_date', DEFAULT_EXAM_DATE)
  const chosen = useMemo(
    () => ['maths1', ...chosenRaw.filter(id => OPTIONAL_MODULE_IDS.includes(id)).slice(0, 2)],
    [chosenRaw]
  )
  const [focus, setFocus] = useState(null) // null = all chosen modules

  const scope = useMemo(() => (focus ? [focus] : chosen), [focus, chosen])
  const attention = useMemo(() => getModuleAttention(events, chosen), [events, chosen])
  const topicRows = useMemo(() => threeStateByTopic(events, scope), [events, scope])
  const diffs = useMemo(() => threeStateByDifficulty(events, scope), [events, scope])
  const errors = useMemo(() => errorTypeByTopic(events), [events])
  const dueCount = useMemo(() => getDueEntries(queue).length, [queue])
  const totalAttempts = topicRows.reduce((s, r) => s + r.attempts, 0)

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Insights</h1>
          <p className="text-text-muted text-sm mt-1">
            {totalAttempts} attempt{totalAttempts !== 1 ? 's' : ''} analysed · {dueCount} due for review
          </p>
        </div>
        <CopyContextButton events={events} examDate={examDate} chosenModules={chosen} />
      </div>

      {chosen.length > 1 && <AttentionCard rows={attention} />}

      {/* Module focus filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFocus(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-xs font-600 transition-all duration-150',
            focus === null ? 'bg-accent/10 border-accent/40 text-accent' : 'border-border text-text-muted hover:text-text-secondary'
          )}
        >
          All modules
        </button>
        {chosen.map(id => {
          const m = getModule(id)
          const sel = focus === id
          return (
            <button
              key={id}
              onClick={() => setFocus(sel ? null : id)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-600 transition-all duration-150',
                sel ? '' : 'border-border text-text-muted hover:text-text-secondary'
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

      <ThreeStateLegend />

      <PaceCard diffs={diffs} />

      {topicRows.length === 0 && (
        <Card><div className="p-6 text-sm text-text-muted text-center">
          Nothing attempted in this scope yet. Practice or sit a mock and the breakdown appears here.
        </div></Card>
      )}

      {topicRows.map(row => <TopicCard key={row.topicId} row={row} errors={errors} />)}

      {/* Achievements */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy size={13} className="text-text-muted" />
            <span className="text-[10px] font-600 uppercase tracking-widest text-text-muted">Achievements</span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {ACHIEVEMENTS.map(a => {
              const ts = unlockedAchievements[a.id]
              return (
                <div
                  key={a.id}
                  title={ts ? `Unlocked ${formatDate(ts)}` : a.desc}
                  className={cn(
                    'rounded-xl border p-3 text-center transition-colors',
                    ts ? 'border-warning/30 bg-warning/10' : 'border-border opacity-45'
                  )}
                >
                  <Trophy size={14} className={cn('mx-auto mb-1.5', ts ? 'text-warning' : 'text-text-muted')} />
                  <div className={cn('text-[11px] font-600 leading-tight', ts ? 'text-text-primary' : 'text-text-muted')}>{a.title}</div>
                  <div className="text-[10px] text-text-muted mt-1 leading-tight">{a.desc}</div>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}
