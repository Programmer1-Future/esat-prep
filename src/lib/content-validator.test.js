import { describe, it, expect } from 'vitest'
import {
  checkKatexCompiles, checkUnbracedSqrt, checkUnicodeMath, checkLetterBan,
  checkHardBans, checkStemOverlap, hasUnbalancedDelimiters,
  validateSolution, validateDiagram, validateQuestion,
} from './content-validator'

// A clean, fully valid question -- used as the "must stay clean" baseline
// for every seeded-error test below (Phase 3 acceptance: a clean run passes).
const CLEAN_QUESTION = {
  id: 'TEST-CLEAN-001',
  question: 'Find the length of the chord cut from the circle by the line.',
  answer: 'C',
  solution: {
    steps: [
      { title: 'Find the centre and radius', content: 'From $(x-3)^2 + (y-4)^2 = 20$: centre $(3, 4)$, and $r^2 = 20$.' },
      { title: 'Perpendicular distance', content: 'Distance from $(3,4)$ to the line:\n\n$$p = \\sqrt{5}$$' },
      { title: 'Half-chord', content: 'By Pythagoras:\n\n$$x = \\sqrt{15}$$' },
    ],
    fast: 'Half-chord $\\sqrt{15}$, chord $2\\sqrt{15}$.',
    trap: 'The value $2\\sqrt{10}$ comes from forgetting to halve.',
  },
  diagram: {
    case: 'circle-line',
    circle: { center: [3, 4], r2: 20 },
    line: { a: 2, b: 1, c: 5 },
  },
}

describe('checkKatexCompiles', () => {
  it('passes valid LaTeX', () => {
    expect(checkKatexCompiles('$\\sqrt{5}$')).toEqual([])
  })
  it('flags genuinely invalid LaTeX (unknown command)', () => {
    expect(checkKatexCompiles('$\\notarealcommand{x}$')).not.toEqual([])
  })
})

describe('checkUnbracedSqrt', () => {
  it('passes braced sqrt', () => {
    expect(checkUnbracedSqrt('$\\sqrt{5}$')).toEqual([])
  })
  it('passes \\sqrt[n]{...}', () => {
    expect(checkUnbracedSqrt('$\\sqrt[3]{x}$')).toEqual([])
  })
  it('flags the exact historical bug: \\sqrt followed by a bare digit', () => {
    // This is the real commit-5b5cdaa class: katex.renderToString does NOT
    // throw on this, so checkKatexCompiles alone would miss it entirely.
    const text = '$\\sqrt 2 + \\sqrt 3$'
    expect(checkUnbracedSqrt(text).length).toBeGreaterThan(0)
    expect(checkKatexCompiles(text)).toEqual([]) // proves katex alone is not sufficient
  })
  it('flags \\sqrt followed by parens', () => {
    expect(checkUnbracedSqrt('$\\sqrt (5)$').length).toBeGreaterThan(0)
  })
})

describe('checkUnicodeMath', () => {
  it('passes pure LaTeX', () => {
    expect(checkUnicodeMath('$\\sqrt{5} - 2$')).toEqual([])
  })
  it('flags a unicode root sign', () => {
    expect(checkUnicodeMath('√5 is irrational').length).toBeGreaterThan(0)
  })
  it('flags a unicode minus sign', () => {
    expect(checkUnicodeMath('the value is 3 − 2').length).toBeGreaterThan(0)
  })
})

describe('checkLetterBan', () => {
  it('passes content with no letter reference', () => {
    expect(checkLetterBan('The chord length is $2\\sqrt{15}$.')).toEqual([])
  })
  it('flags "Answer C"', () => {
    expect(checkLetterBan('So the chord length is $2\\sqrt{15}$. Answer C.').length).toBeGreaterThan(0)
  })
  it('flags "option B"', () => {
    expect(checkLetterBan('This matches option B exactly.').length).toBeGreaterThan(0)
  })
  it('flags "the first option"', () => {
    expect(checkLetterBan('So the first option is correct.').length).toBeGreaterThan(0)
  })
  it('does NOT flag a compound-angle formula like cos(A+B)', () => {
    // Real false positive found migrating trig_040: cos(A-B)+cos(A+B)=2cosAcosB
    // is genuine math notation pairing variables A and B, not an option
    // reference -- \b[A-H]\) alone matched the "B)" in "A+B)".
    expect(checkLetterBan('$\\cos(A-B)+\\cos(A+B)=2\\cos A\\cos B$').length).toBe(0)
  })
  it('still flags a genuine parenthesized option reference', () => {
    expect(checkLetterBan('This matches (B) exactly.').length).toBeGreaterThan(0)
  })
})

