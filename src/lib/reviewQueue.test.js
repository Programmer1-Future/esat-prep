import { beforeEach, describe, expect, it } from 'vitest'
import { updateStoredValue } from '../hooks/useLocalStorage'
import {
  REVIEW_INTERVALS,
  enqueueMisses,
  enqueueSkips,
  recordReviewOutcome,
  getQueue,
  getDueEntries,
} from './reviewQueue'

// The clock is faked by passing an explicit `now` into every queue function, so
// interval scheduling is proven without waiting real days. Each test uses its own
// qIds to stay isolated from the shared localStorage-backed store.

const at = iso => new Date(iso)

function isoPlus(baseIso, days) {
  const d = new Date(baseIso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

beforeEach(() => {
  // Reset through the store so the module-level cache is cleared too, not just
  // the localStorage backing (clearing one without the other leaves stale reads).
  updateStoredValue('esat_review_queue', () => ({}), {})
  localStorage.clear()
})

describe('reviewQueue interval logic', () => {
  it('wrongly-answered questions enter at the shortest interval (+1 day)', () => {
    const now = at('2026-07-03T10:00:00.000Z')
    enqueueMisses([{ qId: 'Q-wrong', topicId: 'm1-algebra', difficulty: 3, outcome: 'wrong' }], now)

    const entry = getQueue()['Q-wrong']
    expect(entry.stage).toBe(0)
    expect(entry.lapses).toBe(1)
    expect(entry.due).toBe(isoPlus(now.toISOString(), REVIEW_INTERVALS[0])) // 2026-07-04
  })

  it('timeouts enqueue, plain skips do not increment lapses', () => {
    const now = at('2026-07-03T10:00:00.000Z')
    enqueueMisses([{ qId: 'Q-timeout', topicId: 'phy-mechanics', difficulty: 2, outcome: 'timeout' }], now)
    enqueueSkips([{ qId: 'Q-skip', topicId: 'phy-waves', difficulty: 1, outcome: 'skip' }], now)

    expect(getQueue()['Q-timeout'].lapses).toBe(1)
    expect(getQueue()['Q-skip'].lapses).toBe(0)
  })

  it('does not become due until the clock reaches the due date', () => {
    const now = at('2026-07-03T10:00:00.000Z')
    enqueueMisses([{ qId: 'Q-due', topicId: 'm1-number', difficulty: 3, outcome: 'wrong' }], now)

    const sameDay = at('2026-07-03T23:59:00.000Z')
    expect(getDueEntries(getQueue(), sameDay).map(e => e.qId)).not.toContain('Q-due')

    const nextDay = at('2026-07-04T09:00:00.000Z')
    expect(getDueEntries(getQueue(), nextDay).map(e => e.qId)).toContain('Q-due')
  })

  it('correct reviews walk the full interval ladder, then graduate off the queue', () => {
    let now = at('2026-07-03T10:00:00.000Z')
    enqueueMisses([{ qId: 'Q-ladder', topicId: 'chem-moles', difficulty: 4, outcome: 'wrong' }], now)

    // stage 0 → 1 → 2 → 3 → 4, due advancing along REVIEW_INTERVALS
    for (let stage = 1; stage < REVIEW_INTERVALS.length; stage++) {
      recordReviewOutcome('Q-ladder', true, now)
      const entry = getQueue()['Q-ladder']
      expect(entry.stage).toBe(stage)
      expect(entry.due).toBe(isoPlus(now.toISOString(), REVIEW_INTERVALS[stage]))
      now = at(`2026-08-${String(stage + 1).padStart(2, '0')}T10:00:00.000Z`)
    }

    // one more correct from the last stage graduates (removes) the question
    recordReviewOutcome('Q-ladder', true, now)
    expect(getQueue()['Q-ladder']).toBeUndefined()
  })

  it('a wrong review resets the ladder to stage 0 and increments lapses', () => {
    const now = at('2026-07-03T10:00:00.000Z')
    enqueueMisses([{ qId: 'Q-reset', topicId: 'bio-cells', difficulty: 2, outcome: 'wrong' }], now)
    recordReviewOutcome('Q-reset', true, now)   // advance to stage 1
    expect(getQueue()['Q-reset'].stage).toBe(1)

    recordReviewOutcome('Q-reset', false, now)  // miss it again
    const entry = getQueue()['Q-reset']
    expect(entry.stage).toBe(0)
    expect(entry.lapses).toBe(2)
    expect(entry.due).toBe(isoPlus(now.toISOString(), REVIEW_INTERVALS[0]))
  })
})
