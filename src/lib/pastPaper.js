/**
 * Assemble a real past-paper sitting ordered by printed qnum.
 * Papers may be shorter than ESAT's 27 — callers label original length.
 *
 * Mappings: `src/data/paperQnums.json` (synced from question-bank/id-qnum-mapping/).
 */
import paperQnums from '../data/paperQnums.json'

/**
 * Normalize bank `source` + year → paperQnums key.
 * Bank stores "ENGAA 2016" (or "ENGAA" / "engaa"); keys are ENGAA_2016_S1.
 */
export function paperKey(source, year) {
  const exam = String(source)
    .toUpperCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/\b20\d{2}\b/g, '')
    .trim()
    .split(/\s+/)[0]
  return `${exam}_${year}_S1`
}

/** Display label for a paper (exam name only, year separate). */
export function paperExamLabel(source) {
  return String(source)
    .toUpperCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/\b20\d{2}\b/g, '')
    .trim()
    .split(/\s+/)[0] || String(source)
}

export function listAvailablePapers(allQuestions) {
  const byKey = {}
  for (const q of allQuestions) {
    if (!q.source || !q.year) continue
    const key = paperKey(q.source, q.year)
    if (!paperQnums[key]) continue
    if (!byKey[key]) {
      byKey[key] = {
        key,
        source: paperExamLabel(q.source),
        year: q.year,
        modules: {},
      }
    }
    const mod = q.module || 'unknown'
    byKey[key].modules[mod] = (byKey[key].modules[mod] || 0) + 1
  }
  return Object.values(byKey).sort((a, b) =>
    a.source.localeCompare(b.source) || a.year - b.year,
  )
}

/**
 * Questions for one module from a past paper, in printed order.
 */
export function questionsForPastPaper(allQuestions, { source, year, moduleId }) {
  const key = paperKey(source, year)
  const mapping = paperQnums[key]
  if (!mapping) return []
  const byId = new Map(allQuestions.map(q => [q.id, q]))
  const rows = []
  for (const [id, qnum] of Object.entries(mapping)) {
    const q = byId.get(id)
    if (!q || q.module !== moduleId) continue
    rows.push({ q, qnum: Number(qnum) })
  }
  rows.sort((a, b) => a.qnum - b.qnum)
  return rows.map(r => r.q)
}
