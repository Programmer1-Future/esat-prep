import { Image as ImageIcon } from 'lucide-react'

// Visible treatment for a quarantined [DIAGRAM: ...] placeholder — see
// lib/diagrams.js for the extraction; this only renders the notice.
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