describe('checkHardBans', () => {
  it('passes clean impersonal prose', () => {
    expect(checkHardBans('The perpendicular distance is $\\sqrt5$.')).toEqual([])
  })
  it('flags first person', () => {
    expect(checkHardBans("We can see that the slope is $3/2$.").length).toBeGreaterThan(0)
  })
  it('does NOT flag a Roman numeral "I" used as a math label', () => {
    // This is the exact false-positive risk: logic questions label statements
    // I/II/III inside math delimiters, which must not trip the "I" pronoun ban.
    expect(checkHardBans('$I$ is irrational, so it is not a counterexample.')).toEqual([])
  })
  it('flags hedging language', () => {
    expect(checkHardBans('It appears to be the correct answer.').length).toBeGreaterThan(0)
  })
  it('does NOT flag "i.e." as the pronoun "I"', () => {
    // Real false positive found migrating GEN-GEOM-065/075: case-insensitive
    // \bI\b matched the lowercase "i" in "i.e." wherever it appeared.
    expect(checkHardBans('For $x+y=k$, i.e. $x+y-k=0$, the distance is $\\sqrt2$.')).toEqual([])
  })
  it('still flags a genuine capitalized "I" pronoun', () => {
    expect(checkHardBans('I will show that the result follows.').length).toBeGreaterThan(0)
  })
  it('flags meta-reference to the platform', () => {
    expect(checkHardBans('As shown above, the result follows.').length).toBeGreaterThan(0)
  })
  it('flags an ellipsis standing in for reasoning', () => {
    expect(checkHardBans('The steps follow... giving the result.').length).toBeGreaterThan(0)
  })
})

describe('checkStemOverlap', () => {
  const question = 'Find the length of the chord cut from the circle by the line shown in the diagram above near the origin point'
  it('passes a derivation that does not restate the stem', () => {
    expect(checkStemOverlap('The perpendicular distance is $\\sqrt5$, giving a half-chord of $\\sqrt{15}$.', question)).toEqual([])
  })
  it('flags >=15 consecutive words repeated verbatim from the question', () => {
    const padded = 'Find the length of the chord cut from the circle by the line shown in the diagram above near the origin point, which equals 2sqrt15.'
    expect(checkStemOverlap(padded, question).length).toBeGreaterThan(0)
  })
})

describe('hasUnbalancedDelimiters', () => {
  it('passes balanced $ counts', () => {
    expect(hasUnbalancedDelimiters('$x$ and $y$')).toBe(false)
  })
  it('flags an odd $ count', () => {
    expect(hasUnbalancedDelimiters('$x$ and $y')).toBe(true)
  })
})

describe('validateSolution', () => {
  it('accepts the clean question', () => {
    expect(validateSolution(CLEAN_QUESTION.solution, CLEAN_QUESTION.question)).toEqual([])
  })
  it('rejects too few steps', () => {
    const bad = { steps: [{ title: 'Only step', content: 'Not enough steps.' }] }
    expect(validateSolution(bad, '').some(i => i.rule === 'step-count')).toBe(true)
  })
  it('rejects too many steps', () => {
    const bad = { steps: Array.from({ length: 7 }, (_, i) => ({ title: `Step ${i}`, content: 'x' })) }
    expect(validateSolution(bad, '').some(i => i.rule === 'step-count')).toBe(true)
  })
  it('rejects a step missing content', () => {
    const bad = { steps: [{ title: 'A' }, { title: 'B', content: 'ok' }] }
    expect(validateSolution(bad, '').some(i => i.rule === 'step-shape')).toBe(true)
  })
})

