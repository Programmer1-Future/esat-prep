#!/usr/bin/env python3
"""Draw a random sample for the fabrication audit and emit per-paper prompts.

Some questions in the bank were invented rather than transcribed from the papers
(proven: ENGAA-2023-M2-008). Every one found so far surfaced through a TELL — a
hedge phrase, a stray bracket, a twin that disagreed — never through a systematic
check, so the rate in the untouched majority is unknown.

Fixing that needs an UNBIASED sample: random, not symptom-selected, drawn from the
questions nobody has re-derived. The output asks for verbatim transcription rather
than a verdict, because a model asked "is this real?" will drift toward agreeing —
and a confident fabrication is exactly the case that fools it. A transcription can
be diffed; a verdict can only be trusted.

Writes:
  scripts/.fabrication_audit/sample.json   — the drawn sample + stored text
  scripts/.fabrication_audit/prompt_<paper>.txt — one paste-ready prompt per paper
"""
from __future__ import annotations
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QB = ROOT / "question-bank"
MAP_DIR = QB / "id-qnum-mapping"
OUT = ROOT / "scripts" / ".fabrication_audit"

SAMPLE_SIZE = 100
SEED = 20260720   # fixed so the draw is reproducible and auditable

# Questions already re-derived against the PDFs. Sampling these would measure work
# already done and bias the estimate downward.
ALREADY_CHECKED = set("""
ENGAA-2019-M1-006 ENGAA-2021-M1-002 ENGAA-2021-M2-001 NSAA-2016-M1-011
NSAA-2016-M1-013 NSAA-2016-M1-018 NSAA-2016-M2-005 NSAA-2016-M2-006
NSAA-2016-M2-008 NSAA-2016-PHY-016 NSAA-2017-M1-003 NSAA-2017-M1-007
NSAA-2017-M1-016 NSAA-2017-M2-001 NSAA-2017-PHY-007 NSAA-2020-PHY-002
NSAA-2020-CHEM-014 NSAA-2020-BIO-015 NSAA-2021-M1-003 NSAA-2021-M1-013
NSAA-2021-M1-014 NSAA-2021-M1-019 NSAA-2021-CHEM-006 NSAA-2021-BIO-010
NSAA-2021-BIO-016 ENGAA-2019-M1-002 ENGAA-2019-M2-007 ENGAA-2021-M2-002
ENGAA-2021-M2-010 ENGAA-2022-M1-001 ENGAA-2022-M1-004 ENGAA-2022-M1-008
ENGAA-2022-M1-010 ENGAA-2022-M2-001 ENGAA-2022-M2-004 ENGAA-2022-M2-006
ENGAA-2022-M2-010 ENGAA-2022-PHY-008 NSAA-2020-M1-007 NSAA-2020-M1-009
NSAA-2021-CHEM-011 NSAA-2022-M1-001 NSAA-2022-M1-007 NSAA-2022-M1-015
NSAA-2022-PHY-016 NSAA-2022-CHEM-014 NSAA-2017-M2-002 NSAA-2017-M2-003
NSAA-2017-M2-006 NSAA-2017-M2-007 ENGAA-2020-M2-001 ENGAA-2020-M2-012
ENGAA-2020-M2-014 ENGAA-2020-M2-015 ENGAA-2023-M2-001 ENGAA-2023-M2-004
ENGAA-2023-M2-009 ENGAA-2023-M2-008 NSAA-2019-M1-002 NSAA-2019-M1-009
NSAA-2019-M1-023 NSAA-2019-M1-024 NSAA-2019-M1-025 NSAA-2019-PHY-022
ENGAA-2016-M1-001 ENGAA-2016-M1-014 ENGAA-2016-M2-001 ENGAA-2016-M2-006
ENGAA-2017-M2-004 ENGAA-2017-M2-006 ENGAA-2017-M2-014 ENGAA-2017-M2-017
ENGAA-2020-PHY-009 ENGAA-2023-M2-002 NSAA-2017-BIO-009 NSAA-2019-M1-003
NSAA-2021-PHY-006 NSAA-2022-M1-019 NSAA-2022-BIO-010 NSAA-2023-M1-006
NSAA-2023-M1-007 NSAA-2023-M1-015 NSAA-2023-BIO-016 NSAA-2023-BIO-020
ENGAA-2019-M2-006 ENGAA-2017-PHY-015 ENGAA-2023-PHY-017 NSAA-2022-BIO-005
""".split())

PROMPT = """I have attached the official {series} {year} Section 1 past paper (PDF).

Transcribe the following questions EXACTLY as they appear in the paper: {nums}

Rules — these matter more than being helpful:
- Transcribe VERBATIM. Do not summarise, correct, paraphrase, modernise or tidy
  anything, even if the paper contains a typo.
- Include every answer option, in the paper's original order, with its letter.
- If a question has a diagram, do NOT try to describe it in the question text.
  Put a short description in the "diagram" field instead.
- If you cannot clearly read a question, or that question number does not exist in
  this paper, set "readable": false and leave the text empty. DO NOT guess or
  reconstruct it. An honest "I can't read it" is far more useful to me than a
  plausible reconstruction — I am specifically checking for invented content, so a
  confident guess actively defeats the purpose.

Reply with ONLY a JSON array, no commentary before or after:

[
  {{
    "qnum": 12,
    "readable": true,
    "question": "full verbatim question text",
    "options": {{"A": "...", "B": "...", "C": "..."}},
    "diagram": "short description, or null if none"
  }}
]
"""


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)

    pool = []
    for src in sorted(QB.glob("*.json")):
        paper = src.stem                      # e.g. ENGAA_2019_S1
        mf = MAP_DIR / f"{paper}.json"
        qmap = json.load(open(mf, encoding="utf-8")) if mf.exists() else {}
        for q in json.load(open(src, encoding="utf-8")):
            qid = q.get("id")
            qnum = qmap.get(qid)
            # need a printed number so the paper page can be pointed at
            if not qid or qnum is None or qid in ALREADY_CHECKED or q.get("needs_repair"):
                continue
            pool.append({"id": qid, "paper": paper, "qnum": qnum,
                         "question": q.get("question", ""),
                         "options": q.get("options", {}),
                         "answer": q.get("answer")})

    print(f"eligible unchecked+mapped questions: {len(pool)}")
    sample = rng.sample(pool, min(SAMPLE_SIZE, len(pool)))
    sample.sort(key=lambda r: (r["paper"], r["qnum"]))

    json.dump(sample, open(OUT / "sample.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    by_paper: dict[str, list] = {}
    for r in sample:
        by_paper.setdefault(r["paper"], []).append(r)

    for paper, rows in sorted(by_paper.items()):
        series, year, _ = paper.split("_")
        nums = ", ".join(str(r["qnum"]) for r in sorted(rows, key=lambda x: x["qnum"]))
        text = PROMPT.format(series=series, year=year, nums=nums)
        (OUT / f"prompt_{paper}.txt").write_text(text, encoding="utf-8")
        print(f"  {paper}: {len(rows)} questions -> prompt_{paper}.txt")

    print(f"\nsample of {len(sample)} across {len(by_paper)} papers -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
