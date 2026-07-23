// Pure geometry derivations for diagram cases (docs/CONTENT_SPEC.md §3).
// Agents author only givens (circle centre/r², line coefficients); every
// function here derives everything else, so the numbers a student sees are
// always computed, never transcribed by an LLM.

const EPS = 1e-6

/**
 * Derives every drawable quantity for the `circle-line` case from a circle
 * `{ center: [h,k], r2 }` and a line `{ a, b, c }` (ax + by = c).
 *
 * Classifies the configuration from the perpendicular distance `d`:
 *  - d < r  -> "chord": both intersection points + the right-triangle
 *              construction (centre -> foot -> chord endpoint).
 *  - d ≈ r  -> "tangent": a single point of contact.
 *  - d > r  -> "miss": no intersection, just the shortest segment.
 */
export function circleLine(circle, line) {
  const [h, k] = circle.center
  const r2 = circle.r2
  const r = Math.sqrt(r2)
  const { a, b, c } = line

  const norm = Math.sqrt(a * a + b * b)
  if (norm === 0) throw new Error('circleLine: line coefficients a and b cannot both be 0')

  const signedT = (a * h + b * k - c) / (a * a + b * b)
  const d = Math.abs(a * h + b * k - c) / norm

  // Foot of the perpendicular from the centre to the line.
  const foot = [h - a * signedT, k - b * signedT]

  // Unit vector along the line direction (perpendicular to the normal (a,b)).
  const dir = [-b / norm, a / norm]

  const base = { center: circle.center, r, d, foot, direction: dir }

  if (d > r + EPS) {
    return { ...base, kind: 'miss' }
  }

  if (Math.abs(d - r) <= EPS) {
    return { ...base, kind: 'tangent', point: foot }
  }

  const halfChord = Math.sqrt(Math.max(r2 - d * d, 0))
  const p1 = [foot[0] + dir[0] * halfChord, foot[1] + dir[1] * halfChord]
  const p2 = [foot[0] - dir[0] * halfChord, foot[1] - dir[1] * halfChord]

  return { ...base, kind: 'chord', halfChord, endpoints: [p1, p2] }
}

/** Central-difference numeric derivative, used to cross-check an authored `slope`. */
export function numericDerivative(fn, x0, h = 1e-5) {
  return (fn(x0 + h) - fn(x0 - h)) / (2 * h)
}

const NEAR_ZERO = 1e-9

/**
 * Counts real solutions of `f(x) = g(x)` across `n` samples in `[a, b]` --
 * used to cross-check an authored `expected_count` for the `trig-solutions`
 * case. Catches three distinct root shapes, each found missing while
 * migrating real trig content:
 *
 *  1. Transversal crossings (the common case) -- refined by bisection.
 *  2. Roots landing exactly on a domain endpoint -- `Math.cos(2*Math.PI)`
 *     happens to round to exactly 1 in floating point, but
 *     `Math.sin(2*Math.PI)` does NOT round to exactly 0 (~-2.4e-16), so an
 *     exact `=== 0` check caught endpoint roots for some expressions and
 *     silently missed them for others, purely by floating-point luck --
 *     fixed with a small tolerance instead of exact equality.
 *  3. Interior tangencies -- a factor like `(sin x + 1)` never goes
 *     negative, so it touches zero without ever changing sign, which no
 *     amount of sign-change detection can see. `(2sinx-1)(sinx+1)=0` has a
 *     genuine root at x=3*pi/2 from the second factor that was silently
 *     undercounted until this case was added.
 */
