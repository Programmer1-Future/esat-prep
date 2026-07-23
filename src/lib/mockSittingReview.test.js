import { describe, it, expect, beforeEach } from 'vitest'
import { resolveSittingReview } from './mockSittingReview'
import { updateStoredValue } from '../hooks/useLocalStorage'

describe('resolveSittingReview', () => {
  beforeEach(() => {
    localStorage.clear()
    updateStoredValue('esat_mock_sittings', () => [], [])
    updateStoredValue('esat_events', () => [], [])
  })

  it('returns not-found for missing sitting', () => {
    const r = resolveSittingReview('nope')
    expect(r.sitting).toBeNull()
    expect(r.reviewable).toBe(false)
    expect(r.reason).toBe('not-found')
  })

  it('marks manual sittings as not reviewable', () => {
    updateStoredValue('esat_mock_sittings', () => [{
      id: 'manual-1',
      date: '2026-07-22',
      manual: true,
      modules: [{ module: 'physics', correct: 10, total: 27, projected: 4.0 }],
    }], [])
    const r = resolveSittingReview('manual-1')
    expect(r.reviewable).toBe(false)
    expect(r.reason).toBe('manual')
    expect(r.moduleResults[0].results).toEqual([])
  })

  it('prefers modules[].results on the sitting', () => {
    const results = [
      { qId: 'ENGAA-2016-M1-001', module: 'maths1', topicId: 'm1-algebra', difficulty: 2, outcome: 'wrong', timeSec: 5, selected: 'A' },
    ]
    updateStoredValue('esat_mock_sittings', () => [{
      id: 'sit-1',
      date: '2026-07-22',
      modules: [{ module: 'maths1', correct: 0, total: 1, projected: 1.0, timeTakenSec: 12, results }],
    }], [])
    const r = resolveSittingReview('sit-1')
    expect(r.reviewable).toBe(true)
    expect(r.moduleResults[0].results).toEqual(results)
    expect(r.questionsByModule.maths1[0].id).toBe('ENGAA-2016-M1-001')
  })

  it('falls back to mock_logged events by sittingId', () => {
    updateStoredValue('esat_mock_sittings', () => [{
      id: 'sit-legacy',
      date: '2026-07-22',
      modules: [{ module: 'physics', correct: 0, total: 27, projected: 1.0, timeTakenSec: 12 }],
    }], [])
    updateStoredValue('esat_events', () => [{
      id: 'e1',
      ts: '2026-07-22T20:00:00.000Z',
      type: 'mock_logged',
      sittingId: 'sit-legacy',
      module: 'physics',
      score: 0,
      total: 27,
      projected: 1.0,
      timeTaken: 12,
      results: [
        { qId: 'NSAA-2020-PHY-009', module: 'physics', topicId: 'phy-electricity', difficulty: 3, outcome: 'wrong', timeSec: 2, selected: 'F' },
      ],
    }], [])
    const r = resolveSittingReview('sit-legacy')
    expect(r.reviewable).toBe(true)
    expect(r.moduleResults[0].results).toHaveLength(1)
    expect(r.questionsByModule.physics[0].id).toBe('NSAA-2020-PHY-009')
  })
})
