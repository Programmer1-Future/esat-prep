import { readFileSync, writeFileSync } from 'node:fs'

const path = 'question-bank/ENGAA_2016_S1.json'
const data = JSON.parse(readFileSync(path, 'utf8'))
const qs = data.questions || data

const MORE = {
  'ENGAA-2016-M1-009': {
    steps: [
      {
        title: 'Clear the denominator',
        content: '$$a(3b^2-1)=b^2+2$$',
      },
      {
        title: 'Collect $b^2$ terms',
        content: '$$3ab^2-a=b^2+2 \\Rightarrow b^2(3a-1)=a+2$$',
      },
      {
        title: 'Solve for $b$',
        content: '$$b=\\pm\\sqrt{\\dfrac{a+2}{3a-1}}$$',
      },
    ],
    trap: 'The form with $3a+1$ in the denominator comes from a sign error when rearranging.',
  },
  'ENGAA-2016-M1-011': {
    steps: [
      {
        title: 'Single fraction',
        content:
          '$$4+\\dfrac{4-x^2}{x^2-2x}=\\dfrac{4(x^2-2x)+4-x^2}{x(x-2)}=\\dfrac{3x^2-8x+4}{x(x-2)}$$',
      },
      {
        title: 'Factor and cancel',
        content:
          '$$\\dfrac{(3x-2)(x-2)}{x(x-2)}=\\dfrac{3x-2}{x}=3-\\dfrac{2}{x}$$',
      },
    ],
  },
  'ENGAA-2016-M1-014': {
    steps: [
      {
        title: 'Rewrite as powers of 3',
        content:
          '$9=3^2$ so $9^{2n+1}=3^{4n+2}$. Also $27=3^3$ so $27^{2-n}=3^{6-3n}$.',
      },
      {
        title: 'Combine exponents',
        content:
          'Numerator $3^{4n+2}\\times 3^{4-3n}=3^{n+6}$. Divide by $3^{6-3n}$:\n\n$$3^{n+6-(6-3n)}=3^{4n}$$.',
      },
    ],
  },
  'ENGAA-2016-M1-015': {
    steps: [
      {
        title: 'Exterior angle at Q',
        content:
          'Interior angle $\\dfrac{(n-2)180}{n}$. Straight line at T gives $\\angle RQT=\\dfrac{360}{n}$.',
      },
      {
        title: 'Isosceles triangle RQT',
        content:
          '$RQ=RT$, so base angles equal: $\\angle RQT=\\angle RTQ=\\dfrac{360}{n}$.',
      },
      {
        title: 'Solve for n',
        content:
          '$$x=180-\\dfrac{720}{n}\\Rightarrow n=\\dfrac{720}{180-x}$$.',
      },
    ],
  },
}

let n = 0
for (const q of qs) {
  if (MORE[q.id]) {
    q.solution = MORE[q.id]
    n++
  }
}

writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
console.log(`added ${n} more solutions`)
