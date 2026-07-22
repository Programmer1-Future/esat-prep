# Explanation System — browser QA checklist

Manual verification for ESATprep Explanation System (Phases 0–4 + polish + pre-ship wave).
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

### Practice soft-save

1. Start a practice session, answer at least one question, advance.
2. Refresh the page (or navigate away and back to Practice).
3. Expect **Resume unfinished practice** on setup → Resume continues at the same question index.
4. Discard clears the draft; finishing a session also clears it.

---

## 2. Mock exam — post-sitting + history

1. Start a mock with **one** module (fast path).
2. During the timed sitting / pre-submit review navigator: confirm **no** worked solution / answer reveal.
3. Submit the module (and finish the sitting if multi-module).
4. On **Sitting complete** → **Review questions** → expand items.
5. Expect per question: stem, your answer vs correct **value**, then **Worked solution** when `solution.steps` exist.
6. Go to **Mock History** → **Review questions** on that sitting → same explanations still available.

### Abandon / tab rules

1. Setup disclaimer: leaving mid-sitting abandons (no resume).
2. During a timed module, switch tabs briefly → toast “Tab switch detected” (does **not** eject).
3. Mid-sitting, click Practice (or browser back) → confirm abandon → progress not resumed; if you had finished an earlier module in a multi-module sitting, history shows an **Abandoned** sitting with review for completed modules only.

---

## 3. Insights → Practice

1. Open Insights → on a TopicCard click **Drill** (or Attention **Practice**).
2. Land on Practice setup with topics/modules prefilled from `location.state`.

---

## 4. Event Ledger

1. Open Ledger after a quiz/mock.
2. `quiz_completed` / `mock_logged` / `achievement_unlocked` show human summaries (not raw JSON).
3. Mock cards link to sitting review when a sitting exists.

---

## 5. Copy / regressions

- [ ] No student-facing label **Technique**
- [ ] No “Answer C” / option-letter language in solutions
- [ ] Auth still loads (`docs/AUTH_SMOKE.md` if testing login)

---

## Status

**BLOCKED for agent auto-check:** needs Ahmed (or a human) to run the app locally and tick the boxes above.

**Deploy:** do not push/merge until Ahmed explicitly asks. After QA, push the feature branch / merge to the Netlify production branch when ready.

Once verified, check the Phase 1 browser checkbox in `EXPLANATION_SYSTEM_PLAN.md` and note the date here.
