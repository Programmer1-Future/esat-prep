import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MODULES } from '../lib/moduleMap'
import { NOTES } from '../data/notes_content'
import { TechniqueRenderer } from '../components/ui/TechniqueRenderer'
import { cn } from '../lib/utils'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { countByTopic } from '../lib/moduleMap'
import questionsData from '../data/questions.json'

// Flattened module → topic list, in the same order as the sidebar groups —
// drives prev/next navigation across the whole syllabus.
const FLAT_TOPICS = MODULES.flatMap(m => m.topics.map(t => ({ ...t, moduleId: m.id })))

function AccuracyDot({ correct, total }) {
  if (!total) return <span className="w-1.5 h-1.5 rounded-full bg-border block flex-shrink-0" />
  const pct = correct / total
  const color = pct >= 0.75 ? 'var(--success)' : pct >= 0.5 ? 'var(--warning)' : 'var(--danger)'
  return <span className="w-1.5 h-1.5 rounded-full block flex-shrink-0" style={{ backgroundColor: color }} />
}

function TopicList({ activeId, stats, onSelect }) {
  return (
    <nav className="h-full overflow-y-auto py-4 px-2.5">
      <p className="px-2 text-[10px] font-600 uppercase tracking-widest text-text-secondary mb-3">Topics</p>
      {MODULES.map(m => (
        <div key={m.id} className="mb-5">
          <p className="px-2 text-[10px] font-600 mb-1.5 uppercase tracking-widest" style={{ color: m.color }}>
            {m.short}
          </p>
          <div className="space-y-0.5">
            {m.topics.map(topic => {
              const st = stats[topic.id] || {}
              const isActive = activeId === topic.id
              return (
                <button
                  key={topic.id}
                  onClick={() => onSelect(topic.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-all duration-150',
                    isActive
                      ? 'bg-surface-hover text-text-primary'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover/60'
                  )}
                >
                  <AccuracyDot correct={st.correct} total={st.total} />
                  <span className="flex-1 truncate text-[12.5px] leading-tight">{topic.name}</span>
                  {st.total > 0 && (
                    <span className="text-[10px] tabular text-text-secondary">
                      {Math.round((st.correct / st.total) * 100)}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function Notes() {
  const [stats] = useLocalStorage('esat_topic_stats', {})
  const counts = countByTopic(Array.isArray(questionsData) ? questionsData : questionsData.questions || [])
  const location = useLocation()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState(() => location.state?.topicId || FLAT_TOPICS[0]?.id)
  const contentRef = useRef(null)

  const currentIdx = FLAT_TOPICS.findIndex(t => t.id === activeId)
  const activeTopic = FLAT_TOPICS[currentIdx]
  const prevTopic = FLAT_TOPICS[currentIdx - 1]
  const nextTopic = FLAT_TOPICS[currentIdx + 1]
  const st = stats[activeId] || {}
  const activeModule = activeTopic && MODULES.find(m => m.id === activeTopic.moduleId)
  const note = activeTopic ? NOTES[activeTopic.moduleId]?.[activeTopic.id] : null

  const handleSelect = (id) => {
    setActiveId(id)
    if (contentRef.current) contentRef.current.scrollTop = 0
  }

  return (
    <motion.div
      className="h-[calc(100vh-3.5rem)] flex overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <aside className="w-52 flex-shrink-0 h-full overflow-y-auto border-r border-border bg-surface">
        <TopicList activeId={activeId} stats={stats} onSelect={handleSelect} />
      </aside>

      <div ref={contentRef} className="flex-1 h-full overflow-y-auto bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="max-w-3xl mx-auto px-10 py-8"
          >
            {activeTopic && (
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border-subtle">
                <span className="text-[11px] font-600 uppercase tracking-widest" style={{ color: activeModule?.color }}>
                  {activeModule?.short}
                </span>
                <span className="text-border">·</span>
                {st.total > 0 ? (
                  <span className="text-[11px] text-text-secondary tabular">
                    Quiz score: {st.correct}/{st.total} ({Math.round((st.correct / st.total) * 100)}%)
                  </span>
                ) : (
                  <span className="text-[11px] text-text-secondary">No quiz attempts yet</span>
                )}
                {counts[activeId] > 0 && (
                  <button
                    onClick={() => navigate('/practice', { state: { topicId: activeId, topicIds: [activeId], qCount: 10, timerSecs: 89 } })}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/25 text-accent text-[11px] font-600 hover:bg-accent/20 transition-colors"
                  >
                    Practice this topic →
                  </button>
                )}
              </div>
            )}

            {note ? (
              <TechniqueRenderer text={note} />
            ) : (
              <p className="text-sm text-text-muted italic">Notes coming soon for this topic.</p>
            )}

            <div className="flex items-center gap-3 mt-12 pt-6 border-t border-border-subtle">
              {prevTopic ? (
                <button
                  onClick={() => handleSelect(prevTopic.id)}
                  className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border transition-all duration-150 text-[12px]"
                >
                  <span>←</span>
                  <span className="truncate">{prevTopic.name}</span>
                </button>
              ) : <div className="flex-1" />}
              {nextTopic ? (
                <button
                  onClick={() => handleSelect(nextTopic.id)}
                  className="flex-1 flex items-center justify-end gap-2 px-4 py-3 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border transition-all duration-150 text-[12px]"
                >
                  <span className="truncate">{nextTopic.name}</span>
                  <span>→</span>
                </button>
              ) : <div className="flex-1" />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
