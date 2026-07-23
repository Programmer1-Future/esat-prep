import { describe, expect, it } from 'vitest'
import { isQuarantined, studentQuestions } from './studentBank'

describe('studentBank', () => {
  it('filters needs_repair and string tiers', () => {
    const pool = [
      { id: 'ok', needs_repair: false },
      { id: 'nr', needs_repair: true },
      { id: 'tier', quality_tier: 'needs_source_check' },
    ]
    expect(isQuarantined(pool[0])).toBe(false)
    expect(studentQuestions(pool).map(q => q.id)).toEqual(['ok'])
  })
})
