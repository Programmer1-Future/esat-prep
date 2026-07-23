import { describe, expect, it, beforeEach } from 'vitest'
import { updateStoredValue } from '../hooks/useLocalStorage'
import {
  MOCK_DRAFT_KEY,
  promoteDraftToAbandoned,
  writeAbandonedSitting,
  ensureAbandonedSitting,
} from './mockAbandon'

beforeEach(() => {
  updateStoredValue(MOCK_DRAFT_KEY, () => null, null)
  updateStoredValue('esat_mock_sittings', () => [], [])
})

describe('mockAbandon', () => {
  it('promotes a draft with completed modules into Abandoned sitting', () => {
    updateStoredValue(MOCK_DRAFT_KEY, () => ({
      id: 'sit-1',
      date: '2026-07-23',
      ts: '2026-07-23T12:00:00.000Z',
      modules: [{ module: 'maths1', correct: 10, total: 27, projected: 4.0, results: [] }],
    }), null)
    expect(promoteDraftToAbandoned()).toBe(true)
    const sittings = JSON.parse(localStorage.getItem('esat_mock_sittings'))
    expect(sittings).toHaveLength(1)
    expect(sittings[0].abandoned).toBe(true)
    expect(sittings[0].modules[0].module).toBe('maths1')
    expect(JSON.parse(localStorage.getItem(MOCK_DRAFT_KEY))).toBeNull()
  })

  it('ensureAbandonedSitting falls back to draft when memory is empty', () => {
    updateStoredValue(MOCK_DRAFT_KEY, () => ({
      id: 'sit-2',
      modules: [{ module: 'physics', correct: 5, total: 27, projected: 2.5, results: [] }],
    }), null)
    expect(ensureAbandonedSitting('sit-2', [])).toBe(true)
    const sittings = JSON.parse(localStorage.getItem('esat_mock_sittings'))
    expect(sittings).toHaveLength(1)
    expect(sittings[0].id).toBe('sit-2')
    expect(sittings[0].abandoned).toBe(true)
  })

  it('writeAbandonedSitting is idempotent for the same id', () => {
    writeAbandonedSitting('sit-3', [{ module: 'maths1', correct: 1, total: 27, projected: 1.2, results: [] }])
    writeAbandonedSitting('sit-3', [{ module: 'maths1', correct: 1, total: 27, projected: 1.2, results: [] }])
    expect(JSON.parse(localStorage.getItem('esat_mock_sittings'))).toHaveLength(1)
  })
})
