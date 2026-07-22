// Pure validation logic for the Explanation System v2 content gate
// (docs/CONTENT_SPEC.md, plan §7). Kept separate from scripts/validate-content.mjs
// so every rule is a plain function testable with vitest, independent of
// file I/O or git.
import katex from 'katex'
import { compileExpr } from './expr.js'
import { circleLine, numericDerivative, numericIntersections } from './diagram-geometry.js'

export const KNOWN_DIAGRAM_CASES = new Set([
  'circle-line', 'curve', 'curve-tangent', 'area-under-curve',
  'trig-solutions', 'triangle', 'transformation', 'number-line',
])

// -- math-span helpers -------------------------------------------------

/** Extracts every $$...$$ and $...$ span's TeX source (without the delimiters). */
export function extractMathSpans(text) {
  const spans = []
  const withoutDisplay = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    spans.push(tex)
    return ' '
  })
  withoutDisplay.replace(/\$([^$]+?)\$/g, (_, tex) => {
    spans.push(tex)
    return ' '
  })
  return spans
}

/** Removes math spans, leaving only the prose -- for checks that must ignore maths (e.g. Roman numerals like "I" inside `$I$` are not the pronoun "I"). */
export function stripMathSpans(text) {
  return text.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$]*\$/g, ' ')
}

/** A raw, unescaped `$` count that isn't even means an unclosed math span. */
export function hasUnbalancedDelimiters(text) {
  const count = (text.match(/\$/g) || []).length
  return count % 2 !== 0
}

// -- individual rule checks (each returns an array of {rule, message}) -

export function checkKatexCompiles(text) {
  const issues = []
  for (const tex of extractMathSpans(text)) {
    try {
      katex.renderToString(tex, { throwOnError: true, strict: 'error' })
    } catch (e) {
      issues.push({ rule: 'katex-compile', message: `LaTeX span "${tex}" fails to compile: ${e.message}` })
    }
  }
  return issues
}

// The actual historical bug (commit 5b5cdaa): katex.renderToString does NOT
// throw on `\sqrt 2` or `\sqrt (5)` -- it silently renders sqrt-of-nothing
// plus stray content outside the root. This regex is the real guard;
// checkKatexCompiles above catches a DIFFERENT class of error (genuinely
// invalid LaTeX) and is not a substitute for this check.
export function checkUnbracedSqrt(text) {
  const issues = []
  const re = /\\sqrt(?![{[])/g
  let m
  while ((m = re.exec(text))) {
    issues.push({ rule: 'unbraced-sqrt', message: `Unbraced "\\sqrt" at position ${m.index} -- must be "\\sqrt{...}" (bare \\sqrt silently mis-renders instead of erroring)` })
  }
  return issues
}

const UNICODE_MATH_CHARS = /[√²³−×÷∣]/g

export function checkUnicodeMath(text) {
  const issues = []
  const found = text.match(UNICODE_MATH_CHARS)
  if (found) {
    issues.push({ rule: 'unicode-math', message: `Unicode math character(s) ${[...new Set(found)].join(' ')} found -- use LaTeX only in solution content` })
  }
  return issues
}

const LETTER_BAN_PATTERNS = [
  /\b(option|choice|answer)\s+[A-H]\b/i,
  // Excludes a letter directly preceded by +/- (e.g. "cos(A+B)"): compound-angle
  // and other multi-variable formulas commonly pair two single-letter names
  // inside parens, which is genuine math notation, not an option reference.
  /(?<![+-])\b[A-H]\)/,
  /\bthe (first|second|third|fourth|last) option\b/i,
]

export function checkLetterBan(text) {
  const issues = []
  for (const pattern of LETTER_BAN_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      issues.push({ rule: 'option-letter-reference', message: `Text references an option letter ("${m[0]}") -- options are shuffled and re-lettered per render, this WILL be wrong` })
    }
  }
  return issues
}

const HARD_BAN_PATTERNS = [
  // "I" is case-SENSITIVE and deliberately excludes we/our's case-insensitivity:
  // a genuine first-person pronoun is always capitalized, whereas a bare
  // lowercase "i" is virtually always "i.e." -- case-insensitive matching
  // here flagged every "i.e." as the pronoun "I" (found while migrating
  // GEN-GEOM-065/075).
  { rule: 'first-second-person', pattern: /\b(we|you'll|let's|our)\b/i, label: 'first/second person' },
  { rule: 'first-second-person', pattern: /\bI\b/, label: 'first/second person' },
  { rule: 'hedging', pattern: /\b(presumably|it seems|probably|unclear|hard to tell|appears to be)\b/i, label: 'hedging language' },
  { rule: 'meta-reference', pattern: /\b(this question|as shown above|see the stem)\b/i, label: 'meta-reference to the platform' },
  { rule: 'ellipsis', pattern: /\.\.\.|…/, label: 'ellipsis standing in for reasoning' },
]

