import { Mafs, Coordinates, Plot, Point, Line, Theme } from 'mafs'
import 'mafs/core.css'
import { compileExpr } from '../../../lib/expr'

// Renders the `curve-tangent` case (docs/CONTENT_SPEC.md §3.3). `slope` is
// authored by the content pass but numerically cross-checked by the
// validator against the actual derivative -- this component just draws
// whatever slope it's given, so a wrong worked derivative would still show
// visibly (the validator is what catches it before it ships).
export function CurveTangent({ expr, x0, kind, slope }) {
  const fn = compileExpr(expr).evaluate
  const y0 = fn(x0)
  const reach = 3

  const tangentP1 = [x0 - reach, y0 - slope * reach]
  const tangentP2 = [x0 + reach, y0 + slope * reach]

  const hasNormal = kind === 'normal' || kind === 'both'
  const normalSlope = slope !== 0 ? -1 / slope : null
  const normalP1 = normalSlope !== null ? [x0 - reach, y0 - normalSlope * reach] : [x0, y0 - reach]
  const normalP2 = normalSlope !== null ? [x0 + reach, y0 + normalSlope * reach] : [x0, y0 + reach]

  const pad = 4
  const caption =
    kind === 'both'
      ? 'Tangent (green) and normal (blue) at the marked point.'
      : kind === 'normal'
        ? 'Normal (blue) at the marked point.'
        : 'Tangent (green) at the marked point.'

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [x0 - pad, x0 + pad], y: [y0 - pad, y0 + pad] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian />
        <Plot.OfX y={fn} color={Theme.indigo} />
        {(kind === 'tangent' || kind === 'both') && (
          <Line.Segment point1={tangentP1} point2={tangentP2} color={Theme.green} />
        )}
        {hasNormal && <Line.Segment point1={normalP1} point2={normalP2} color={Theme.blue} />}
        <Point x={x0} y={y0} color={Theme.green} />
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        {caption}
      </p>
    </div>
  )
}
