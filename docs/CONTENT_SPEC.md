# ESATprep — Question Presentation & Explanation Spec

Version 1.0. Governs all 1022 records in `question-bank/` and `src/data/questions.json`.
Binding on: the AI content pass, human editors, and `scripts/check_content.py` (build gate).

Priority when rules conflict: **clarity under time pressure > completeness**. A student has
~60 seconds per question in the real thing and maybe 90 seconds of patience for an
explanation after getting one wrong. Every trade below was decided that way, and where
rigour lost, it says so.

---

## 0. GOVERNING PRINCIPLE (resolves Tension 1)

> **Restore the paper's invariants, not the paper's geometry.**

An invariant is something a student would actually *lose* on exam day if we changed it.
Geometry is an artifact of A4 print that carries no skill.

Apply the test: *if the real paper looked like our version, would the candidate perform
differently?*

| Change | Invariant or geometry? | Verdict |
|---|---|---|
| Three "Rows" as a table instead of a run-on sentence | **Invariant.** The paper had a table; reading tabular data as prose is a load the real exam never imposes. | Restore it |
| Options in a 2–4 column grid instead of stacked | **Geometry.** On paper all eight options are in one eyeful. The invariant is *simultaneous visibility*, and stacking eight of them off-screen breaks it. | Grid permitted (§3) |
| Prompt in a tinted callout box | **Invariant, destroyed.** Locating the actual question inside a wall of context *is* a tested skill. A callout does that work for them. | **Banned** |
| Two-column desktop layout | **Geometry — but it changes reading order.** The paper is a single reading column. A two-column split invents a scan pattern that won't exist. | **Rejected** |
| Bold "Row 1: Invalid" tags in the *explanation* | Not exam surface at all. | Free |

The boundary, stated once: **the stem, the diagram, and the option text are exam surface
and may be re-*structured* but never re-*styled* into cues that don't exist on paper.
Everything with no counterpart on exam day — explanations, miss-reason tags, timers,
progress — is site chrome and is designed purely for comprehension.**

Corollary the content pass must obey: **never reword official question text.** Restoration
means inserting whitespace, table pipes and `$` delimiters. It never means changing,
adding, summarising or clarifying a word.

---

## 1. STEM FORMATTING SPEC

### 1.1 Markup convention

The permitted markup is a **closed subset of GFM**, already supported by `MathText`:

| Construct | Syntax | Permitted in stems |
|---|---|---|
| Paragraph break | blank line (`\n\n`) | yes |
| GFM table | `\| a \| b \|` + `\| --- \| --- \|` | yes |
| Ordered list | `1. ` at line start | yes |
| Unordered list | `- ` at line start | yes |
| Inline maths | `$...$` | yes |
| Display maths | `$$...$$` | **no** — stems never need it; ban makes the check trivial |
| Figure caption | `*Figure: ...*` (single reserved italic construct) | only per §1.4 |
| Bold | `**...**` | **no** |
| Headings, blockquotes, links, code, HTML, `---` rules | — | **no** |

Single newlines (`\n`) are forbidden: GFM collapses them, so they encode intent that never
survives to the DOM. Use `\n\n` or a list.

Bold is banned in stems even though real papers use it, because "restore the paper's bold"
is not mechanically decidable from the extraction (the bold was lost) — so any bold we add
is invention, and invention is a cue (§0).

### 1.2 Renderer changes required (blocking)

1. `MathText` must render a `<div>`, not a `<span>` (`TechniqueRenderer.jsx:50`). Tables and
   lists are block elements; nesting them in a `<span>` is invalid HTML.
   Where inline flow is genuinely needed (option text inside a flex row, `QuestionBank.jsx:497`),
   export a separate `InlineMath` that keeps the `<span>` and forbids block constructs.
2. Delete `formatTechnique` (`TechniqueRenderer.jsx:8-28`). Once explanations carry real
   structure, a regex that inserts paragraph breaks at `". [A-Z]"` will fire on
   "…at 9.81 m s⁻². Substituting…" *and* mangle decimals, and it silently applies to some
   records and not others depending on whether they happen to contain a `$`. Structure comes
   from the content, not from a display-time heuristic.
3. Table styling: no zebra striping, no card wrapper. A hairline `border-collapse` grid in
   `--border-subtle`, matching print. It is part of the question, not a widget.

### 1.3 Enumerated alternatives (Row 1/2/3, Statement I/II/III)

Extremely common in this bank; two mechanical outcomes, decided by field structure.

