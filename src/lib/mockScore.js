// Raw module score (0–27) → projected ESAT scale score (1.0–9.0).
// ESAT reports each module independently on 1.0–9.0; official raw→scale tables
// vary by sitting, so this is a linear projection anchored at 0 → 1.0 and
// 27/27 → 9.0 (≈50% → 5.0, consistent with published ENGAA-era conversions).
// There is NO combined ESAT score — never sum or average across modules.
export function projectScore(correct, total = 27) {
  if (!total) return 1.0
  const clamped = Math.min(Math.max(correct / total, 0), 1)
  return Math.round((1 + 8 * clamped) * 10) / 10
}

export function formatProjected(score) {
  return score.toFixed(1)
}
