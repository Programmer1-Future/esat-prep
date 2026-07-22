import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import '../../styles/notes.css'

// Notes / admin body renderer (markdown + LaTeX). Not used for question explanations
// after Phase 4 — those go through SolutionSteps.
export function TechniqueRenderer({ text, className = '' }) {
  return (
    <div className={`technique-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {text || ''}
      </ReactMarkdown>
    </div>
  )
}

// Block renderer for question stems — no paragraph reflow, just LaTeX + markdown.
// Must be a <div>: react-markdown emits block elements, and stems carry GFM tables
// (the papers' data tables, flattened by extraction and now being restored). A
// <table> nested in a <span> is invalid HTML and cannot lay out.
export function MathText({ text, className = '' }) {
  return (
    <div className={`technique-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {text || ''}
      </ReactMarkdown>
    </div>
  )
}

// Inline variant for short values that sit inside a flex row — option text, and the
// answer values in the review list. Keeps the <span> so the row doesn't break; block
// constructs (tables, lists) are not expected here.
export function InlineMath({ text, className = '' }) {
  return (
    <span className={`technique-body technique-inline ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {text || ''}
      </ReactMarkdown>
    </span>
  )
}
