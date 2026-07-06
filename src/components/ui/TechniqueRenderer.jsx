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

// Inline math renderer for question stems and options — no paragraph reflow, just
// LaTeX + light markdown. ESAT question text and options carry $...$ spans that
// the TMUA source never had (it rendered stems as plain text).
export function MathText({ text, className = '' }) {
  return (
    <span className={`technique-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {text || ''}
      </ReactMarkdown>
    </span>
  )
}
