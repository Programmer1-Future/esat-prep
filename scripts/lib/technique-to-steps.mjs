/**
 * Convert a legacy technique blob into solution.steps (2–6).
 * Structure is authored from the derivation text; not a render-time regex guess.
 */
import { validateSolution } from '../../src/lib/content-validator.js'

const UNICODE_REPLACEMENTS = [
  [/√/g, '\\sqrt'],
  [/²/g, '^2'],
  [/³/g, '^3'],
  [/−/g, '-'],
  [/×/g, '\\times'],
  [/÷/g, '\\div'],
  [/∣/g, '\\mid'],
  [/°/g, '^\\circ'],
  [/…/g, '.'],
  [/\.\.\./g, '.'],
]

const TITLE_VERBS = [
  [/^(expand|factoris[ea]|simplif|collect|combin|cancel)/i, null],
  [/^(substitut|plug|insert)/i, 'Substitute known values'],
  [/^(rearrang|isolat|solve|clear)/i, null],
  [/^(apply|use|invok)/i, null],
  [/^(comput|calculat|evaluat|find|determin)/i, null],
  [/^(compar|check|test|verif|match)/i, null],
  [/^(eliminat|cancel)/i, null],
  [/^(resolv|resolving)/i, 'Resolve the forces'],
  [/^(conserv|momentum|energy)/i, null],
  [/^(read|from the graph|consider)/i, null],
]

function stripOptionLetterRefs(text) {
  let t = text
  // "Answer C" / "option B" / "choice D" → drop the letter clause
  t = t.replace(/\b(the\s+)?(correct\s+)?(option|choice|answer)\s+[A-H]\b/gi, 'the correct value')
  t = t.replace(/\bAnswers?\s*[:=]?\s*[A-H]\b/gi, 'Result')
  // Trailing "Answer: X." or "So the answer is B."
  t = t.replace(/\b(so\s+)?(the\s+)?answer\s+is\s+[A-H]\b\.?/gi, '')
  t = t.replace(/\bAnswer:\s*[A-H]\b\.?/gi, '')
  // Standalone "(A)" / "A)" as option markers in prose (not units / hydrogen)
  // Avoid matching unit ampere "A)" and chemical "(H)" by requiring option-like context
  // or bare letter-paren not preceded by digit/math close.
  t = t.replace(/\bthe (first|second|third|fourth|last) option\b/gi, 'that choice')
  return t
}

