// Diagram handling — shared by practice and mock modes. Extracted questions carry
// a [DIAGRAM: caption] placeholder where the source figure sits in the paper.
// Split it out so the description of a figure is NEVER rendered as if it were the
// question itself, and resolve it to the crop taken from the source PDF.
const DIAGRAM_RE = /\[DIAGRAM:\s*([^\]]*)\]/gi

// Crops live at public/diagrams/<question id>.png, one per question. Anything
// beyond the first placeholder has no crop and falls back to the pending notice.
const srcFor = (id) => `${import.meta.env.BASE_URL}diagrams/${id}.png`

// Removing the placeholder leaves the punctuation that sat either side of it, so
// "...speed v. [DIAGRAM: ...]. Which row..." collapses to "speed v. . Which row".
// Repair only what the removal created: doubled sentence punctuation, a space before
// punctuation, and runs of spaces. Deliberately conservative — this must not rewrite
// the paper's own text.
function repairPunctuation(s) {
  return s
    .replace(/([.?!,;:])\s*\1/g, '$1')
    .replace(/\s+([.?!,;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
}

export function parseDiagrams(text, id) {
  if (!text) return { stem: '', diagrams: [] }
  const diagrams = []
  const stripped = text.replace(DIAGRAM_RE, (_, caption) => {
    diagrams.push({
      caption: caption.trim(),
      src: id && diagrams.length === 0 ? srcFor(id) : null,
    })
    return ''
  })
  const stem = repairPunctuation(stripped).replace(/\n{3,}/g, '\n\n').trim()
  return { stem, diagrams }
}
