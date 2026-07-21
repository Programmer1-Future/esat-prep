#!/usr/bin/env python3
"""Recover the missing id->qnum mappings by matching stored text against the papers.

About 30 questions have no entry in question-bank/id-qnum-mapping/<PAPER>.json, so
fabrication_diff.py skips them entirely (load_stored() drops anything with no qnum).
They are the one slice of the bank nobody has audited, which is exactly where an
invented question would survive longest.

The transcriptions from gemini_transcribe.py cover every printed question, so any
qnum a paper's mapping does not already claim is a free slot. Matching an unmapped
question against only the free slots of its own paper turns a 30-way guess into a
handful of 2-6 way choices.

Scoring reuses fabrication_diff.judge() unchanged - option-value overlap primary,
stem-token overlap secondary - so a proposal here means the same thing a MATCH
verdict means there.

Proposals are written to scripts/.fabrication_audit/proposed_mapping.json. This
script NEVER touches question-bank/; another session owns those files.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from fabrication_diff import CACHE, MAP_DIR, QB, judge

PROPOSALS = Path(__file__).resolve().parent / ".fabrication_audit" / "proposed_mapping.json"

# Thresholds picked from the observed score distribution, which is sharply bimodal.
# Ranking all 30 unmapped questions against their paper's free slots, the best score
# per question was one of: 1.0 (x18), 0.93, 0.89, 0.86, 0.75, 0.67 -- then a gap --
# then 0.5, 0.5, 0.4, 0.11 for the last four. Nothing landed between 0.5 and 0.67.
# Every question in the upper group beat its runner-up by at least 0.46 (worst case
# 0.67 vs 0.20); every question in the lower group had a runner-up within 0.36, and
# two were outright ties (0.5/0.5 and 0.11/0.11). MIN_SCORE sits in the empty band
# and MIN_MARGIN well below the 0.46 worst passing margin, so both bars are set
# inside real gaps rather than at the edge of a cluster - a slightly different
# transcription would have to move a score a long way to flip a verdict.
MIN_SCORE = 0.60
MIN_MARGIN = 0.30


def paper_names() -> list[str]:
    return [p.stem for p in sorted(QB.glob("*_S1.json"))]


def load_unmapped(paper: str) -> tuple[list[dict], dict]:
    """Stored questions with no qnum, plus the paper's existing mapping."""
    mf = MAP_DIR / f"{paper}.json"
    qmap = json.load(open(mf, encoding="utf-8")) if mf.exists() else {}
    questions = json.load(open(QB / f"{paper}.json", encoding="utf-8"))
    return [q for q in questions if qmap.get(q.get("id")) is None], qmap


def load_transcription(paper: str) -> dict:
    out = {}
    for f in sorted((CACHE / paper).glob("*.json")):
        for r in json.load(open(f, encoding="utf-8")):
            out[r["qnum"]] = r
    return out


def rank(question: dict, free: dict) -> list[tuple[float, float, float, int]]:
    """Score one stored question against every free slot, best first."""
    scored = []
    for qnum, got in free.items():
        if not got.get("readable"):
            continue
        _, frac, stem = judge(question, got)
        scored.append((max(frac, stem), frac, stem, qnum))
    scored.sort(reverse=True)
    return scored


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help=f"write confident proposals to {PROPOSALS.name}")
    args = ap.parse_args()

    proposals: dict[str, dict[str, int]] = {}
    ambiguous: list[tuple] = []
    total = 0

    for paper in paper_names():
        unmapped, qmap = load_unmapped(paper)
        if not unmapped:
            continue
        transcribed = load_transcription(paper)
        claimed = set(qmap.values())
        free = {qn: r for qn, r in transcribed.items() if qn not in claimed}
        total += len(unmapped)

        print(f"\n{paper}  {len(unmapped)} unmapped, free slots {sorted(free)}")
        for q in unmapped:
            scored = rank(q, free)
            best = scored[0] if scored else (0.0, 0.0, 0.0, None)
            second = scored[1] if len(scored) > 1 else (0.0, 0.0, 0.0, None)
            score, frac, stem, qnum = best
            margin = score - second[0]
            ok = qnum is not None and score >= MIN_SCORE and margin >= MIN_MARGIN
            runner = f"q{second[3]}={second[0]:.2f}" if second[3] is not None else "none"
            print(f"  {'OK ' if ok else '?? '} {q['id']:22} -> "
                  f"q{qnum} score={score:.2f} (opts={frac:.2f} stem={stem:.2f}) "
                  f"margin={margin:.2f}  runner-up {runner}")
            if ok:
                proposals.setdefault(paper, {})[q["id"]] = qnum
            else:
                ambiguous.append((paper, q["id"],
                                  [(f"q{c[3]}", round(c[0], 2)) for c in scored[:3]]))

    # Two unmapped questions proposing the same slot means at least one is wrong;
    # neither can be trusted, so both are demoted rather than arbitrated.
    for paper, mapping in list(proposals.items()):
        seen: dict[int, list[str]] = {}
        for qid, qnum in mapping.items():
            seen.setdefault(qnum, []).append(qid)
        for qnum, ids in seen.items():
            if len(ids) > 1:
                print(f"\nCONFLICT {paper}: {ids} all claim q{qnum}; dropping all")
                for qid in ids:
                    del mapping[qid]
                    ambiguous.append((paper, qid, [(f"q{qnum}", "conflict")]))

    mapped = sum(len(m) for m in proposals.values())
    print(f"\n{'-' * 68}\n{mapped}/{total} confidently mapped, "
          f"{total - mapped} ambiguous (score>={MIN_SCORE}, margin>={MIN_MARGIN})")
    for paper, qid, scored in ambiguous:
        print(f"  ambiguous {paper:16} {qid:22} {scored}")

    if args.write:
        PROPOSALS.parent.mkdir(parents=True, exist_ok=True)
        PROPOSALS.write_text(json.dumps(proposals, indent=2), encoding="utf-8")
        print(f"\nwrote {PROPOSALS}")
    else:
        print("\ndry run; pass --write to save proposals")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
