import { cn } from '../../lib/utils'

// Trust badge: surfaces whether a question is a real past-paper question or
// not. "adapted" = reconstructed from paper; "generated" = site-authored filler.
export function OriginBadge({ origin, source, className = '' }) {
  const isAdapted = origin === 'adapted'
  const isGenerated = origin === 'generated'
  const text = isGenerated
    ? 'Generated practice'
    : (origin === 'past-paper' || isAdapted) && source
      ? `${source} · ${isAdapted ? 'Adapted' : 'Past paper'}`
      : 'Practice question'

  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-600 tracking-wide border whitespace-nowrap',
        isGenerated
          ? 'bg-info/10 border-info/30 text-info'
          : isAdapted
            ? 'bg-warning/10 border-warning/30 text-warning'
            : 'bg-surface-raised border-border text-text-muted',
        className
      )}
    >
      {text}
    </span>
  )
}