export function numericIntersections(f, g, [a, b], n = 2000) {
  const diff = (x) => f(x) - g(x)
  const step = (b - a) / n
  const xs = []
  const vs = []
  for (let i = 0; i <= n; i++) {
    const x = a + i * step
    xs.push(x)
    vs.push(diff(x))
  }

  const roots = []

  // Any sample landing (within tolerance) on a root -- not just domain
  // endpoints. Found migrating trig content: sin(x)+cos(x)=1 has a root at
  // x=pi/2 that, at n=2000 over [0,2pi], lands EXACTLY on a grid sample, so
  // vs[i] is precisely 0 -- and 0 * anything is never < 0, silently hiding
  // it from the transversal sign-change check below even though it's a
  // genuine crossing, not a tangency.
  for (let i = 0; i <= n; i++) {
    if (Math.abs(vs[i]) < NEAR_ZERO) roots.push(xs[i])
  }

  for (let i = 0; i < n; i++) {
    if (Math.abs(vs[i]) < NEAR_ZERO || Math.abs(vs[i + 1]) < NEAR_ZERO) continue
    if (vs[i] * vs[i + 1] < 0) {
      let lo = xs[i], hi = xs[i + 1], vLo = vs[i]
      for (let iter = 0; iter < 40; iter++) {
        const mid = (lo + hi) / 2
        const vMid = diff(mid)
        if (Math.abs(vMid) < NEAR_ZERO || (hi - lo) < 1e-10) { lo = hi = mid; break }
        if (vLo * vMid < 0) hi = mid
        else { lo = mid; vLo = vMid }
      }
      roots.push((lo + hi) / 2)
    }
  }

  // Interior tangencies: a sample that is a local min/max of diff AND
  // already close to zero is worth refining -- golden-section search for
  // the true extremum of |diff| within the bracketing triple, then check
  // whether the refined value is genuinely (near-)zero.
  for (let i = 1; i < n; i++) {
    const isLocalExtremum = (vs[i] - vs[i - 1]) * (vs[i + 1] - vs[i]) < 0
    if (!isLocalExtremum || Math.abs(vs[i]) >= 1e-4) continue
    let lo = xs[i - 1], hi = xs[i + 1]
    const gr = (Math.sqrt(5) - 1) / 2
    for (let iter = 0; iter < 60; iter++) {
      const c = hi - gr * (hi - lo)
      const d = lo + gr * (hi - lo)
      if (Math.abs(diff(c)) < Math.abs(diff(d))) hi = d
      else lo = c
    }
    const xExt = (lo + hi) / 2
    if (Math.abs(diff(xExt)) < NEAR_ZERO) roots.push(xExt)
  }

  roots.sort((p, q) => p - q)
  const deduped = []
  for (const r of roots) {
    if (deduped.length === 0 || Math.abs(r - deduped[deduped.length - 1]) > 1e-6) {
      deduped.push(r)
    }
  }

  return { count: deduped.length, roots: deduped }
}

/**
 * Solves a triangle from a partial set of sides/angles (degrees), using
 * whichever combination of the cosine/sine rule the givens support. Used by
 * the `triangle` case; throws if the givens don't determine the triangle.
 */
export function solveTriangle({ sides = {}, angles = {} }) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const toDeg = (rad) => (rad * 180) / Math.PI
  const { a, b, c } = sides
  const { A, B, C } = angles

  // Angle opposite `side`, from the other two sides — via the cosine rule
  // (acos), never asin: asin's ±90° range silently returns the WRONG angle
  // whenever the true angle is obtuse, which the cosine rule can't do.
  const angleOpposite = (side, s1, s2) => toDeg(Math.acos((s1 * s1 + s2 * s2 - side * side) / (2 * s1 * s2)))

  // SAS: two sides and the included angle.
  if (a != null && b != null && C != null) {
    const cSide = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(toRad(C)))
    const aAngle = angleOpposite(a, b, cSide)
    const bAngle = 180 - C - aAngle
    return { sides: { a, b, c: cSide }, angles: { A: aAngle, B: bAngle, C } }
  }
  if (b != null && c != null && A != null) {
    const aSide = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(toRad(A)))
    const bAngle = angleOpposite(b, aSide, c)
    const cAngle = 180 - A - bAngle
    return { sides: { a: aSide, b, c }, angles: { A, B: bAngle, C: cAngle } }
  }
  if (a != null && c != null && B != null) {
    const bSide = Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(toRad(B)))
    const aAngle = angleOpposite(a, bSide, c)
    const cAngle = 180 - B - aAngle
    return { sides: { a, b: bSide, c }, angles: { A: aAngle, B, C: cAngle } }
  }

  throw new Error('solveTriangle: givens do not match a supported SAS combination (Phase 5 extends this for ASA/SSA)')
}
