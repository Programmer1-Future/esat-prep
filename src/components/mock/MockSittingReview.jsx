import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, X, Check } from 'lucide-react'
import { Card } from '../ui/Card'
import { cn, formatSecs } from '../../lib/utils'
import { getModule } from '../../lib/moduleMap'
import { formatProjected } from '../../lib/mockScore'
import { MathText, InlineMath } from '../ui/TechniqueRenderer'
import { parseDiagrams } from '../../lib/diagrams'
import { DiagramFigure } from '../ui/Diagram'
import { OriginBadge } from '../ui/Origin'
import { QuestionExplanation, hasExplanation } from '../questions/QuestionExplanation'

// Origin badges appear here only — never inside the timed sitting (VUE fidelity).
const REVIEW_OUTCOME = {
  correct: { text: 'Correct', color: 'var(--success)' },
  wrong: { text: 'Wrong', color: 'var(--danger)' },
  skip: { text: 'Unanswered', color: 'var(--muted)' },
}

/**
 * Per-module score cards + expandable question review (stem, answers, explanation).
 * Used at end-of-sitting and from Mock History.
 */
export function MockSittingReview({
  moduleResults,
  questionsByModule,
  title = 'Sitting complete',
  subtitle = 'ESAT reports each module independently on the 1.0–9.0 scale — there is no combined score.',
  showMissedQueueNote = true,
  footerNote = null,
  onDone,
  doneLabel = 'Done — mock history',
}) {
  const [openReview, setOpenReview] = useState(null)
  const [expandedQ, setExpandedQ] = useState(null)

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">{title}</h1>
        {subtitle && (
          <p className="text-text-muted text-sm mt-1">{subtitle}</p>
        )}
      </div>

      {moduleResults.map(r => {
        const m = getModule(r.module)
        const results = r.results || []
        const answered = results.filter(x => x.outcome !== 'skip').length
        const open = openReview === r.module
        const questions = questionsByModule?.[r.module] || []
        return (
          <Card key={r.module}>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-600" style={{ color: m.color }}>{m.name}</p>
                <p className="text-xs text-text-muted mt-1 tabular">
                  {r.correct}/{r.total} correct
                  {results.length > 0 && (
                    <> · {answered}/{r.total} answered</>
                  )}
                  {r.timeTakenSec != null && (
                    <> · {formatSecs(r.timeTakenSec)} used</>
                  )}
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
            {results.length > 0 && questions.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenReview(open ? null : r.module)
                    setExpandedQ(null)
                  }}
                  className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border-subtle text-xs font-600 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {open ? 'Hide questions' : 'Review questions'}
                  <ChevronRight size={12} className={cn('transition-transform duration-150', open && 'rotate-90')} />
                </button>
                {open && (
                  <div className="px-5 pb-4 space-y-1.5">
                    {results.map((res, i) => {
                      const o = REVIEW_OUTCOME[res.outcome] || REVIEW_OUTCOME.skip
                      const q = questions[i]
                      if (!q) return null
                      const rowKey = `${r.module}:${res.qId}`
                      const expanded = expandedQ === rowKey
                      const { stem, diagrams } = parseDiagrams(q.question, q.id)
                      const gaveAnswer = res.selected != null && res.selected !== q.answer
                      return (
                        <div key={res.qId} className="rounded-lg border border-border-subtle overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedQ(expanded ? null : rowKey)}
                            className="w-full flex items-center gap-3 text-xs px-3 py-2 hover:bg-surface-raised/40 transition-colors"
                          >
                            <span className="w-7 tabular text-text-muted flex-shrink-0 text-left">Q{i + 1}</span>
                            <span className="font-600" style={{ color: o.color }}>{o.text}</span>
                            <OriginBadge origin={q.origin} source={q.source} className="ml-auto" />
                            <ChevronRight size={12} className={cn('text-text-muted flex-shrink-0 transition-transform duration-150', expanded && 'rotate-90')} />
                          </button>
                          {expanded && (
                            <div className="px-3 pb-3 border-t border-border-subtle">
                              <div className="pt-3 text-[15px] text-text-primary leading-relaxed mb-3">
                                <MathText text={stem} />
                              </div>
                              {diagrams.map((d, j) => <DiagramFigure key={j} caption={d.caption} src={d.src} />)}

                              <div className="space-y-2">
                                {gaveAnswer && (
                                  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-danger/5 border border-danger/20">
                                    <X size={15} className="text-danger mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-600 uppercase tracking-widest text-danger/70 mb-0.5">Your answer</p>
                                      <div className="text-sm text-text-primary">
                                        <InlineMath text={String(q.options?.[res.selected] ?? '')} />
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-success/5 border border-success/20">
                                  <Check size={15} className="text-success mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-600 uppercase tracking-widest text-success/70 mb-0.5">Correct answer</p>
                                    <div className="text-sm text-text-primary">
                                      <InlineMath text={String(q.options?.[q.answer] ?? '')} />
                                    </div>
                                  </div>
                                </div>
                                {res.outcome === 'skip' && !gaveAnswer && (
                                  <p className="text-xs text-text-muted px-1">You skipped this one.</p>
                                )}
                              </div>

                              {hasExplanation(q) && (
                                <div className="mt-3 px-3 py-3 border-t border-border-subtle bg-accent/[0.03] -mx-3">
                                  <div className="px-3">
                                    <QuestionExplanation question={q} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </Card>
        )
      })}

      {showMissedQueueNote && (
        <p className="text-xs text-text-muted">
          Missed questions have entered your redemption queue and will resurface in practice.
        </p>
      )}
      {footerNote && (
        <p className="text-xs text-text-muted">{footerNote}</p>
      )}
      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="w-full py-3.5 rounded-xl font-600 text-sm bg-accent text-on-accent hover:opacity-90 dark:bg-accent-dim dark:text-text-primary dark:border dark:border-accent/30 transition-all duration-150"
        >
          {doneLabel}
        </button>
      )}
    </motion.div>
  )
}