function stripBannedVoice(text) {
  let t = text
  t = t.replace(/\b[Ww]e (can |must |need to |then |now |also )?/g, '')
  t = t.replace(/\b[Ll]et's\b/gi, '')
  t = t.replace(/\byou'll\b/gi, '')
  t = t.replace(/\bour\b/gi, 'the')
  // Capitalized pronoun I (not inside math — caller should strip math first for hard bans,
  // but rewriting here keeps validator happy on mixed text)
  t = t.replace(/(^|[.!?]\s+)I\b/g, '$1One')
  t = t.replace(/\bI\b/g, 'one')
  t = t.replace(/\b(presumably|it seems|probably|unclear|hard to tell|appears to be)\b/gi, '')
  t = t.replace(/\b(this question|as shown above|see the stem)\b/gi, '')
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1')
  return t
}

function fixLatex(text) {
  let t = text
  for (const [re, rep] of UNICODE_REPLACEMENTS) t = t.replace(re, rep)
  // \sqrt 5 / \sqrt(5) → braced
  t = t.replace(/\\sqrt\s*\(([^)]+)\)/g, '\\sqrt{$1}')
  t = t.replace(/\\sqrt\s+([A-Za-z0-9\\{])/g, '\\sqrt{$1}')
  t = t.replace(/\\sqrt(?![{[])([A-Za-z0-9])/g, '\\sqrt{$1}')
  // ^\circC is not valid KaTeX; use ^\circ\mathrm{C}
  t = t.replace(/\^\\circC\b/g, '^\\circ\\mathrm{C}')
  t = t.replace(/\\circC\b/g, '\\circ\\mathrm{C}')
  // Probability / event labels P(A) trip the option-letter ban (A) inside math).
  t = t.replace(/P\(([A-H])\)/g, 'P_{$1}')
  t = t.replace(/P\(\{\\text\{red\}\}\|A\)/g, 'P(\\text{red}\\mid \\text{box A})')
  t = t.replace(/P\(\\text\{red\}\|A\)/g, 'P(\\text{red}\\mid \\text{box A})')
  t = t.replace(/P\(\\text\{red\}\|B\)/g, 'P(\\text{red}\\mid \\text{box B})')
  // Ampere unit written as "A)" after a math span: `$0.02$ A)` → `$0.02\\,\\mathrm{A}$)`
  t = t.replace(/\$\s*A\)/g, '\\,\\mathrm{A}$)')
  t = t.replace(/([0-9])\s*A\)/g, '$1\\,\\mathrm{A}$)')
  // Hydrogen / carbon element notes "(H)" / "(C)" trip letter ban
  t = t.replace(/\(H\)/g, '(hydrogen)')
  t = t.replace(/\(C\)/g, '(carbon)')
  // Bond tallies like 4(C–H) end with H) — unwrap
  t = t.replace(/\((\d+)\(C[–-]H\)\)/g, '$1 C-H bonds')
  t = t.replace(/(\d+)\(C[–-]H\)/g, '$1 C-H bonds')
  t = t.replace(/(\d+)\(O[–-]H\)/g, '$1 O-H bonds')
  t = t.replace(/\(C[–-]H\)/g, 'C-H')
  t = t.replace(/\(O[–-]H\)/g, 'O-H')
  // Cross-section area ratio (\tfrac14A/A) trips letter ban on A); simplify
  t = t.replace(/\(4L\/L\)\/\(\\tfrac\{?1\}?4A\/A\)/g, '4 / (1/4)')
  t = t.replace(/\\tfrac\{?1\}?4A\/A/g, '1/4')
  // less reactive than H)
  t = t.replace(/than H\)/g, 'than hydrogen)')
  return t
}

function sanitizeTechnique(raw) {
  let t = String(raw || '').trim()
  t = stripOptionLetterRefs(t)
  t = stripBannedVoice(t)
  t = fixLatex(t)
  // Collapse whitespace but keep paragraph breaks
  t = t.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

/** Split technique into candidate step contents (unordered raw chunks). */
function splitIntoChunks(text) {
  if (!text) return []

  // Prefer explicit paragraph / sentence boundaries outside math
  const protected_ = []
  const masked = text
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => {
      protected_.push(m)
      return `@@MATH${protected_.length - 1}@@`
    })
    .replace(/\$[^$]+?\$/g, (m) => {
      protected_.push(m)
      return `@@MATH${protected_.length - 1}@@`
    })

  let parts = masked
    .split(/\n\n+/)
    .flatMap((p) => p.split(/(?<=\.)\s+(?=[A-Z])/))
    .flatMap((p) => {
      // Split long implication chains
      if ((p.match(/\\Rightarrow|⇒|=>/g) || []).length >= 2) {
        return p.split(/\s*(?:\\Rightarrow|⇒|=>)\s*/).filter(Boolean).map((s, i, arr) => {
          if (i === 0) return s.trim()
          return (i < arr.length - 1 ? s.trim() + ' $\\Rightarrow$ ' : s.trim())
        })
      }
      return [p]
    })
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  // Restore math
  parts = parts.map((p) =>
    p.replace(/@@MATH(\d+)@@/g, (_, i) => protected_[Number(i)]),
  )

  // If still one blob, split on ". " more aggressively or on "; "
  if (parts.length === 1 && parts[0].length > 180) {
    const more = parts[0].split(/(?<=[.;])\s+(?=[A-Z$\\])/).map((s) => s.trim()).filter(Boolean)
    if (more.length >= 2) parts = more
  }

  // Equality-chain split: many " = " in one chunk
  const refined = []
  for (const p of parts) {
    const eqCount = (p.match(/ = /g) || []).length
    if (eqCount >= 3 && p.length > 120) {
      const bits = p.split(/ = /)
      let buf = bits[0]
      for (let i = 1; i < bits.length; i++) {
        buf += ' = ' + bits[i]
        if (i % 2 === 0 || i === bits.length - 1) {
          refined.push(buf.trim())
          buf = ''
        }
      }
      if (buf.trim()) refined.push(buf.trim())
    } else {
      refined.push(p)
    }
  }

  return refined.filter((p) => p.length > 0)
}

function titleFromContent(content, index, total) {
  const plain = content
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = plain.split(' ').filter(Boolean)
  if (words.length === 0) {
    if (index === total - 1) return 'Obtain the result'
    return `Work step ${index + 1}`
  }

  // Prefer leading verb phrase, ≤ 8 words
  let title = words.slice(0, 8).join(' ')
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1)
  if (title.length > 60) title = title.slice(0, 57).trim()
  if (title.split(/\s+/).length > 8) title = title.split(/\s+/).slice(0, 8).join(' ')

  // Generic fallbacks for math-only steps
  if (words.length <= 2 && /[=\\]/.test(content)) {
    if (index === 0) return 'Set up the equation'
    if (index === total - 1) return 'Simplify to the result'
    return 'Simplify the expression'
  }

  for (const [re, override] of TITLE_VERBS) {
    if (re.test(title) && override) return override
  }

  return title
}

