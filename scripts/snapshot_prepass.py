#!/usr/bin/env python3
"""Archive current question stems as the pre-pass baseline.

The content pass (docs/CONTENT_SPEC.md) restores structure to stems — tables,
paragraph breaks, wrapped variables — but must never reword official question
text. That rule is only enforceable against a frozen "before" copy, so this
snapshot has to exist BEFORE the pass runs (spec §6.4 step 1).

Writes question-bank/.pre-pass/<paper>.json as {id: question}. Refuses to
overwrite an existing snapshot: re-running after the pass would silently adopt
the rewritten text as the baseline and neuter the gate.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QB = ROOT / "question-bank"
OUT = QB / ".pre-pass"


def main() -> int:
    force = "--force" in sys.argv
    if OUT.exists() and any(OUT.glob("*.json")) and not force:
        print(f"Snapshot already exists at {OUT} — refusing to overwrite.")
        print("That is deliberate: re-snapshotting after the content pass would")
        print("adopt rewritten stems as the baseline. Use --force only if you are")
        print("certain the pass has not run yet.")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    papers = total = 0
    for src in sorted(QB.glob("*.json")):
        questions = json.load(open(src, encoding="utf-8"))
        stems = {q["id"]: q.get("question", "") for q in questions if "id" in q}
        json.dump(stems, open(OUT / src.name, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        papers += 1
        total += len(stems)
        print(f"  {src.name}: {len(stems)} stems")

    print(f"\nSnapshotted {total} stems from {papers} papers -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
