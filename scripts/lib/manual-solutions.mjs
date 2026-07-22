/**
 * Hand-authored solutions for questions whose technique is too thin / flagged /
 * broken for automatic conversion. Keys are question IDs.
 */
export const MANUAL_SOLUTIONS = {
  'ENGAA-2022-M1-001': {
    steps: [
      {
        title: 'Square the fraction',
        content:
          '$$\\left(\\dfrac{3x^{1/2}z}{y^3}\\right)^2 = \\dfrac{9xz^2}{y^6}$$',
      },
      {
        title: 'Multiply by the outer y',
        content: '$$y \\cdot \\dfrac{9xz^2}{y^6} = \\dfrac{9xz^2}{y^5}$$',
      },
    ],
  },
  'NSAA-2022-M1-001': {
    steps: [
      {
        title: 'Square the fraction',
        content:
          '$$\\left(\\dfrac{3x^{1/2}z}{y^3}\\right)^2 = \\dfrac{9xz^2}{y^6}$$',
      },
      {
        title: 'Multiply by the outer y',
        content: '$$y \\cdot \\dfrac{9xz^2}{y^6} = \\dfrac{9xz^2}{y^5}$$',
      },
    ],
  },
  'ENGAA-2023-M1-002': {
    steps: [
      {
        title: 'Isolate the fraction term',
        content: '$$y = p - \\dfrac{q-r}{s-x} \\implies p - y = \\dfrac{q-r}{s-x}$$',
      },
      {
        title: 'Invert both sides',
        content: '$$s - x = \\dfrac{q-r}{p-y}$$',
      },
      {
        title: 'Solve for x',
        content: '$$x = s - \\dfrac{q-r}{p-y}$$',
      },
    ],
  },
  'NSAA-2019-M1-015': {
    steps: [
      {
        title: 'Find box-selection probabilities',
        content:
          'Both coins heads selects box A: $P_A = \\dfrac{1}{4}$. Otherwise box B: $P_B = \\dfrac{3}{4}$.',
      },
      {
        title: 'Conditional red probabilities',
        content:
          'From box A: $P(\\text{red}\\mid \\text{box A}) = \\dfrac{6}{10} = 0.6$. From box B: $P(\\text{red}\\mid \\text{box B}) = \\dfrac{3}{15} = 0.2$.',
      },
      {
        title: 'Apply the law of total probability',
        content:
          '$$P(\\text{red}) = \\dfrac{1}{4}(0.6) + \\dfrac{3}{4}(0.2) = 0.15 + 0.15 = 0.3 = \\dfrac{3}{10}$$',
      },
    ],
  },
  'NSAA-2021-CHEM-001': {
    steps: [
      {
        title: 'Order from displacement reactions',
        content:
          'R displaces T from solution, so R is more reactive than T. T reacts with HCl (produces $\\mathrm{H_2}$), so T is more reactive than hydrogen. M does not react with HCl, so M is less reactive than hydrogen.',
      },
      {
        title: 'Place M relative to Q',
        content: 'M displaces Q from solution, so M is more reactive than Q.',
      },
      {
        title: 'Combine the inequalities',
        content: 'Overall: R $> $ T $> $ hydrogen $> $ M $> $ Q, so the order is R, T, M, Q.',
      },
    ],
  },

  'ENGAA-2023-PHY-014': {
    steps: [
      {
        title: 'Read the network topology',
        content:
          'The four identical resistors of resistance $R$ form the chain $P$ in series with the parallel pair $Q\\parallel R$, then $S$ in series. The equivalent resistance is $$R_{\\mathrm{eq}} = R + \\dfrac{R}{2} + R = \\dfrac{5}{2}R.$$',
      },
      {
        title: 'Relate battery current to power in Q',
        content:
          'Battery current $I$ splits equally through $Q$ and $R$, so each parallel branch carries $\\dfrac{I}{2}$. Power in $Q$ is $$\\left(\\dfrac{I}{2}\\right)^2 R = \\dfrac{I^2 R}{4} = 4.0\\,\\mathrm{W} \\implies I^2 R = 16\\,\\mathrm{W}.$$',
      },
      {
        title: 'Find the total battery power',
        content:
          '$$P_{\\mathrm{total}} = I^2 R_{\\mathrm{eq}} = I^2 \\cdot \\dfrac{5}{2}R = \\dfrac{5}{2}\\cdot 16 = 40\\,\\mathrm{W}.$$',
      },
    ],
  },

  'ENGAA-2023-PHY-015': {
    steps: [
      {
        title: 'Set up forces on one plank',
        content:
          'Each plank has weight $W = 40 \\times 10 = 400\\,\\mathrm{N}$ and makes $30^\\circ$ with the vertical. By symmetry the apex reaction is horizontal, so the normal reaction at the base equals $W$. Friction $f$ at the base balances that horizontal apex force.',
      },
      {
        title: 'Take moments about the apex',
        content:
          'With plank length $L$, moments about the apex give $$W \\cdot \\dfrac{L}{2}\\sin 30^\\circ = f \\cdot L\\cos 30^\\circ.$$',
      },
      {
        title: 'Solve for the friction',
        content:
          '$$f = \\dfrac{W}{2}\\tan 30^\\circ = \\dfrac{400}{2}\\cdot \\dfrac{1}{\\sqrt{3}} = \\dfrac{200}{\\sqrt{3}}\\,\\mathrm{N}.$$',
      },
    ],
  },

  'ENGAA-2023-PHY-019': {
    steps: [
      {
        title: 'Find the geometric path difference',
        content:
          'Triangle $PQR$ is isosceles with $\\angle QPR = \\angle QRP = 30^\\circ$, so $$PQ = QR = \\dfrac{d/2}{\\cos 30^\\circ} = \\dfrac{d}{\\sqrt{3}}.$$ The path difference is $$\\delta = PQ + QR - PR = \\dfrac{2d}{\\sqrt{3}} - d = d\\left(\\dfrac{2}{\\sqrt{3}} - 1\\right).$$',
      },
      {
        title: 'Include the reflection phase shift',
        content:
          'A phase change of $\\pi$ at $Q$ is equivalent to an extra path of $\\dfrac{\\lambda}{2}$. For the two arrivals at the detector to be in phase, $$\\delta + \\dfrac{\\lambda}{2} = n\\lambda \\quad (n = 1, 2, 3, \\ldots).$$',
      },
      {
        title: 'Maximise the wavelength',
        content:
          'Rearranging, $\\lambda = \\dfrac{\\delta}{n - 1/2}$. The greatest wavelength is at $n = 1$: $$\\lambda = 2\\delta = 2d\\left(\\dfrac{2}{\\sqrt{3}} - 1\\right).$$',
      },
    ],
  },

  'NSAA-2018-M1-002': {
    steps: [
      {
        title: 'Write volume and surface area',
        content:
          'The sides are $x$, $x\\sqrt{2}$ and $2x$. Volume: $$V = x \\cdot x\\sqrt{2} \\cdot 2x = 2\\sqrt{2}\\, x^3.$$ Total surface area: $$S = 2\\bigl(x\\cdot x\\sqrt{2} + x\\cdot 2x + x\\sqrt{2}\\cdot 2x\\bigr) = 2x^2\\bigl(2 + 3\\sqrt{2}\\bigr).$$',
      },
      {
        title: 'Impose the numerical condition',
        content:
          '$$V = 2S \\implies 2\\sqrt{2}\\, x^3 = 4x^2\\bigl(2 + 3\\sqrt{2}\\bigr).$$ For $x \\neq 0$, $$\\sqrt{2}\\, x = 2\\bigl(2 + 3\\sqrt{2}\\bigr) = 4 + 6\\sqrt{2}.$$',
      },
      {
        title: 'Solve for x',
        content:
          '$$x = \\dfrac{4 + 6\\sqrt{2}}{\\sqrt{2}} = 2\\sqrt{2} + 6 = 6 + 2\\sqrt{2}.$$',
      },
    ],
  },

  'NSAA-2018-PHY-016': {
    steps: [
      {
        title: 'Find the equivalent resistance',
        content:
          'Identical resistors $X$ and $Y$ are in parallel, and that combination is in series with $Z$. With each resistance equal to $R$, $$R_{\\mathrm{eq}} = \\dfrac{R}{2} + R = \\dfrac{3}{2}R.$$',
      },
      {
        title: 'Share total power by resistance',
        content:
          'The same battery current flows through the parallel block and through $Z$, so power splits in the ratio of those resistances: $$P_{X\\parallel Y} : P_Z = \\dfrac{R}{2} : R = 1 : 2.$$ Of the $18\\,\\mathrm{W}$ supplied, $P_{X\\parallel Y} = 6\\,\\mathrm{W}$ and $P_Z = 12\\,\\mathrm{W}$.',
      },
      {
        title: 'Split the parallel power',
        content:
          '$X$ and $Y$ are identical, so each dissipates half of $6\\,\\mathrm{W}$: $$P_X = 3.0\\,\\mathrm{W}.$$',
      },
    ],
  },

  'NSAA-2019-CHEM-012': {
    steps: [
      {
        title: 'Balance phosphorus and hydrogen',
        content:
          'From $\\mathrm{P_4}$ on the left, $x = 4$. Hydrogen atoms: $w + 2 = 3x = 12$, so $w = 10$.',
      },
      {
        title: 'Use nitrogen and electron transfer',
        content:
          'Nitrogen: $w = y + z$, so $y + z = 10$. Each $\\mathrm{P}$ atom is oxidised from $0$ to $+5$, so $\\mathrm{P_4}$ loses $20$ electrons. Reduction $\\mathrm{N(+5)}\\to\\mathrm{N(+2)}$ in $\\mathrm{NO}$ gains $3$ electrons per formula unit, and $\\mathrm{N(+5)}\\to\\mathrm{N(+4)}$ in $\\mathrm{NO_2}$ gains $1$, giving $$3y + z = 20.$$',
      },
      {
        title: 'Solve and sum the coefficients',
        content:
          'From $y + z = 10$ and $3y + z = 20$: $y = 5$, $z = 5$. Then $$w + x + y + z = 10 + 4 + 5 + 5 = 24.$$',
      },
    ],
  },

  'NSAA-2020-PHY-002': {
    steps: [
      {
        title: 'Read the given ion',
        content:
          'In the given diagram, unshaded nucleons are protons and shaded nucleons are neutrons: $3$ protons, $4$ neutrons, and $4$ electrons. Net charge is $-1$ (an anion of the mass-$7$ isotope).',
      },
      {
        title: 'State the required species',
        content:
          'An oppositely charged ion of the same element needs $3$ protons (same atomic number) but fewer than $3$ electrons (net positive charge), and a neutron count other than $4$ (different isotope).',
      },
      {
        title: 'Match the diagram counts',
        content:
          'The matching diagram has $3$ protons, $3$ neutrons, and $2$ electrons: net charge $+1$, mass number $6$. That is a cation of a different isotope of the same element.',
      },
    ],
  },

  'NSAA-2021-BIO-010': {
    steps: [
      {
        title: 'Count bases on the given strand',
        content:
          'In $\\mathrm{AATCGGTCTTGCGGCCAAGGCCCTT}$: $\\mathrm{A}=4$, $\\mathrm{T}=6$, $\\mathrm{G}=7$, $\\mathrm{C}=8$.',
      },
      {
        title: 'Apply complementary base pairing',
        content:
          'In double-stranded DNA, every $\\mathrm{A}$ pairs with $\\mathrm{T}$ and every $\\mathrm{G}$ with $\\mathrm{C}$, so totals are $$\\mathrm{A}=\\mathrm{T}=4+6=10, \\qquad \\mathrm{G}=\\mathrm{C}=7+8=15$$ out of $50$ bases.',
      },
      {
        title: 'Identify the matching pie chart',
        content:
          'Proportions are $\\mathrm{A}:\\mathrm{T}:\\mathrm{G}:\\mathrm{C} = 10:10:15:15 = 2:2:3:3$. The correct chart has equal $\\mathrm{A}$ and $\\mathrm{T}$ wedges (each $20\\%$) and equal, larger $\\mathrm{G}$ and $\\mathrm{C}$ wedges (each $30\\%$).',
      },
    ],
  },

  'NSAA-2023-M1-010': {
    steps: [
      {
        title: 'Express the legs from the tangent',
        content:
          'With $\\tan\\theta = \\sqrt{2}$, the opposite and adjacent sides may be taken as $\\sqrt{2}\\,k$ and $k$. The hypotenuse is $$k\\sqrt{3} = 3\\sqrt{6} \\implies k = 3\\sqrt{2}.$$',
      },
      {
        title: 'Compute the area',
        content:
          '$$\\text{Area} = \\dfrac{1}{2}\\cdot(\\sqrt{2}\\,k)\\cdot k = \\dfrac{\\sqrt{2}}{2}k^2 = \\dfrac{\\sqrt{2}}{2}\\cdot(3\\sqrt{2})^2 = \\dfrac{\\sqrt{2}}{2}\\cdot 18 = 9\\sqrt{2}.$$',
      },
    ],
  },
}
