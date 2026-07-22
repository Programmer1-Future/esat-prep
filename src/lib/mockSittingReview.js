import questionsData from '../data/questions.json'
import { getEvents } from './eventLog'
import { readStoredValue } from '../hooks/useLocalStorage'

const allQuestions = Array.isArray(questionsData) ? questionsData : questionsData.questions || []
const questionById = new Map(allQuestions.map(q => [q.id, q]))

function questionsForResults(results) {
  return (results || []).map(r => questionById.get(r.qId)).filter(Boolean)
}

/**
 * Resolve a stored sitting into the payload MockSittingReview needs.
 * Prefers modules[].results on the sitting; falls back to mock_logged events by sittingId.
 */
export function resolveSittingReview(sittingId) {
  const sittings = readStoredValue('esat_mock_sittings', [])
  const sitting = sittings.find(s => s.id === sittingId) || null
  if (!sitting) {
    return { sitting: null, moduleResults: [], questionsByModule: {}, reviewable: false, reason: 'not-found' }
  }

  if (sitting.manual) {
    const moduleResults = (sitting.modules || []).map(m => ({
      module: m.module,
      correct: m.correct,
      total: m.total,
      projected: m.projected,
      timeTakenSec: m.timeTakenSec ?? null,
      autoSubmitted: m.autoSubmitted ?? false,
      results: [],
    }))
    return {
      sitting,
      moduleResults,
      questionsByModule: {},
      reviewable: false,
      reason: 'manual',
    }
  }

  const events = getEvents({ type: 'mock_logged' }).filter(e => e.sittingId === sittingId)
  const eventsByModule = new Map()
  for (const e of events) {
    if (e.module) eventsByModule.set(e.module, e)
  }

  const moduleResults = []
  const questionsByModule = {}
  let reviewable = false

  for (const m of sitting.modules || []) {
    let results = Array.isArray(m.results) && m.results.length > 0 ? m.results : null
    let timeTakenSec = m.timeTakenSec ?? null
    let autoSubmitted = m.autoSubmitted ?? false
    let correct = m.correct
    let total = m.total
    let projected = m.projected

    if (!results) {
      const ev = eventsByModule.get(m.module)
      if (ev && Array.isArray(ev.results) && ev.results.length > 0) {
        results = ev.results
        if (timeTakenSec == null && ev.timeTaken != null) timeTakenSec = ev.timeTaken
        if (ev.autoSubmitted != null) autoSubmitted = ev.autoSubmitted
        if (correct == null && ev.score != null) correct = ev.score
        if (total == null && ev.total != null) total = ev.total
        if (projected == null && ev.projected != null) projected = ev.projected
      }
    }

    results = results || []
    const questions = questionsForResults(results)
    if (results.length > 0 && questions.length > 0) reviewable = true
    questionsByModule[m.module] = questions

    moduleResults.push({
      module: m.module,
      correct,
      total,
      projected,
      timeTakenSec,
      autoSubmitted,
      results,
    })
  }

  return {
    sitting,
    moduleResults,
    questionsByModule,
    reviewable,
    reason: reviewable ? null : 'no-results',
  }
}
