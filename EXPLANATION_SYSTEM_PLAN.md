# Explanation System — ESATprep Plan

**Status: SHIPPED — Phases 0–4 complete (2026-07-22).**  
Do not edit `C:\Users\Ahmed\Documents\De-TMUA-guide` from that session.  
Kickoff prompt: `E:\brain\ESAT\HANDOFF — Explanation System from TMUA.md`.

Planner context: TMUA (tmuaprep) already shipped this system end-to-end (2026-07-22).
This document adapts that playbook for ESATprep’s modules, PNG diagram pipeline,
and ~1038-question bank.

Each phase has acceptance criteria; a phase is not done until they pass.

---

## 1. Problem

Current state (verified against ESATprep, 2026-07-22):

- Every question has a single `technique` string — often a short prose blob.
- `TechniqueRenderer.formatTechnique()` tries to impose structure at render
  time with regexes (split on `. [A-Z]`, break `=` chains). Structure is
  guessed, not authored → the same “wacky blob” UX TMUA had before v2.
- Practice reveal labels the block **“Technique”**
  (`src/pages/QuestionBank.jsx`).
- Paper figures use `[DIAGRAM: …]` placeholders resolved to
  `public/diagrams/<id>.png` via `src/lib/diagrams.js` (~258 stems). **Keep.**
- Zero questions have `solution.steps`. Zero declarative Mafs diagrams.
  `mafs` is not in `package.json`.
- `docs/CONTENT_SPEC.md` still targets structured markdown *inside* the
  `technique` field (“The answer” / “The route” / …). That approach never
  landed in the bank; TMUA’s `solution.steps` schema is the proven replacement.

Target: every question gets an authored **step-by-step `solution`**; paper
figures stay PNG; maths questions whose subtopic fits a typed case get a
**declarative Mafs diagram**. Authoring stays constrained so agents cannot
guess geometry silently.

---

## 2. Core design decisions (do not re-litigate)

Same as TMUA — copy these verbatim into content work:

1. **Agents author givens; code computes geometry.**
2. **Typed diagram cases, not freeform primitives.**
3. **Deterministic case matching** (subtopic → case table).
4. **Steps are authored structure**, not regex-derived from `technique`.
5. **Backwards compatible during migration** — prefer `solution`, fall back
   to `technique` until Phase 4.
6. **Paper PNG figures never get a parallel Mafs `diagram`**
   (`[DIAGRAM:]` / existing crop wins).
7. **Diagrams static by default**; interactivity only where motion teaches.
8. **`solution` never names an option letter** — options shuffle and
   re-letter at render (TMUA + ESAT both hit this bug class).

ESAT additions:

9. **Preserve `module`, `origin`, `quality_tier`, `spec_status`.**
10. **Do not delete the `[DIAGRAM:]` PNG pipeline** when adding Mafs.

Gold schema reference:  
`C:\Users\Ahmed\Documents\De-TMUA-guide\docs\CONTENT_SPEC.md`  
Update ESATprep `docs/CONTENT_SPEC.md` §2 during Phase 0 to match `solution`
(+ keep ESAT’s stem-restoration / `[DIAGRAM:]` sections).

---

## 3. `solution` schema (TMUA-compatible)

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

Hard bans (CI-enforce): option letters, unicode math in solution, first/second
person, hedging, platform meta, ellipsis-as-reasoning. Full list in TMUA
CONTENT_SPEC §1.

Optional:

```jsonc
{
  "diagram": {
    "case": "curve-tangent",
    "after_step": 2,
    // case-specific givens only
  }
}
```

---

## 4. Phases

### Phase 0 — Engine + UI with fallback

Port from TMUA (adapt imports / CSS tokens):

- `SolutionSteps.jsx`
- `MathDiagram.jsx` + `cases/*` (can land even if unused until Phase 3)
- `expr.js`, `diagram-geometry.js`, `content-validator.js` (+ tests)
- `mafs` dependency + CSS
- Wire `QuestionBank.jsx` (practice + review): if `q.solution` → SolutionSteps,
  else TechniqueRenderer
- Change student-facing label from “Technique” to “Worked solution” when
  showing steps (keep “Technique” only for fallback blob if desired)