describe('validateDiagram', () => {
  it('accepts the clean circle-line chord diagram', () => {
    expect(validateDiagram(CLEAN_QUESTION.diagram, 'chord')).toEqual([])
  })
  it('rejects an unknown case', () => {
    expect(validateDiagram({ case: 'not-a-real-case' }).some(i => i.rule === 'unknown-case')).toBe(true)
  })
  it('rejects r2 <= 0', () => {
    const bad = { case: 'circle-line', circle: { center: [0, 0], r2: -4 }, line: { a: 1, b: 0, c: 1 } }
    expect(validateDiagram(bad).some(i => i.rule === 'circle-line-r2')).toBe(true)
  })
  it('catches a solution/geometry mismatch: text says tangent but givens produce a chord', () => {
    const diagram = { case: 'circle-line', circle: { center: [3, 4], r2: 20 }, line: { a: 2, b: 1, c: 5 } }
    expect(validateDiagram(diagram, 'the line is tangent to the circle').some(i => i.rule === 'circle-line-mismatch')).toBe(true)
  })
  it('accepts a correctly-labelled tangent', () => {
    const diagram = { case: 'circle-line', circle: { center: [0, 0], r2: 25 }, line: { a: 1, b: 0, c: 5 } }
    expect(validateDiagram(diagram, 'the line is tangent to the circle')).toEqual([])
  })
  it('catches an authored slope that does not match the numeric derivative', () => {
    const diagram = { case: 'curve-tangent', expr: 'x^3 - 2*x', x0: 2, kind: 'tangent', slope: 999 }
    expect(validateDiagram(diagram).some(i => i.rule === 'curve-tangent-slope')).toBe(true)
  })
  it('accepts a correct authored slope', () => {
    const diagram = { case: 'curve-tangent', expr: 'x^3 - 2*x', x0: 2, kind: 'tangent', slope: 10 }
    expect(validateDiagram(diagram)).toEqual([])
  })
  it('catches a wrong expected_count for trig-solutions', () => {
    const diagram = { case: 'trig-solutions', expr: 'sin(2*x)', level: 0.5, domain: [0, 6.283185], expected_count: 2 }
    expect(validateDiagram(diagram).some(i => i.rule === 'trig-solutions-count')).toBe(true)
  })
  it('accepts a correct expected_count for trig-solutions', () => {
    const diagram = { case: 'trig-solutions', expr: 'sin(2*x)', level: 0.5, domain: [0, 6.283185], expected_count: 4 }
    expect(validateDiagram(diagram)).toEqual([])
  })
  it('accepts level: 0 without a false "requires level or expr2" error', () => {
    // Real bug: `!diagram.level` treats level:0 (a legitimate, common value --
    // "solve f(x) = 0") as missing, since 0 is falsy in JS.
    const diagram = { case: 'trig-solutions', expr: '2*cos(x)^2 - cos(x) - 1', level: 0, domain: [0, 6.283185307179586], expected_count: 4 }
    expect(validateDiagram(diagram).some(i => i.rule === 'diagram-schema')).toBe(false)
  })
  it('rejects a malformed expression', () => {
    const diagram = { case: 'curve', functions: [{ expr: 'x^^2' }], x_range: [-2, 2] }
    expect(validateDiagram(diagram).some(i => i.rule === 'expr-parse')).toBe(true)
  })
  it('accepts a curve diagram', () => {
    expect(validateDiagram({
      case: 'curve',
      functions: [{ expr: 'x^3 - 3*x + 1', label: 'f(x)' }],
      x_range: [-2.5, 2.5],
      points: [{ x: -1, label: 'local max' }, { x: 1, label: 'local min' }],
    })).toEqual([])
  })
  it('accepts a transformation diagram', () => {
    expect(validateDiagram({
      case: 'transformation',
      expr: 'x^2',
      transform: '2*f(x-1)',
      x_range: [-3, 5],
    })).toEqual([])
  })
})

describe('validateQuestion (integration)', () => {
  it('accepts the fully clean question with no issues', () => {
    expect(validateQuestion(CLEAN_QUESTION)).toEqual([])
  })
  it('rejects missing solution by default (Phase 4)', () => {
    expect(validateQuestion({ id: 'LEGACY-001' }).some(i => i.rule === 'solution-required')).toBe(true)
  })
  it('allows missing solution when requireSolution is false', () => {
    expect(validateQuestion({ id: 'LEGACY-001' }, { requireSolution: false })).toEqual([])
  })
  it('rejects image + diagram coexisting', () => {
    const bad = { ...CLEAN_QUESTION, image: '/diagrams/x.png' }
    expect(validateQuestion(bad).some(i => i.rule === 'image-diagram-conflict')).toBe(true)
  })
  it('rejects [DIAGRAM:] stem + generated diagram coexisting', () => {
    const bad = {
      ...CLEAN_QUESTION,
      question: 'Find the chord. [DIAGRAM: circle and line]',
    }
    expect(validateQuestion(bad).some(i => i.rule === 'image-diagram-conflict')).toBe(true)
  })
  it('every issue carries the question id', () => {
    const bad = { ...CLEAN_QUESTION, solution: { steps: [{ title: 'Only one', content: 'x' }] } }
    const issues = validateQuestion(bad)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.every(i => i.id === 'TEST-CLEAN-001')).toBe(true)
  })
})
