import { readFileSync, writeFileSync } from 'node:fs'

const path = 'question-bank/ENGAA_2016_S1.json'
const data = JSON.parse(readFileSync(path, 'utf8'))
const qs = data.questions || data

const SOLUTIONS = {
  'ENGAA-2016-M1-001': {
    steps: [
      {
        title: 'Isolate the x term',
        content: 'Subtract 6 from both sides:\n\n$$-14 < -\\dfrac{x}{2}$$',
      },
      {
        title: 'Clear the fraction',
        content:
          'Multiply through by $-2$. Reverse the inequality because the multiplier is negative:\n\n$$28 > x$$',
      },
      {
        title: 'Rewrite the inequality',
        content: '$$x < 28$$',
      },
    ],
    fast: 'Move constants, then multiply by $-2$ and reverse: $x < 28$.',
    trap: '$x < 22$ comes from forgetting to reverse when multiplying by a negative.',
  },
  'ENGAA-2016-M1-002': {
    steps: [
      {
        title: 'Expand the square',
        content: '$$(\\sqrt{3}-\\sqrt{2})^2 = 3 - 2\\sqrt{3}\\sqrt{2} + 2$$',
      },
      {
        title: 'Collect constants',
        content: '$3+2=5$, so the expression is $5-2\\sqrt{3}\\sqrt{2}$.',
      },
      {
        title: 'Match the form',
        content: '$$5-2\\sqrt{2}\\sqrt{3}$$',
      },
    ],
    trap: '$5-\\sqrt{2}\\sqrt{3}$ drops the factor of 2 on the middle term.',
  },
  'ENGAA-2016-M1-003': {
    steps: [
      {
        title: 'Common value of R',
        content: '$Q:R=5:2=15:6$ and $R:S=3:10=6:20$.',
      },
      {
        title: 'Chain the ratios',
        content: 'With $R=6$ shared, $Q:S=15:20$.',
      },
      {
        title: 'Simplify',
        content: '$$15:20=3:4$$',
      },
    ],
  },
  'ENGAA-2016-M1-004': {
    steps: [
      {
        title: 'Original total age',
        content: '$$20 \\times 28 = 560$$ years.',
      },
      {
        title: 'New total age',
        content: '22 members at mean 30: $$22 \\times 30 = 660$$.',
      },
      {
        title: 'Mean of the two new',
        content: 'Extra age $660-560=100$, so mean $$100/2=50$$ years.',
      },
    ],
  },
  'ENGAA-2016-M1-005': {
    steps: [
      {
        title: 'Value after 2 years',
        content: '$$15000 \\times 0.8^2 = 15000 \\times 0.64 = 9600$$.',
      },
      {
        title: 'Find the reduction',
        content: '$$15000-9600=5400$$, so $\\pounds 5400$.',
      },
    ],
    trap: '$\\pounds 6000$ is two separate 20% cuts of the original price, not compound depreciation.',
  },
  'ENGAA-2016-M1-006': {
    steps: [
      {
        title: 'Find angle at B',
        content:
          'From B, BA is due West and BC has bearing $060^\\circ$, so $\\angle ABC = 90^\\circ-60^\\circ=30^\\circ$.',
      },
      {
        title: 'Find angle at A',
        content:
          'From A, AB is due West and AC has bearing $330^\\circ$, so $\\angle BAC = 330^\\circ-270^\\circ=60^\\circ$.',
      },
      {
        title: 'Right triangle at C',
        content:
          '$\\angle C=180^\\circ-30^\\circ-60^\\circ=90^\\circ$. Hypotenuse $AB=4$, so $$BC=4\\sin 60^\\circ=2\\sqrt{3}$$ km.',
      },
    ],
  },
  'ENGAA-2016-M1-007': {
    steps: [
      {
        title: 'Write the proportion',
        content: '$x=k/\\sqrt{y}$. With $x=8$, $y=9$: $$k=8\\sqrt{9}=24$$.',
      },
      {
        title: 'Solve for y',
        content: 'When $x=6$: $\\sqrt{y}=24/6=4$, so $$y=16$$.',
      },
    ],
  },
  'ENGAA-2016-M1-008': {
    steps: [
      {
        title: 'Area formula',
        content: '$$\\tfrac12[(x-1)+(x+5)]x=(x+2)x=120$$.',
      },
      {
        title: 'Solve the quadratic',
        content:
          '$$x^2+2x-120=0 \\Rightarrow x=\\dfrac{-2+\\sqrt{484}}{2}=10$$ (positive root).',
      },
      {
        title: 'Length of RS',
        content: '$$RS=x+5=15$$ cm.',
      },
    ],
  },
  'ENGAA-2016-M1-010': {
    steps: [
      {
        title: 'Circumference from the sheet',
        content:
          'Height is 10 m, so the 5 m side is the circumference: $$2\\pi r=5 \\Rightarrow r=\\dfrac{5}{2\\pi}$$.',
      },
      {
        title: 'Volume of the cylinder',
        content:
          '$$V=\\pi r^2 h=\\pi\\left(\\dfrac{5}{2\\pi}\\right)^2\\times 10=\\dfrac{125}{2\\pi}$$.',
      },
    ],
  },
  'ENGAA-2016-M1-012': {
    steps: [
      {
        title: 'Fill tennis and girls',
        content:
          'Boys in tennis $=\\tfrac23\\times 36=24$, girls in tennis $=12$. Girls in archery $=46-12-25=9$.',
      },
      {
        title: 'Boys in swimming',
        content:
          'Archery total 27 $\\Rightarrow$ boys in archery $=18$. Boys total 74, so boys swimming $=74-24-18=32$.',
      },
      {
        title: 'Conditional probability',
        content: '$$P(\\text{swimming}\\mid\\text{boy})=32/74=16/37$$.',
      },
    ],
  },
  'ENGAA-2016-M1-013': {
    steps: [
      {
        title: 'Masses from unit volume',
        content:
          'Volume 1: tin mass $0.1Y$, copper mass $0.9X$, total mass $0.1Y+0.9X$.',
      },
      {
        title: 'Percentage mass of tin',
        content:
          '$$\\dfrac{0.1Y}{0.1Y+0.9X}\\times 100=\\dfrac{Y}{9X+Y}\\times 100$$.',
      },
    ],
  },
}

let n = 0
for (const q of qs) {
  if (SOLUTIONS[q.id]) {
    q.solution = SOLUTIONS[q.id]
    n++
  }
}

writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
console.log(`wrote solutions for ${n} questions`)
