import { useEvents } from '../lib/eventLog'
import { getTopicName, getModuleName } from '../lib/moduleMap'
import { Card } from '../components/ui/Card'

const OUTCOME_COLOR = {
  correct: 'var(--success)',
  wrong: 'var(--danger)',
  timeout: 'var(--warning)',
  skip: 'var(--muted)',
}

export default function History() {
  const events = useEvents()
  const ordered = [...events].reverse()

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="font-display font-700 text-2xl text-text-primary tracking-[-0.02em]">Event Ledger</h1>
        <p className="text-text-muted text-sm mt-1">{events.length} event{events.length !== 1 ? 's' : ''} — the append-only source of truth</p>
      </div>

      {ordered.length === 0 && (
        <Card><div className="p-6 text-sm text-text-muted text-center">No events yet. Complete a practice session and it lands here.</div></Card>
      )}

      {ordered.map(e => (
        <Card key={e.id}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-600 text-accent">{e.type}</span>
              <span className="text-[11px] text-text-muted tabular">{new Date(e.ts).toLocaleString('en-GB')}</span>
            </div>
            {e.type === 'quiz_completed' && (
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  Scored <span className="font-600 text-text-primary tabular">{e.score}/{e.total}</span>
                  {' · '}{Math.round(e.totalTimeSec)}s total
                  {e.config?.moduleIds?.length ? ` · ${e.config.moduleIds.map(getModuleName).join(', ')}` : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(e.results || []).map((r, i) => (
                    <span
                      key={i}
                      title={`${getTopicName(r.topicId)} · ${r.outcome} · ${r.timeSec}s`}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: OUTCOME_COLOR[r.outcome] || 'var(--muted)' }}
                    />
                  ))}
                </div>
              </div>
            )}
            {e.type !== 'quiz_completed' && (
              <pre className="text-[11px] text-text-muted overflow-x-auto">{JSON.stringify(e, null, 1)}</pre>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
