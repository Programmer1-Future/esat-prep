/**
 * Adaptive question selection for practice "Smart mix".
 * Ported from De-TMUA-guide; ESAT uses moduleMap topic ids + ledger attempts.
 */
import { getAttempts } from './studentModel'
import { topicIdForQuestion } from './moduleMap'

function buildTopicModel(events) {
  const byTopic = {}
  for (const a of getAttempts(events)) {
    const topicId = a.topicId || topicIdForQuestion({ topic: a.topicId, module: a.module })
    if (!topicId) continue
    if (!byTopic[topicId]) {
      byTopic[topicId] = { topicId, attempts: 0, correct: 0, lastTs: null }
    }
    const t = byTopic[topicId]
    t.attempts++
    if (a.outcome === 'correct') t.correct++
    t.lastTs = a.ts
  }
  return Object.fromEntries(
    Object.values(byTopic).map(t => [
      t.topicId,
      {
        ...t,
        accuracy: t.attempts > 0 ? t.correct / t.attempts : null,
        daysSinceSeen: t.lastTs
          ? Math.floor((Date.now() - new Date(t.lastTs).getTime()) / 86400000)
          : null,
      },
    ]),
  )
}

function buildQuestionHistory(events) {
  const map = {}
  for (const a of getAttempts(events)) {
    if (!a.qId) continue
    const h = map[a.qId] || { attempts: 0, correct: 0, lastTs: null, lastOutcome: null }
    h.attempts++
    if (a.outcome === 'correct') h.correct++
    h.lastTs = a.ts
    h.lastOutcome = a.outcome
    map[a.qId] = h
  }
  return map
}

/** Score pool and return top `count` questions (presentation order shuffled). */
export function selectAdaptive(allQuestions, events, count = 10) {
  const byTopic = buildTopicModel(events)
  const qHist = buildQuestionHistory(events)
  const now = Date.now()

  const scored = allQuestions
    .map(q => {
      const topicId = topicIdForQuestion(q)
      if (!topicId) return null
      const t = byTopic[topicId]
      let score = 0

      if (!t || t.attempts === 0) {
        score += 1.2
      } else {
        score += (1 - (t.accuracy ?? 0.5)) * 2.5
        if (t.daysSinceSeen !== null) score += Math.min(t.daysSinceSeen / 30, 1)
      }

      const h = qHist[q.id]
      if (!h) {
        score += 1.5
      } else {
        const daysSince = (now - new Date(h.lastTs).getTime()) / 86400000
        if (h.lastOutcome !== 'correct') score += 1.0
        else if (daysSince < 7) score -= 2.0
        else score += 0.2
      }

      const acc = t?.accuracy ?? 0.5
      const targetDiff = acc >= 0.8 ? 4.5 : acc >= 0.6 ? 3.5 : 2.5
      score -= Math.abs((q.difficulty || 3) - targetDiff) * 0.3
      score += Math.random() * 0.6
      return { q, score }
    })
    .filter(Boolean)

  scored.sort((a, b) => b.score - a.score)
  const picked = scored.slice(0, count).map(s => s.q)
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]]
  }
  return picked
}