**Rule E1 — table form.** If every enumerated entry parses as ≥2 `key = value` or `key: value`
pairs **and the key sequence is identical across all entries**, emit a GFM table. Column 1 is
the enumerator; remaining columns are the shared keys in first-seen order.

```
Row 1: y=h, x=t. Row 2: y=kinetic energy, x=h. Row 3: y=gravitational potential energy, x=s.
```
→
```
| Row | $y$-axis | $x$-axis |
| --- | --- | --- |
| 1 | $h$ | $t$ |
| 2 | kinetic energy | $h$ |
| 3 | gravitational potential energy | $s$ |
```

**Rule E2 — list form.** If entries are single clauses, or the key sequence differs between
entries, emit an ordered list preserving the paper's labels verbatim:

```
1. The reaction is exothermic.
2. The equilibrium shifts left on heating.
3. $K_c$ decreases as temperature rises.
```

Roman-numeral enumerations (I, II, III) keep Roman labels — use a `- ` list with the literal
label, since GFM ordered lists renumber to Arabic and the options say "II and III only".

**Failure modes of E1/E2:**
- *Comma inside a value* ("x = 1, 2 or 3") splits a cell wrongly. Detector: a value containing
  a comma that is not followed by a known key token → abort to E2.
- *Ragged keys* (Row 1 gives axes, Row 2 gives a condition) → E2, correctly.
- *Two-level enumeration* (Row 1 with sub-parts a/b) → abort both, flag `needs_manual_structure`.
- *An enumerator appearing in the narrative* ("in Row 1 of the table above") → only treat as an
  entry when the label sits at a sentence start and is followed by `:` or `)`.

### 1.4 Diagram references

Stems currently carry inline `[DIAGRAM: ...]` markers from extraction.

- **If a PNG crop exists for the question:** delete the marker entirely. The description is a
  lossy paraphrase of an image the student can see; leaving both invites the student to trust
  the words over the picture, and the extraction descriptions are demonstrably unreliable.
- **If no PNG exists:** convert to a single line `*Figure: <original text, verbatim>*`, placed
  where the image would sit. This is the only italic permitted in a stem, and it is honest —
  it reads as editorial, not as official question text.
- `[DIAGRAM:` must never survive anywhere in a shipped record. Hard ban (§4).

### 1.5 Layering: Context / Data / Prompt

Per §0 this is a **paragraph split only**. No badges, no callouts, no colour, no ordering
change. The three layers become three visually identical paragraph groups in original order.

**Detection, in order:**

1. **Prompt** = the last sentence terminating in `?`. If none, the last sentence beginning with
   a token from the fixed trigger list: `Which`, `What`, `How many`, `Calculate`, `Determine`,
   `Find`, `Estimate`, `State`, `Give`, `Deduce`, `Show that`.
2. **Trailing assumptions** — a parenthesised sentence, or one starting `Assume`, `Take`,
   `You may assume`, `Ignore`, `Neglect` — that occurs *after* the prompt stays after the
   prompt, in its own paragraph. It is not context, and folding it upward changes reading order.
3. **Data** = any span matched by E1/E2, plus any sentence that is purely a symbol assignment
   (`matches ^[A-Za-z] *= *[-0-9]`).
4. **Context** = everything before the first Data span.

**Failure modes:**
- Rhetorical or embedded questions in the narrative ("the question of whether…?") produce a
  false prompt. Guard: prompt candidate must be the final or penultimate sentence.
- Multi-part prompts ("Which row is valid, and what is the gradient?") — a single sentence,
  correctly kept whole.
- Prompt-first stems ("Which of the following is true of the reaction below?") — detector finds
  it at position 0; do not reorder. Layer order follows the paper, always.
- Stems where the prompt is a bare imperative fragment with no trigger word → no split emitted.
  Safe failure: the stem stays one paragraph, which is exactly what it is today.

When detection is ambiguous, **emit nothing**. An unsplit stem is the status quo; a wrongly
split one moves the question.

### 1.6 Variables as maths (resolves Tension 2)

**Verdict: not automatable as a blanket pass. Automatable under one narrow, self-evidencing
rule that will cover roughly half the symbols and must refuse the rest.**

**Rule V1 — declared-symbol set.** For each question, build the set `S` of symbols that already
appear inside `$...$` anywhere in that record's `question`, `options` *or* `technique` fields.
Only members of `S` may be auto-wrapped.

