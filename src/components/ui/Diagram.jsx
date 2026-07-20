import { useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'

// Shown when a question's figure could not be resolved — see lib/diagrams.js.
export function DiagramNotice({ caption }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-dashed border-warning/50 bg-warning/5 mb-4">
      <ImageIcon size={15} className="text-warning mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-600 uppercase tracking-widest text-warning/80 mb-0.5">Diagram pending</p>
        <p className="text-xs text-text-secondary leading-relaxed">{caption || 'Figure not yet available for this question.'}</p>
      </div>
    </div>
  )
}

// The figure as cropped from the source paper. The crops are opaque white, so
// they sit on an explicit white sheet in both themes rather than as a bare slab
// on the dark background. The caption is the accessible description only — it
// paraphrases the figure and sometimes its physics, so it is never shown next to
// the real thing.
export function DiagramFigure({ caption, src, eager = false }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <DiagramNotice caption={caption} />

  return (
    <figure className="mb-4 rounded-xl border border-border bg-white p-3 overflow-x-auto">
      <img
        src={src}
        alt={caption || 'Figure for this question'}
        onError={() => setFailed(true)}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="mx-auto block h-auto max-h-[420px] w-auto max-w-full object-contain"
      />
    </figure>
  )
}
