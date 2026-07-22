import { Mafs, Coordinates, Plot, Point, Theme } from 'mafs'
import 'mafs/core.css'
import { compileExpr } from '../../../lib/expr'
import { numericIntersections } from '../../../lib/diagram-geometry'

// Renders the `trig-solutions` case (docs/CONTENT_SPEC.md §3.5). Marks every
// intersection the renderer itself finds numerically -- if this count ever
// disagreed with the authored `expected_count`, the validator would already
// have failed the build, so what's drawn here is trustworthy by construction.
export function TrigSolutions({ expr, level, expr2, domain }) {
  const f = compileExpr(expr).evaluate
  const g = expr2 ? compileExpr(expr2).evaluate : () => level
  const [a, b] = domain
  const { roots } = numericIntersections(f, g, domain)

  const samples = []
  for (let i = 0; i <= 60; i++) {
    const x = a + (i / 60) * (b - a)
    samples.push(f(x), g(x))
  }
  const yMin = Math.min(...samples) - 0.5
  const yMax = Math.max(...samples) + 0.5

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [a, b], y: [yMin, yMax] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian />
        <Plot.OfX y={f} color={Theme.indigo} />
        <Plot.OfX y={g} color={Theme.blue} />
        {roots.map((x, i) => (
          <Point key={i} x={x} y={f(x)} color={Theme.green} />
        ))}
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        {roots.length} intersection{roots.length === 1 ? '' : 's'} in the shown domain.
      </p>
    </div>
  )
}
