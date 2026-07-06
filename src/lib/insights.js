import { ERROR_TAGS } from './errorTags'
import { moduleForTopic } from './moduleMap'

// Error-type-per-topic aggregation over the event ledger. This is the payload
// behind the differentiator claim: "your algebra misses are mostly timed-out, not
// concept gaps." It reads every result item across quiz/review events, keeps only
// misses (wrong | timeout), and buckets them by topic → error tag.
//
// Input: raw events array (from getEvents/useEvents). Field names are exam-agnostic
// so the same function runs unchanged over a tmuaprep ledger.

const MISS_OUTCOMES = new Set(['wrong', 'timeout'])
const LEDGER_TYPES = new Set(['quiz_completed', 'review_completed'])

function emptyTagCounts() {
  const counts = { untagged: 0 }
  for (const t of ERROR_TAGS) counts[t.id] = 0
  return counts
}

// Returns: { [topicId]: { topicId, moduleId, total, dominant, counts: {tagId: n, untagged: n} } }
// `total` is total misses for the topic; `dominant` is the tag id with the most
// misses (null if every miss is untagged or the topic has no misses).
export function errorTypeByTopic(events) {
  const byTopic = {}
  for (const e of events) {
    if (!LEDGER_TYPES.has(e.type) || !Array.isArray(e.results)) continue
    for (const r of e.results) {
      if (!MISS_OUTCOMES.has(r.outcome)) continue
      const topicId = r.topicId || 'unknown'
      if (!byTopic[topicId]) {
        byTopic[topicId] = {
          topicId,
          moduleId: r.module || moduleForTopic(topicId),
          total: 0,
          counts: emptyTagCounts(),
        }
      }
      const bucket = byTopic[topicId]
      bucket.total++
      const tag = r.errorTag
      if (tag && tag in bucket.counts && tag !== 'untagged') bucket.counts[tag]++
      else bucket.counts.untagged++
    }
  }
  for (const bucket of Object.values(byTopic)) {
    bucket.dominant = dominantTag(bucket.counts)
  }
  return byTopic
}

function dominantTag(counts) {
  let best = null
  let bestN = 0
  for (const t of ERROR_TAGS) {
    if (counts[t.id] > bestN) { best = t.id; bestN = counts[t.id] }
  }
  return best
}

// Rows sorted by total misses descending — the topics that hurt most, first.
export function errorTypeRows(events) {
  return Object.values(errorTypeByTopic(events)).sort((a, b) => b.total - a.total)
}
