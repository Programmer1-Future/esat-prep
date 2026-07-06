import { describe, it, expect } from 'vitest'
import {
  paceOf,
  targetSecs,
  getAttempts,
  threeStateByTopic,
  getModuleModel,
  getModuleForecast,
  getModuleAttention,
} from './studentModel'

const result = (over = {}) => ({
  qId: 'q1', module: 'maths1', topicId: 'm1-algebra', difficulty: 3,
  outcome: 'correct', timeSec: 60, selected: 'A', errorTag: null, ...over,
})

const quiz = (results, ts = '2026-06-01T10:00:00.000Z') =>
  ({ type: 'quiz_completed', ts, results })

const mock = (module, projected, ts, score = 15) =>
  ({ type: 'mock_logged', ts, date: ts.slice(0, 10), module, projected, score, total: 27, results: [] })

describe('paceOf', () => {
  it('classifies against the per-difficulty target', () => {
    expect(paceOf(result({ timeSec: targetSecs(3) }))).toBe('fast')
    expect(paceOf(result({ timeSec: targetSecs(3) + 1 }))).toBe('slow')
    expect(paceOf(result({ difficulty: 5, timeSec: 125 }))).toBe('fast')
    expect(paceOf(result({ difficulty: 1, timeSec: 55 }))).toBe('slow')
  })
  it('maps wrong and timeout to wrong, skip to null', () => {
    expect(paceOf(result({ outcome: 'wrong' }))).toBe('wrong')
    expect(paceOf(result({ outcome: 'timeout' }))).toBe('wrong')
    expect(paceOf(result({ outcome: 'skip' }))).toBe(null)
  })
})

describe('getAttempts', () => {
  it('includes mock_logged results and scopes by module', () => {
    const events = [
      quiz([result(), result({ module: 'physics', topicId: 'phy-waves' })]),
      { ...mock('maths1', 5.0, '2026-06-02T10:00:00.000Z'), results: [result()] },
    ]
    expect(getAttempts(events)).toHaveLength(3)
    expect(getAttempts(events, ['physics'])).toHaveLength(1)
  })
})

describe('threeStateByTopic', () => {
  it('splits wrong / slow / fast and excludes skips from attempts', () => {
    const events = [quiz([
      result({ timeSec: 40 }),
      result({ timeSec: 120 }),
      result({ outcome: 'wrong' }),
      result({ outcome: 'skip' }),
    ])]
    const [row] = threeStateByTopic(events)
    expect(row.fast).toBe(1)
    expect(row.slow).toBe(1)
    expect(row.wrong).toBe(1)
    expect(row.skips).toBe(1)
    expect(row.attempts).toBe(3)
    expect(row.riskShare).toBeCloseTo(2 / 3)
  })
})

describe('getModuleModel', () => {
  it('counts slow-correct as correct for accuracy', () => {
    const events = [quiz([result({ timeSec: 200 }), result({ outcome: 'wrong' })])]
    const m = getModuleModel(events, 'maths1')
    expect(m.accuracy).toBe(0.5)
    expect(m.slow).toBe(1)
  })
})

describe('getModuleForecast', () => {
  it('fits a line over 3+ mocks and clamps to 1–9', () => {
    const events = [
      mock('maths1', 4.0, '2026-06-01T10:00:00.000Z'),
      mock('maths1', 5.0, '2026-06-08T10:00:00.000Z'),
      mock('maths1', 6.0, '2026-06-15T10:00:00.000Z'),
    ]
    const f = getModuleForecast({ events, moduleId: 'maths1', examDate: '2026-06-22' })
    expect(f.basis).toBe('mocks')
    expect(f.current).toBe(6.0)
    expect(f.projected).toBeCloseTo(7.0, 1)
    const far = getModuleForecast({ events, moduleId: 'maths1', examDate: '2027-06-22' })
    expect(far.projected).toBe(9)
  })
  it('refuses to fit same-day mocks — averages instead of extrapolating noise', () => {
    const events = [
      mock('maths1', 6.0, '2026-06-01T10:00:00.000Z'),
      mock('maths1', 3.0, '2026-06-01T11:00:00.000Z'),
      mock('maths1', 5.0, '2026-06-01T12:00:00.000Z'),
    ]
    const f = getModuleForecast({ events, moduleId: 'maths1', examDate: '2026-10-14' })
    expect(f.basis).toBe('mock')
    expect(f.projected).toBeCloseTo(4.7, 1)
    expect(f.slopePerWeek).toBe(null)
  })
  it('falls back to accuracy trend, then single mock, then null', () => {
    const attempts = Array.from({ length: 16 }, (_, i) =>
      result({ outcome: i < 8 ? 'wrong' : 'correct' }))
    const f = getModuleForecast({ events: [quiz(attempts)], moduleId: 'maths1', examDate: '2026-10-14' })
    expect(f.basis).toBe('accuracy')
    expect(f.projected).toBeGreaterThan(f.current - 0.01)

    const one = getModuleForecast({
      events: [mock('physics', 5.5, '2026-06-01T10:00:00.000Z')],
      moduleId: 'physics', examDate: '2026-10-14',
    })
    expect(one).toMatchObject({ basis: 'mock', projected: 5.5 })

    expect(getModuleForecast({ events: [], moduleId: 'biology', examDate: '2026-10-14' })).toBe(null)
  })
})

describe('getModuleAttention', () => {
  it('ranks thin-data modules first, then by wrong/slow weight', () => {
    const events = [quiz([
      ...Array.from({ length: 10 }, () => result({ timeSec: 40 })),
      ...Array.from({ length: 10 }, () => result({ module: 'physics', topicId: 'phy-waves', outcome: 'wrong' })),
    ])]
    const rows = getModuleAttention(events, ['maths1', 'physics', 'chemistry'])
    expect(rows[0].moduleId).toBe('chemistry')
    expect(rows[0].thin).toBe(true)
    expect(rows[1].moduleId).toBe('physics')
    expect(rows[2].moduleId).toBe('maths1')
    expect(rows[1].reason).toContain('100% wrong')
  })
})
