#!/usr/bin/env python3
"""Diff every stored question against Gemini's transcription of the source paper.

Some questions in the bank were invented rather than transcribed (proven:
ENGAA-2023-M2-008). Every one found so far surfaced through a TELL — a hedge
phrase, a stray bracket, a twin that disagreed — never through a systematic check,
so the rate across the bank was unknown.

Transcriptions come from scripts/gemini_transcribe.py. We diff on OPTION VALUES
first: they are short, highly distinctive, and survive transcription noise far
better than prose, so they answer "is this even the same question?" more reliably
than the stem does.

Verdicts:
  MATCH        options substantially agree -> the stored question is real
  DRIFT        some options agree -> same question, garbled extraction
  MISMATCH     nothing agrees -> stored question is not at that number. Either a
               fabrication or a bad id->qnum mapping; --resolve tells them apart.
  UNREADABLE   Gemini declined to transcribe -> excluded from the rate

Flash-vs-Pro sanity check: on ENGAA_2019 q6/11/18/23/27/36, gemini-3.5-flash
reproduced web-UI Gemini Pro's transcription on every question, so the cheaper
model is not the weak link here.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QB = ROOT / "question-bank"
MAP_DIR = QB / "id-qnum-mapping"
CACHE = ROOT / "scripts" / ".fabrication_audit" / "gemini"
REPORT = ROOT / "scripts" / ".fabrication_audit" / "census.json"


def norm(s: str) -> str:
    """Reduce LaTeX and plain-text spellings of one value to a single form, so
    '$\\frac{7}{20}$' and '7/20' compare equal.

    Order is load-bearing. Constructs are reduced INNERMOST FIRST because regex
    cannot parse nesting: \\frac{1}{\\sqrt{3}} will not match a frac pattern until
    the inner \\sqrt is gone. Whitespace is stripped BEFORE the scientific-notation
    rewrite, because '\\times 10' becomes '* 10' with a space and would otherwise
    never match. Getting either wrong manufactures false mismatches.
    """
    s = str(s)
    # Unicode and LaTeX spellings of the same symbol must collapse together, or every
    # option carrying a Greek letter or an equilibrium arrow reads as a mismatch.
    for uni, name in (("ω", "omega"), ("Ω", "omega"), ("θ", "theta"), ("λ", "lambda"),
                      ("μ", "mu"), ("Δ", "delta"), ("δ", "delta"), ("α", "alpha"),
                      ("β", "beta"), ("γ", "gamma"), ("ρ", "rho"), ("σ", "sigma"),
                      ("⇌", "rightleftharpoons"), ("→", "rightarrow"),
                      ("⟶", "rightarrow"), ("≈", "approx"), ("∞", "infty")):
        s = s.replace(uni, name)
    # Brace-less LaTeX: \frac12 means \frac{1}{2}. The braced pattern below cannot
    # see it, so it would survive as the literal "frac12" and never compare equal.
    s = re.sub(r"\\[dt]?frac\s*(\d)\s*(\d)", r"(\1)/(\2)", s)
    # Formatting wrappers carry no value: \text{ m} is the same quantity as m.
    for _ in range(4):
        s, n = re.subn(
            r"\\(?:text|textrm|textit|mathrm|mathit|operatorname)\s*\{([^{}]*)\}",
            r"\1", s)
        if not n:
            break
    for _ in range(4):
        s, n = re.subn(r"\\sqrt\s*\{([^{}]*)\}", r"sqrt(\1)", s)
        if not n:
            break
    for _ in range(4):
        s, n = re.subn(r"\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}", r"(\1)/(\2)", s)
        if not n:
            break
    s = (s.replace("\\leq", "<=").replace("\\le", "<=")
          .replace("\\geq", ">=").replace("\\ge", ">=")
          .replace("\\times", "*").replace("\\cdot", "*")
          .replace("\\pm", "+-").replace("\\div", "/"))
    s = re.sub(r"\\([a-zA-Z]+)", r"\1", s)      # \pi -> pi, \theta -> theta
    s = (s.replace("−", "-").replace("–", "-").replace("×", "*")
          .replace("≤", "<=").replace("≥", ">=").replace("π", "pi")
          .replace("√", "sqrt").replace("°", "deg").replace("circ", "deg"))
    s = re.sub(r"[\s${}\\,()^]", "", s)
    s = s.replace("*10", "e").replace("x10", "e")
    return s.lower()


def tokens(s: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]+", str(s).lower()) if len(w) > 3}


def load_stored(extra_mapping: Path | None = None) -> dict:
    """`extra_mapping` overlays proposed id->qnum mappings that are not yet adopted
    into question-bank/, so questions recovered by scripts/map_unmapped.py can be
    audited without editing another session's files."""
    extra = json.load(open(extra_mapping, encoding="utf-8")) if extra_mapping else {}
    out = {}
    for src in sorted(QB.glob("*_S1.json")):
        paper = src.stem
        mf = MAP_DIR / f"{paper}.json"
        qmap = json.load(open(mf, encoding="utf-8")) if mf.exists() else {}
        qmap = {**qmap, **extra.get(paper, {})}
        for q in json.load(open(src, encoding="utf-8")):
            qnum = qmap.get(q.get("id"))
            if qnum is None:
                continue
            out[(paper, qnum)] = q
    return out


