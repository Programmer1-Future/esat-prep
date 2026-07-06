import { readStoredValue, updateStoredValue, useLocalStorage } from '../hooks/useLocalStorage'
import { isoDate } from './utils'

// Spaced-repetition redemption queue for questions answered wrong or timed out.
// Correct on review advances the interval; wrong resets it. Graduating past the
// last interval removes the question. Ported from De-TMUA-guide's reviewQueue.js —
// logic unchanged, only the storage key carries the esat_* prefix (Phase 3).
// Wrongly-answered questions re-enter at the shortest interval (stage 0 → +1 day).

const KEY = 'esat_review_queue'
export const REVIEW_INTERVALS = [1, 3, 7, 16, 30] // days

// Clock is injectable so interval logic is testable without waiting real days.
function dateInDays(n, now = new Date()) {
  const d = new Date(now)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export function enqueueMisses(results, now = new Date()) {
  const misses = results.filter(r => r.outcome === 'wrong' || r.outcome === 'timeout')
  if (misses.length === 0) return 0
  updateStoredValue(KEY, queue => {
    const next = { ...queue }
    misses.forEach(r => {
      const prev = next[r.qId]
      next[r.qId] = {
        qId: r.qId,
        topicId: r.topicId,
        difficulty: r.difficulty,
        stage: 0,
        due: dateInDays(REVIEW_INTERVALS[0], now),
        lapses: (prev?.lapses || 0) + 1,
        addedTs: prev?.addedTs || now.toISOString(),
      }
    })
    return next
  }, {})
  return misses.length
}

// Enqueue skipped questions at the shortest interval so they come back tomorrow.
// Does NOT overwrite an existing entry (wrong answers keep their stage/lapses) and
// does NOT increment lapses — a skip is "unseen", not a failure.
export function enqueueSkips(results, now = new Date()) {
  const skips = results.filter(r => r.outcome === 'skip')
  if (skips.length === 0) return 0
  let added = 0
  updateStoredValue(KEY, queue => {
    const next = { ...queue }
    skips.forEach(r => {
      if (next[r.qId]) return
      next[r.qId] = {
        qId: r.qId, topicId: r.topicId, difficulty: r.difficulty,
        stage: 0, due: dateInDays(REVIEW_INTERVALS[0], now), lapses: 0,
        addedTs: now.toISOString(),
      }
      added++
    })
    return next
  }, {})
  return added
}

export function recordReviewOutcome(qId, correct, now = new Date()) {
  updateStoredValue(KEY, queue => {
    const entry = queue[qId]
    if (!entry) return queue
    const next = { ...queue }
    if (correct) {
      const stage = entry.stage + 1
      if (stage >= REVIEW_INTERVALS.length) {
        delete next[qId] // graduated
      } else {
        next[qId] = { ...entry, stage, due: dateInDays(REVIEW_INTERVALS[stage], now) }
      }
    } else {
      next[qId] = { ...entry, stage: 0, due: dateInDays(REVIEW_INTERVALS[0], now), lapses: (entry.lapses || 0) + 1 }
    }
    return next
  }, {})
}

export function getQueue() {
  return readStoredValue(KEY, {})
}

export function getDueEntries(queue = getQueue(), now = new Date()) {
  const today = isoDate(now)
  return Object.values(queue).filter(e => e.due <= today)
}

export function useReviewQueue() {
  const [queue] = useLocalStorage(KEY, {})
  return queue
}
