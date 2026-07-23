#!/usr/bin/env node
/** Phase 4: strip legacy `technique` from all question-bank JSON files. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BANK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'question-bank')
let stripped = 0
for (const file of readdirSync(BANK).filter((f) => f.endsWith('.json'))) {
  const full = path.join(BANK, file)
  const raw = JSON.parse(readFileSync(full, 'utf8'))
  const isWrapped = !Array.isArray(raw) && Array.isArray(raw.questions)
  const qs = isWrapped ? raw.questions : raw
  let changed = false
  for (const q of qs) {
    if ('technique' in q) {
      delete q.technique
      stripped++
      changed = true
    }
  }
  if (changed) {
    writeFileSync(full, JSON.stringify(isWrapped ? { ...raw, questions: qs } : qs, null, 2) + '\n')
    console.log('stripped', file)
  }
}
console.log('removed technique from', stripped, 'questions')
