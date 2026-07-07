import { cn } from '../../lib/utils'

// Trust badge: surfaces whether a question is a real past-paper question or
// not. All current bank questions are "past-paper" — "adapted" is being
// introduced for reconstructed questions, "generated" is a future origin.
export function OriginBadge({ origin, source, className = '' }) {
  const isAdapted = origin === 'adapted'
  const text = (origin === 'past-paper' || isAdapted) && source
    ? `${source} · ${isAdapted ? 'Adapted' : 'Past paper'}`
    : 'Practice question'

  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-600 tracking-wide border whitespace-nowrap',
        isAdapted
          ? 'bg-warning/10 border-warning/30 text-warning'
          : 'bg-surface-raised border-border text-text-muted',
        className
      )}
    >
      {text}
    </span>
  )
}
