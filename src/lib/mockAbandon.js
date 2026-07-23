/**
 * Abandoned mock sittings: completed modules stay in Mock History as Abandoned.
 * Draft key holds progress between modules / across refresh.
 */
import { isoDate } from './utils'
import { readStoredValue, updateStoredValue } from '../hooks/useLocalStorage'

export const MOCK_DRAFT_KEY = 'esat_mock_in_progress'

export function modulesPayload(records) {
  return records.map(({ module, correct: c, total, projected: p, timeTakenSec, autoSubmitted: auto, results: res }) =>
    ({ module, correct: c, total, projected: p, timeTakenSec, autoSubmitted: auto, results: res }))
}

/** Promote `esat_mock_in_progress` draft into an Abandoned sitting (idempotent). */
export function promoteDraftToAbandoned() {
  const draft = readStoredValue(MOCK_DRAFT_KEY, null)
  if (!draft?.id || !Array.isArray(draft.modules) || draft.modules.length === 0) {
    if (draft) updateStoredValue(MOCK_DRAFT_KEY, () => null, null)
    return false
  }
  updateStoredValue('esat_mock_sittings', sittings => {
    if (sittings.some(s => s.id === draft.id)) return sittings
    return [
      ...sittings,
      {
        id: draft.id,
        date: draft.date || isoDate(),
        ts: draft.ts || new Date().toISOString(),
        abandoned: true,
        modules: draft.modules,
      },
    ]
  }, [])
  updateStoredValue(MOCK_DRAFT_KEY, () => null, null)
  return true
}

export function writeAbandonedSitting(sittingId, moduleRecords) {
  if (!sittingId || !moduleRecords?.length) return false
  updateStoredValue('esat_mock_sittings', sittings => {
    if (sittings.some(s => s.id === sittingId)) return sittings
    return [
      ...sittings,
      {
        id: sittingId,
        date: isoDate(),
        ts: new Date().toISOString(),
        abandoned: true,
        modules: modulesPayload(moduleRecords),
      },
    ]
  }, [])
  updateStoredValue(MOCK_DRAFT_KEY, () => null, null)
  return true
}

/**
 * Prefer in-memory completed modules; otherwise promote draft.
 * Never clears a draft that still has completed modules without writing a sitting.
 */
export function ensureAbandonedSitting(sittingId, moduleRecords) {
  if (sittingId && moduleRecords?.length > 0) {
    return writeAbandonedSitting(sittingId, moduleRecords)
  }
  return promoteDraftToAbandoned()
}
