import { MODULES, getModule, moduleForTopic } from './moduleMap'
import { projectScore } from './mockScore'

// Per-module student model — the Phase 5 redesign of De-TMUA-guide's
// studentModel.js. The structural change vs TMUA: there is no combined score,
// so every selector here is scoped to a module and returns 1.0–9.0 projections
// per module, never an aggregate across them.
//
// Three-state outcome model: a correct answer that blew the time budget is a
// different problem from a wrong answer, and for strong students it's the more
// common one. Classification happens at read time from timeSec + difficulty
// already in the ledger, so pre-Phase-5 events are retroactively analysable.

// 40 min / 27 questions ≈ 89s. Targets anchor difficulty 3 at the raw budget
// and widen ~20s per band: easy questions must bank time for hard ones.
export const EXAM_SECS_PER_QUESTION = 89
export const TARGET_SECS_BY_DIFF = { 1: 50, 2: 70, 3: 89, 4: 110, 5: 130 }

export function targetSecs(difficulty) {
  return TARGET_SECS_BY_DIFF[difficulty] ?? EXAM_SECS_PER_QUESTION
}

// wrong | slow | fast, or null for skips (a skip is "unseen", not an outcome).
export function paceOf(result) {
  if (result.outcome === 'wrong' || result.outcome === 'timeout') return 'wrong'
  if (result.outcome !== 'correct') return null
  return (result.timeSec || 0) > targetSecs(result.difficulty) ? 'slow' : 'fast'
}

const ATTEMPT_TYPES = new Set(['quiz_completed', 'review_completed', 'mock_logged'])

