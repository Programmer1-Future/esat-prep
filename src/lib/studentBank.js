/**
 * Student-facing bank filter — never serve quarantined / needs_repair items
 * even if they slip into a local JSON blob.
 */
export function isQuarantined(q) {
  if (!q) return true
  if (q.needs_repair === true) return true
  const tier = q.quality_tier
  if (tier === 'needs_repair' || tier === 'needs_source_check') return true
  return false
}

export function studentQuestions(allQuestions) {
  return (allQuestions || []).filter(q => !isQuarantined(q))
}
