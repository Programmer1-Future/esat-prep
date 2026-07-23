import katex from 'katex'
import { readFileSync } from 'node:fs'

const qs = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url)))
const mathSpan = /\$([^$]*)\$/g

let checked = 0
const errors = []
for (const q of qs) {
  const fields = { question: q.question }
  if (q.solution?.steps) {
    fields.solution = q.solution.steps.map(s => `${s.title} ${s.content}`).join('\n')
  }
  for (const [L, opt] of Object.entries(q.options)) fields['opt.' + L] = opt
  for (const [name, text] of Object.entries(fields)) {
    let m
    mathSpan.lastIndex = 0
    while ((m = mathSpan.exec(text)) !== null) {
      checked++
      try {
        katex.renderToString(m[1], { throwOnError: true, strict: false })
      } catch (e) {
        errors.push(`${q.id}/${name}: ${e.message.split('\n')[0]}  ::  $${m[1]}$`)
      }
    }
  }
}

console.log(`KaTeX-parsed ${checked} math spans across ${qs.length} questions`)
console.log(`Parse errors: ${errors.length}`)
for (const e of errors.slice(0, 40)) console.log('  -', e)
