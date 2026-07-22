import { TechniqueRenderer } from '../ui/TechniqueRenderer'
import { SolutionSteps } from './SolutionSteps'

// Prefer authored solution.steps; fall back to legacy technique blob during migration.
export function QuestionExplanation({ question }) {
  if (question.solution?.steps?.length) {
    return (
      <>
        <p className="text-[11px] font-600 uppercase tracking-widest text-accent/70 mb-1">Worked solution</p>
        <SolutionSteps solution={question.solution} diagram={question.diagram} />
      </>
    )
  }
  if (!question.technique) return null
  return (
    <>
      <p className="text-[11px] font-600 uppercase tracking-widest text-accent/70 mb-1">How to solve it</p>
      <TechniqueRenderer text={question.technique} />
    </>
  )
}

export function hasExplanation(question) {
  return Boolean(question.solution?.steps?.length || question.technique)
}
