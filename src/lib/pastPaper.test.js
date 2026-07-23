import { describe, expect, it } from 'vitest'
import { listAvailablePapers, questionsForPastPaper, paperKey } from './pastPaper'

describe('pastPaper', () => {
  const sample = [
    { id: 'ENGAA-2016-M1-002', source: 'ENGAA 2016', year: 2016, module: 'maths1' },
    { id: 'ENGAA-2016-M1-003', source: 'ENGAA 2016', year: 2016, module: 'maths1' },
    { id: 'ENGAA-2016-PHY-002', source: 'ENGAA 2016', year: 2016, module: 'physics' },
  ]

  it('builds paper keys from bare and year-suffixed sources', () => {
    expect(paperKey('engaa', 2016)).toBe('ENGAA_2016_S1')
    expect(paperKey('ENGAA 2016', 2016)).toBe('ENGAA_2016_S1')
    expect(paperKey('NSAA_2020', 2020)).toBe('NSAA_2020_S1')
  })

  it('lists papers present in the pool', () => {
    const papers = listAvailablePapers(sample)
    expect(papers.some(p => p.key === 'ENGAA_2016_S1')).toBe(true)
    expect(papers.find(p => p.key === 'ENGAA_2016_S1')?.source).toBe('ENGAA')
  })

  it('orders maths1 by printed qnum', () => {
    const qs = questionsForPastPaper(sample, { source: 'ENGAA 2016', year: 2016, moduleId: 'maths1' })
    expect(qs.map(q => q.id)).toEqual(['ENGAA-2016-M1-002', 'ENGAA-2016-M1-003'])
  })
})
