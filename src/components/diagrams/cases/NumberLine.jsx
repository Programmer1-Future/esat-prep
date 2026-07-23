import { Mafs, Coordinates, Line, Point, LaTeX, Theme } from 'mafs'
import 'mafs/core.css'

// Renders the `number-line` case (docs/CONTENT_SPEC.md §3.8). Intervals and
// points here are solution-derived scalars (e.g. roots already found by
// factoring), not computed geometry -- the one case where content authors
// transcribe rather than the renderer deriving, acceptable per plan §5
// because they're low-guess-risk single numbers.
export function NumberLine({ intervals, points, x_range }) {
  const [a, b] = x_range

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [a, b], y: [-2, 2] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian subdivisions={1} />
        <Line.Segment point1={[a, 0]} point2={[b, 0]} color={Theme.indigo} />
        {intervals.map((iv, i) => (
          <Line.Segment
            key={i}
            point1={[iv.from, 0]}
            point2={[iv.to, 0]}
            color={iv.sign === '+' ? Theme.green : Theme.red}
            weight={5}
          />
        ))}
        {points?.map((p, i) => (
          <Point key={i} x={p.x} y={0} color={Theme.blue} />
        ))}
        {points?.map((p, i) => (
          <LaTeX key={`label-${i}`} at={[p.x, 0.5]} tex={`\\text{${p.label}}`} />
        ))}
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        Green = positive, red = negative.
      </p>
    </div>
  )
}
