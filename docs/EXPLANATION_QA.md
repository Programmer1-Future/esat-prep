# Explanation System — browser QA checklist

Manual verification for ESATprep Explanation System (Phases 0–4 + polish wave).
Run locally: `npm run dev` → open the app while signed in (or bypass auth if env allows).

Do **not** mark items done unless you actually clicked through them.

---

## 1. Question Bank — worked solutions

Start a short practice session (any module). Reveal answers and confirm the heading is **Worked solution** (never “Technique”).

| # | Target | How to land it | Expect |
|---|---|---|---|
| 1 | `ENGAA-2016-M1-001` | Maths 1 practice; inequality question | Numbered `solution.steps` (3 steps); no option letters in text |
| 2 | Mafs diagram | Maths practice until a question with declarative diagram (e.g. bank IDs with `diagram` field such as `ENGAA-2016-M2-009`) | Figure injects mid-steps via `after_step` |
| 3 | Paper PNG | Physics/chem with stem figure — e.g. `ENGAA-2016-PHY-002` (`[DIAGRAM:]` → `public/diagrams/…`) | PNG under stem; **no** parallel Mafs |
| 4 | Physics steps | Any physics miss | Steps render; KaTeX OK |
| 5 | Biology steps | Any biology miss | Prose-heavy steps; KaTeX sparse |

Also open the session **mistakes** tab and confirm `QuestionExplanation` appears there too.

---

## 2. Mock exam — post-sitting only

1. Start a mock with **one** module (fast path).
2. During the timed sitting / pre-submit review navigator: confirm **no** worked solution / answer reveal.
3. Submit the module (and finish the sitting if multi-module).
4. On **Sitting complete** → **Review questions** → expand items.
5. Expect per question: stem, your answer vs correct **value**, then **Worked solution** when `solution.steps` exist.

---

## 3. Copy / regressions

- [ ] No student-facing label **Technique**
- [ ] No “Answer C” / option-letter language in solutions
- [ ] Auth still loads (`docs/AUTH_SMOKE.md` if testing login)

---

## Status

**BLOCKED for agent auto-check:** needs Ahmed (or a human) to run the app locally and tick the boxes above.

Once verified, check the Phase 1 browser checkbox in `EXPLANATION_SYSTEM_PLAN.md` and note the date here.
