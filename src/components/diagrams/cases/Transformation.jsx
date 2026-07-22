import { Mafs, Coordinates, Plot, Theme } from 'mafs'
import 'mafs/core.css'
import { compileExpr } from '../../../lib/expr'
import { clampYRange } from './viewBoxHelpers'

// Renders the `transformation` case (docs/CONTENT_SPEC.md §3.7). `transform`
// references the base curve symbolically as `f(...)`, compiled with `f`
// bound to the base expression's own evaluator.
export function Transformation({ expr, transform, x_range }) {
  const base = compileExpr(expr)
  const transformed = compileExpr(transform, { functions: { f: base.evaluate } })
  const [a, b] = x_range
  const xSpan = b - a
  const xPad = xSpan * 0.15

  const samples = []
  for (let i = 0; i <= 40; i++) {
    const x = a + (i / 40) * xSpan
    samples.push(base.evaluate(x), transformed.evaluate(x))
  }
  const [yMin, yMax] = clampYRange(Math.min(...samples) - 1, Math.max(...samples) + 1, xSpan, 5)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [a - xPad, b + xPad], y: [yMin, yMax] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian />
        <Plot.OfX y={base.evaluate} color={Theme.indigo} svgPathProps={{ strokeDasharray: '6,4' }} />
        <Plot.OfX y={transformed.evaluate} color={Theme.green} />
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        Original (dashed) vs transformed (solid).
      </p>
    </div>
  )
}
