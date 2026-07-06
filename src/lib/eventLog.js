import { readStoredValue, updateStoredValue, useLocalStorage } from '../hooks/useLocalStorage'

// Append-only learning ledger — the single source of truth for all analytics.
// Ported from De-TMUA-guide's eventLog.js; field names kept exam-agnostic so the
// same event shapes flow back into tmuaprep later (Phase 3 requirement).
//   quiz_completed   { config, score, total, totalTimeSec, results[] }
//   review_completed { score, total, totalTimeSec, results[] }
//   study_logged     { date, hours, questionsCompleted, sessionType, ... }
//   mock_logged      { date, module, score, timeTaken, ... }
//   topic_updated    { topicId, confidence?, status? }
// results[] items: { qId, module, topicId, difficulty, outcome, timeSec, selected }
//   outcome ∈ correct | wrong | skip | timeout

const KEY = 'esat_events'
const MAX_EVENTS = 5000

export function logEvent(type, payload = {}) {
  const event = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    type,
    ...payload,
  }
  updateStoredValue(KEY, events => {
    const next = [...events, event]
    return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next
  }, [])
  return event
}

export function getEvents({ type, types, since, topicId, module } = {}) {
  let events = readStoredValue(KEY, [])
  if (type) events = events.filter(e => e.type === type)
  if (types) events = events.filter(e => types.includes(e.type))
  if (since) events = events.filter(e => e.ts >= since)
  if (module) {
    events = events.filter(e =>
      e.module === module ||
      (Array.isArray(e.results) && e.results.some(r => r.module === module))
    )
  }
  if (topicId) {
    events = events.filter(e =>
      e.topicId === topicId ||
      (Array.isArray(e.results) && e.results.some(r => r.topicId === topicId))
    )
  }
  return events
}

// Live-updating hook: re-renders whenever any page logs an event.
export function useEvents() {
  const [events] = useLocalStorage(KEY, [])
  return events
}
