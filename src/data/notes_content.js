// Per-module notes content, keyed module → topicId → markdown (KaTeX + GFM).
// Empty shell: Phase 6 wires the rendering pipeline only. Content lands
// module-by-module as extraction/writing completes (maths2 can start from
// De-TMUA-guide's adv-* notes — see Module & Topic Map — the rest is fresh).
export const NOTES = {
  maths1: {},
  maths2: {},
  physics: {},
  chemistry: {},
  biology: {},
}

export function getNote(moduleId, topicId) {
  return NOTES[moduleId]?.[topicId] || null
}
