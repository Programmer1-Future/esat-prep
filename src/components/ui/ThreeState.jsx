import { cn } from '../../lib/utils'

// The three-state visual language, used identically on Dashboard and Insights:
// wrong = danger, slow-correct = warning, fast-correct = success. Slow-correct
// must never read as failure — it is amber risk, not red loss.
export function ThreeStateBar({ wrong, slow, fast, height = 'h-1.5' }) {
  const total = wrong + slow + fast
  if (!total) return <div className={cn('rounded-full bg-border', height)} />
  return (
    <div className={cn('flex rounded-full overflow-hidden bg-border', height)}>
      {wrong > 0 && <div style={{ width: `${(wrong / total) * 100}%`, background: 'var(--danger)' }} />}
      {slow > 0 && <div style={{ width: `${(slow / total) * 100}%`, background: 'var(--warning)' }} />}
      {fast > 0 && <div style={{ width: `${(fast / total) * 100}%`, background: 'var(--success)' }} />}
    </div>
  )
}

export function ThreeStateLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--danger)' }} /> Wrong</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--warning)' }} /> Slow correct — over target time</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--success)' }} /> Fast correct</span>
    </div>
  )
}