**Rule V2 — token conditions.** A bare occurrence is wrapped only if all hold:
- it is a single character, `[A-Za-z]`, with word boundaries on both sides;
- it is in `S`;
- it is not immediately preceded by a digit or `°` (excludes `5 A`, `300 K`);
- it is not inside an existing `$…$` span;
- it is not the first word of a sentence (excludes "A student…", "I is measured…");
- it is not followed by `)` where preceded by `(` (excludes "(a)" style sub-labels).

**Rule V3 — absolute denylist**, applied after V2, never wrapped automatically regardless of `S`:
`a, A, I, i, e, o, O, u` (articles, pronouns, Euler's number ambiguity), and any letter that is
an SI unit symbol or element symbol *in this module*: physics `{A, C, F, J, K, N, T, V, W, S, Ω}`,
chemistry `{H, C, N, O, S, P, K, B, F, I, V, W, Y, U}`. In chemistry, single capitals are element
symbols until proven otherwise — the pass must not wrap them at all; chemistry is manual.

**Coverage on the worked example.** The stem contains no `$` at all, but the technique contains
`$h = H-\tfrac12gt^2$`, `$KE = mg(H-h)$` and `$GPE = mg(H-s)$`, so
`S = {h, H, g, t, s, m}`. V1–V3 therefore auto-wrap `H`, `t`, `s`, `h` in the stem and
**refuse `v`, `y`, `x`** (not in `S`). That is the expected behaviour: the machine does the
provable half and hands the rest to review. It must never guess to finish the job.

Every auto-wrap emits a diff line to `content-pass-report.json` for human sampling. Target
sample rate 10% of touched questions, 100% of chemistry and biology.

### 1.7 Punctuation repair

Only these, and only these, are permitted as text edits — they are extraction damage, not
authorial choice:
- `.\s*\.` → `.` (the "speed v. . Which" defect)
- `\s+([,.;:?])` → `\1`
- ` ,` → `,`; `( ` → `(`; ` )` → `)`
- collapse runs of ≥2 spaces to one
- `--` → `–` only between digits

Anything else that looks like a typo goes to `review_note`, not to the text.

### 1.8 Line length

Question surface capped at `max-w-[68ch]`. This is the one place a purely typographic default
beats the paper's ~90-character measure, because screen reading at 90ch measurably costs
re-scan time. Cost accepted: our lines are shorter than exam-day lines. Judged negligible
against the daily reading benefit.

---

## 2. EXPLANATION SPEC

**Migration (2026-07):** Student-facing explanations move from a single `technique`
markdown blob to TMUA's authored **`solution.steps`** schema. See
`EXPLANATION_SYSTEM_PLAN.md` for phase order. During migration the UI prefers
`solution` and falls back to `technique` until Phase 4.

Gold reference (diagram cases, full rule list):
`C:\Users\Ahmed\Documents\De-TMUA-guide\docs\CONTENT_SPEC.md`.

### 2.1 UI labels

| Data | Student-facing heading |
|---|---|
| `solution.steps` present | **Worked solution** |
| `technique` fallback only | **How to solve it** |

Paper figures in stems (`[DIAGRAM:]` → `public/diagrams/<id>.png`) are unchanged.
A question with a paper PNG must **never** also get a declarative Mafs `diagram` field.

### 2.2 `solution` schema

```jsonc
{
  "solution": {
    "steps": [
      { "title": "Imperative, ≤ 8 words", "content": "Prose + LaTeX, ≤ ~50 words" }
      // 2–6 steps
    ],
    "fast": "Optional. Elimination/estimation route.",
    "trap": "Optional. Tempting wrong option by VALUE not letter."
  }
}
```

**Hard bans (CI-enforced when `solution` is present):** option letters (`Answer C`,
`option B`, `(D)`), unicode math in solution text, first/second person, hedging,
platform meta, ellipsis-as-reasoning, ≥15-word verbatim stem overlap. Full list in
TMUA `CONTENT_SPEC.md` §1.

**Never name an option letter** — options shuffle and re-letter at render (`QuestionBank.jsx`).

Keep `technique` in the JSON during Phases 1–3 as backup; strip in Phase 4 only.

### 2.3 Optional Mafs `diagram` (maths, Phase 3+)

```jsonc
{
  "diagram": {
    "case": "curve-tangent",
    "after_step": 2,
    // case-specific givens only — code derives geometry
  }
}
```

Eight typed cases: `circle-line`, `curve`, `curve-tangent`, `area-under-curve`,
`trig-solutions`, `triangle`, `transformation`, `number-line`. Agents author givens
only; never transcribe computed coordinates. Set `after_step` so the figure sits
mid-solution. Skip Mafs when the stem already has `[DIAGRAM:]` / a paper PNG.

### 2.4 Maths typesetting, per module

| Module | Display `$$…$$` | Inline `$…$` | Prose |
|---|---|---|---|
| maths1 / maths2 | 1–3 blocks per step when manipulating expressions | Substituted values, single symbols, results | Step framing |
| physics | **≤2 blocks** total — governing equation once | Numeric substitution + answer with units | Dominant |
| chemistry | Balanced equations only | Species in `\mathrm{}` — no `\ce{}` | Dominant |
| biology | **Zero, normally** | Sparingly | Near-total |

All maths in `solution.*` must use LaTeX with braced arguments (`\sqrt{5}`, never `\sqrt 5`).

### 2.5 Legacy `technique` blob (fallback until Phase 4)

Existing `technique` strings remain valid during migration. Do **not** rely on
`formatTechnique()` regex structure — new content must use `solution.steps`.
The old §2.3 markdown-section structure (`**The answer**` / `**The route**` / …)
inside `technique` is **retired**; it never landed in the bank at scale.

---

## 3. OPTION LAYOUT (resolves Tension 4)

Options are shuffled and re-lettered per render. The badge shows the **display** letter; nothing
in any text field may reference a letter at all (§4).

**Column count is computed once per question, from the widest option, and applied uniformly.**
Never ragged, never per-option.

```
weight(option):
  strip $ delimiters
  each LaTeX command token (\frac, \sqrt, \int, \sum, ^{..}, _{..}) counts as 6
  \frac{a}{b} additionally forces hasStacked = true
  everything else counts as 1 char

w = max(weight(o) for o in options)
n = len(options)

if any option contains "$$", a newline, a table pipe, an image, or hasStacked  -> 1 column
elif w <= 12 and n >= 6   -> 4 cols (lg) / 2 cols (sm) / 2 cols (xs)
elif w <= 12              -> 2 cols (lg) / 1 col (sm)
elif w <= 28              -> 2 cols (lg) / 1 col (sm)
else                      -> 1 column
```

`hasStacked` forces single column because a stacked fraction blows the row height and a grid of
mismatched row heights reads worse than a stack.

Tab/arrow order must be **row-major** and must match visual order. Touch targets ≥44px in every
configuration. On any viewport where a 1-column stack would exceed the viewport height, the grid
is not optional — it is the invariant from §0.

---

## 4. HARD BANS

Every one is checkable. `[F]` = build-failing, `[W]` = warn + review queue.

**In `technique`:**
1. `[F]` Option-letter references: `/\b(option|choice|answer)\s+[A-H]\b/i`, `/\b[A-H]\)/`,
   `/\bthe (first|second|third|fourth|last) option\b/i`.
2. `[F]` Extraction commentary: `[DIAGRAM`, `[OCR`, `[NOTE`, `[TODO`, `[sic]`, `[?]`.
3. `[F]` Uncertainty hedging: `trusting the official key`, `assuming the`, `presumably`,
   `it seems`, `appears to be`, `cannot verify`, `unclear`, `I think`, `probably`,
   `if the diagram`, `hard to tell`.
4. `[F]` Ellipsis standing in for reasoning: `…` or `...` outside a `$…$` span.
5. `[F]` First/second person: `we`, `I`, `you'll`, `let's`, `our`. Explanations are impersonal.
6. `[F]` Meta-reference to the platform: `this question`, `the above`, `as shown earlier`,
   `see the stem`.
7. `[F]` `\ce{` (mhchem not loaded — renders as raw text).
8. `[F]` Unbalanced `$` delimiters, or `$$` inside a paragraph of prose.
9. `[F]` Missing required section heading (`**The answer**`, `**The route**`).
10. `[W]` Bare numbers with a physical dimension and no unit in the final answer sentence.
11. `[W]` >250 words, or `**The route**` >8 sentences.
12. `[W]` Display block in a `biology` record.
13. `[F]` Restating the stem verbatim (>15-word overlap with `question`) — that is padding.
14. `[F]` Hedging relocated: any uncertainty must live in the **non-rendered** `review_note`
    field, never in `technique`.

**In `question`:**
15. `[F]` `[DIAGRAM`, `[OCR`, or any `[UPPERCASE:` marker.
16. `[F]` `**bold**`, headings, blockquotes, links, code fences, raw HTML, `$$`.
17. `[F]` Single `\n` not part of a table or list block.
18. `[F]` Doubled sentence terminators (`. .`, `..`, `?.`).
19. `[F]` Any word-level diff against the archived pre-pass text other than whitespace, `$`
    insertion, table pipes, list markers, and the §1.7 punctuation repairs. **This is the
    strongest gate in the spec** — it makes "never reword official text" mechanical.
20. `[W]` A single-letter variable outside `$…$` that is a member of `S` (§1.6) — a missed wrap.

**In `options`:**
21. `[F]` Empty or placeholder (`-`, `—`, `N/A`) values.
22. `[F]` Text referencing another option's letter.
23. `[F]` Unbalanced `$`.

---

## 5. WORKED REWRITE — ENGAA-2023-PHY-017

### 5.1 Stem — BEFORE

```
An object is released from rest at a height H above the ground and falls freely in a uniform
gravitational field. At time t after being released, it has fallen a distance s and is at a
height h above the ground, travelling at speed v. [DIAGRAM: a graph showing y plotted against
x, starting at the origin and curving upward]. Which row(s) show(s) a possible pair of
quantities for the axes? Row 1: y=h, x=t. Row 2: y=kinetic energy, x=h. Row 3: y=gravitational
potential energy, x=s. (Assume that air resistance is negligible.)
```

### 5.2 Stem — AFTER

```markdown
An object is released from rest at a height $H$ above the ground and falls freely in a uniform gravitational field.

At time $t$ after being released, it has fallen a distance $s$ and is at a height $h$ above the ground, travelling at speed v.

| Row | y-axis | x-axis |
| --- | --- | --- |
| 1 | $h$ | $t$ |
| 2 | kinetic energy | $h$ |
| 3 | gravitational potential energy | $s$ |

Which row(s) show(s) a possible pair of quantities for the axes?

(Assume that air resistance is negligible.)
```

**Every change, justified:**
- `[DIAGRAM: …]` deleted — a PNG crop exists (§1.4). The paraphrase is removed, not relocated.
- Rows → GFM table via rule E1 (identical key sequence `y`, `x` across all three entries).
- `speed v. . Which` → `speed v.` (§1.7 doubled terminator).
- `H, t, s, h` wrapped: all in `S` derived from the technique's `$…$` spans (§1.6).
- `v`, `y`, `x` **left bare** — not in `S`. Flagged for human review, not guessed. This is the
  rule working correctly, and it is why §1.6 says the pass is half-automatic.
- Paragraph splits at Context / Data / Prompt / trailing-assumption boundaries (§1.5). Order
  unchanged. No callout, no badge, no colour.
- Not one word of official text altered.

### 5.3 Technique — BEFORE

```
Row 1: $h = H-\tfrac12gt^2$ starts at $H$ (not the origin) and curves downward, so it does not
match a graph starting at the origin. Row 2: $KE = mg(H-h)$, a straight line in h that passes
through the origin when $h=H$... considered against the given graph shape, this is consistent.
Row 3: $GPE = mg(H-s)$, similarly a straight line consistent with the graph. [DIAGRAM: exact
graph shape needed to fully verify; trusting official key for rows 2 and 3.]
```

Ban violations: #2 (`[DIAGRAM`), #3 (`trusting the official key`), #4 (`...`), #9 (no sections),
plus an internal contradiction — it calls rows 2 and 3 *straight lines* and then declares them
consistent with a graph it has just described as *curving upward*, and claims $KE = mg(H-h)$
"passes through the origin when $h=H$", which is not what an origin is.

### 5.4 Technique — AFTER

```markdown
**The answer**

The correct choice is rows 2 and 3 only. In free fall the energy exchanged is *linear* in a
distance, while a distance is *quadratic* in time — so the shape of a graph tells you which
variable is on the horizontal axis.

**The route**

1. Fix the kinematics from rest: $s = \tfrac12 g t^2$ and $h = H - s$.
2. Row 1 plots $h$ against $t$. At $t=0$ the object is still at $H$, so the curve begins at
   $H$, not at the origin, and falls away — it is inverted relative to a curve rising from the
   origin.
3. Row 2 plots kinetic energy against $h$. All the energy lost from the drop appears as kinetic
   energy, so $E_k = mg(H-h)$ — a straight line, decreasing in $h$.
4. Row 3 plots gravitational potential energy against $s$. Measured from the ground,
   $E_p = mg(H-s)$ — again a straight line, decreasing in $s$.
5. Rows 2 and 3 share the same energy relation read against two equivalent distance variables,
   so they stand or fall together.

**Where it goes wrong**

Selecting the row pairing height with time treats a quadratic fall as if it were linear, which
is the single most common slip in free-fall graph questions. Selecting only one of the two
energy rows misses that $h$ and $s$ are the same information measured from opposite ends —
whatever is true of one is true of the other.

**Faster in the exam**

Rows 2 and 3 are the same physics twice, so they cannot disagree: any choice containing exactly
one of them is impossible. That eliminates half the option set before any algebra.

**The trap**

"Released from rest" is what makes the time dependence quadratic — with an initial speed, row 1
would need re-examining.
```

**Why "Faster in the exam" leads on structure, not physics:** the observation that rows 2 and 3
are logically inseparable kills four of the eight options in about five seconds and requires no
equation. Under §2.5 that beats the derivation, so it is called out explicitly — and the
derivation still sits above it for anyone who wants it.

### 5.5 Quarantine — this record actually fails the consistency gate

The extraction's diagram description ("starting at the origin and curving upward") is not
consistent with the physics of any of the three rows: $E_k = mg(H-h)$ is a straight line that
does **not** pass through the origin, and neither does $E_p = mg(H-s)$. Either the description
is corrupt or the row contents are.

**The spec's response is architectural, and it is the general rule:**

> **Hedging is a data property, not prose.** When a record's stem, options and stored answer
> cannot be made mutually consistent, the content pass must not write confident prose *or*
> hedged prose. It writes the best defensible explanation, sets
> `quality_tier: "needs_source_check"`, and puts the doubt in a **non-rendered** `review_note`
> field. The student never sees a wobble; the editor always sees the flag.

Add to the data model:

```json
"quality_tier": "needs_source_check",
"review_note": "Extraction's diagram description (origin, curving upward) is inconsistent with all three rows; both energy relations are linear and non-zero at the axis. Verify row contents and graph shape against the 2023 ENGAA S1 PDF before promoting to verified."
```

`needs_source_check` records are **excluded from Mock Exam mode** and shown in Question Bank with
a neutral "under review" marker. §5.4 above therefore stands as the **format** template — it is
the reference for structure, tone and length — while this record's physics stays gated until the
source PDF is checked.

---

## 6. MECHANICAL VALIDATION

`scripts/check_content.py`, wired into the build alongside the existing `scripts/check_latex.py`.

### 6.1 Tier A — fully mechanical, build-failing

| Check | Method |
|---|---|
| Bans 1–9, 13–19, 21–23 | regex over each field |
| Balanced `$` / `$$`, KaTeX parses | reuse `scripts/check_katex_render.mjs` over every field |
| Required section headings present, in order | ordered substring scan |
| Stem contains no forbidden markdown construct | line-level parse |
| GFM table well-formed (equal cell counts per row) | table parse |
| `answer` key exists in `options`; ≥2 non-empty options | schema |
| **No word-level diff vs. archived pre-pass stem** beyond the permitted classes | token diff against `question-bank/.pre-pass/` snapshot |
| Option-set column count computable (no unbounded option) | run the §3 estimator |
| `needs_source_check` records excluded from mock pool | pool assembly assertion |

Snapshot the current `question` strings to `question-bank/.pre-pass/` **before** the content pass
runs. Without that baseline, ban #19 — the one gate that actually enforces "never reword official
text" — is unenforceable.

### 6.2 Tier B — heuristic, warn + review queue

Word counts and sentence counts per section; display-math count per module against §2.4; biology
display blocks; missing units in a physics answer sentence (number with no adjacent unit token);
stem/technique n-gram overlap; §1.6 V-rule misses (ban #20); enumerations that matched E1/E2 but
produced a single-row table.

### 6.3 Tier C — model or human judgement only

Whether the physics is *correct*. Whether "The answer" is genuinely self-sufficient for a student
who got it right. Whether a distractor description matches a real error mode rather than a
plausible-sounding one. Whether the fast route actually works. Whether a wrapped variable was the
right variable. Whether a table restoration reflects the original paper's table. Whether a
`needs_source_check` flag is resolved.

Tier C is sampled, not exhaustive: 100% of `difficulty >= 4`, 100% of chemistry and biology
(where §1.6 refuses to automate), 10% random elsewhere.

### 6.4 Rollout

1. Snapshot `question-bank/.pre-pass/`.
2. Land the renderer fixes (§1.2) — they are independent of content and unblock everything.
3. Ship `check_content.py` in **warn-only** mode; get a baseline violation count.
4. Content pass, one module at a time, physics first (largest, most structured).
5. Flip Tier A to build-failing per module as each module reaches zero.
