import { describe, expect, it } from 'vitest'
import { errorTypeByTopic, errorTypeRows } from './insights'

// A ledger where one topic's misses are overwhelmingly timed-out, not concept
// gaps — the exact signal the Insights view exists to surface.
const events = [
  {
    type: 'quiz_completed',
    results: [
      { qId: 'a', module: 'maths1', topicId: 'm1-algebra', outcome: 'wrong', errorTag: 'timed_out' },
      { qId: 'b', module: 'maths1', topicId: 'm1-algebra', outcome: 'timeout', errorTag: 'timed_out' },
      { qId: 'c', module: 'maths1', topicId: 'm1-algebra', outcome: 'wrong', errorTag: 'concept_gap' },
      { qId: 'd', module: 'maths1', topicId: 'm1-algebra', outcome: 'correct', errorTag: null }, // ignored
      { qId: 'e', module: 'physics', topicId: 'phy-mechanics', outcome: 'wrong', errorTag: null }, // untagged
    ],
  },
  {
    type: 'review_completed',
    results: [
      { qId: 'a', module: 'maths1', topicId: 'm1-algebra', outcome: 'timeout', errorTag: 'timed_out' },
    ],
  },
  { type: 'study_logged', hours: 2 }, // non-ledger event, ignored
]

describe('errorTypeByTopic', () => {
  it('counts only misses, buckets by topic and tag, and names the dominant tag', () => {
    const byTopic = errorTypeByTopic(events)

    const algebra = byTopic['m1-algebra']
    expect(algebra.total).toBe(4) // 3 misses in quiz + 1 in review; the correct one excluded
    expect(algebra.counts.timed_out).toBe(3)
    expect(algebra.counts.concept_gap).toBe(1)
    expect(algebra.dominant).toBe('timed_out') // the whole point: not a concept gap

    const mechanics = byTopic['phy-mechanics']
    expect(mechanics.total).toBe(1)
    expect(mechanics.counts.untagged).toBe(1)
    expect(mechanics.dominant).toBeNull() // no tagged misses → no dominant tag
  })

  it('orders rows by total misses, worst first', () => {
    const rows = errorTypeRows(events)
    expect(rows[0].topicId).toBe('m1-algebra')
    expect(rows[0].total).toBeGreaterThanOrEqual(rows[1].total)
  })
})