def load_gemini() -> dict:
    out = {}
    for pdir in sorted(CACHE.glob("*_S1")):
        for f in sorted(pdir.glob("*.json")):
            for r in json.load(open(f, encoding="utf-8")):
                out[(pdir.name, r["qnum"])] = r
    return out


def judge(stored: dict, got: dict) -> tuple:
    s_opts = [norm(v) for v in (stored.get("options") or {}).values()]
    g_opts = [norm(o.get("text", "")) for o in (got.get("options") or [])]
    s_opts = [o for o in s_opts if o]
    frac = (sum(1 for o in s_opts if o in g_opts) / len(s_opts)) if s_opts else 0.0

    st, gt = tokens(stored.get("question", "")), tokens(got.get("question", ""))
    stem = (len(st & gt) / min(len(st), len(gt))) if st and gt else 0.0

    if frac >= 0.6 or (frac >= 0.3 and stem >= 0.4) or stem >= 0.6:
        return "MATCH", frac, stem
    if frac > 0 or stem >= 0.3:
        return "DRIFT", frac, stem
    return "MISMATCH", frac, stem


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", default="MISMATCH,DRIFT",
                    help="comma-separated verdicts to list in full")
    ap.add_argument("--extra-mapping", type=Path,
                    help="overlay proposed mappings (see scripts/map_unmapped.py) "
                         "without editing question-bank/")
    ap.add_argument("--resolve", action="store_true",
                    help="for each MISMATCH, hunt the stored question elsewhere in "
                         "the same paper (distinguishes a mapping error from a "
                         "fabrication)")
    args = ap.parse_args()

    stored, gem = load_stored(args.extra_mapping), load_gemini()
    if not gem:
        return print(f"no transcriptions in {CACHE}; run gemini_transcribe.py") or 1

    show = {v.strip().upper() for v in args.show.split(",") if v.strip()}
    counts, per_paper, rows = Counter(), {}, []

    for key in sorted(stored):
        got = gem.get(key)
        if got is None:
            continue
        paper, qnum = key
        if not got.get("readable"):
            verdict, frac, stem = "UNREADABLE", 0.0, 0.0
        else:
            verdict, frac, stem = judge(stored[key], got)
        counts[verdict] += 1
        per_paper.setdefault(paper, Counter())[verdict] += 1
        rows.append({"paper": paper, "qnum": qnum, "id": stored[key].get("id"),
                     "verdict": verdict, "opts": round(frac, 2),
                     "stem": round(stem, 2)})

    if args.resolve:
        resolve(stored, gem, rows)

    for r in rows:
        if r["verdict"] in show:
            mark = {"MISMATCH": "!!", "DRIFT": "~ ", "UNREADABLE": "? "}.get(
                r["verdict"], "  ")
            found = f"  -> found at q{r['found_at']}" if r.get("found_at") else ""
            print(f"{mark} {r['id']:22} q{r['qnum']:<3} {r['verdict']:10} "
                  f"opts={r['opts']:.0%} stem={r['stem']:.2f}{found}")

    print("\n" + "-" * 68)
    print(f"{'paper':16} {'match':>6} {'drift':>6} {'mismatch':>9} {'unread':>7}")
    for paper in sorted(per_paper):
        c = per_paper[paper]
        print(f"{paper:16} {c['MATCH']:>6} {c['DRIFT']:>6} "
              f"{c['MISMATCH']:>9} {c['UNREADABLE']:>7}")

    checked = counts["MATCH"] + counts["DRIFT"] + counts["MISMATCH"]
    print("-" * 68)
    print(f"{'TOTAL':16} {counts['MATCH']:>6} {counts['DRIFT']:>6} "
          f"{counts['MISMATCH']:>9} {counts['UNREADABLE']:>7}")
    if checked:
        mapped = sum(1 for r in rows if r.get("found_at"))
        print(f"\nchecked {checked} readable questions")
        if args.resolve:
            print(f"  mapping errors (found elsewhere): {mapped}")
            print(f"  unexplained mismatches: {counts['MISMATCH'] - mapped}"
                  f"  ({(counts['MISMATCH'] - mapped) / checked:.1%})")
        else:
            print(f"  mismatch rate: {counts['MISMATCH'] / checked:.1%} "
                  f"(run --resolve to strip out mapping errors)")

    REPORT.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"\nreport: {REPORT}")
    return 0


def resolve(stored: dict, gem: dict, rows: list) -> None:
    """A bad id->qnum mapping is indistinguishable from a fabrication when you only
    compare one number against one number. So for every mismatch, search the whole
    paper: if the stored question turns up at a different qnum, the content is real
    and the MAPPING is wrong."""
    for r in rows:
        if r["verdict"] != "MISMATCH":
            continue
        paper = r["paper"]
        rec = stored[(paper, r["qnum"])]
        best, best_score = None, 0.0
        for (p, qn), got in gem.items():
            if p != paper or qn == r["qnum"] or not got.get("readable"):
                continue
            _, frac, stem = judge(rec, got)
            score = max(frac, stem)
            if score > best_score:
                best, best_score = qn, score
        if best is not None and best_score >= 0.5:
            r["found_at"] = best
            r["found_score"] = round(best_score, 2)


if __name__ == "__main__":
    raise SystemExit(main())
