import { HabitDay } from './HabitDay'
import { getStudyPhases } from '../../lib/utils'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getDatesInRange(start, end) {
  const dates = []
  const current = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function groupByMonth(dates) {
  const months = {}
  dates.forEach(date => {
    const key = date.slice(0, 7)
    if (!months[key]) months[key] = []
    months[key].push(date)
  })
  return months
}

// Range spans the whole derived study calendar — build phase start to exam
// day — so the grid always matches the user's own exam date, never a fixed one.
export function CalendarGrid({ habits, onDayClick, examDate }) {
  const phases = getStudyPhases(examDate)
  const startDate = phases[0].start
  const endDate = examDate
  const allDates = getDatesInRange(startDate, endDate)
  const months = groupByMonth(allDates)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div>
        {Object.entries(months).map(([monthKey, dates]) => {
          const [year, month] = monthKey.split('-')
          const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

          // Pad the first week
          const firstDate = new Date(dates[0] + 'T00:00:00')
          const firstDayOfWeek = (firstDate.getDay() + 6) % 7 // 0=Mon
          const paddedDates = [
            ...Array(firstDayOfWeek).fill(null),
            ...dates,
          ]

          // Pad the end to complete the last week
          const remaining = paddedDates.length % 7
          if (remaining !== 0) {
            for (let i = 0; i < 7 - remaining; i++) {
              paddedDates.push(null)
            }
          }

          const weeks = []
          for (let i = 0; i < paddedDates.length; i += 7) {
            weeks.push(paddedDates.slice(i, i + 7))
          }

          return (
            <div key={monthKey} className="mb-6">
              <h3 className="text-xs font-600 text-text-muted mb-3 uppercase tracking-widest">
                {monthName}
              </h3>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-[10px] text-text-muted font-500 pb-1">
                    {d}
                  </div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                  {week.map((date, di) => (
                    <div key={di}>
                      {date ? (
                        <HabitDay
                          date={date}
                          entry={habits[date]}
                          isToday={date === today}
                          isFuture={date > today}
                          isOutOfRange={false}
                          examDate={examDate}
                          onClick={onDayClick}
                        />
                      ) : (
                        <div className="aspect-square" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
