import { Mafs, Coordinates, Plot, Line, Polygon, Polyline, Theme } from 'mafs'
import 'mafs/core.css'
import { compileExpr } from '../../../lib/expr'
import { clampYRange } from './viewBoxHelpers'

// Builds a closed polygon shading the region between `topFn` and `bottomFn`
// over [a, b] by sampling both boundaries -- NOT Mafs' Plot.Inequality,
// which throws at runtime if given both x AND y bounds together (its type
// signature allows it, but the library enforces "either/or"; found while
// building this component).
function shadeRegion(topFn, bottomFn, a, b, n = 60) {
  const points = []
  for (let i = 0; i <= n; i++) {
    const x = a + (i / n) * (b - a)
    points.push([x, topFn(x)])
  }
  for (let i = n; i >= 0; i--) {
    const x = a + (i / n) * (b - a)
    points.push([x, bottomFn(x)])
  }
  return points
}

// Renders the `area-under-curve` case (docs/CONTENT_SPEC.md §3.4). The
// shaded band always uses pointwise max/min of the two boundaries, so it's a
// simple (non-self-intersecting) polygon even where curves cross -- and
// correctly represents the below-axis region when `signed`.
export function AreaUnderCurve({ expr, range, expr2, signed, trapezia }) {
  const f = compileExpr(expr).evaluate
  const g = expr2 ? compileExpr(expr2).evaluate : null
  const [a, b] = range

  const samples = []
  for (let i = 0; i <= 40; i++) {
    const x = a + (i / 40) * (b - a)
    samples.push(f(x))
    if (g) samples.push(g(x))
  }
  const [yMin, yMax] = clampYRange(Math.min(0, ...samples) - 1, Math.max(0, ...samples) + 1, b - a)
  const xPad = (b - a) * 0.15

  const trapeziaPoints = trapezia
    ? Array.from({ length: trapezia + 1 }, (_, i) => a + (i * (b - a)) / trapezia)
    : null

  const zero = () => 0
  const upper = g ? (x) => Math.max(f(x), g(x)) : (x) => Math.max(f(x), 0)
  const lower = g ? (x) => Math.min(f(x), g(x)) : (x) => Math.min(f(x), 0)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [a - xPad, b + xPad], y: [yMin, yMax] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian />
        <Plot.OfX y={f} color={Theme.indigo} />
        {g && <Plot.OfX y={g} color={Theme.blue} />}

        {signed && !g ? (
          <>
            <Polygon points={shadeRegion((x) => Math.max(f(x), 0), zero, a, b)} color={Theme.green} fillOpacity={0.25} />
            <Polygon points={shadeRegion(zero, (x) => Math.min(f(x), 0), a, b)} color={Theme.red} fillOpacity={0.25} />
          </>
        ) : (
          <Polygon points={shadeRegion(upper, lower, a, b)} color={Theme.green} fillOpacity={0.25} />
        )}

        {trapeziaPoints && (
          <>
            {trapeziaPoints.map((x, i) => (
              <Line.Segment key={i} point1={[x, 0]} point2={[x, f(x)]} color={Theme.red} strokeOpacity={0.5} />
            ))}
            <Polyline points={trapeziaPoints.map(x => [x, f(x)])} color={Theme.red} strokeStyle="dashed" fillOpacity={0} />
          </>
        )}
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        {g ? 'Shaded: area between the curves.' : 'Shaded: area under the curve.'}
      </p>
    </div>
  )
}
