export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function isoDate(date = new Date()) {
  return date.toISOString().split('T')[0]
}

export function formatSecs(s) {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s) % 60).padStart(2, '0')}`
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getWeekDates(weekOffset = 0) {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(isoDate(d))
  }
  return days
}

export function calculateStreak(habits) {
  if (!habits || Object.keys(habits).length === 0) return 0
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const entry = habits[isoDate(d)]
    if (entry && (entry.hours > 0 || entry.questionsCompleted > 0)) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

export const SESSION_TYPES = [
  'Concept Review',
  'Problem Practice',
  'Past Paper',
  'Mock Exam',
  'Topic Deep Dive',
  'Speed Drill',
  'Weak Area Focus',
]

// Study phases derived from the user's own exam date (never hardcoded — ESAT's
// exam date is per-user configurable, unlike TMUA's fixed 2026-10-14). Same
// proportions as the TMUA engine's calendar (10wk build / 6wk speed / 3wk peak),
// anchored backward from exam day instead of forward from a fixed start.
const DAY_MS = 86400000

export function getStudyPhases(examDate) {
  const exam = new Date(examDate + 'T00:00:00')
  const peakEnd = new Date(exam - DAY_MS)
  const peakStart = new Date(peakEnd - 20 * DAY_MS)
  const speedEnd = new Date(peakStart - DAY_MS)
  const speedStart = new Date(speedEnd - 41 * DAY_MS)
  const buildEnd = new Date(speedStart - DAY_MS)
  const buildStart = new Date(buildEnd - 69 * DAY_MS)
  return [
    { id: 'build', name: 'Build', color: 'var(--info)', start: isoDate(buildStart), end: isoDate(buildEnd), description: 'Deep content — understand every mistake' },
    { id: 'speed', name: 'Speed', color: 'var(--warning)', start: isoDate(speedStart), end: isoDate(speedEnd), description: 'Timed practice — 89s per question' },
    { id: 'peak', name: 'Peak', color: 'var(--danger)', start: isoDate(peakStart), end: isoDate(peakEnd), description: 'Full mocks — sharpen reflexes' },
  ]
}

export function getPhaseForDate(dateStr, examDate) {
  for (const phase of getStudyPhases(examDate)) {
    if (dateStr >= phase.start && dateStr <= phase.end) return phase
  }
  return null
}

export function getCurrentPhase(examDate) {
  const today = isoDate()
  const phases = getStudyPhases(examDate)
  const hit = phases.find(p => today >= p.start && today <= p.end)
  if (hit) return hit
  return today > phases[phases.length - 1].end ? phases[phases.length - 1] : phases[0]
}