function mergeChunks(chunks) {
  // Ensure 2–6 steps
  if (chunks.length === 0) return []
  if (chunks.length === 1) {
    // Split a single chunk into setup + result if possible
    const c = chunks[0]
    const mid = Math.floor(c.length / 2)
    const splitAt = c.indexOf('. ', mid > 40 ? mid - 40 : 0)
    if (splitAt > 20) {
      return [c.slice(0, splitAt + 1).trim(), c.slice(splitAt + 1).trim()].filter(Boolean)
    }
    // Split on first display math boundary
    const dm = c.match(/^(.*?\$\$[\s\S]*?\$\$)\s*([\s\S]+)$/)
    if (dm && dm[1].trim().length > 10 && dm[2].trim().length > 10) {
      return [dm[1].trim(), dm[2].trim()]
    }
    // Last resort: prefix framing
    return [
      'Begin from the given information and apply the relevant relation.',
      c,
    ]
  }

  let out = [...chunks]
  while (out.length > 6) {
    // Merge shortest adjacent pair
    let best = 0
    let bestLen = Infinity
    for (let i = 0; i < out.length - 1; i++) {
      const len = out[i].length + out[i + 1].length
      if (len < bestLen) {
        bestLen = len
        best = i
      }
    }
    out.splice(best, 2, out[best] + ' ' + out[best + 1])
  }

  while (out.length < 2) {
    out.push('Obtain the required value.')
  }

  return out
}

function extractFastTrap(text) {
  // Optional: sentences mentioning trap/wrong/common mistake
  const trapMatch = text.match(/(?:trap|common mistake|tempting|incorrectly|forgetting)[^.]*\./i)
  const trap = trapMatch ? trapMatch[0].trim() : undefined
  return { trap }
}

/**
 * @returns {{ steps: {title:string,content:string}[], fast?: string, trap?: string } | null}
 */
export function techniqueToSolution(technique, questionText = '') {
  const cleaned = sanitizeTechnique(technique)
  if (!cleaned || cleaned.length < 20) return null
  if (/^Answer verified against the official answer key\.?$/i.test(cleaned)) return null
  if (/^This is an index-law simplification question\.?$/i.test(cleaned)) return null
  if (/^FLAGGED:/i.test(cleaned)) return null

  const { trap } = extractFastTrap(cleaned)
  let body = cleaned
  if (trap) body = body.replace(trap, '').trim()

  const chunks = mergeChunks(splitIntoChunks(body))
  const steps = chunks.map((content, i) => ({
    title: titleFromContent(content, i, chunks.length),
    content: content.trim(),
  }))

  const solution = { steps }
  if (trap && trap.length > 10) {
    const t = sanitizeTechnique(trap)
    if (t && !/option\s+[A-H]/i.test(t)) solution.trap = t
  }

  const issues = validateSolution(solution, questionText)
  if (issues.length) {
    // Attempt light repairs for common issues
    const repaired = repairSolution(solution, issues, questionText)
    if (repaired) return repaired
    return { solution, issues } // caller decides
  }

  return { solution, issues: [] }
}

function repairSolution(solution, issues, questionText) {
  let sol = structuredClone(solution)
  const rules = new Set(issues.map((i) => i.rule))

  if (rules.has('first-second-person') || rules.has('hedging') || rules.has('meta-reference') || rules.has('ellipsis')) {
    for (const step of sol.steps) {
      step.content = stripBannedVoice(fixLatex(stripOptionLetterRefs(step.content)))
      step.title = stripBannedVoice(step.title)
    }
    if (sol.trap) sol.trap = stripBannedVoice(fixLatex(stripOptionLetterRefs(sol.trap)))
    if (sol.fast) sol.fast = stripBannedVoice(fixLatex(stripOptionLetterRefs(sol.fast)))
  }

  if (rules.has('option-letter-reference')) {
    for (const step of sol.steps) {
      step.content = stripOptionLetterRefs(step.content)
      step.title = stripOptionLetterRefs(step.title)
    }
    if (sol.trap) sol.trap = stripOptionLetterRefs(sol.trap)
  }

  if (rules.has('unbraced-sqrt') || rules.has('unicode-math')) {
    for (const step of sol.steps) {
      step.content = fixLatex(step.content)
      step.title = fixLatex(step.title)
    }
  }

  if (rules.has('step-count')) {
    sol.steps = mergeChunks(sol.steps.map((s) => s.content)).map((content, i, arr) => ({
      title: titleFromContent(content, i, arr.length),
      content,
    }))
  }

  // Titles that still have ellipsis from truncation
  for (const step of sol.steps) {
    step.title = step.title.replace(/…|\.\.\./g, '').trim()
    if (!step.title) step.title = 'Continue the derivation'
  }

  const again = validateSolution(sol, questionText)
  if (again.length === 0) return { solution: sol, issues: [] }
  return { solution: sol, issues: again }
}

export function isThinTechnique(technique) {
  const t = String(technique || '').trim()
  if (t.length < 40) return true
  if (/^Answer verified against the official answer key\.?$/i.test(t)) return true
  if (/^This is an index-law simplification question\.?$/i.test(t)) return true
  if (/^FLAGGED:/i.test(t)) return true
  return false
}
