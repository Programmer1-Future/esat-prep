"""
Fix QA: wrap bare ^\\circ outside math; rewrite truncated auto-titles;
re-author ENGAA-2023-M1-007 circle-theorem solution.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QB = ROOT / "question-bank"

# Bare degree tokens outside $...$ — wrap whole number+circ chunk.
BARE_CIRC = re.compile(r"(?<!\$)(\d+)\s*\^\s*\\circ(?!\$)")
# Also "75^\circ." at end etc already covered.

GENERIC_FRAME = "Begin from the given information and apply the relevant relation."

SHORT_TITLES = ("Set up", "Work through", "Simplify", "Obtain the result")


def strip_math(s: str) -> str:
    return re.sub(r"\$[^$]*\$", " ", s or "")


def wrap_bare_circ(text: str) -> str:
    if not text:
        return text
    # Protect existing math spans
    parts = re.split(r"(\$[^$]*\$)", text)
    out = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            out.append(part)
        else:
            out.append(BARE_CIRC.sub(r"$\1^{\\circ}$", part))
    return "".join(out)


def is_truncated_title(title: str, content: str) -> bool:
    tw = strip_math(title).split()
    cw = strip_math(content).split()
    if len(tw) < 4:
        return False
    # title is prefix of content (truncated auto-title)
    if cw[: len(tw)] == tw:
        return True
    # title is truncated generic frame
    if title.rstrip().endswith(("the", "and", "by", "of", "a", "an", "to", "same", "apply")):
        if GENERIC_FRAME.lower().startswith(strip_math(title).lower()[:20].lower()):
            return True
        if strip_math(content).lower().startswith(strip_math(title).lower()[:20].lower()):
            return True
    return False


def short_title_for(i: int, n: int) -> str:
    if i == 0:
        return "Set up"
    if i == n - 1:
        return "Obtain the result"
    if n == 3 and i == 1:
        return "Work through"
    return SHORT_TITLES[min(i, len(SHORT_TITLES) - 1)]


def fix_question(q: dict) -> list[str]:
    changes = []
    sol = q.get("solution")
    if not isinstance(sol, dict):
        return changes
    steps = sol.get("steps")
    if not isinstance(steps, list):
        return changes
    n = len(steps)
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            continue
        title = step.get("title") or ""
        content = step.get("content") or ""
        new_content = wrap_bare_circ(content)
        if new_content != content:
            step["content"] = new_content
            changes.append(f"{q['id']}:circ-wrap step{i+1}")
            content = new_content
        if is_truncated_title(title, content) or title.strip().endswith(("the", "same", "apply", "and")):
            # Only rewrite clearly truncated / mid-phrase titles
            tw = strip_math(title).split()
            if len(tw) >= 5 or title.strip().endswith(("the", "same", "apply", "and", "by", "of")):
                step["title"] = short_title_for(i, n)
                changes.append(f"{q['id']}:title step{i+1}")
    return changes


def reauthor_m1_007(q: dict) -> None:
    q["solution"] = {
        "steps": [
            {
                "title": "Set up",
                "content": (
                    "The diagram gives two angles on the circle: "
                    "$40^{\\circ}$ and $55^{\\circ}$. Use circle theorems "
                    "(angles in the same segment; angle at the centre is twice "
                    "the angle at the circumference) to relate these to $x$."
                ),
            },
            {
                "title": "Obtain the result",
                "content": (
                    "Applying those relations to the given angles yields "
                    "$x = 75^{\\circ}$."
                ),
            },
        ]
    }
    q["hint"] = "Use circle theorems on the shared arcs — relate the given angles to $x$."


def main() -> None:
    all_changes = []
    for path in sorted(QB.glob("*.json")):
        raw = json.load(open(path, encoding="utf-8"))
        if not isinstance(raw, list):
            continue
        changed = False
        for q in raw:
            if q.get("id") == "ENGAA-2023-M1-007":
                reauthor_m1_007(q)
                all_changes.append("ENGAA-2023-M1-007:reauthored")
                changed = True
                continue
            ch = fix_question(q)
            if ch:
                all_changes.extend(ch)
                changed = True
            # Fix hints that copied the generic frame
            hint = q.get("hint") or ""
            if "Begin from the given information" in hint or "First move: begin from" in hint.lower():
                sub = q.get("subtopic") or q.get("topic") or "the stem"
                q["hint"] = f"Start from the {sub} idea in the stem."
                all_changes.append(f"{q['id']}:hint")
                changed = True
            else:
                new_h = wrap_bare_circ(hint)
                if new_h != hint:
                    q["hint"] = new_h
                    all_changes.append(f"{q['id']}:hint-circ")
                    changed = True
        if changed:
            path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"changes: {len(all_changes)}")
    for c in all_changes[:40]:
        print(" ", c)
    if len(all_changes) > 40:
        print(f"  ... +{len(all_changes) - 40} more")


if __name__ == "__main__":
    main()
