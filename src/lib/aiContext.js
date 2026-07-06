import { readStoredValue } from '../hooks/useLocalStorage'
import { getModuleModel, getModuleForecast, getModuleAttention, getAttempts } from './studentModel'
import { getDueEntries } from './reviewQueue'
import { getModule } from './moduleMap'
import { calculateStreak, getCurrentPhase } from './utils'

// Build a compact markdown digest of the whole learning profile, designed to be
// pasted into any AI tutor so it can reason over the student's real data.
// Module-aware version of De-TMUA-guide's aiContext.js — every section is
// scoped per module (there is no combined score to summarise for ESAT).
export function buildAIContext({ events, examDate, chosenModules }) {
  const habits = readStoredValue('esat_habits', {})
  const due = getDueEntries()
  const phase = getCurrentPhase(examDate)
  const streak = calculateStreak(habits)
  const attempts = getAttempts(events)
  const attention = getModuleAttention(events, chosenModules)
  const examDays = Math.max(0, Math.ceil((new Date(examDate + 'T09:00:00').getTime() - Date.now()) / 86400000))

  const lines = []
  lines.push('# ESAT student profile (auto-generated)')
  lines.push('')
  lines.push(`- Exam: ESAT on ${examDate} (${examDays} days away); current study phase: ${phase.name} — ${phase.description}`)
  lines.push(`- Modules: ${chosenModules.map(id => getModule(id)?.short || id).join(', ')} — each scored independently 1.0–9.0, no combined score`)
  lines.push(`- Total recorded question attempts: ${attempts.length}; current study streak: ${streak} days; spaced-repetition reviews due now: ${due.length}`)

  lines.push('')
  lines.push('## Which module needs attention most')
  attention.forEach((a, i) => lines.push(`${i + 1}. ${getModule(a.moduleId)?.name || a.moduleId} — ${a.reason}`))

  lines.push('')
  lines.push('## Per-module state')
  lines.push('| Module | Attempts | Accuracy | Wrong | Slow-correct | Fast-correct | Forecast | Basis |')
  lines.push('|---|---|---|---|---|---|---|---|')
  for (const id of chosenModules) {
    const m = getModuleModel(events, id)
    const forecast = getModuleForecast({ events, moduleId: id, examDate })
    lines.push(`| ${getModule(id)?.name || id} | ${m.attempts} | ${m.accuracy === null ? '—' : Math.round(m.accuracy * 100) + '%'} | ${m.wrong} | ${m.slow} | ${m.fast} | ${forecast ? forecast.projected.toFixed(1) : '—'} | ${forecast ? forecast.basis : 'no signal'} |`)
  }

  lines.push('')
  lines.push('## Recent sessions (last 15 events)')
  events.slice(-15).forEach(e => {
    const day = e.ts.slice(0, 10)
    if (e.type === 'quiz_completed') lines.push(`- ${day}: quiz ${e.score}/${e.total}${e.config?.moduleIds ? ` (${e.config.moduleIds.join(', ')})` : ''}`)
    else if (e.type === 'review_completed') lines.push(`- ${day}: review ${e.score}/${e.total}`)
    else if (e.type === 'study_logged') lines.push(`- ${day}: study ${e.hours || 0}h${e.sessionType ? ` (${e.sessionType})` : ''}`)
    else if (e.type === 'mock_logged') lines.push(`- ${day}: mock ${getModule(e.module)?.short || e.module} ${e.score}/${e.total} → ${typeof e.projected === 'number' ? e.projected.toFixed(1) : e.projected}`)
    else if (e.type === 'achievement_unlocked') lines.push(`- ${day}: achievement "${e.title}"`)
  })

  lines.push('')
  lines.push('Context: recommendations should be small, concrete next actions with clear reasons, scoped to one module at a time.')
  return lines.join('\n')
}
