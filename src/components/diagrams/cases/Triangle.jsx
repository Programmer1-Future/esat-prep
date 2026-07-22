import { Mafs, Coordinates, Polygon, Point, LaTeX, Theme } from 'mafs'
import 'mafs/core.css'
import { solveTriangle } from '../../../lib/diagram-geometry'

// Renders the `triangle` case (docs/CONTENT_SPEC.md §3.6). NOTE: only the
// SAS combinations `solveTriangle` supports are handled -- the ambiguous SSA
// case from the original plan is NOT implemented (matches plan §9's own
// call: ship the fiddly parts steps-only rather than stall the fan-out).
// Placement: A at the origin, B along the x-axis at distance c, C found
// from angle A and side b -- all derived, nothing transcribed.
export function Triangle({ sides, angles }) {
  const result = solveTriangle({ sides, angles })
  const { a, b, c } = result.sides
  const angleA = (result.angles.A * Math.PI) / 180

  const ptA = [0, 0]
  const ptB = [c, 0]
  const ptC = [b * Math.cos(angleA), b * Math.sin(angleA)]

  const allX = [ptA[0], ptB[0], ptC[0]]
  const allY = [ptA[1], ptB[1], ptC[1]]
  const pad = Math.max(a, b, c) * 0.35 + 1
  const xMin = Math.min(...allX) - pad
  const xMax = Math.max(...allX) + pad
  const yMin = Math.min(...allY) - pad
  const yMax = Math.max(...allY) + pad

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [xMin, xMax], y: [yMin, yMax] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian />
        <Polygon points={[ptA, ptB, ptC]} color={Theme.indigo} fillOpacity={0.1} />
        <Point x={ptA[0]} y={ptA[1]} color={Theme.indigo} />
        <Point x={ptB[0]} y={ptB[1]} color={Theme.indigo} />
        <Point x={ptC[0]} y={ptC[1]} color={Theme.indigo} />
        <LaTeX at={[(ptA[0] + ptB[0]) / 2, (ptA[1] + ptB[1]) / 2 - pad * 0.18]} tex={`c \\approx ${c.toFixed(2)}`} />
        <LaTeX at={[(ptB[0] + ptC[0]) / 2 + pad * 0.12, (ptB[1] + ptC[1]) / 2]} tex={`a \\approx ${a.toFixed(2)}`} />
        <LaTeX at={[(ptA[0] + ptC[0]) / 2 - pad * 0.12, (ptA[1] + ptC[1]) / 2]} tex={`b \\approx ${b.toFixed(2)}`} />
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        Triangle solved from the given sides and angle.
      </p>
    </div>
  )
}
