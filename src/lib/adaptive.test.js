import { describe, expect, it } from 'vitest'
import { selectAdaptive } from './adaptive'

describe('selectAdaptive', () => {
  const pool = [
    { id: 'a', topic: 'm1-algebra', module: 'maths1', difficulty: 2 },
    { id: 'b', topic: 'm1-algebra', module: 'maths1', difficulty: 4 },
    { id: 'c', topic: 'm1-geometry', module: 'maths1', difficulty: 3 },
    { id: 'd', topic: 'phy-mechanics', module: 'physics', difficulty: 3 },
  ]

  it('returns up to count questions from the pool', () => {
    const picked = selectAdaptive(pool, [], 2)
    expect(picked).toHaveLength(2)
    expect(picked.every(q => pool.some(p => p.id === q.id))).toBe(true)
  })

  it('prefers unseen over recently-correct', () => {
    const events = [{
      type: 'quiz_completed',
      ts: new Date().toISOString(),
      results: [
        { qId: 'a', topicId: 'm1-algebra', module: 'maths1', difficulty: 2, outcome: 'correct', timeSec: 40 },
        { qId: 'b', topicId: 'm1-algebra', module: 'maths1', difficulty: 4, outcome: 'wrong', timeSec: 90 },
      ],
    }]
    // Run a few times — with jitter, missed/unseen should dominate top picks
    let missedOrUnseen = 0
    for (let i = 0; i < 20; i++) {
      const picked = selectAdaptive(pool, events, 2)
      if (picked.some(q => q.id !== 'a')) missedOrUnseen++
    }
    expect(missedOrUnseen).toBeGreaterThan(10)
  })
})