- Update `docs/CONTENT_SPEC.md` §2 to document `solution`
- Add validate script (port `validate-content.mjs` or extend `check_content.py`)

**Acceptance**

- [x] A question with `solution.steps` renders numbered steps in practice reveal (`QuestionExplanation` → `SolutionSteps`)
- [x] A question with only `technique` still renders (no regression — fallback path)
- [x] `[DIAGRAM:]` PNGs still appear in stems (unchanged `parseDiagrams`)
- [x] Validator runs and passes on current bank (technique-only OK in Phase 0; `requireSolution` opt-in)
- [x] Vitest / build green (confirm in this session)

### Phase 1 — Pilot one maths slice

Pick one `question-bank` maths file (prefer Maths 1 algebra/calculus-heavy).
Author `solution.steps` for every question in that file (transcribe from
`technique`; verify answer; no option letters). Leave `technique` in place.

**Acceptance**

- [x] 100% of that file has `solution.steps` *(pilot scope: all 15 `ENGAA-2016-M1-*` IDs in `ENGAA_2016_S1.json`)*
- [x] Validator clean for the pilot
- [x] Manual browser check of 5 questions — see [docs/EXPLANATION_QA.md](docs/EXPLANATION_QA.md) — **re-checked 2026-07-23 post bank-wide scrub: NSAA-2016-BIO-006, NSAA-2023-M1-017, ENGAA-2021-M2-001 confirmed clean in-browser (sane titles, °/pmatrix/√ render properly, no raw LaTeX/dangling `$`); ENGAA-2017-PHY-023 accepted on prior clean in-browser evidence + clean source — sign-off clean**

### Phase 2 — Fan-out

Migrate remaining files module-by-module: maths1 → maths2 → physics → chem → bio.
Physics/chem/bio: steps-only is fine; many won’t get Mafs.

**Acceptance**

- [x] Every question has `solution.steps`
- ~~[x] `technique` still present as backup~~ — **obsolete:** Phase 4 stripped `technique` from the bank
- [x] Full-bank validate clean

### Phase 3 — Mafs for eligible maths

Use TMUA case table (circle-line, curve, curve-tangent, area-under-curve,
trig-solutions, triangle, transformation, number-line). Skip when schema
doesn’t fit — set `diagram_skipped` with reason. Never add Mafs when a PNG
`[DIAGRAM:]` already supplies the figure.

Port TMUA lessons: `clampYRange`, asymptote sample skip, `after_step`.

**Acceptance**

- [x] Eligible maths questions have diagram or documented skip
- [x] Paper PNG questions unchanged
- [x] Validator enforces diagram schema + numeric cross-checks where applicable

### Phase 4 — Require solution / delete blob path

- Validator requires `solution.steps`
- Delete `formatTechnique` / stop calling TechniqueRenderer for explanations
- Strip `technique` in one pass (optional keep internally for notes — prefer strip
  if unused)
- UI copy: “Worked solution” only

**Acceptance**

- [x] No student-facing technique blob path
- [x] Bank + CI require `solution`
- [x] Build + tests green

---

## 5. Case-matching (maths)

Follow TMUA `EXPLANATION_SYSTEM_PLAN.md` §5. First subtopic hit wins; no hit →
steps only. If unsure → no diagram + `diagram_skipped`.

---

## 6. What not to do

- Do not start from rewriting `technique` into fancy markdown sections inside
  the same field — that was ESAT’s old CONTENT_SPEC plan and it stalled.
- Do not LLM-rewrite entire stems for LaTeX (deterministic tool + review only).
- Do not force Mafs onto biology/chemistry paper figures.
- Do not edit the TMUA repo from this session.
- Do not strip `technique` until Phase 4.

---

## 7. Related reading

- Vault kickoff: `E:\brain\ESAT\HANDOFF — Explanation System from TMUA.md`
- TMUA gold: `C:\Users\Ahmed\Documents\De-TMUA-guide\docs\CONTENT_SPEC.md`
- TMUA history: `C:\Users\Ahmed\Documents\De-TMUA-guide\EXPLANATION_SYSTEM_PLAN.md`
- ESAT presentation rules (stems/PNGs): `docs/CONTENT_SPEC.md` (this repo) —
  keep §0 stem-restoration; replace explanation sections with `solution` schema
