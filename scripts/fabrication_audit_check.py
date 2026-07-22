#!/usr/bin/env python3
"""Validate transcription files in the fabrication-audit cache.

Transcriptions may be produced by several different agents and models. That output
is UNTRUSTED: a malformed file, a silently skipped question or a "readable" entry
with no options would all corrupt the audit while looking fine in a directory
listing. Everything downstream assumes this schema holds, so check it here rather
than discovering it in the diff.

Usage:
    python scripts/fabrication_audit_check.py [--paper NSAA_2016_S1]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
MAP_DIR = ROOT / "question-bank" / "id-qnum-mapping"
CACHE = ROOT / "scripts" / ".fabrication_audit" / "gemini"


def _fingerprint(row: dict) -> tuple:
    """Compare duplicates on the values that matter, ignoring LaTeX spelling."""
    from fabrication_diff import norm
    return (bool(row.get("readable")),
            tuple(sorted(norm(o.get("text", ""))
                         for o in (row.get("options") or []))))


def top_qnum(paper: str) -> int:
    mf = MAP_DIR / f"{paper}.json"
    if not mf.exists():
        return 0
    nums = [v for v in json.load(open(mf, encoding="utf-8")).values()
            if isinstance(v, int)]
    return max(nums) if nums else 0


def check_paper(paper: str) -> tuple:
    """Returns (problems, seen_qnums). A problem is a human-readable string."""
    problems, seen, first_seen = [], {}, {}
    d = CACHE / paper

    if not d.exists():
        return [f"no directory {d.relative_to(ROOT)}"], seen

    for f in sorted(d.glob("*.json")):
        rel = f.relative_to(ROOT)
        try:
            rows = json.load(open(f, encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems.append(f"{rel}: invalid JSON ({e})")
            continue
        if not isinstance(rows, list):
            problems.append(f"{rel}: top level must be an array, got "
                            f"{type(rows).__name__}")
            continue

        for i, r in enumerate(rows):
            where = f"{rel}[{i}]"
            if not isinstance(r, dict):
                problems.append(f"{where}: entry must be an object")
                continue
            qnum = r.get("qnum")
            if not isinstance(qnum, int):
                problems.append(f"{where}: qnum must be an integer, got {qnum!r}")
                continue
            # Overlapping chunk ranges transcribe some questions twice. That is
            # harmless redundancy — and a free cross-check — so only flag a
            # duplicate whose CONTENT disagrees with the first transcription.
            if qnum in seen:
                prev = first_seen[qnum]
                if prev.get("readable") and r.get("readable") and _fingerprint(r) != _fingerprint(prev):
                    problems.append(f"{where}: q{qnum} disagrees with the "
                                    f"transcription in {seen[qnum]}")
                elif not prev.get("readable") and r.get("readable"):
                    seen[qnum] = rel
                    first_seen[qnum] = r
                continue
            seen[qnum] = rel
            first_seen[qnum] = r

            if not isinstance(r.get("readable"), bool):
                problems.append(f"{where} q{qnum}: readable must be true/false")
                continue
            if not r["readable"]:
                continue

            # A readable question with nothing in it is the failure mode that would
            # quietly read as "no match" downstream and look like a fabrication.
            if not str(r.get("question", "")).strip():
                problems.append(f"{where} q{qnum}: readable but question is empty")
            opts = r.get("options")
            if not isinstance(opts, list) or not opts:
                problems.append(f"{where} q{qnum}: readable but options missing")
                continue
            for o in opts:
                if not isinstance(o, dict) or "letter" not in o or "text" not in o:
                    problems.append(f"{where} q{qnum}: option must be "
                                    f"{{letter, text}}, got {o!r}")
                    break

    return problems, seen


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--paper", action="append")
    args = ap.parse_args()

    papers = args.paper or sorted(p.stem for p in MAP_DIR.glob("*_S1.json"))
    total_problems = 0

    for paper in papers:
        top = top_qnum(paper)
        problems, seen = check_paper(paper)
        missing = [q for q in range(1, top + 1) if q not in seen]
        extra = [q for q in seen if q < 1 or q > top]

        if missing:
            problems.append(f"missing {len(missing)} questions: "
                            f"{missing[:15]}{'...' if len(missing) > 15 else ''}")
        if extra:
            problems.append(f"qnum outside 1..{top}: {sorted(extra)[:10]}")

        status = "OK" if not problems else f"{len(problems)} PROBLEM(S)"
        print(f"{paper:16} {len(seen):3}/{top:<3} {status}")
        for p in problems[:12]:
            print(f"    - {p}")
        if len(problems) > 12:
            print(f"    ... and {len(problems) - 12} more")
        total_problems += len(problems)

    print("\nall clean" if not total_problems
          else f"\n{total_problems} problem(s) across {len(papers)} paper(s)")
    return 1 if total_problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
