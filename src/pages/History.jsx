import { Link } from 'react-router-dom'
import { useEvents } from '../lib/eventLog'
import { getTopicName, getModuleName, getModule } from '../lib/moduleMap'
import { formatProjected } from '../lib/mockScore'
import { Card } from '../components/ui/Card'
import { useLocalStorage } from '../hooks/useLocalStorage'

const OUTCOME_COLOR = {
  correct: 'var(--success)',
  wrong: 'var(--danger)',
  timeout: 'var(--warning)',
  skip: 'var(--muted)',
}

function OutcomeDots({ results }) {
  if (!results?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {results.map((r, i) => (
        <span
          key={i}
          title={`${getTopicName(r.topicId)} · ${r.outcome} · ${r.timeSec}s`}
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: OUTCOME_COLOR[r.outcome] || 'var(--muted)' }}
        />
      ))}
    </div>
  )
}

function EventBody({ e, sittingIds }) {
  if (e.type === 'quiz_completed') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">
          Scored <span className="font-600 text-text-primary tabular">{e.score}/{e.total}</span>
          {' · '}{Math.round(e.totalTimeSec)}s total
          {e.config?.moduleIds?.length ? ` · ${e.config.moduleIds.map(getModuleName).join(', ')}` : ''}
        </p>
        <OutcomeDots results={e.results} />
      </div>
    )
  }

  if (e.type === 'mock_logged') {
    const m = getModule(e.module)
    const hasSitting = e.sittingId && sittingIds.has(e.sittingId)
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">
          <span className="font-600" style={{ color: m?.color }}>{m?.short || e.module}</span>
          {' · '}
          <span className="tabular font-600 text-text-primary">{e.score}/{e.total}</span>
          {typeof e.projected === 'number' && (
            <> · projected {formatProjected(e.projected)}</>
          )}
          {e.manual && ' · manual'}
          {e.autoSubmitted && ' · timed out'}
        </p>
        <OutcomeDots results={e.results} />
        {hasSitting && (
          <Link to={`/mocks/${e.sittingId}`} className="text-xs font-600 text-accent hover:opacity-80">
            Review sitting →
          </Link>
        )}
      </div>
    )
  }

  if (e.type === 'review_completed') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">
          Review scored <span className="font-600 text-text-primary tabular">{e.score}/{e.total}</span>
          {e.totalTimeSec != null && <> · {Math.round(e.totalTimeSec)}s</>}
        </p>
        <OutcomeDots results={e.results} />
      </div>
    )
  }

  if (e.type === 'achievement_unlocked') {
    return (
      <p className="text-sm text-text-secondary">
        Unlocked <span className="font-600 text-text-primary">{e.title || e.achievementId}</span>
      </p>
    )
  }

  if (e.type === 'study_logged') {
    return (
      <p className="text-sm text-text-secondary">
        Study log{e.date ? ` · ${e.date}` : ''}
        {e.hours != null && <> · {e.hours}h</>}
        {e.questionsCompleted != null && <> · {e.questionsCompleted} questions</>}
        {e.sessionType ? ` · ${e.sessionType}` : ''}
      </p>
    )
  }

  if (e.type === 'topic_updated') {
    return (
      <p className="text-sm text-text-secondary">
        Topic {getTopicName(e.topicId) || e.topicId}
        {e.confidence != null && <> · confidence {e.confidence}</>}
        {e.status ? ` · ${e.status}` : ''}
      </p>
    )
  }

  return (
    <pre className="text-[11px] text-text-muted overflow-x-auto">{JSON.stringify(e, null, 1)}</pre>
  )
}

export default function History() {
  const events = useEvents()
  const [sittings] = useLocalStorage('esat_mock_sittings', [])
  const sittingIds = new Set((sittings || []).map(s => s.id))
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
            <EventBody e={e} sittingIds={sittingIds} />
          </div>
        </Card>
      ))}
    </div>
  )
}