/** Checked against math-STRIPPED text so a Roman-numeral label like `$I$` never false-positives as the pronoun "I". */
export function checkHardBans(text) {
  const prose = stripMathSpans(text)
  const issues = []
  for (const { rule, pattern, label } of HARD_BAN_PATTERNS) {
    const m = prose.match(pattern)
    if (m) issues.push({ rule, message: `${label} found: "${m[0]}"` })
  }
  return issues
}

function normalizeWords(text) {
  return stripMathSpans(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

/** Flags a >=15 consecutive word overlap between the solution and the question stem (padding, not derivation). */
export function checkStemOverlap(solutionText, questionText, windowSize = 15) {
  const qWords = normalizeWords(questionText)
  const sText = normalizeWords(solutionText).join(' ')
  for (let i = 0; i + windowSize <= qWords.length; i++) {
    const window = qWords.slice(i, i + windowSize).join(' ')
    if (window && sText.includes(window)) {
      return [{ rule: 'stem-overlap', message: `Solution repeats >=${windowSize} consecutive words from the question verbatim: "${window}"` }]
    }
  }
  return []
}

// -- solution-level validation ------------------------------------------

export function validateSolutionText(text) {
  const issues = []
  if (hasUnbalancedDelimiters(text)) {
    issues.push({ rule: 'unbalanced-delimiters', message: `Odd number of "$" characters -- an unclosed math span` })
    return issues // further math-span checks would be unreliable on unbalanced text
  }
  issues.push(...checkKatexCompiles(text))
  issues.push(...checkUnbracedSqrt(text))
  issues.push(...checkUnicodeMath(text))
  issues.push(...checkLetterBan(text))
  issues.push(...checkHardBans(text))
  return issues
}

export function validateSolution(solution, questionText) {
  const issues = []
  if (!Array.isArray(solution.steps) || solution.steps.length < 2 || solution.steps.length > 6) {
    issues.push({ rule: 'step-count', message: `solution.steps must have 2-6 items, found ${solution.steps?.length ?? 0}` })
  }
  const allText = []
  for (const [i, step] of (solution.steps || []).entries()) {
    if (!step.title || typeof step.title !== 'string') {
      issues.push({ rule: 'step-shape', message: `Step ${i + 1} is missing a non-empty title` })
    }
    if (!step.content || typeof step.content !== 'string') {
      issues.push({ rule: 'step-shape', message: `Step ${i + 1} is missing non-empty content` })
    }
    if (step.title) allText.push(step.title)
    if (step.content) allText.push(step.content)
  }
  if (solution.fast) allText.push(solution.fast)
  if (solution.trap) allText.push(solution.trap)

  const combined = allText.join('\n\n')
  issues.push(...validateSolutionText(combined))
  if (questionText) issues.push(...checkStemOverlap(combined, questionText))

  return issues
}

// -- diagram validation ---------------------------------------------------

function requireFields(obj, fields, caseName) {
  const issues = []
  for (const f of fields) {
    if (obj?.[f] === undefined) {
      issues.push({ rule: 'diagram-schema', message: `${caseName}: missing required field "${f}"` })
    }
  }
  return issues
}

function checkExprParses(exprSource, midpoint, extraFunctions) {
  const issues = []
  try {
    const compiled = compileExpr(exprSource, { functions: extraFunctions })
    const value = compiled.evaluate(midpoint)
    if (!Number.isFinite(value)) {
      issues.push({ rule: 'expr-not-finite', message: `Expression "${exprSource}" is not finite at x=${midpoint}` })
    }
  } catch (e) {
    issues.push({ rule: 'expr-parse', message: `Expression "${exprSource}" failed to parse: ${e.message}` })
  }
  return issues
}

export function validateDiagram(diagram, solutionText = '') {
  const issues = []
  if (!KNOWN_DIAGRAM_CASES.has(diagram.case)) {
    issues.push({ rule: 'unknown-case', message: `Unknown diagram case "${diagram.case}"` })
    return issues
  }

  switch (diagram.case) {
    case 'circle-line': {
      issues.push(...requireFields(diagram, ['circle', 'line'], 'circle-line'))
      if (diagram.circle && diagram.line) {
        if (!(diagram.circle.r2 > 0)) {
          issues.push({ rule: 'circle-line-r2', message: `circle.r2 must be > 0, got ${diagram.circle.r2}` })
        } else {
          const result = circleLine(diagram.circle, diagram.line)
          if (/\btangent\b/i.test(solutionText) && result.kind !== 'tangent') {
            issues.push({ rule: 'circle-line-mismatch', message: `Solution text says "tangent" but the givens produce a "${result.kind}" (d=${result.d.toFixed(4)}, r=${result.r.toFixed(4)})` })
          } else if (/\bchord\b/i.test(solutionText) && result.kind !== 'chord') {
            issues.push({ rule: 'circle-line-mismatch', message: `Solution text says "chord" but the givens produce a "${result.kind}" (d=${result.d.toFixed(4)}, r=${result.r.toFixed(4)})` })
          }
        }
      }
      break
    }
    case 'curve': {
      issues.push(...requireFields(diagram, ['functions', 'x_range'], 'curve'))
      if (Array.isArray(diagram.functions) && diagram.x_range) {
        const mid = (diagram.x_range[0] + diagram.x_range[1]) / 2
        for (const fn of diagram.functions) issues.push(...checkExprParses(fn.expr, mid))
      }
      break
    }
    case 'curve-tangent': {
      issues.push(...requireFields(diagram, ['expr', 'x0', 'kind', 'slope'], 'curve-tangent'))
      if (diagram.expr && diagram.x0 !== undefined && diagram.slope !== undefined) {
        try {
          const compiled = compileExpr(diagram.expr)
          const derivative = numericDerivative(compiled.evaluate, diagram.x0)
          if (Math.abs(derivative - diagram.slope) > 1e-3) {
            issues.push({ rule: 'curve-tangent-slope', message: `Authored slope ${diagram.slope} does not match the numeric derivative ${derivative.toFixed(6)} of "${diagram.expr}" at x0=${diagram.x0}` })
          }
        } catch (e) {
          issues.push({ rule: 'expr-parse', message: `Expression "${diagram.expr}" failed to parse: ${e.message}` })
        }
      }
      break
    }
    case 'area-under-curve': {
      issues.push(...requireFields(diagram, ['expr', 'range'], 'area-under-curve'))
      if (diagram.expr && diagram.range) {
        const mid = (diagram.range[0] + diagram.range[1]) / 2
        issues.push(...checkExprParses(diagram.expr, mid))
        if (diagram.expr2) issues.push(...checkExprParses(diagram.expr2, mid))
      }
      break
    }
    case 'trig-solutions': {
      issues.push(...requireFields(diagram, ['expr', 'domain', 'expected_count'], 'trig-solutions'))
      if (diagram.level === undefined && diagram.expr2 === undefined) {
        issues.push({ rule: 'diagram-schema', message: `trig-solutions: requires either "level" or "expr2"` })
      }
      if (diagram.expr && diagram.domain) {
        try {
          const f = compileExpr(diagram.expr).evaluate
          const g = diagram.expr2 ? compileExpr(diagram.expr2).evaluate : () => diagram.level
          const { count } = numericIntersections(f, g, diagram.domain)
          if (count !== diagram.expected_count) {
            issues.push({ rule: 'trig-solutions-count', message: `expected_count=${diagram.expected_count} but numerically found ${count} intersections over [${diagram.domain}]` })
          }
        } catch (e) {
          issues.push({ rule: 'expr-parse', message: `Expression "${diagram.expr}" failed to parse: ${e.message}` })
        }
      }
      break
    }
    case 'triangle': {
      const hasSides = diagram.sides && Object.keys(diagram.sides).length > 0
      const hasAngles = diagram.angles && Object.keys(diagram.angles).length > 0
      if (!hasSides || !hasAngles) {
        issues.push({ rule: 'diagram-schema', message: `triangle: requires at least one side and one angle` })
      }
      break
    }
    case 'transformation': {
      issues.push(...requireFields(diagram, ['expr', 'transform', 'x_range'], 'transformation'))
      if (diagram.expr && diagram.transform && diagram.x_range) {
        const mid = (diagram.x_range[0] + diagram.x_range[1]) / 2
        try {
          const base = compileExpr(diagram.expr)
          issues.push(...checkExprParses(diagram.transform, mid, { f: base.evaluate }))
        } catch (e) {
          issues.push({ rule: 'expr-parse', message: `Expression "${diagram.expr}" failed to parse: ${e.message}` })
        }
      }
      break
    }
    case 'number-line': {
      issues.push(...requireFields(diagram, ['intervals', 'x_range'], 'number-line'))
      break
    }
  }

  return issues
}

// -- top-level question validation ---------------------------------------

export function validateQuestion(question, { requireSolution = false } = {}) {
  const issues = []

  if (!question.solution) {
    if (requireSolution) {
      issues.push({ rule: 'solution-required', message: 'Every question must have solution.steps (Phase 4 — technique fallback removed)' })
    }
  } else {
    issues.push(...validateSolution(question.solution, question.question))
  }

  if (question.diagram) {
    const hasPaperFigure = question.image || /\[DIAGRAM:/i.test(question.question || '')
    if (hasPaperFigure) {
      issues.push({ rule: 'image-diagram-conflict', message: `Question has a paper figure ([DIAGRAM:] or image) and a generated diagram — only one figure source allowed` })
    }
    const solutionText = question.solution
      ? [...question.solution.steps.map(s => `${s.title} ${s.content}`), question.solution.fast, question.solution.trap].filter(Boolean).join(' ')
      : ''
    issues.push(...validateDiagram(question.diagram, solutionText))
  }

  return issues.map(issue => ({ ...issue, id: question.id }))
}
