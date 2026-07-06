// Diagram quarantine — shared by practice and mock modes. ~1 in 4 extracted
// questions carries a [DIAGRAM: ...] placeholder because the source figure
// couldn't be pulled from the PDF. Split it out so the description of a missing
// figure is NEVER rendered as if it were the question itself.
const DIAGRAM_RE = /\[DIAGRAM:\s*([^\]]*)\]/gi

export function parseDiagrams(text) {
  if (!text) return { stem: '', diagrams: [] }
  const diagrams = []
  const stem = text.replace(DIAGRAM_RE, (_, caption) => {
    diagrams.push(caption.trim())
    return ''
  }).replace(/\n{3,}/g, '\n\n').trim()
  return { stem, diagrams }
}
