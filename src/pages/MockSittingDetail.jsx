import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { MockSittingReview } from '../components/mock/MockSittingReview'
import { resolveSittingReview } from '../lib/mockSittingReview'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function MockSittingDetail() {
  const { sittingId } = useParams()
  // Re-read when sittings/events change (events aren't on this key, but sittings are).
  useLocalStorage('esat_mock_sittings', [])
  useLocalStorage('esat_events', [])

  const { sitting, moduleResults, questionsByModule, reviewable, reason } = resolveSittingReview(sittingId)

  if (!sitting) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Link to="/mocks" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors">
          <ChevronLeft size={14} /> Mock history
        </Link>
        <Card className="p-8 text-center">
          <p className="text-sm text-text-secondary">Sitting not found.</p>
          <p className="text-xs text-text-muted mt-1">It may have been cleared from this device.</p>
        </Card>
      </div>
    )
  }

  if (!reviewable) {
    const message = reason === 'manual'
      ? 'No question review — this mock was logged manually.'
      : 'No per-question data is available for this sitting.'
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Link to="/mocks" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors">
          <ChevronLeft size={14} /> Mock history
        </Link>
        <MockSittingReview
          moduleResults={moduleResults}
          questionsByModule={{}}
          title={sitting.date}
          subtitle={message}
          showMissedQueueNote={false}
          onDone={undefined}
        />
        <Link
          to="/mocks"
          className="block w-full text-center py-3.5 rounded-xl font-600 text-sm border border-border text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all duration-150"
        >
          Back to mock history
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto px-6 pt-6">
        <Link to="/mocks" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors">
          <ChevronLeft size={14} /> Mock history
        </Link>
      </div>
      <MockSittingReview
        moduleResults={moduleResults}
        questionsByModule={questionsByModule}
        title={sitting.date}
        subtitle="Review answers and worked solutions from this sitting."
        showMissedQueueNote={false}
        onDone={undefined}
      />
    </div>
  )
}
