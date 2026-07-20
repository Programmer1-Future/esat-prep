import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import '../../styles/notes.css'

function formatTechnique(raw) {
  if (!raw) return ''
  if (/\$.*\$|^\s*#{1,4}\s|^\s*[-*]\s/m.test(raw)) return raw

  let text = raw
    .replace(/\. ([A-Z])/g, '.\n\n$1')
    .replace(/ → /g, '\n\n→ ')
    .replace(/: ([A-Z])/g, ':\n\n$1')

  // Split long equality chains: if a paragraph has 3+ "=" signs,
  // break at each " = " so each step sits on its own line.
  text = text.split('\n\n').map(para => {
    const eqCount = (para.match(/ = /g) || []).length
    if (eqCount >= 3) {
      return para.replace(/ = /g, '\n\n= ')
    }
    return para
  }).join('\n\n')

  return text
}

export function TechniqueRenderer({ text, className = '' }) {
  const formatted = formatTechnique(text)

  return (
    <div className={`technique-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {formatted}
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
