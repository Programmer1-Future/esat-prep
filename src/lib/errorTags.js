// Error taxonomy — the four ways a miss happens. Ids are exam-agnostic so the
// same tags flow back into tmuaprep later; only the surface copy is ESAT-flavoured.
// A tag answers "why did I get this wrong?", which the raw outcome can't: a wrong
// answer might be a concept gap OR a careless slip, and the coaching differs.

export const ERROR_TAGS = [
  { id: 'misread', label: 'Misread', hint: 'Read the question wrong' },
  { id: 'method_slip', label: 'Method slip', hint: 'Right idea, careless error' },
  { id: 'concept_gap', label: 'Concept gap', hint: "Didn't know how" },
  { id: 'timed_out', label: 'Timed out', hint: 'Ran out of time' },
]

export const ERROR_TAG_IDS = new Set(ERROR_TAGS.map(t => t.id))

const TAG_BY_ID = new Map(ERROR_TAGS.map(t => [t.id, t]))

export function errorTagLabel(id) {
  return TAG_BY_ID.get(id)?.label || 'Untagged'
}

export function isValidErrorTag(id) {
  return ERROR_TAG_IDS.has(id)
}
