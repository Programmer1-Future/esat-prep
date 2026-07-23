// Shared helper for the plot-based diagram cases (Curve, CurveTangent's
// caller, AreaUnderCurve, Transformation). Mafs' `preserveAspectRatio="contain"`
// keeps x/y units equal by EXPANDING whichever axis is under-constrained to
// match the container's aspect ratio -- for a steep function over a narrow
// x-range (e.g. a parabola reaching y=32 over an 8-unit x-span), that
// stretches the x-axis into an illegible sliver. Found building the
// `transformation` case (Phase 5). Clamping the y-span relative to the
// x-span keeps every case's viewBox in a sane landscape-ish proportion,
// at the cost of cropping extreme y-values off-screen -- normal and
// expected for a diagram meant to show the interesting region, not the
// full unbounded range of a function.
export function clampYRange(yMin, yMax, xSpan, maxRatio = 3) {
  const ySpan = yMax - yMin
  const maxYSpan = xSpan * maxRatio
  if (ySpan <= maxYSpan || xSpan <= 0) return [yMin, yMax]
  const center = (yMin + yMax) / 2
  return [center - maxYSpan / 2, center + maxYSpan / 2]
}