function avg(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

// Flatten quiz + review + mock sessions into one per-question attempt stream.
export function getAttempts(events, moduleIds = null) {
  const scope = moduleIds ? new Set(moduleIds) : null
  const out = []
  for (const e of events) {
    if (!ATTEMPT_TYPES.has(e.type) || !Array.isArray(e.results)) continue
    for (const r of e.results) {
      if (scope && !scope.has(r.module)) continue
      out.push({ ...r, ts: e.ts, sessionType: e.type })
    }
  }
  return out
}

function emptyStates() {
  return { wrong: 0, slow: 0, fast: 0, skips: 0 }
}

function tally(bucket, attempt) {
  const pace = paceOf(attempt)
  if (pace) bucket[pace]++
  else bucket.skips++
}

// Per-topic three-state rows, worst first. attempts excludes skips so the
// wrong/slow/fast shares always sum to 1.
export function threeStateByTopic(events, moduleIds = null) {
  const attempts = getAttempts(events, moduleIds)
  const byTopic = {}
  for (const a of attempts) {
    const topicId = a.topicId || 'unknown'
    if (!byTopic[topicId]) {
      byTopic[topicId] = {
        topicId,
        moduleId: a.module || moduleForTopic(topicId),
        ...emptyStates(),
        timeSum: 0,
        timeCount: 0,
      }
    }
    const b = byTopic[topicId]
    tally(b, a)
    if (a.outcome === 'correct' && a.timeSec > 0) {
      b.timeSum += a.timeSec
      b.timeCount++
    }
  }
  return Object.values(byTopic)
    .map(b => {
      const attempted = b.wrong + b.slow + b.fast
      return {
        ...b,
        attempts: attempted,
        avgCorrectSecs: b.timeCount ? b.timeSum / b.timeCount : null,
        wrongShare: attempted ? b.wrong / attempted : 0,
        slowShare: attempted ? b.slow / attempted : 0,
        // Marks at risk = everything that isn't a fast correct answer.
        riskShare: attempted ? (b.wrong + b.slow) / attempted : 0,
      }
    })
    .filter(b => b.attempts > 0)
    .sort((a, b) => b.riskShare - a.riskShare || b.attempts - a.attempts)
}

// Per-difficulty pace vs target within a module (or all modules).
export function threeStateByDifficulty(events, moduleIds = null) {
  const attempts = getAttempts(events, moduleIds)
  const byDiff = {}
  for (const d of [1, 2, 3, 4, 5]) byDiff[d] = { difficulty: d, target: targetSecs(d), ...emptyStates(), times: [] }
  for (const a of attempts) {
    const b = byDiff[a.difficulty]
    if (!b) continue
    tally(b, a)
    if (a.timeSec > 0) b.times.push(a.timeSec)
  }
  return Object.values(byDiff).map(b => ({
    difficulty: b.difficulty,
    target: b.target,
    wrong: b.wrong,
    slow: b.slow,
    fast: b.fast,
    attempts: b.wrong + b.slow + b.fast,
    avgTimeSec: b.times.length ? avg(b.times) : null,
  }))
}

// One module's aggregate signal — the scorecard's supporting numbers.
export function getModuleModel(events, moduleId) {
  const attempts = getAttempts(events, [moduleId])
  const states = emptyStates()
  let lastTs = null
  const outcomes = []
  for (const a of attempts) {
    tally(states, a)
    lastTs = a.ts
    const pace = paceOf(a)
    if (pace) outcomes.push(pace === 'fast' ? 1 : pace === 'slow' ? 0.5 : 0)
  }
  const attempted = states.wrong + states.slow + states.fast
  const accuracy = attempted ? (states.slow + states.fast) / attempted : null
  const recent = outcomes.slice(-15)
  const previous = outcomes.slice(-30, -15)
  const trend = recent.length >= 8 && previous.length >= 8 ? avg(recent) - avg(previous) : null
  const daysSinceSeen = lastTs ? Math.floor((Date.now() - new Date(lastTs).getTime()) / 86400000) : null
  return { moduleId, ...states, attempts: attempted, accuracy, trend, lastTs, daysSinceSeen }
}

// Mock score history for one module, oldest first: [{ ts, date, projected, correct, total }]
export function getModuleMocks(events, moduleId) {
  return events
    .filter(e => e.type === 'mock_logged' && e.module === moduleId)
    .map(e => ({ ts: e.ts, date: e.date, projected: e.projected, correct: e.score, total: e.total }))
    .sort((a, b) => new Date(a.ts) - new Date(b.ts))
}

// Projected exam-day score for one module on the 1.0–9.0 scale.
// ≥3 mocks spanning ≥3 days → linear fit over projected scores (a fit over
// same-day mocks extrapolates noise); ≥15 attempts → recent-vs-earlier accuracy
// trend; ≥1 mock → average of the last 3; else null (not enough signal).
export function getModuleForecast({ events, moduleId, examDate }) {
  const examTs = new Date(examDate + 'T09:00:00').getTime()
  const mocks = getModuleMocks(events, moduleId)
  const spanDays = mocks.length >= 2
    ? (new Date(mocks[mocks.length - 1].ts) - new Date(mocks[0].ts)) / 86400000
    : 0

  if (mocks.length >= 3 && spanDays >= 3) {
    const pts = mocks.map(m => ({ x: new Date(m.ts).getTime() / 86400000, y: m.projected }))
    const mx = avg(pts.map(p => p.x))
    const my = avg(pts.map(p => p.y))
    let num = 0, den = 0
    for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
    const slope = den === 0 ? 0 : num / den
    // Extrapolate at most 28 days past the last mock — a fit carried months
    // forward inflates every improving trend to a ceiling 9.0.
    const lastX = pts[pts.length - 1].x
    const horizonX = Math.min(examTs / 86400000, lastX + 28)
    const projected = Math.max(1, Math.min(9, my + slope * (horizonX - mx)))
    return {
      basis: 'mocks',
      current: mocks[mocks.length - 1].projected,
      projected: Math.round(projected * 10) / 10,
      slopePerWeek: Math.round(slope * 7 * 10) / 10,
      mockCount: mocks.length,
    }
  }

  const attempts = getAttempts(events, [moduleId]).filter(a => a.outcome !== 'skip')
  if (attempts.length >= 15) {
    const half = Math.floor(attempts.length / 2)
    const acc = list => list.filter(a => a.outcome === 'correct').length / list.length
    const recentAcc = acc(attempts.slice(half))
    const delta = recentAcc - acc(attempts.slice(0, half))
    return {
      basis: 'accuracy',
      current: projectScore(recentAcc * 27),
      projected: projectScore(Math.max(0, Math.min(1, recentAcc + delta)) * 27),
      slopePerWeek: null,
      mockCount: mocks.length,
    }
  }

  if (mocks.length >= 1) {
    const recent = mocks.slice(-3)
    const projected = Math.round(avg(recent.map(m => m.projected)) * 10) / 10
    return {
      basis: 'mock',
      current: mocks[mocks.length - 1].projected,
      projected,
      slopePerWeek: null,
      mockCount: mocks.length,
    }
  }

  return null
}

// Cross-module "which module needs attention most right now" — no TMUA
// equivalent. Score ∈ [0,1]: wrong answers weigh most, slow-corrects carry real
// weight (they are the marks strong students lose), staleness tops it up.
// Modules with thin data rank first — you can't triage what you haven't measured.
export function getModuleAttention(events, moduleIds) {
  const MIN_ATTEMPTS = 8
  const rows = moduleIds.map(moduleId => {
    const m = getModuleModel(events, moduleId)
    const name = getModule(moduleId)?.short || moduleId
    if (m.attempts < MIN_ATTEMPTS) {
      return {
        moduleId,
        score: 1,
        thin: true,
        reason: m.attempts === 0
          ? `No ${name} attempts logged yet — start here.`
          : `Only ${m.attempts} attempt${m.attempts !== 1 ? 's' : ''} logged — not enough signal to trust.`,
      }
    }
    const wrongRate = m.wrong / m.attempts
    const slowRate = m.slow / m.attempts
    const staleness = Math.min((m.daysSinceSeen ?? 0) / 14, 1)
    const score = 0.55 * wrongRate + 0.3 * slowRate + 0.15 * staleness
    const parts = [`${Math.round(wrongRate * 100)}% wrong`, `${Math.round(slowRate * 100)}% slow-correct`]
    if (m.daysSinceSeen >= 4) parts.push(`last practised ${m.daysSinceSeen} days ago`)
    if (m.trend !== null && m.trend < -0.05) parts.push('getting worse')
    if (m.trend !== null && m.trend > 0.05) parts.push('improving')
    return { moduleId, score: Math.round(score * 100) / 100, thin: false, reason: parts.join(' · ') + '.' }
  })
  return rows.sort((a, b) => b.score - a.score)
}

export const ALL_MODULE_IDS = MODULES.map(m => m.id)
