import { useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Clock, BarChart2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { CalendarGrid } from '../components/tracker/CalendarGrid'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { calculateStreak, getWeekDates, isoDate, SESSION_TYPES, getStudyPhases } from '../lib/utils'
import { logEvent } from '../lib/eventLog'

const DEFAULT_EXAM_DATE = '2026-10-14'
const QUICK_HOURS = [0.5, 1, 1.5, 2, 3]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function WeekView({ habits, onDayClick, weekOffset, onPrev, onNext }) {
  const dates = getWeekDates(weekOffset)
  const today = isoDate()

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text-secondary transition-colors">
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs text-text-secondary">
          {new Date(dates[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
          {new Date(dates[6] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text-secondary transition-colors">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((d, i) => {
          const date = dates[i]
          const entry = habits[date]
          const isToday = date === today
          const isFuture = date > today
          const hasData = entry && (entry.hours > 0 || entry.questionsCompleted > 0)

          return (
            <button
              key={d}
              onClick={() => !isFuture && onDayClick(date)}
              disabled={isFuture}
              className={`
                rounded-xl p-3 text-center transition-all duration-200 ease-out
                ${isToday ? 'ring-1 ring-accent/60' : ''}
                ${isFuture ? 'opacity-25 cursor-default' : 'hover:-translate-y-0.5 cursor-pointer'}
                ${hasData ? 'bg-accent/10 border border-accent/20' : 'bg-surface-raised border border-border'}
              `}
            >
              <div className="text-[11px] text-text-muted mb-1">{d}</div>
              <div className={`text-sm font-600 tabular ${isToday ? 'text-accent' : 'text-text-primary'}`}>
                {new Date(date + 'T00:00:00').getDate()}
              </div>
              {hasData ? (
                <>
                  <div className="text-[11px] text-accent mt-1 tabular">{entry.hours || 0}h</div>
                  {entry.questionsCompleted > 0 && (
                    <div className="text-[10px] text-text-muted">{entry.questionsCompleted}q</div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-text-muted mt-1">—</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function HabitTracker() {
  const [habits, setHabits] = useLocalStorage('esat_habits', {})
  const [examDate] = useLocalStorage('esat_exam_date', DEFAULT_EXAM_DATE)
  const [selectedDate, setSelectedDate] = useState(null)
  const [view, setView] = useState('calendar') // 'calendar' | 'week'
  const [weekOffset, setWeekOffset] = useState(0)
  const [showMoreDetail, setShowMoreDetail] = useState(false)

  const [form, setForm] = useState({
    sessionType: '',
    hours: '',
    questionsCompleted: '',
    percentCorrect: '',
    topics: '',
    notes: '',
  })

  const streak = calculateStreak(habits)
  const phases = getStudyPhases(examDate)

  const totalHours = Object.values(habits).reduce((s, e) => s + (e?.hours || 0), 0)
  const totalQuestions = Object.values(habits).reduce((s, e) => s + (e?.questionsCompleted || 0), 0)
  const daysLogged = Object.values(habits).filter(e => e?.hours > 0 || e?.questionsCompleted > 0).length

  const handleDayClick = (date) => {
    setSelectedDate(date)
    setShowMoreDetail(false)
    const entry = habits[date] || {}
    setForm({
      sessionType: entry.sessionType || '',
      hours: entry.hours || '',
      questionsCompleted: entry.questionsCompleted || '',
      percentCorrect: entry.percentCorrect || '',
      topics: entry.topics || '',
      notes: entry.notes || '',
    })
  }

  const handleSave = () => {
    if (!selectedDate) return
    const entry = {
      date: selectedDate,
      sessionType: form.sessionType,
      hours: parseFloat(form.hours) || 0,
      questionsCompleted: parseInt(form.questionsCompleted) || 0,
      percentCorrect: parseFloat(form.percentCorrect) || 0,
      topics: form.topics,
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    }
    const edited = !!habits[selectedDate]
    setHabits({ ...habits, [selectedDate]: entry })
    logEvent('study_logged', {
      date: selectedDate,
      hours: entry.hours,
      questionsCompleted: entry.questionsCompleted,
      sessionType: entry.sessionType,
      percentCorrect: entry.percentCorrect,
      topics: entry.topics,
      notes: entry.notes,
      edited,
    })
    setSelectedDate(null)
  }

  const handleDelete = () => {
    if (!selectedDate) return
    const updated = { ...habits }
    delete updated[selectedDate]
    setHabits(updated)
    setSelectedDate(null)
  }

  const inputClass = "w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"

  return (
    <motion.div
      className="max-w-2xl mx-auto p-6 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Flame, label: 'Day Streak', value: streak, color: 'var(--warning)' },
          { icon: Clock, label: 'Total Hours', value: totalHours.toFixed(1), color: 'var(--accent)' },
          { icon: BarChart2, label: 'Questions Done', value: totalQuestions, color: 'var(--success)' },
          { icon: BarChart2, label: 'Days Logged', value: daysLogged, color: 'var(--info)' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25, ease: 'easeOut' }}
          >
            <Card className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={13} style={{ color: stat.color }} />
                <span className="text-[11px] text-text-muted">{stat.label}</span>
              </div>
              <div className="font-mono font-600 text-2xl tabular tracking-[-0.02em]" style={{ color: stat.color }}>{stat.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted mr-1">View</span>
        {['calendar', 'week'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-500 border transition-colors duration-200 capitalize ${
              view === v
                ? 'border-accent/40 text-accent bg-accent/5'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            {v === 'calendar' ? 'Full Calendar' : 'Week View'}
          </button>
        ))}
      </div>

      {/* Phase legend — derived from this user's own exam date */}
      <div className="flex items-center gap-4">
        {phases.map(p => (
          <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name} ({new Date(p.start + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–{new Date(p.end + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
          </div>
        ))}
      </div>

      {/* Calendar */}
      <Card>
        <CardBody>
          {view === 'calendar' ? (
            <CalendarGrid habits={habits} onDayClick={handleDayClick} examDate={examDate} />
          ) : (
            <WeekView
              habits={habits}
              onDayClick={handleDayClick}
              weekOffset={weekOffset}
              onPrev={() => setWeekOffset(w => w - 1)}
              onNext={() => setWeekOffset(w => w + 1)}
            />
          )}
        </CardBody>
      </Card>

      {/* Day log modal */}
      <Modal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? `Log — ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
      >
        {selectedDate && (
          <div className="space-y-4">
            {/* Session type — tap chips, no dropdown */}
            <div>
              <div className="text-[11px] text-text-muted mb-2">Session type</div>
              <div className="flex flex-wrap gap-1.5">
                {SESSION_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, sessionType: f.sessionType === t ? '' : t }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-500 border transition-colors duration-150 ${
                      form.sessionType === t
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border text-text-muted hover:border-border hover:text-text-secondary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Hours — quick tap + manual */}
            <div>
              <div className="text-[11px] text-text-muted mb-2">Hours studied</div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {QUICK_HOURS.map(h => (
                    <button
                      key={h}
                      onClick={() => setForm(f => ({ ...f, hours: f.hours === String(h) ? '' : String(h) }))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-600 border transition-colors duration-150 tabular ${
                        String(form.hours) === String(h)
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-border text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <input
                  type="number" min="0" max="12" step="0.25"
                  value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                  placeholder="other"
                  className={`${inputClass} w-20 text-center`}
                />
              </div>
            </div>

            {/* Questions done — single field */}
            <div>
              <div className="text-[11px] text-text-muted mb-2">Questions done</div>
              <input
                type="number" min="0"
                value={form.questionsCompleted}
                onChange={e => setForm(f => ({ ...f, questionsCompleted: e.target.value }))}
                placeholder="e.g. 20"
                className={`${inputClass} w-32`}
              />
            </div>

            {/* More detail toggle */}
            <button
              onClick={() => setShowMoreDetail(v => !v)}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronDown size={12} className={`transition-transform duration-200 ${showMoreDetail ? 'rotate-180' : ''}`} />
              {showMoreDetail ? 'Less detail' : 'Add % correct, topics, notes'}
            </button>

            {showMoreDetail && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-text-muted mb-1.5">% Correct</div>
                  <input
                    type="number" min="0" max="100"
                    value={form.percentCorrect}
                    onChange={e => setForm(f => ({ ...f, percentCorrect: e.target.value }))}
                    placeholder="e.g. 80"
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className="text-[11px] text-text-muted mb-1.5">Topics covered</div>
                  <input
                    type="text"
                    value={form.topics}
                    onChange={e => setForm(f => ({ ...f, topics: e.target.value }))}
                    placeholder="e.g. Mechanics"
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] text-text-muted mb-1.5">Notes</div>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any observations..."
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="primary" size="md" onClick={handleSave} className="flex-1">
                Save
              </Button>
              {habits[selectedDate] && (
                <Button variant="danger" size="md" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button variant="ghost" size="md" onClick={() => setSelectedDate(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
