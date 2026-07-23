import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { MathDiagram } from '../diagrams/MathDiagram'
import '../../styles/notes.css'

function StepMarkdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  )
}

const TITLE_STOP_ENDS = new Set([
  'the', 'and', 'by', 'of', 'a', 'an', 'to', 'same', 'apply', 'so', 'but', 'with',
  'at', 'for', 'from', 'since', 'is', 'are', 'was', 'not', 'as', 'or', 'in', 'on',
  'than', 'their', 'its', 'be', 'this', 'that', 'which', 'when', 'then', 'means',
  'giving', 'using', 'taking', 'has', 'have', 'would', 'could', 'should', 'will',
  'can', 'only', 'also', 'both', 'all', 's', 't', 'm', 'n',
])

/** Hide auto-titles: body prefixes, ≥8-word truncations, stopword endings, latex residue. */
function showStepTitle(title, content) {
  const t = String(title || '').replace(/\$[^$]*\$/g, ' ').trim()
  const c = String(content || '').replace(/\$[^$]*\$/g, ' ').trim()
  if (!t) return false
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 8) return false
  const last = (words[words.length - 1] || '').toLowerCase().replace(/[.,;:!?]+$/, '')
  if (words.length >= 4 && TITLE_STOP_ENDS.has(last)) return false
  if (c.toLowerCase().startsWith(t.toLowerCase()) && words.length >= 4) return false
  if (/\bpmatrix\b|mathrm|\\[a-zA-Z]+/i.test(t)) return false
  return true
}

// Renders an authored `solution` (docs/CONTENT_SPEC.md §2) as numbered
// steps with a diagram injected after `diagram.after_step`, replacing the
// regex-guessed formatting of the old technique blob path.
export function SolutionSteps({ solution, diagram }) {
  const { steps, fast, trap } = solution
  const [mode, setMode] = useState(fast ? 'fast' : 'full')
  const diagramAfterStep = diagram?.after_step ?? steps.length

  return (
    <div>
      {fast && (
        <div className="flex gap-1 mb-2">
          <button
            type="button"
            onClick={() => setMode('fast')}
            className={`px-2 py-0.5 rounded text-[10px] font-600 uppercase tracking-wide transition-colors ${
              mode === 'fast' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            ⚡ 30-second way
          </button>
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`px-2 py-0.5 rounded text-[10px] font-600 uppercase tracking-wide transition-colors ${
              mode === 'full' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Full method
          </button>
        </div>
      )}

      {mode === 'fast' && fast ? (
        <div className="technique-body text-[13px]">
          <StepMarkdown>{fast}</StepMarkdown>
        </div>
      ) : (
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-600 flex items-center justify-center mt-0.5 tabular">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                {showStepTitle(step.title, step.content) && (
                  <div className="text-[12px] font-600 text-text-secondary mb-0.5 [&_p]:inline [&_p]:m-0">
                    <StepMarkdown>{step.title}</StepMarkdown>
                  </div>
                )}
                <div className="technique-body text-[13px]">
                  <StepMarkdown>{step.content}</StepMarkdown>
                </div>
                {diagram && diagramAfterStep === i + 1 && (
                  <div className="mt-2">
                    <MathDiagram diagram={diagram} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {trap && (
        <div className="mt-3 pt-2 border-t border-border-subtle">
          <p className="text-[11px] font-600 uppercase tracking-widest text-warning/70 mb-1">Common trap</p>
          <div className="technique-body text-[12px]">
            <StepMarkdown>{trap}</StepMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
