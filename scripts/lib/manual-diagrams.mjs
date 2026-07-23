/**
 * Phase 3 Mafs diagrams for eligible maths questions.
 * Givens only — no computed coordinates.
 * Every eligible ID must appear (diagram or diagram_skipped).
 */
export const MANUAL_DIAGRAMS = {
  // --- number-line (solution regions / critical roots) ---
  'ENGAA-2016-M1-001': {
    diagram: {
      case: 'number-line',
      after_step: 3,
      intervals: [{ from: -10, to: 28, sign: '+' }],
      points: [{ x: 28, label: '28' }],
      x_range: [-10, 40],
    },
  },
  'ENGAA-2016-M2-008': {
    diagram_skipped: 'increasing-function condition on a parameter; no single fixed critical set to plot',
  },
  'ENGAA-2016-M2-010': {
    diagram_skipped: 'quartic inequality — roots not uniquely fixed as simple authored scalars without over-deriving',
  },
  'ENGAA-2017-M2-001': {
    diagram: {
      case: 'number-line',
      after_step: 2,
      intervals: [
        { from: -8, to: -3, sign: '+' },
        { from: -3, to: 2.5, sign: '-' },
        { from: 2.5, to: 8, sign: '+' },
      ],
      points: [
        { x: -3, label: '-3' },
        { x: 2.5, label: '2.5' },
      ],
      x_range: [-8, 8],
    },
  },
  'ENGAA-2017-M2-015': {
    diagram_skipped: 'rational inequality; critical points depend on cancelled factors — skip to avoid wrong intervals',
  },
  'ENGAA-2019-M2-010': {
    diagram_skipped: 'cubic inequality — prefer steps-only without risking incorrect interval signs',
  },
  'ENGAA-2022-M1-002': {
    diagram: {
      case: 'number-line',
      after_step: 2,
      intervals: [{ from: 0.6, to: 5, sign: '+' }],
      points: [{ x: 0.6, label: '3/5' }],
      x_range: [-2, 5],
    },
  },
  'NSAA-2016-M1-001': {
    diagram: {
      case: 'number-line',
      after_step: 2,
      intervals: [{ from: -10, to: 28, sign: '+' }],
      points: [{ x: 28, label: '28' }],
      x_range: [-10, 40],
    },
  },
  'NSAA-2017-M1-002': {
    diagram: {
      case: 'number-line',
      after_step: 2,
      intervals: [
        { from: -8, to: -3, sign: '+' },
        { from: -3, to: 5, sign: '-' },
        { from: 5, to: 10, sign: '+' },
      ],
      points: [
        { x: -3, label: '-3' },
        { x: 5, label: '5' },
      ],
      x_range: [-8, 10],
    },
  },
  'NSAA-2017-M2-008': {
    diagram_skipped: 'rational inequality; diagram would require cancelling factors first',
  },
  'NSAA-2019-M1-002': {
    diagram_skipped: 'linear inequality with rearranged form; thin pedagogical value vs steps',
  },
  'NSAA-2019-M1-027': {
    diagram_skipped: 'cubic inequality via factorisation — skip without unique clean interval plot',
  },
  'NSAA-2022-M1-003': {
    diagram: {
      case: 'number-line',
      after_step: 2,
      intervals: [{ from: 0.6, to: 5, sign: '+' }],
      points: [{ x: 0.6, label: '3/5' }],
      x_range: [-2, 5],
    },
  },

  // --- circle-line ---
  'ENGAA-2016-M2-002': {
    diagram_skipped: 'circle inscribed in square — no line given; circle-line schema requires a line',
  },
  'ENGAA-2016-M2-004': {
    diagram_skipped: 'tangents/area geometry without a single clear ax+by=c line in stem',
  },
  'ENGAA-2018-M2-008': {
    diagram_skipped: 'tangent length from external point — needs point+circle, not circle-line chord schema',
  },
  'NSAA-2016-M2-002': {
    diagram_skipped: 'circle equation only; circle-line requires a line',
  },
  'NSAA-2018-M2-005': {
    diagram_skipped: 'tangent length from a point; schema is circle+line not point+tangent length',
  },
  'NSAA-2021-M1-004': {
    diagram_skipped: 'Euclidean tangent-to-circle geometry, not Cartesian circle-line',
  },

  // --- curve-tangent ---
  'ENGAA-2018-M2-003': {
    diagram: {
      case: 'curve-tangent',
      after_step: 2,
      expr: '3*x^2 - 2*x + 1',
      x0: 0.5,
      kind: 'tangent',
      slope: 1,
    },
  },
  'NSAA-2018-M2-002': {
    diagram: {
      case: 'curve-tangent',
      after_step: 2,
      expr: '3*x^2 - 2*x + 1',
      x0: 0.5,
      kind: 'tangent',
      slope: 1,
    },
  },

  // --- area-under-curve ---
  'ENGAA-2016-M2-012': {
    diagram_skipped: 'sideways parabola; area-under-curve expr is y=f(x) only',
  },
  'ENGAA-2018-M2-001': {
    diagram: {
      case: 'area-under-curve',
      after_step: 1,
      expr: '9 - x^2',
      expr2: '5',
      range: [-2, 2],
    },
  },
  'ENGAA-2019-M2-001': {
    diagram_skipped: 'area bounded by straight lines only — not a curve integral case',
  },
  'ENGAA-2020-M2-007': {
    diagram: {
      case: 'area-under-curve',
      after_step: 1,
      expr: '0.5*x^2',
      expr2: '-x',
      range: [1, 3],
    },
  },
  'NSAA-2018-M1-019': {
    diagram: {
      case: 'area-under-curve',
      after_step: 1,
      expr: '9 - x^2',
      expr2: '5',
      range: [-2, 2],
    },
  },
  'NSAA-2019-M1-019': {
    diagram_skipped: 'area bounded by straight lines — not area-under-curve',
  },

  // --- trig-solutions ---
  'ENGAA-2017-M2-006': {
    diagram_skipped: 'two simultaneous trig equations in degrees; single level/expr2 plot underspecifies the union count',
  },
  'ENGAA-2018-M2-002': {
    diagram_skipped: 'trig equation in degrees domain; Mafs case expects radian domain consistently',
  },
  'ENGAA-2020-M2-013': {
    diagram_skipped: 'identity-then-count; unsure of clean level/expr2 without inventing',
  },
  'NSAA-2017-M2-002': {
    diagram_skipped: 'trig solutions counting — confirm radian domain and level before authoring',
  },
  'NSAA-2018-M2-001': {
    diagram: {
      case: 'trig-solutions',
      after_step: 1,
      expr: '2*sin(x)^3',
      expr2: 'sin(x)',
      domain: [-1.5708, 3.1416],
      expected_count: 5,
    },
  },
  'NSAA-2021-M1-020': {
    diagram_skipped: 'graphical trig reasoning; paper-style, not clean Mafs level intersection',
  },

  // --- triangle ---
  'ENGAA-2017-M2-011': {
    diagram_skipped: 'SAS maximisation with variable angle — not a fixed solvable triangle',
  },

  // --- transformation ---
  'ENGAA-2016-M2-009': {
    diagram: {
      case: 'transformation',
      after_step: 1,
      expr: 'x^2',
      transform: 'f(x - 4) + 3',
      x_range: [-2, 8],
    },
  },
  'ENGAA-2017-M2-016': {
    diagram: {
      case: 'transformation',
      after_step: 1,
      expr: 'sin(x)',
      transform: 'f(2*x)',
      x_range: [-3.5, 3.5],
    },
  },
  'NSAA-2016-M2-009': {
    diagram: {
      case: 'transformation',
      after_step: 1,
      expr: 'x^2',
      transform: '-2 - (f(x - 4) + 3)',
      x_range: [-1, 9],
    },
  },

  // --- curve ---
  'ENGAA-2016-M2-011': {
    diagram: {
      case: 'curve',
      after_step: 1,
      functions: [
        { expr: '4*x^3 - 12*x^2 - 36*x - 15', label: 'curve' },
        { expr: '10', label: 'y=10' },
      ],
      x_range: [-3, 5],
    },
  },
  'ENGAA-2017-M2-010': {
    diagram_skipped: 'stationary points of a cubic — parameter/family; no unique curve',
  },
  'ENGAA-2019-M2-002': {
    diagram_skipped: 'turning points of a cubic with parameters — skip',
  },
  'ENGAA-2020-M2-012': {
    diagram_skipped: 'discriminant condition on cubic family — no unique curve',
  },
  'ENGAA-2022-M2-008': {
    diagram_skipped: 'quadratic + rectangle construction — better as steps-only without inventing scale',
  },
}
