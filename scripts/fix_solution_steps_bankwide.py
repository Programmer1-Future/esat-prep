"""
Bank-wide scrub for solution.steps titles + LaTeX delimiter leaks (+ option ASCII sqrt).

Safe rules:
- Rewrite truncated / body-prefix / ≥8-word titles to short imperatives.
- Repair delimiter mangling; fix $X^{\\circ}$\\mathrm{Y}; wrap bare ^\\circ only outside math.
- Convert ASCII sqrt(...) in options to \\sqrt{...} with $ wrappers.

Run: python scripts/fix_solution_steps_bankwide.py && python scripts/merge.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QB = ROOT / "question-bank"

SHORT = ("Set up", "Work through", "Simplify", "Obtain the result")

STOP_ENDS = frozenset(
    {
        "the", "and", "by", "of", "a", "an", "to", "same", "apply", "so", "but", "with",
        "at", "for", "from", "since", "is", "are", "was", "not", "as", "or", "in", "on",
        "than", "their", "its", "be", "been", "this", "that", "which", "when", "where",
        "then", "thus", "into", "onto", "over", "under", "between", "means", "giving",
        "using", "taking", "has", "have", "had", "would", "could", "should", "will",
        "can", "may", "must", "only", "also", "each", "both", "all", "any", "per",
        "via", "s", "t", "m", "n", "x", "y", "z",
    }
)

CIRC_THEN_MATHRM = re.compile(
    r"\$([^$]*?(?:\^\{\\circ\}|\^\\circ))\$\\mathrm\{([^}]+)\}"
)
BARE_CIRC = re.compile(r"(?<![\\$0-9])(\d+)\s*\^\s*\\circ(?![0-9])")
# Mangled by an earlier aggressive pass: $$90^{\circ$}$
MANGLED_CIRC = re.compile(r"\$\$(\d+)\^\{\\circ\$\}\$")
# \sin$$25^{\circ$}$
MANGLED_TRIG = re.compile(r"\\(sin|cos|tan|sec|csc|cot)\$\$(\d+)\^\{\\circ\$\}\$")
# $$\begin{pmatrix}7$\\$6\end{pmatrix}$$
MANGLED_PMATRIX = re.compile(
    r"\$\$\\begin\{pmatrix\}([^$]*?)\$\\\\\$([^$]*?)\\end\{pmatrix\}\$\$"
)
ASCII_SQRT = re.compile(r"(?<!\\)sqrt\(([^)]+)\)")
DOLLAR = re.compile(r"(?<!\\)\$")
# Whole non-math segment that is clearly an equation fragment
EQ_FRAGMENT = re.compile(
    r"^(?:=|\\[a-zA-Z])[\s\S]*\\[a-zA-Z][\s\S]*$"
)


def strip_math(s: str) -> str:
    return re.sub(r"\$\$[\s\S]*?\$\$|\$[^$]*\$", " ", s or "")


def alnum_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", strip_math(s).lower())


def short_title_for(i: int, n: int) -> str:
    if i == 0:
        return "Set up"
    if i == n - 1:
        return "Obtain the result"
    if n == 3 and i == 1:
        return "Work through"
    return SHORT[min(i, len(SHORT) - 1)]


def is_bad_title(title: str, content: str) -> bool:
    t = (title or "").strip()
    if not t:
        return True
    words = strip_math(t).split()
    if not words:
        return True
    if len(words) >= 8:
        return True
    last = words[-1].lower().rstrip(".,;:!?")
    if len(words) >= 4 and last in STOP_ENDS:
        return True
    tw = strip_math(t).split()
    cw = strip_math(content or "").split()
    if len(tw) >= 4 and cw[: len(tw)] == tw:
        return True
    # Soft prefix (ignores punctuation): truncated body used as title
    tk, ck = alnum_key(t), alnum_key(content or "")
    if len(tk) >= 18 and ck.startswith(tk):
        return True
    if len(tk) >= 12 and ck.startswith(tk) and len(ck) > len(tk) + 2:
        return True
    if re.search(r"\bpmatrix\b|mathrm|\\\\frac|\\\\sqrt|\\\\begin", t, re.I):
        return True
    if "..." in t or t.endswith("-"):
        return True
    if re.search(r"\\[a-zA-Z]+", t) and "$" not in t:
        return True
    # Latex-stripped residue: "Since XP PY", "Since Q Y"
    short_toks = sum(1 for w in words if len(re.sub(r"[^A-Za-z0-9]", "", w)) <= 2)
    if len(words) <= 4 and short_toks >= 2 and len(words) >= 3:
        return True
    # Mid-word truncation: last title word is strict prefix of next content word
    if tw and cw and len(tw) <= len(cw) and cw[: len(tw) - 1] == tw[:-1]:
        ct = cw[len(tw) - 1] if len(cw) >= len(tw) else ""
        if ct.startswith(tw[-1]) and len(ct) > len(tw[-1]) + 1:
            return True
    return False


def map_non_math(text: str, fn) -> str:
    """Apply fn to non-math segments only ($...$ / $$...$$ preserved)."""
    if not text:
        return text
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        if text.startswith("$$", i):
            j = text.find("$$", i + 2)
            if j == -1:
                out.append(fn(text[i:]))
                break
            out.append(text[i : j + 2])
            i = j + 2
        elif text[i] == "$" and (i == 0 or text[i - 1] != "\\"):
            j = i + 1
            while j < n:
                if text[j] == "$" and text[j - 1] != "\\":
                    break
                j += 1
            if j >= n:
                out.append(fn(text[i:]))
                break
            out.append(text[i : j + 1])
            i = j + 1
        else:
            j = i + 1
            while j < n:
                if text.startswith("$$", j):
                    break
                if text[j] == "$" and (j == 0 or text[j - 1] != "\\"):
                    break
                j += 1
            out.append(fn(text[i:j]))
            i = j
    return "".join(out)


def repair_mangled(text: str) -> str:
    s = text
    s = MANGLED_TRIG.sub(r"\\\1 \2^\\circ", s)
    s = MANGLED_CIRC.sub(r"\1^\\circ", s)
    s = MANGLED_PMATRIX.sub(r"$\\begin{pmatrix}\1\\\\\2\\end{pmatrix}$", s)
    # Accidental display-math open before '='
    s = re.sub(r"\$\$(\s*=)", r"$\1", s)
    # Any remaining `$$\begin{...}` that isn't a true $$...$$ display block
    s = re.sub(r"\$\$(\\begin\{[a-zA-Z*]+\})", r"$\1", s)
    s = re.sub(r"(\\end\{[a-zA-Z*]+\})\$\$(?!\$)", r"\1$", s)
    # Orphan closer at end of a step that continues prior math: `= (...)$`
    if re.match(r"^\s*=", s) and "$" not in s and re.search(r"\d|\(|\\", s):
        s = f"${s.strip().rstrip('.')}$"
        if text.rstrip().endswith("."):
            s += "."
    return s


def fix_non_math_segment(seg: str) -> str:
    if not seg:
        return seg
    s = seg
    # Bare N^\circ → $N^{\circ}$
    s = BARE_CIRC.sub(r"$\1^{\\circ}$", s)
    # Bare pmatrix / env
    def env_wrap(m: re.Match) -> str:
        body = m.group(0)
        if body.startswith("$"):
            return body
        return f"${body}$"

    s = re.sub(
        r"(?<!\$)\\begin\{([a-zA-Z*]+)\}.*?\\end\{\1\}(?!\$)",
        env_wrap,
        s,
        flags=re.DOTALL,
    )
    # Equation-only fragments starting with = or \cmd containing TeX
    stripped = s.strip().rstrip(".")
    trailing_dot = s.strip().endswith(".")
    if (
        "\\" in stripped
        and "$" not in stripped
        and (EQ_FRAGMENT.match(stripped) or re.match(r"^[A-Za-z0-9_\\].*\\[a-zA-Z]", stripped))
        and len(stripped) <= 200
        and not re.search(r"\b(the|and|where|since|from|with|that|this|which)\b", stripped, re.I)
    ):
        wrapped = f"${stripped}$" + ("." if trailing_dot else "")
        s = s.replace(s.strip(), wrapped, 1)
    return s


def balance_dollars(text: str) -> str:
    dollars = list(DOLLAR.finditer(text))
    if len(dollars) % 2 == 0:
        return text
    last = dollars[-1].start()
    tail = text[last + 1 :]
    if re.search(r"\\[a-zA-Z]+|=|\d", tail):
        return text + "$"
    return text[:last] + text[last + 1 :]


def fix_content_math(text: str) -> str:
    if not text:
        return text
    s = repair_mangled(text)
    s = CIRC_THEN_MATHRM.sub(r"$\1\\mathrm{\2}$", s)
    s = map_non_math(s, fix_non_math_segment)
    s = balance_dollars(s)
    return s


def fix_ascii_sqrt_option(text: str) -> str:
    if not text or "sqrt(" not in text:
        return text
    s = ASCII_SQRT.sub(r"\\sqrt{\1}", text)
    if s == text:
        return text
    if "$" not in s:
        return f"${s}$"
    if len(DOLLAR.findall(s)) % 2 == 1:
        s = s + "$"
    return s


def fix_question(q: dict) -> list[str]:
    changes: list[str] = []
    sol = q.get("solution")
    if isinstance(sol, dict):
        steps = sol.get("steps")
        if isinstance(steps, list):
            n = len(steps)
            for i, step in enumerate(steps):
                if not isinstance(step, dict):
                    continue
                title = step.get("title") or ""
                content = step.get("content") or ""
                new_c = fix_content_math(content)
                if new_c != content:
                    step["content"] = new_c
                    changes.append(f"{q['id']}:content step{i+1}")
                    content = new_c
                if is_bad_title(title, content):
                    step["title"] = short_title_for(i, n)
                    changes.append(f"{q['id']}:title step{i+1}")
        for key in ("fast", "trap"):
            val = sol.get(key)
            if isinstance(val, str) and val:
                new_v = fix_content_math(val)
                if new_v != val:
                    sol[key] = new_v
                    changes.append(f"{q['id']}:{key}")

    hint = q.get("hint")
    if isinstance(hint, str) and hint:
        new_h = fix_content_math(hint)
        if new_h != hint:
            q["hint"] = new_h
            changes.append(f"{q['id']}:hint")

    opts = q.get("options")
    if isinstance(opts, dict):
        for k, v in list(opts.items()):
            if isinstance(v, str):
                nv = fix_ascii_sqrt_option(v)
                if nv != v:
                    opts[k] = nv
                    changes.append(f"{q['id']}:opt {k}")

    return changes


def main() -> None:
    all_changes: list[str] = []
    for path in sorted(QB.glob("*.json")):
        if path.name.startswith("GENERATED"):
            continue
        raw = json.load(open(path, encoding="utf-8"))
        if not isinstance(raw, list):
            continue
        changed = False
        for q in raw:
            if not isinstance(q, dict):
                continue
            ch = fix_question(q)
            if ch:
                all_changes.extend(ch)
                changed = True
        if changed:
            path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    titles = sum(1 for c in all_changes if ":title " in c)
    contents = sum(1 for c in all_changes if ":content " in c)
    opts = sum(1 for c in all_changes if ":opt " in c)
    print(f"changes: {len(all_changes)} (titles={titles}, content={contents}, opts={opts})")
    for c in all_changes[:40]:
        print(" ", c)
    if len(all_changes) > 40:
        print(f"  ... +{len(all_changes) - 40} more")


if __name__ == "__main__":
    main()
