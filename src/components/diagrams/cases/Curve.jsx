import { Mafs, Coordinates, Plot, Point, LaTeX, Line, Theme } from 'mafs'
import 'mafs/core.css'
import { compileExpr } from '../../../lib/expr'
import { clampYRange } from './viewBoxHelpers'

// Renders the `curve` case (docs/CONTENT_SPEC.md §3.2): 1-3 functions plotted
// over a given x_range, with optional labelled points (y computed, never
// transcribed) and optional asymptotes.
const COLORS = [Theme.indigo, Theme.green, Theme.blue]

export function Curve({ functions, x_range, points, asymptotes }) {
  const [a, b] = x_range
  const xSpan = b - a
  const xPad = xSpan * 0.15
  const compiled = functions.map(f => ({ ...f, fn: compileExpr(f.expr).evaluate }))
  const vert = asymptotes?.vertical ?? []

  const samples = []
  for (let i = 0; i <= 40; i++) {
    const x = a + (i / 40) * xSpan
    // Skip near vertical asymptotes — finite but huge samples there would
    // centre clampYRange on the blow-up and hide the interesting region.
    if (vert.some(v => Math.abs(x - v) < Math.max(0.15, xSpan * 0.03))) continue
    for (const c of compiled) {
      const y = c.fn(x)
      if (Number.isFinite(y)) samples.push(y)
    }
  }
  const fallback = samples.length ? samples : [0]
  const [yMin, yMax] = clampYRange(Math.min(0, ...fallback) - 1, Math.max(0, ...fallback) + 1, xSpan)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Mafs viewBox={{ x: [a - xPad, b + xPad], y: [yMin, yMax] }} preserveAspectRatio="contain" height={280}>
        <Coordinates.Cartesian />
        {compiled.map((c, i) => (
          <Plot.OfX key={i} y={c.fn} color={COLORS[i % COLORS.length]} />
        ))}
        {asymptotes?.vertical?.map((x, i) => (
          <Line.Segment key={`v${i}`} point1={[x, yMin]} point2={[x, yMax]} color={Theme.red} strokeStyle="dashed" />
        ))}
        {asymptotes?.horizontal?.map((y, i) => (
          <Line.Segment key={`h${i}`} point1={[a, y]} point2={[b, y]} color={Theme.red} strokeStyle="dashed" />
        ))}
        {points?.map((p, i) => {
          const y = compiled[0].fn(p.x)
          return (
            <Point key={i} x={p.x} y={y} color={Theme.green} />
          )
        })}
        {points?.map((p, i) => {
          const y = compiled[0].fn(p.x)
          return (
            <LaTeX key={`label-${i}`} at={[p.x, y + (yMax - yMin) * 0.06]} tex={`\\text{${p.label}}`} />
          )
        })}
      </Mafs>
      <p className="text-[11px] text-text-muted text-center py-1.5 bg-surface-raised border-t border-border">
        {compiled.map(c => c.label || c.expr).join('  ·  ')}
      </p>
    </div>
  )
}
