// Whitelist expression parser/compiler for diagram specs (§4 of
// docs/CONTENT_SPEC.md). Deliberately NOT `new Function`/`eval`: a typo in a
// question's diagram spec must fail to parse, not execute arbitrary JS.
// Grammar: numbers, `x`, `pi`/`e` constants, + - * / ^ (right-assoc), unary
// minus, sin/cos/tan/ln/exp/abs/sqrt, parentheses, and (for the
// `transformation` case only) a caller-supplied `f(...)` function.

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  exp: Math.exp,
  abs: Math.abs,
  sqrt: Math.sqrt,
}

const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
}

function tokenize(source) {
  const tokens = []
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < source.length && /[0-9.]/.test(source[j])) j++
      const text = source.slice(i, j)
      if (!/^\d*\.?\d+$/.test(text)) throw new ExprError(`Invalid number "${text}"`)
      tokens.push({ type: 'number', value: Number(text) })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i
      while (j < source.length && /[a-zA-Z]/.test(source[j])) j++
      tokens.push({ type: 'ident', value: source.slice(i, j) })
      i = j
      continue
    }
    if ('+-*/^(),'.includes(c)) {
      tokens.push({ type: c })
      i++
      continue
    }
    throw new ExprError(`Unexpected character "${c}" in expression "${source}"`)
  }
  return tokens
}

export class ExprError extends Error {}

// Recursive-descent parser. Precedence (low to high): + - | * / | unary - | ^ (right-assoc) | primary
function parse(tokens, source) {
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  function expectEnd() {
    if (pos !== tokens.length) {
      throw new ExprError(`Unexpected trailing input in expression "${source}"`)
    }
  }

  function parseExpr() {
    let node = parseTerm()
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = next().type
      node = { type: 'binary', op, left: node, right: parseTerm() }
    }
    return node
  }

  function parseTerm() {
    let node = parseUnary()
    while (peek() && (peek().type === '*' || peek().type === '/')) {
      const op = next().type
      node = { type: 'binary', op, left: node, right: parseUnary() }
    }
    return node
  }

  function parseUnary() {
    if (peek() && peek().type === '-') {
      next()
      return { type: 'unary', op: '-', arg: parseUnary() }
    }
    if (peek() && peek().type === '+') {
      next()
      return parseUnary()
    }
    return parsePower()
  }

  function parsePower() {
    const base = parsePrimary()
    if (peek() && peek().type === '^') {
      next()
      // right-associative: 2^3^2 = 2^(3^2)
      const exponent = parseUnary()
      return { type: 'binary', op: '^', left: base, right: exponent }
    }
    return base
  }

  function parsePrimary() {
    const tok = peek()
    if (!tok) throw new ExprError(`Unexpected end of expression "${source}"`)

    if (tok.type === 'number') {
      next()
      return { type: 'number', value: tok.value }
    }

    if (tok.type === '(') {
      next()
      const node = parseExpr()
      if (!peek() || peek().type !== ')') throw new ExprError(`Missing closing ")" in expression "${source}"`)
      next()
      return node
    }

    if (tok.type === 'ident') {
      next()
      const name = tok.value
      if (peek() && peek().type === '(') {
        next()
        const args = [parseExpr()]
        while (peek() && peek().type === ',') {
          next()
          args.push(parseExpr())
        }
        if (!peek() || peek().type !== ')') throw new ExprError(`Missing closing ")" for "${name}(" in expression "${source}"`)
        next()
        return { type: 'call', name, args }
      }
      if (name === 'x') return { type: 'variable' }
      if (name in CONSTANTS) return { type: 'number', value: CONSTANTS[name] }
      throw new ExprError(`Unknown identifier "${name}" in expression "${source}"`)
    }

    throw new ExprError(`Unexpected token "${tok.type}" in expression "${source}"`)
  }

  const ast = parseExpr()
  expectEnd()
  return ast
}

function evaluate(node, x, extraFunctions) {
  switch (node.type) {
    case 'number':
      return node.value
    case 'variable':
      return x
    case 'unary':
      return -evaluate(node.arg, x, extraFunctions)
    case 'binary': {
      const l = evaluate(node.left, x, extraFunctions)
      const r = evaluate(node.right, x, extraFunctions)
      switch (node.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/': return l / r
        case '^': return Math.pow(l, r)
        default: throw new ExprError(`Unknown operator "${node.op}"`)
      }
    }
    case 'call': {
      const fn = FUNCTIONS[node.name] || (extraFunctions && extraFunctions[node.name])
      if (!fn) throw new ExprError(`Unknown function "${node.name}"`)
      const args = node.args.map(a => evaluate(a, x, extraFunctions))
      return fn(...args)
    }
    default:
      throw new ExprError(`Unknown node type "${node.type}"`)
  }
}

/**
 * Compiles a whitelisted expression string into an evaluator.
 * `functions` may supply extra single-argument functions (e.g. `{ f }` for
 * the `transformation` case, where the spec's `transform` string references
 * the base curve as `f(...)`).
 */
export function compileExpr(source, { functions } = {}) {
  const tokens = tokenize(source)
  const ast = parse(tokens, source)
  return {
    source,
    evaluate: (x) => evaluate(ast, x, functions),
  }
}
