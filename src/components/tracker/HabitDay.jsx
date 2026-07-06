import { getPhaseForDate } from '../../lib/utils'

export function HabitDay({ date, entry, isToday, isFuture, isOutOfRange, examDate, onClick }) {
  const phase = getPhaseForDate(date, examDate)
  const phaseColor = phase ? phase.color : 'rgb(var(--c-border))'

  const dayNum = new Date(date + 'T00:00:00').getDate()
  const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())

  const hasData = entry && (entry.hours > 0 || entry.questionsCompleted > 0)

  let bgColor = 'rgb(var(--c-hover))'

  if (isOutOfRange) {
    bgColor = 'rgb(var(--c-bg))'
  } else if (hasData) {
    bgColor = phaseColor
  } else if (!isFuture && !isOutOfRange) {
    bgColor = 'rgb(var(--c-hover))'
  }

  return (
    <button
      onClick={() => !isOutOfRange && onClick(date)}
      disabled={isOutOfRange}
      title={date}
      className={`
        relative w-full aspect-square rounded-lg flex items-center justify-center
        text-xs font-body transition-all duration-200 ease-out
        ${isOutOfRange ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5'}
        ${isToday ? 'ring-1 ring-accent/60 ring-offset-1 ring-offset-background' : ''}
        ${isWeekend && !isOutOfRange ? 'opacity-75' : ''}
      `}
      style={{ backgroundColor: bgColor, opacity: isOutOfRange ? 0.25 : 1 }}
    >
      <span
        className={`text-[10px] font-500 tabular ${
          hasData ? 'text-on-accent' : isToday ? 'text-accent' : 'text-text-muted'
        }`}
      >
        {dayNum}
      </span>
      {hasData && (
        <div
          className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full opacity-80"
          style={{ backgroundColor: phaseColor }}
        />
      )}
    </button>
  )
}
