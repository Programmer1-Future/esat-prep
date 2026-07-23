#!/usr/bin/env node
/**
 * Phase 2: author solution.steps from technique for questions missing solutions.
 *
 * Usage:
 *   node scripts/phase2_apply_solutions.mjs [--module maths1] [--file ENGAA_2016_S1.json] [--dry-run] [--force]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { techniqueToSolution, isThinTechnique } from './lib/technique-to-steps.mjs'
import { MANUAL_SOLUTIONS } from './lib/manual-solutions.mjs'
import { validateSolution } from '../src/lib/content-validator.js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BANK = path.join(REPO, 'question-bank')

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(name)
  if (i === -1) return null
  return args[i + 1] ?? true
}
const moduleFilter = flag('--module')
const fileFilter = flag('--file')
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')

const files = readdirSync(BANK)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => !fileFilter || f === fileFilter)

const stats = {
  scanned: 0,
  already: 0,
  written: 0,
  manual: 0,
  thin: 0,
  failed: 0,
  skippedModule: 0,
}
const failures = []
const thinIds = []

for (const file of files) {
  const full = path.join(BANK, file)
  const raw = JSON.parse(readFileSync(full, 'utf8'))
  const isWrapped = !Array.isArray(raw) && Array.isArray(raw.questions)
  const qs = isWrapped ? raw.questions : raw
  let changed = false

  for (const q of qs) {
    stats.scanned++
    if (moduleFilter && q.module !== moduleFilter) {
      stats.skippedModule++
      continue
    }
    if (q.solution?.steps?.length && !force) {
      stats.already++
      continue
    }

    let solution = null
    if (MANUAL_SOLUTIONS[q.id]) {
      solution = MANUAL_SOLUTIONS[q.id]
      const issues = validateSolution(solution, q.question || '')
      if (issues.length) {
        stats.failed++
        failures.push({
          id: q.id,
          reason: 'manual: ' + issues.map((i) => `${i.rule}: ${i.message}`).join(' | '),
          file,
        })
        continue
      }
      stats.manual++
    } else if (isThinTechnique(q.technique)) {
      stats.thin++
      thinIds.push(q.id)
      continue
    } else {
      const result = techniqueToSolution(q.technique, q.question || '')
      if (!result || !result.solution) {
        stats.failed++
        failures.push({ id: q.id, reason: 'converter returned null', file })
        continue
      }
      if (result.issues?.length) {
        stats.failed++
        failures.push({
          id: q.id,
          reason: result.issues.map((i) => `${i.rule}: ${i.message}`).join(' | '),
          file,
        })
        continue
      }
      const issues = validateSolution(result.solution, q.question || '')
      if (issues.length) {
        stats.failed++
        failures.push({
          id: q.id,
          reason: issues.map((i) => `${i.rule}: ${i.message}`).join(' | '),
          file,
        })
        continue
      }
      solution = result.solution
    }

    if (!dryRun) {
      q.solution = solution
      changed = true
    }
    stats.written++
  }

  if (changed && !dryRun) {
    const out = isWrapped ? { ...raw, questions: qs } : qs
    writeFileSync(full, JSON.stringify(out, null, 2) + '\n', 'utf8')
    console.log(`wrote ${file}`)
  }
}

console.log(JSON.stringify({ stats, thinIds, failureCount: failures.length, failures }, null, 2))
