import { readStoredValue, updateStoredValue, useLocalStorage } from '../hooks/useLocalStorage'
import { getEvents, logEvent } from './eventLog'
import { getAttempts, targetSecs } from './studentModel'
import { MODULE_IDS } from './moduleMap'
import { calculateStreak } from './utils'

const KEY = 'esat_achievements' // id -> unlock timestamp

// Ported from De-TMUA-guide's achievements.js — predicate pattern unchanged,
// copy rewritten module-flavoured (Explorer/mock-runner/on-pace all speak in
// module and per-difficulty-target terms rather than TMUA's flat paper/20).
export const ACHIEVEMENTS = [
  { id: 'first-quiz', title: 'First steps', desc: 'Complete your first quiz', test: c => c.quizzes >= 1 },
  { id: 'centurion', title: 'Centurion', desc: 'Attempt 100 questions', test: c => c.attempts.length >= 100 },
  { id: 'half-thousand', title: 'Question machine', desc: 'Attempt 500 questions', test: c => c.attempts.length >= 500 },
  { id: 'streak-7', title: 'One week strong', desc: 'Study 7 days in a row', test: c => c.streak >= 7 },
  { id: 'streak-30', title: 'Unstoppable', desc: 'Study 30 days in a row', test: c => c.streak >= 30 },
  {
    id: 'sharpshooter', title: 'Sharpshooter', desc: 'Score 80%+ on a quiz of 10+ questions',
    test: c => c.events.some(e => e.type === 'quiz_completed' && e.total >= 10 && e.score / e.total >= 0.8),
  },
  {
    id: 'comeback', title: 'Comeback', desc: 'Clear a review session with a perfect score',
    test: c => c.events.some(e => e.type === 'review_completed' && e.total >= 3 && e.score === e.total),
  },
  {
    id: 'explorer', title: 'Full spectrum', desc: 'Attempt questions in every module',
    test: c => {
      const seen = new Set(c.attempts.map(a => a.module))
      return MODULE_IDS.every(id => seen.has(id))
    },
  },
  { id: 'mock-runner', title: 'Mock runner', desc: 'Sit or log 3 mock exams', test: c => c.mocks.length >= 3 },
  {
    id: 'on-pace', title: 'On pace', desc: '80%+ of your last 20 timed questions inside target time',
    test: c => {
      const timed = c.attempts.filter(a => a.timeSec > 0).slice(-20)
      return timed.length >= 20 && timed.filter(a => a.timeSec <= targetSecs(a.difficulty)).length / timed.length >= 0.8
    },
  },
]

// Evaluate all achievement conditions; persist + log any newly unlocked ones
// (they land in the event ledger, so they show up in History too).
export function checkAchievements() {
  const unlocked = readStoredValue(KEY, {})
  const events = getEvents()
  const ctx = {
    events,
    attempts: getAttempts(events),
    quizzes: events.filter(e => e.type === 'quiz_completed').length,
    mocks: readStoredValue('esat_mock_sittings', []),
    streak: calculateStreak(readStoredValue('esat_habits', {})),
  }
  const fresh = ACHIEVEMENTS.filter(a => !unlocked[a.id] && a.test(ctx))
  if (fresh.length === 0) return []
  updateStoredValue(KEY, prev => {
    const next = { ...prev }
    fresh.forEach(a => { next[a.id] = new Date().toISOString() })
    return next
  }, {})
  fresh.forEach(a => logEvent('achievement_unlocked', { achievementId: a.id, title: a.title }))
  return fresh
}

export function useAchievements() {
  const [unlocked] = useLocalStorage(KEY, {})
  return unlocked
}
