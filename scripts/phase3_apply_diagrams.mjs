#!/usr/bin/env node
/**
 * Phase 3: classify maths questions for Mafs diagrams and apply
 * diagram / diagram_skipped. Never adds diagram when stem has [DIAGRAM:].
 *
 * Usage:
 *   node scripts/phase3_apply_diagrams.mjs [--dry-run] [--apply-skips-only]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateQuestion } from '../src/lib/content-validator.js'
import { MANUAL_DIAGRAMS } from './lib/manual-diagrams.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BANK = path.join(REPO, 'question-bank')
const dryRun = process.argv.includes('--dry-run')
const skipsOnly = process.argv.includes('--apply-skips-only')

/** TMUA §5 adapted to ESAT free-text subtopics. First match wins. */
const CASE_RULES = [
  {
    case: 'circle-line',
    patterns: [
      /chord/i,
      /tangent.*circle|circle.*tangent/i,
      /line.?and.?circle|circle.?and.?line/i,
      /equation of a circle/i,
      /tangent length to a circle/i,
      /inscribed in a square/i,
      /radical/i,
    ],
  },
  {
    case: 'curve-tangent',
    patterns: [
      /equation of tangent|equation of normal/i,
      /tangent line to a (quadratic|parabola|curve)/i,
      /gradient at a point/i,
      /normal to a curve/i,
    ],
  },
  {
    case: 'area-under-curve',
    patterns: [
      /area under/i,
      /area between.*(curve|line|parabola)/i,
      /area bounded by.*(curve|line|parabola)/i,
      /signed area/i,
      /trapezium rule/i,
    ],
  },
  {
    case: 'trig-solutions',
    patterns: [
      /trig.*counting solutions|counting solutions.*trig/i,
      /trig(onometric)? equation.*solutions/i,
      /number of solutions.*trig|trig.*number of solutions/i,
      /simultaneous trig.*solutions/i,
      /intersections.*sine|sine.*intersections/i,
    ],
  },
  {
    case: 'triangle',
    patterns: [
      /sine rule|cosine rule/i,
      /\bSSA\b/,
      /ambiguous.*triangle/i,
      /maximising the area of a triangle/i,
      /SAS formula/i,
    ],
  },
  {
    case: 'transformation',
    patterns: [
      /transform(ing|ation).*sine|sine.*transform/i,
      /translation and reflection of a curve/i,
      /translations and reflections of curves/i,
      /transforming a sine curve/i,
      /graphs.?transformations/i,
    ],
  },
  {
    case: 'number-line',
    patterns: [
      /sign analysis/i,
      /increasing function condition/i,
      /quadratic inequalit/i,
      /linear inequalit/i,
      /quartic inequalit/i,
      /cubic inequalit/i,
      /rational inequalit/i,
    ],
  },
  {
    case: 'curve',
    patterns: [
      /graph sketching|sketching.*graph/i,
      /asymptote/i,
      /comparing.*graph/i,
      /roots via turning/i,
      /turning points of a cubic/i,
      /stationary points of a cubic/i,
      /quadratic curve, rectangle/i,
      /minimum vertical distance between line and curve/i,
    ],
  },
]

function matchCase(q) {
  const hay = `${q.subtopic || ''} ${q.topic || ''}`
  for (const rule of CASE_RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule.case
  }
  // topic-level fallback
  if (/graphs.?transform/i.test(q.topic || '')) return 'transformation'
  return null
}

function hasPaperPng(q) {
  return /\[DIAGRAM:/i.test(q.question || '') || Boolean(q.image)
}

const stats = {
  maths: 0,
  png: 0,
  ineligible: 0,
  eligible: 0,
  authored: 0,
  skipped: 0,
  failed: 0,
}
const byCase = {}
const eligibleIds = []
const failures = []

for (const file of readdirSync(BANK).filter((f) => f.endsWith('.json'))) {
  const full = path.join(BANK, file)
  const raw = JSON.parse(readFileSync(full, 'utf8'))
  const isWrapped = !Array.isArray(raw) && Array.isArray(raw.questions)
  const qs = isWrapped ? raw.questions : raw
  let changed = false

  for (const q of qs) {
    if (q.module !== 'maths1' && q.module !== 'maths2') continue
    stats.maths++

    if (hasPaperPng(q)) {
      stats.png++
      // Never add Mafs; clear any accidental diagram
      if (q.diagram) {
        delete q.diagram
        changed = true
      }
      continue
    }

    const matched = matchCase(q)
    if (!matched) {
      stats.ineligible++
      continue
    }

    stats.eligible++
    byCase[matched] = (byCase[matched] || 0) + 1
    eligibleIds.push({ id: q.id, case: matched, subtopic: q.subtopic })

    if (q.diagram?.case || q.diagram_skipped) continue

    if (MANUAL_DIAGRAMS[q.id]) {
      const entry = MANUAL_DIAGRAMS[q.id]
      if (entry.diagram_skipped) {
        if (!dryRun) {
          q.diagram_skipped = entry.diagram_skipped
          changed = true
        }
        stats.skipped++
      } else if (entry.diagram && !skipsOnly) {
        const probe = { ...q, diagram: entry.diagram }
        const issues = validateQuestion(probe)
        if (issues.length) {
          stats.failed++
          failures.push({ id: q.id, issues })
        } else {
          if (!dryRun) {
            q.diagram = entry.diagram
            changed = true
          }
          stats.authored++
        }
      }
      continue
    }

    // Default for eligible-but-unauthored: document skip (agents author givens only when confident)
    const reason = `eligible ${matched}: givens not yet authored from stem (Phase 3 batch skip)`
    if (!dryRun) {
      q.diagram_skipped = reason
      changed = true
    }
    stats.skipped++
  }

  if (changed && !dryRun) {
    writeFileSync(full, JSON.stringify(isWrapped ? { ...raw, questions: qs } : qs, null, 2) + '\n')
    console.log('wrote', file)
  }
}

console.log(JSON.stringify({ stats, byCase, failureCount: failures.length, failures, eligibleSample: eligibleIds.slice(0, 40), eligibleCount: eligibleIds.length }, null, 2))
