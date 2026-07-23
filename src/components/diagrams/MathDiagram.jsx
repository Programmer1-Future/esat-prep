import { CircleLine } from './cases/CircleLine'
import { Curve } from './cases/Curve'
import { CurveTangent } from './cases/CurveTangent'
import { AreaUnderCurve } from './cases/AreaUnderCurve'
import { TrigSolutions } from './cases/TrigSolutions'
import { Triangle } from './cases/Triangle'
import { Transformation } from './cases/Transformation'
import { NumberLine } from './cases/NumberLine'
// After case imports (they pull mafs/core.css) so theme vars win on cascade too.
import 'mafs/core.css'
import './mafs-theme.css'

// Dispatcher from a `diagram` spec (docs/CONTENT_SPEC.md §2) to its case
// component. An unknown/missing case renders nothing rather than crashing
// the explanation modal -- a bad or not-yet-built case should never take
// down the rest of the explanation.
const CASES = {
  'circle-line': CircleLine,
  curve: Curve,
  'curve-tangent': CurveTangent,
  'area-under-curve': AreaUnderCurve,
  'trig-solutions': TrigSolutions,
  triangle: Triangle,
  transformation: Transformation,
  'number-line': NumberLine,
}

export function MathDiagram({ diagram }) {
  if (!diagram) return null
  const Case = CASES[diagram.case]
  if (!Case) return null
  return <Case {...diagram} />
}
