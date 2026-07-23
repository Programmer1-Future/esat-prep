import { SolutionSteps } from './SolutionSteps'

/** Student-facing explanation: authored solution.steps only (Phase 4). */
export function QuestionExplanation({ question }) {
  if (!question.solution?.steps?.length) return null
  return (
    <>
      <p className="text-[11px] font-600 uppercase tracking-widest text-accent/70 mb-1">Worked solution</p>
      <SolutionSteps solution={question.solution} diagram={question.diagram} />
    </>
  )
}

export function hasExplanation(question) {
  return Boolean(question.solution?.steps?.length)
}
