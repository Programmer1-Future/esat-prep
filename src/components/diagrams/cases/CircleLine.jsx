import { Mafs, Coordinates, Circle, Line, Point, LaTeX, Theme } from 'mafs'
import 'mafs/core.css'
import { circleLine } from '../../../lib/diagram-geometry'

// Renders the `circle-line` case (docs/CONTENT_SPEC.md §3.1). Every drawn
// quantity -- the foot of the perpendicular, chord endpoints, tangent point,
// half-chord length -- is DERIVED here from the authored givens (circle +
// line), never transcribed by the content author. See §0 of the spec.
//
// Color convention (shared across all diagram cases, plan §6):
//   indigo = the given circle/line, blue = auxiliary construction (radius),
//   green = the answer element (the chord / point of contact),
//   red = the highlighted distance measurement.
export function CircleLine({ circle, line, show = ['distance', 'half-chord', 'radius-triangle'] }) {
  const result = circleLine(circle, line)
  const { center, r, d, foot, kind } = result
  const [h, k] = center

  const showDistance = show.includes('distance')
  const showHalfChord = show.includes('half-chord')
  const showRadiusTriangle = show.includes('radius-triangle')

  // Two points far apart along the line direction, for Mafs to clip to the viewport.
  const dir = result.direction
  const linePoint1 = [foot[0] + dir[0] * (r + 10), foot[1] + dir[1] * (r + 10)]
  const linePoint2 = [foot[0] - dir[0] * (r + 10), foot[1] - dir[1] * (r + 10)]

  const pad = Math.max(r, d) + 2.5
  const caption =
    kind === 'chord'
      ? 'The line cuts the circle in a chord -- centre, foot of perpendicular, and each endpoint form a right triangle.'
      : kind === 'tangent'
        ? 'The line touches the circle at exactly one point -- the radius there is perpendicular to the line.'
        : 'The line does not reach the circle -- the dashed segment is the shortest distance between them.'

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [h - pad, h + pad], y: [k - pad, k + pad] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian />
        <Circle center={center} radius={r} color={Theme.indigo} />
        <Line.ThroughPoints point1={linePoint1} point2={linePoint2} color={Theme.indigo} />

        {showDistance && (
          <>
            <Line.Segment point1={center} point2={foot} color={Theme.red} strokeDasharray={kind === 'miss' ? '6,4' : undefined} />
            <LaTeX at={[(h + foot[0]) / 2, (k + foot[1]) / 2]} tex={`p \\approx ${d.toFixed(2)}`} />
          </>
        )}

        {kind === 'chord' && (
          <>
            {result.endpoints.map((pt, i) => (
              <Line.Segment key={`half-${i}`} point1={foot} point2={pt} color={Theme.green} />
            ))}
            {showRadiusTriangle && result.endpoints.map((pt, i) => (
              <Line.Segment key={`radius-${i}`} point1={center} point2={pt} color={Theme.blue} />
            ))}
            {result.endpoints.map((pt, i) => (
              <Point key={`pt-${i}`} x={pt[0]} y={pt[1]} color={Theme.green} />
            ))}
            {showHalfChord && (
              <LaTeX
                at={[(foot[0] + result.endpoints[0][0]) / 2, (foot[1] + result.endpoints[0][1]) / 2]}
                tex={`\\approx ${result.halfChord.toFixed(2)}`}
              />
            )}
          </>
        )}

        {kind === 'tangent' && (
          <>
            <Line.Segment point1={center} point2={result.point} color={Theme.blue} />
            <Point x={result.point[0]} y={result.point[1]} color={Theme.green} />
          </>
        )}

        <Point x={h} y={k} color={Theme.indigo} />
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        {caption}
      </p>
    </div>
  )
}
