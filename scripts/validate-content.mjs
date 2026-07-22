#!/usr/bin/env node
// CI gate for the Explanation System (docs/CONTENT_SPEC.md §2,
// EXPLANATION_SYSTEM_PLAN.md). Validates src/data/questions.json:
//   - every question must have solution.steps (Phase 4)
//   - schema + content rules for `solution` and `diagram` when present
//   - diff-safety: migrations must not change immutable stem fields
// Usage: node scripts/validate-content.mjs
// Opt-out (legacy): node scripts/validate-content.mjs --allow-missing-solution
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateQuestion } from '../src/lib/content-validator.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = path.join(REPO_ROOT, 'src', 'data', 'questions.json')
const IMMUTABLE_FIELDS = ['id', 'answer', 'question', 'options', 'source']
const REQUIRE_SOLUTION = !process.argv.includes('--allow-missing-solution')

function loadQuestions() {
  const raw = readFileSync(DATA_FILE, 'utf-8').trim()
  const data = JSON.parse(raw)
  return Array.isArray(data) ? data : data.questions || []
}

function readQuestionsFromGitHead() {
  const relative = 'src/data/questions.json'
  try {
    const raw = execFileSync('git', ['show', `HEAD:${relative}`], { cwd: REPO_ROOT, encoding: 'utf-8' })
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : data.questions || []
  } catch {
    return null
  }
}

function checkDiffSafety(currentQuestions, baselineQuestions) {
  if (!baselineQuestions) return []
  const baselineById = new Map(baselineQuestions.map(q => [q.id, q]))
  const issues = []
  for (const q of currentQuestions) {
    const before = baselineById.get(q.id)
    if (!before) continue
    for (const field of IMMUTABLE_FIELDS) {
      if (JSON.stringify(q[field]) !== JSON.stringify(before[field])) {
        issues.push({
          id: q.id,
          rule: 'immutable-field-changed',
          message: `Field "${field}" changed from the last commit — migrations may only add solution/diagram, never edit ${field}`,
        })
      }
    }
  }
  return issues
}

function main() {
  const questions = loadQuestions()
  const issues = []

  for (const q of questions) {
    issues.push(...validateQuestion(q, { requireSolution: REQUIRE_SOLUTION }))
  }
  issues.push(...checkDiffSafety(questions, readQuestionsFromGitHead()))

  if (issues.length === 0) {
    console.log(`validate-content: ${questions.length} questions, 0 issues${REQUIRE_SOLUTION ? ' (solution required)' : ''}.`)
    process.exit(0)
  }

  for (const issue of issues) {
    console.error(`  [${issue.id}] (${issue.rule}) ${issue.message}`)
  }
  console.error(`\nvalidate-content: ${issues.length} issue(s), ${questions.length} questions checked.`)
  process.exit(1)
}

main()
