#!/usr/bin/env python3
"""Mechanical validation of question content against docs/CONTENT_SPEC.md.

The spec (§4 hard bans, §6 validation tiers) is only worth writing if it is
enforced, and it is only enforceable mechanically — nobody re-reads 1040
records. This script is spec §6.4 step 3: it runs every Tier A and Tier B check
over the bank and reports, but it ALWAYS exits 0. Step 5 flips Tier A to
build-failing one module at a time; that flip is `--fail-on A --module physics`
plus a call in the build, not a rewrite.

Tier split, verbatim from the spec:
  A  fully mechanical, destined to be build-failing (§6.1)
  B  heuristic, warn + review queue (§6.2)
  C  model or human judgement only (§6.3) — this script cannot judge these, so
     it emits the sampling roster the spec mandates rather than a verdict.

Deliberately NOT re-implemented here: schema/topic/duplicate-id validation and
the empty/placeholder/scratch-working option checks. Those already live in
scripts/merge.py and already fail the build. See the module notes in
check_option_placeholder for the one place the two overlap on purpose.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Callable, Iterable, Iterator

ROOT = Path(__file__).resolve().parent.parent
QUESTION_BANK = ROOT / "question-bank"
PRE_PASS = QUESTION_BANK / ".pre-pass"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from merge import MODULE_TOPICS  # noqa: E402  reuse the canonical module list


# ---------------------------------------------------------------- data model

@dataclass(frozen=True)
class Finding:
    tier: str
    code: str
    ban: str          # spec reference, e.g. "§4.1"
    qid: str
    module: str
    field: str
    detail: str
    ships: bool       # False for needs_repair records, which merge.py drops


CHECK_TITLES: dict[str, str] = {}


# ------------------------------------------------------------------- helpers

MATH_SPAN = re.compile(r"\$\$.+?\$\$|\$[^$]*\$", re.DOTALL)


def strip_math(text: str) -> str:
    """Blank out $…$ / $$…$$ spans, preserving length-independent word breaks.

    Every prose-level ban is about prose; matching them inside LaTeX produces
    nonsense like flagging `(x - A)` as an option-letter reference.
    """
    return MATH_SPAN.sub(" ", text)


def math_spans(text: str) -> list[str]:
    return MATH_SPAN.findall(text)


DECIMAL = re.compile(r"(?<=\d)\.(?=\d)")


def sentences(text: str) -> list[str]:
    masked = DECIMAL.sub("\x00", strip_math(text))
    parts = re.split(r"(?<=[.!?])[\s\n]+", masked)
    return [p.replace("\x00", ".").strip() for p in parts if p.strip()]


def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9']+", text)


SECTION_HEADINGS = [
    "**The answer**",
    "**The route**",
    "**Where it goes wrong**",
    "**Faster in the exam**",
    "**The trap**",
]
REQUIRED_HEADINGS = SECTION_HEADINGS[:2]


def sections(technique: str) -> dict[str, str]:
    """Split a technique into its §2.3 sections. Missing headings simply absent."""
    hits = sorted(
        (technique.find(h), h) for h in SECTION_HEADINGS if technique.find(h) >= 0
    )
    out: dict[str, str] = {}
    for i, (pos, heading) in enumerate(hits):
        end = hits[i + 1][0] if i + 1 < len(hits) else len(technique)
        out[heading] = technique[pos + len(heading):end].strip()
    return out


def excerpt(text: str, at: int = 0, width: int = 90) -> str:
    start = max(0, at - 20)
    snippet = text[start:start + width].replace("\n", "\\n")
    return f"…{snippet}…" if start else f"{snippet}…"


# --------------------------------------------------------- §4 technique bans

BAN_RULES: list[tuple[str, str, str, re.Pattern[str]]] = [
    # (code, ban ref, human title, pattern applied to math-stripped technique)
    # The spec's bare /\b[A-H]\)/ form is unusable against this corpus: it fires on
    # "(at 30 °C)", "(a/b)/c" and "(consistent: A)". A letter+paren only means an
    # option label when it is used as a label — line-initial or opening a clause.
    ("A-TECH-OPTION-LETTER", "§4.1", "references an option by letter (options are shuffled at render)",
     re.compile(r"(?i:\b(?:option|choice|answer)s?\s+[A-H]\b)"
                r"|(?:^|(?<=[.;]\s))[A-H]\)"
                r"|(?i:\bthe (?:first|second|third|fourth|last) option\b)", re.M)),
    ("A-TECH-COMMENTARY", "§4.2", "extraction commentary leaked into student-facing prose",
     re.compile(r"\[DIAGRAM|\[OCR|\[NOTE|\[TODO|\[sic\]|\[\?\]", re.I)),
    ("A-TECH-HEDGING", "§4.3", "uncertainty hedging (belongs in review_note, never rendered)",
     re.compile(r"trusting the official key|assuming the|presumably|it seems|appears to be|"
                r"cannot verify|unclear|I think|probably|if the diagram|hard to tell|"
                r"garbled in source extraction|\brecheck\b|\bunsure\b|\bTODO\b", re.I)),
    ("A-TECH-ELLIPSIS", "§4.4", "ellipsis standing in for reasoning",
     re.compile(r"…|\.\.\.")),
    # Bare `I` is not checkable in this bank: it is iodine in chemistry, current in
    # physics and a statement label ("I and II only") everywhere. Only the pronoun
    # construction is flagged; `I'm`/`I have` etc. still catch real first person.
    ("A-TECH-PERSON", "§4.5", "first/second person — explanations are impersonal",
     re.compile(r"\b(?:we|we're|we've|our|ours|us|you|you'll|you're|your|yours|let's)\b"
                r"|\bI'(?:m|ve|ll|d)\b"
                r"|\bI\s+(?:am|have|will|think|would|assume|note|use|used|find|get|can|should|do|don't)\b")),
    ("A-TECH-META", "§4.6", "meta-reference to the platform rather than the physics",
     re.compile(r"\bthis question\b|\bthe above\b|\bas shown earlier\b|\bsee the stem\b", re.I)),
    ("A-TECH-MHCHEM", "§4.7", r"\ce{} — mhchem is not loaded, renders as raw text",
     re.compile(r"\\ce\{")),
]


def check_technique_bans(q: dict) -> Iterator[tuple]:
    technique = q.get("technique") or ""
    prose = strip_math(technique)
    for code, ban, title, pattern in BAN_RULES:
        CHECK_TITLES[code] = title
        # \ce{ and the commentary markers can hide inside math; those two look at
        # the raw field, the rest are prose-only by construction.
        subject = technique if code in ("A-TECH-MHCHEM", "A-TECH-COMMENTARY") else prose
        m = pattern.search(subject)
        if m:
            yield ("A", code, ban, "technique",
                   f"{m.group(0)!r} — {excerpt(subject, m.start())}")


def check_technique_delimiters(q: dict) -> Iterator[tuple]:
    """§4.8 — unbalanced $, or a $$ block wedged inside a prose paragraph."""
    CHECK_TITLES["A-TECH-UNBALANCED-MATH"] = "unbalanced $ delimiters"
    CHECK_TITLES["A-TECH-INLINE-DISPLAY"] = "$$ display block inside a prose paragraph"
    technique = q.get("technique") or ""
    if unbalanced_dollars(technique):
        yield ("A", "A-TECH-UNBALANCED-MATH", "§4.8", "technique", excerpt(technique))
    for para in technique.split("\n\n"):
        if "$$" not in para:
            continue
        # A display block must own its paragraph; prose either side of it means
        # it was written as an inline step (§2.4 "if it is a step, it is inline").
        if strip_math(para).strip():
            yield ("A", "A-TECH-INLINE-DISPLAY", "§4.8", "technique", excerpt(para))
            break


def unbalanced_dollars(text: str) -> bool:
    without_display = re.sub(r"\$\$.+?\$\$", "", text, flags=re.DOTALL)
    return without_display.count("$") % 2 == 1 or text.count("$$") % 2 == 1


def check_technique_sections(q: dict) -> Iterator[tuple]:
    """§4.9 / §6.1 — required headings present and in spec order."""
    CHECK_TITLES["A-TECH-MISSING-SECTION"] = "missing required section heading (§2.3)"
    CHECK_TITLES["A-TECH-SECTION-ORDER"] = "section headings out of spec order"
    technique = q.get("technique") or ""
    missing = [h for h in REQUIRED_HEADINGS if h not in technique]
    if missing:
        yield ("A", "A-TECH-MISSING-SECTION", "§4.9", "technique", ", ".join(missing))
        return
    present = [h for h in SECTION_HEADINGS if h in technique]
    positions = [technique.find(h) for h in present]
    if positions != sorted(positions):
        yield ("A", "A-TECH-SECTION-ORDER", "§4.9", "technique", " then ".join(present))


SHINGLE = 15


def check_stem_echo(q: dict) -> Iterator[tuple]:
    """§4.13 — >15 contiguous words of the stem restated in the explanation."""
    CHECK_TITLES["A-TECH-STEM-ECHO"] = "restates >15 contiguous words of the stem (padding)"
    stem = [w.lower() for w in words(strip_math(q.get("question") or ""))]
    tech = [w.lower() for w in words(strip_math(q.get("technique") or ""))]
    if len(stem) <= SHINGLE or len(tech) <= SHINGLE:
        return
    stem_shingles = {tuple(stem[i:i + SHINGLE]) for i in range(len(stem) - SHINGLE + 1)}
    for i in range(len(tech) - SHINGLE + 1):
        shingle = tuple(tech[i:i + SHINGLE])
        if shingle in stem_shingles:
            yield ("A", "A-TECH-STEM-ECHO", "§4.13", "technique", " ".join(shingle))
            return


# ------------------------------------------------------------- §4 stem bans

STEM_MARKER = re.compile(r"\[DIAGRAM|\[OCR|\[[A-Z]{2,}:")
STEM_MARKDOWN = [
    ("bold", re.compile(r"\*\*[^*]+\*\*")),
    ("heading", re.compile(r"^#{1,6} ", re.M)),
    ("blockquote", re.compile(r"^> ", re.M)),
    ("link", re.compile(r"\[[^\]]*\]\([^)]*\)")),
    ("code fence", re.compile(r"```|(?<!\w)`[^`]+`")),
    ("raw HTML", re.compile(r"</?[a-zA-Z][^>]*>")),
    ("display math", re.compile(r"\$\$")),
    ("horizontal rule", re.compile(r"^---\s*$", re.M)),
]


def check_stem_markers(q: dict) -> Iterator[tuple]:
    """§4.15 — no extraction marker may survive into a shipped stem."""
    CHECK_TITLES["A-STEM-MARKER"] = "extraction marker in stem ([DIAGRAM/[OCR/[UPPERCASE:)"
    stem = q.get("question") or ""
    m = STEM_MARKER.search(stem)
    if m:
        yield ("A", "A-STEM-MARKER", "§4.15", "question", excerpt(stem, m.start()))


def check_stem_markdown(q: dict) -> Iterator[tuple]:
    """§4.16 / §1.1 — stems use a closed GFM subset; everything else is a cue."""
    CHECK_TITLES["A-STEM-MARKDOWN"] = "forbidden markdown construct in stem (§1.1)"
    stem = q.get("question") or ""
    # The one permitted italic is the §1.4 figure caption line; mask it first.
    masked = re.sub(r"^\*Figure:[^\n]*\*$", "", stem, flags=re.M)
    masked = strip_math(masked)
    for name, pattern in STEM_MARKDOWN:
        m = pattern.search(masked)
        if m:
            yield ("A", "A-STEM-MARKDOWN", "§4.16", "question",
                   f"{name}: {excerpt(masked, m.start())}")
            return


TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
LIST_ITEM = re.compile(r"^\s*(?:[-*]\s|\d+\.\s)")


def check_stem_single_newline(q: dict) -> Iterator[tuple]:
    """§4.17 — a lone \\n collapses in GFM, so it encodes intent that never renders."""
    CHECK_TITLES["A-STEM-SINGLE-NEWLINE"] = r"single \n outside a table or list block (§1.1)"
    stem = q.get("question") or ""
    lines = stem.split("\n")
    for i in range(len(lines) - 1):
        a, b = lines[i], lines[i + 1]
        if not a.strip() or not b.strip():
            continue
        structural = (TABLE_ROW.match(a) and TABLE_ROW.match(b)) or \
                     (LIST_ITEM.match(a) and LIST_ITEM.match(b))
        if not structural:
            yield ("A", "A-STEM-SINGLE-NEWLINE", "§4.17", "question",
                   f"{a.strip()[-40:]!r} / {b.strip()[:40]!r}")
            return


DOUBLED_TERMINATOR = re.compile(r"[.?!]\s*[.?!]")


def check_stem_doubled_terminator(q: dict) -> Iterator[tuple]:
    """§4.18 — the `speed v. . Which` defect left by marker removal."""
    CHECK_TITLES["A-STEM-DOUBLED-TERMINATOR"] = "doubled sentence terminator (extraction damage)"
    stem = strip_math(q.get("question") or "")
    stem = stem.replace("...", "\x00")  # ellipsis is its own ban, do not double-report
    m = DOUBLED_TERMINATOR.search(stem)
    if m:
        yield ("A", "A-STEM-DOUBLED-TERMINATOR", "§4.18", "question", excerpt(stem, m.start()))


def check_stem_table(q: dict) -> Iterator[tuple]:
    """§6.1 — a GFM table with ragged cell counts renders as garbage."""
    CHECK_TITLES["A-STEM-TABLE-MALFORMED"] = "GFM table malformed (no separator row, or ragged cells)"
    CHECK_TITLES["B-STEM-TABLE-SINGLE-ROW"] = "table restoration produced a single-row table (§6.2)"
    stem = q.get("question") or ""
    for block in table_blocks(stem):
        widths = [len(row.strip().strip("|").split("|")) for row in block]
        if len(block) < 2 or not re.match(r"^\s*\|[\s:|-]+\|\s*$", block[1]):
            yield ("A", "A-STEM-TABLE-MALFORMED", "§6.1", "question",
                   "missing separator row: " + block[0].strip())
        elif len(set(widths)) != 1:
            yield ("A", "A-STEM-TABLE-MALFORMED", "§6.1", "question",
                   f"cell counts {widths}: {block[0].strip()}")
        elif len(block) == 3:
            yield ("B", "B-STEM-TABLE-SINGLE-ROW", "§6.2", "question", block[0].strip())


def table_blocks(text: str) -> Iterator[list[str]]:
    block: list[str] = []
    for line in text.split("\n"):
        if TABLE_ROW.match(line):
            block.append(line)
        elif block:
            yield block
            block = []
    if block:
        yield block


# ------------------------------------------- §4.19 diff against the pre-pass

DIAGRAM_MARKER = re.compile(r"\[DIAGRAM:[^\]]*\]", re.I)
FIGURE_CAPTION = re.compile(r"^\*Figure:[^\n]*\*$", re.M)


def normalise_for_diff(text: str) -> list[str]:
    """Reduce a stem to the token sequence §4.19 says must never change.

    Permitted classes are erased on both sides so only a genuine reword shows:
    whitespace, `$` insertion, table pipes and separator rows, list markers, the
    §1.4 diagram/figure treatment, and the §1.7 punctuation repairs.
    """
    t = DIAGRAM_MARKER.sub(" ", text)
    t = FIGURE_CAPTION.sub(lambda m: m.group(0)[8:-1], t)   # keep the caption words
    t = t.replace("$", "")
    t = re.sub(r"^\s*\|[\s:|-]+\|\s*$", " ", t, flags=re.M)  # table separator rows
    t = t.replace("|", " ")
    t = re.sub(r"^\s*(?:[-*]\s|\d+\.\s)", " ", t, flags=re.M)  # list markers
    # §1.7 punctuation repairs, applied to both sides so a repair is not a diff
    t = re.sub(r"\.\s*\.", ".", t)
    t = re.sub(r"\s+([,.;:?!])", r"\1", t)
    t = t.replace("( ", "(").replace(" )", ")")
    t = re.sub(r"(?<=\d)--(?=\d)", "–", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip().split()


def make_prepass_check(baseline: dict[str, str]) -> Callable[[dict], Iterator[tuple]]:
    CHECK_TITLES["A-STEM-REWORDED"] = "stem text differs from the pre-pass baseline (§4.19)"
    CHECK_TITLES["A-STEM-NO-BASELINE"] = "no pre-pass baseline for this id — §4.19 unenforceable"

    def check(q: dict) -> Iterator[tuple]:
        qid = q.get("id")
        if qid not in baseline:
            yield ("A", "A-STEM-NO-BASELINE", "§6.1", "question", "id absent from .pre-pass snapshot")
            return
        before = normalise_for_diff(baseline[qid])
        after = normalise_for_diff(q.get("question") or "")
        if before == after:
            return
        deltas = []
        for tag, i1, i2, j1, j2 in SequenceMatcher(None, before, after).get_opcodes():
            if tag == "equal":
                continue
            deltas.append(f"{tag}: {' '.join(before[i1:i2])!r} -> {' '.join(after[j1:j2])!r}")
        yield ("A", "A-STEM-REWORDED", "§4.19", "question", "; ".join(deltas[:3]))

    return check


# ---------------------------------------------------------- §4 option bans

OPTION_LETTER_REF = re.compile(r"\b(?:option|choice|answer)\s+[A-H]\b|\bsame as [A-H]\b", re.I)


def check_options(q: dict) -> Iterator[tuple]:
    """§4.21–23. §4.21 duplicates merge.py deliberately — see module docstring."""
    CHECK_TITLES["A-OPT-PLACEHOLDER"] = "empty or placeholder option value (also gated by merge.py)"
    CHECK_TITLES["A-OPT-LETTER-REF"] = "option text references another option's letter"
    CHECK_TITLES["A-OPT-UNBALANCED-MATH"] = "unbalanced $ in an option"
    CHECK_TITLES["A-OPT-ANSWER-KEY"] = "answer key missing from options, or <2 usable options"
    options = q.get("options")
    if not isinstance(options, dict):
        yield ("A", "A-OPT-ANSWER-KEY", "§6.1", "options", "options is not an object")
        return

    usable = 0
    for letter in sorted(options):
        value = str(options[letter]).strip()
        if not value or value in ("-", "—", "–", "N/A"):
            yield ("A", "A-OPT-PLACEHOLDER", "§4.21", f"options.{letter}", repr(value))
            continue
        usable += 1
        m = OPTION_LETTER_REF.search(strip_math(value))
        if m:
            yield ("A", "A-OPT-LETTER-REF", "§4.22", f"options.{letter}", m.group(0))
        if unbalanced_dollars(value):
            yield ("A", "A-OPT-UNBALANCED-MATH", "§4.23", f"options.{letter}", value[:60])

    answer = q.get("answer")
    if usable < 2:
        yield ("A", "A-OPT-ANSWER-KEY", "§6.1", "options", f"only {usable} usable option(s)")
    if answer not in options or not str(options.get(answer, "")).strip():
        yield ("A", "A-OPT-ANSWER-KEY", "§6.1", "answer", f"answer {answer!r} has no usable option")


# ------------------------------------------------- §3 option column estimator

LATEX_TOKEN = re.compile(r"\\[a-zA-Z]+|\^\{[^{}]*\}|_\{[^{}]*\}|\^\S|_\S")
STACKED = re.compile(r"\\[dt]?frac")
# The §3 estimator degrades to one column as options widen; past this weight even
# a single column cannot hold the option on one line at max-w-[68ch] (§1.8), so
# the layout is no longer computable from the option set alone.
UNBOUNDED_WEIGHT = 200


def option_weight(text: str) -> int:
    s = text.replace("$", "")
    commands = LATEX_TOKEN.findall(s)
    rest = LATEX_TOKEN.sub("", s)
    return len(commands) * 6 + len(rest)


def option_columns(options: dict) -> tuple[int, int, bool]:
    """Return (max weight, column count at lg, hasStacked) per §3."""
    values = [str(v) for v in options.values()]
    w = max((option_weight(v) for v in values), default=0)
    n = len(values)
    stacked = any(STACKED.search(v) for v in values)
    if stacked or any("$$" in v or "\n" in v or "|" in v or "![" in v for v in values):
        return w, 1, stacked
    if w <= 12 and n >= 6:
        return w, 4, stacked
    if w <= 28:
        return w, 2, stacked
    return w, 1, stacked


def check_option_layout(q: dict) -> Iterator[tuple]:
    CHECK_TITLES["A-OPT-UNBOUNDED"] = f"option wider than the §3 estimator can lay out (weight >{UNBOUNDED_WEIGHT})"
    options = q.get("options")
    if not isinstance(options, dict) or not options:
        return
    w, _cols, _stacked = option_columns(options)
    if w > UNBOUNDED_WEIGHT:
        widest = max(options.items(), key=lambda kv: option_weight(str(kv[1])))
        yield ("A", "A-OPT-UNBOUNDED", "§6.1", f"options.{widest[0]}",
               f"weight {w}: {str(widest[1])[:60]}…")


# --------------------------------------------------- §5.5 quarantine routing

def check_quarantine(q: dict) -> Iterator[tuple]:
    """§5.5 / §6.1 — needs_source_check must not reach the mock pool.

    merge.py's only exclusion mechanism is `needs_repair`, so a record flagged
    needs_source_check without it ships into Mock Exam mode.
    """
    CHECK_TITLES["A-QUARANTINE-LEAK"] = "needs_source_check record not excluded from the mock pool"
    CHECK_TITLES["B-QUARANTINE-NO-NOTE"] = "quarantined record carries no review_note (§5.5)"
    tier = q.get("quality_tier")
    if tier == "needs_source_check":
        if not q.get("needs_repair"):
            yield ("A", "A-QUARANTINE-LEAK", "§6.1", "quality_tier",
                   "quality_tier=needs_source_check but needs_repair is not set")
        if not str(q.get("review_note") or "").strip():
            yield ("B", "B-QUARANTINE-NO-NOTE", "§5.5", "review_note", "missing")


# ----------------------------------------------------------------- Tier B

MAX_WORDS = 250
MAX_ROUTE_SENTENCES = 8
# §2.4: display-block budget per module. chemistry is content-conditional
# ("balanced equations and mole-ratio arithmetic only"), so it is not counted.
DISPLAY_BUDGET = {"maths1": 3, "maths2": 3, "physics": 2, "biology": 0}


def check_length(q: dict) -> Iterator[tuple]:
    CHECK_TITLES["B-TECH-TOO-LONG"] = f"explanation >{MAX_WORDS} words (§4.11)"
    CHECK_TITLES["B-TECH-ROUTE-TOO-LONG"] = f"'The route' >{MAX_ROUTE_SENTENCES} sentences (§4.11)"
    technique = q.get("technique") or ""
    n = len(words(strip_math(technique)))
    if n > MAX_WORDS:
        yield ("B", "B-TECH-TOO-LONG", "§4.11", "technique", f"{n} words")
    route = sections(technique).get("**The route**")
    if route:
        numbered = len(re.findall(r"^\s*\d+\.\s", route, flags=re.M))
        count = numbered or len(sentences(route))
        if count > MAX_ROUTE_SENTENCES:
            yield ("B", "B-TECH-ROUTE-TOO-LONG", "§4.11", "technique",
                   f"{count} steps/sentences")


def check_display_math(q: dict) -> Iterator[tuple]:
    CHECK_TITLES["B-TECH-DISPLAY-BUDGET"] = "display math blocks over the §2.4 per-module budget"
    module = q.get("module")
    if module not in DISPLAY_BUDGET:
        return
    technique = q.get("technique") or ""
    blocks = len(re.findall(r"\$\$.+?\$\$", technique, flags=re.DOTALL))
    budget = DISPLAY_BUDGET[module]
    if blocks > budget:
        ban = "§4.12" if module == "biology" else "§2.4"
        yield ("B", "B-TECH-DISPLAY-BUDGET", ban, "technique",
               f"{module}: {blocks} display block(s), budget {budget}")


UNIT_TOKEN = re.compile(
    r"(?<![A-Za-z])(?:m|km|cm|mm|nm|s|ms|min|h|kg|g|mg|N|J|kJ|MJ|W|kW|MW|V|mV|kV|A|mA|"
    r"C|K|Pa|kPa|MPa|Hz|kHz|MHz|GHz|T|mT|F|μF|nF|Wb|eV|MeV|mol|dm|rad|"
    r"ohm|ohms|Ω|degrees?|%)(?![A-Za-z])"
)
UNIT_WORD = re.compile(
    r"\b(?:second|minute|hour|day|year|met(?:re|er)|kilomet(?:re|er)|centimet(?:re|er)|"
    r"gram|kilogram|tonne|newton|joule|watt|volt|amp|ampere|coulomb|ohm|kelvin|celsius|"
    r"pascal|hertz|tesla|weber|farad|mole|radian|degree|percent)s?\b", re.I
)
# Only a number that looks *computed* is presumed dimensional. Counts and mass
# numbers ("drops by 4", "214 -> 210") are dimensionless and must not be flagged,
# so a decimal point or a power-of-ten is required.
BARE_NUMBER = re.compile(r"(?<![\w.])\d+\.\d+(?![\w.])|\\times\s*10\^|\b10\^\{?-?\d")


def check_answer_units(q: dict) -> Iterator[tuple]:
    """§4.10 — a physics answer that is a bare number has lost its dimension."""
    CHECK_TITLES["B-TECH-ANSWER-NO-UNIT"] = "numeric physics answer with no unit token (§4.10)"
    if q.get("module") != "physics":
        return
    technique = q.get("technique") or ""
    # Before the content pass most techniques have no sections at all; §4.10 is
    # about the *final answer sentence*, so fall back to the last sentence.
    all_sentences = sentences(technique)
    raw = sections(technique).get("**The answer**") or (all_sentences[-1] if all_sentences else "")
    if not raw:
        return
    # Search the raw text: units usually sit inside the same $…$ as the number.
    has_unit = UNIT_TOKEN.search(raw) or UNIT_WORD.search(raw)
    if BARE_NUMBER.search(strip_math(raw) + " ".join(math_spans(raw))) and not has_unit:
        yield ("B", "B-TECH-ANSWER-NO-UNIT", "§4.10", "technique", excerpt(raw, 0, 70))


# §1.6 V3 absolute denylist, plus the per-module unit/element symbol sets.
V3_DENY = set("aAIieoOu")
MODULE_SYMBOL_DENY = {
    "physics": set("ACFJKNTVWS") | {"Ω"},
    "chemistry": set("HCNOSPKBFIVWYU"),
}
SENTENCE_START = re.compile(r"(?:^|(?<=[.?!])\s+|(?<=\n))$")


def declared_symbols(q: dict) -> set[str]:
    """§1.6 V1 — the set S of symbols already typeset somewhere in this record."""
    pool = [q.get("question") or "", q.get("technique") or ""]
    options = q.get("options")
    if isinstance(options, dict):
        pool += [str(v) for v in options.values()]
    S: set[str] = set()
    for span in math_spans(" ".join(pool)):
        inner = re.sub(r"\\[a-zA-Z]+", " ", span.strip("$"))
        S.update(re.findall(r"(?<![A-Za-z])([A-Za-z])(?![A-Za-z])", inner))
    return S


def check_unwrapped_variables(q: dict) -> Iterator[tuple]:
    """§4.20 — a declared symbol left bare in the stem is a missed §1.6 wrap."""
    CHECK_TITLES["B-STEM-UNWRAPPED-VAR"] = "declared symbol left outside $…$ in the stem (§4.20)"
    module = q.get("module")
    if module == "chemistry":
        return  # §1.6 V3: chemistry single capitals are element symbols; manual only
    S = declared_symbols(q) - V3_DENY - MODULE_SYMBOL_DENY.get(module, set())
    if not S:
        return
    stem = q.get("question") or ""
    # Text inside a [DIAGRAM: …] marker is slated for deletion by §1.4, so an
    # unwrapped symbol in there is not work anyone should do.
    prose = strip_math(DIAGRAM_MARKER.sub(" ", stem))
    misses = []
    for m in re.finditer(r"(?<![A-Za-z0-9])([A-Za-z])(?![A-Za-z0-9])", prose):
        letter = m.group(1)
        if letter not in S:
            continue
        prefix = prose[:m.start()]
        after = prose[m.end():m.end() + 1]
        if prefix[-2:].rstrip().endswith("(") and after == ")":
            continue                      # (a)-style sub-label
        if re.search(r"[\d°]\s*$", prefix):
            continue                      # "5 A", "300 K"
        # A unit symbol inside a compound unit is not a variable: "m/s", "m s^-2",
        # "N kg^-1". Detect by the neighbour rather than by the letter itself,
        # since s, m and g are all legitimate variables elsewhere in this bank.
        if prefix.rstrip().endswith(("/", "·", "^", "_")) or after == "/":
            continue
        prev = re.search(r"([A-Za-z]+)\s*$", prefix)
        if prev and UNIT_TOKEN.fullmatch(prev.group(1)):
            continue
        if SENTENCE_START.search(prefix):
            continue                      # sentence-initial "A student…"
        misses.append(letter)
    if misses:
        yield ("B", "B-STEM-UNWRAPPED-VAR", "§4.20", "question",
               "bare " + ", ".join(sorted(set(misses))) + f" (S={''.join(sorted(S))})")


# ---------------------------------------------------------------- Tier C

def check_tier_c_sampling(q: dict) -> Iterator[tuple]:
    """§6.3 — this script cannot judge correctness; it can only name the roster."""
    CHECK_TITLES["C-REVIEW-REQUIRED"] = "requires human/model review per the §6.3 sampling rule"
    module = q.get("module")
    difficulty = q.get("difficulty") or 0
    if module in ("chemistry", "biology"):
        reason = f"100% of {module} (§1.6 refuses to automate)"
    elif isinstance(difficulty, (int, float)) and difficulty >= 4:
        reason = f"difficulty {difficulty} >= 4"
    else:
        return
    yield ("C", "C-REVIEW-REQUIRED", "§6.3", "record", reason)


# ---------------------------------------------------------------- KaTeX pass

KATEX_SCRIPT = """
import katex from 'katex'
import { readFileSync } from 'node:fs'
const rows = JSON.parse(readFileSync(process.argv[1], 'utf8'))
const out = []
for (const [id, field, expr, display] of rows) {
  try { katex.renderToString(expr, { throwOnError: true, strict: false, displayMode: display }) }
  catch (e) { out.push([id, field, expr, e.message.split('\\n')[0]]) }
}
console.log(JSON.stringify(out))
"""


def run_katex(records: list[dict]) -> list[tuple]:
    """§6.1 — same KaTeX gate as check_katex_render.mjs, but over question-bank/.

    That script reads the merged src/data/questions.json, which only exists after
    merge.py succeeds; content checking has to work on the bank directly.
    """
    CHECK_TITLES["A-KATEX-PARSE"] = "math span does not parse in KaTeX"
    rows = []
    for q in records:
        fields = {"question": q.get("question") or "", "technique": q.get("technique") or ""}
        options = q.get("options")
        if isinstance(options, dict):
            for letter, value in options.items():
                fields[f"options.{letter}"] = str(value)
        for name, text in fields.items():
            for span in math_spans(text):
                display = span.startswith("$$")
                rows.append([q.get("id"), name, span.strip("$"), display])

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
        json.dump(rows, fh)
        payload = fh.name
    try:
        proc = subprocess.run(
            ["node", "--input-type=module", "-e", KATEX_SCRIPT, payload],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
        )
    except FileNotFoundError:
        print("  (node not found — skipping the KaTeX parse check)", file=sys.stderr)
        return []
    finally:
        Path(payload).unlink(missing_ok=True)

    if proc.returncode != 0:
        print(f"  (KaTeX check unavailable: {proc.stderr.strip()[:200]})", file=sys.stderr)
        return []
    return [tuple(r) for r in json.loads(proc.stdout)]


# ------------------------------------------------------------------- driver

PER_RECORD_CHECKS: list[Callable[[dict], Iterator[tuple]]] = [
    check_technique_bans,
    check_technique_delimiters,
    check_technique_sections,
    check_stem_echo,
    check_stem_markers,
    check_stem_markdown,
    check_stem_single_newline,
    check_stem_doubled_terminator,
    check_stem_table,
    check_options,
    check_option_layout,
    check_quarantine,
    check_length,
    check_display_math,
    check_answer_units,
    check_unwrapped_variables,
    check_tier_c_sampling,
]


def load_bank() -> list[dict]:
    records = []
    for path in sorted(QUESTION_BANK.glob("*.json")):
        records.extend(json.load(open(path, encoding="utf-8")))
    return records


def load_baseline() -> dict[str, str]:
    baseline: dict[str, str] = {}
    for path in sorted(PRE_PASS.glob("*.json")):
        baseline.update(json.load(open(path, encoding="utf-8")))
    return baseline


def collect(records: list[dict], baseline: dict[str, str], katex: bool) -> list[Finding]:
    checks = PER_RECORD_CHECKS + [make_prepass_check(baseline)]
    findings: list[Finding] = []
    for q in records:
        qid = q.get("id", "<no id>")
        module = q.get("module", "<no module>")
        ships = not q.get("needs_repair")
        for check in checks:
            for tier, code, ban, field, detail in check(q):
                findings.append(Finding(tier, code, ban, qid, module, field, detail, ships))

    if katex:
        by_id = {q.get("id"): q for q in records}
        for qid, field, expr, message in run_katex(records):
            q = by_id.get(qid, {})
            findings.append(Finding(
                "A", "A-KATEX-PARSE", "§6.1", qid, q.get("module", "?"), field,
                f"{message} :: ${expr}$", not q.get("needs_repair"),
            ))
    return findings


TIER_TITLES = {
    "A": "TIER A — fully mechanical, becomes build-failing per module (§6.1)",
    "B": "TIER B — heuristic, warn + review queue (§6.2)",
    "C": "TIER C — human/model judgement, sampling roster only (§6.3)",
}


def report(findings: list[Finding], records: list[dict], tiers: list[str],
           examples: int) -> None:
    print("CONTENT CHECK — warn-only (spec §6.4 step 3); this never fails the build")
    print(f"{len(records)} records in {QUESTION_BANK}\n")

    by_tier_module: dict[str, Counter] = defaultdict(Counter)
    for f in findings:
        by_tier_module[f.tier][f.module] += 1

    for tier in tiers:
        tier_findings = [f for f in findings if f.tier == tier]
        print("=" * 78)
        print(f"{TIER_TITLES[tier]}  —  {len(tier_findings)} finding(s)")
        print("=" * 78)
        if not tier_findings:
            print("  none\n")
            continue
        modules = sorted(by_tier_module[tier].items(), key=lambda kv: -kv[1])
        for module, count in modules:
            print(f"\n  {module}  ({count} finding(s))")
            per_code = Counter(f.code for f in tier_findings if f.module == module)
            for code, n in per_code.most_common():
                sample = [f for f in tier_findings if f.module == module and f.code == code]
                print(f"    {n:>5}  {code:<28} {sample[0].ban}  {CHECK_TITLES.get(code, '')}")
                for f in sample[:examples]:
                    flag = "" if f.ships else "  [needs_repair, not shipped]"
                    print(f"           - {f.qid} [{f.field}] {f.detail[:140]}{flag}")
                if n > examples:
                    print(f"           … {n - examples} more")
        print()

    print("=" * 78)
    print("WHERE TO START — findings per module")
    print("=" * 78)
    modules = sorted(MODULE_TOPICS)
    header = f"  {'module':<12}" + "".join(f"{t:>10}" for t in tiers) + f"{'records':>10}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    record_counts = Counter(q.get("module") for q in records)
    for module in modules:
        row = f"  {module:<12}"
        for tier in tiers:
            row += f"{by_tier_module[tier].get(module, 0):>10}"
        row += f"{record_counts.get(module, 0):>10}"
        print(row)
    print("  " + "-" * (len(header) - 2))
    total_row = f"  {'TOTAL':<12}"
    for tier in tiers:
        total_row += f"{sum(by_tier_module[tier].values()):>10}"
    total_row += f"{len(records):>10}"
    print(total_row)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--tier", action="append", choices=["A", "B", "C"],
                        help="restrict to one or more tiers (default: A and B)")
    parser.add_argument("--module", action="append", choices=sorted(MODULE_TOPICS),
                        help="restrict to one or more modules")
    parser.add_argument("--code", action="append", help="restrict to specific check codes")
    parser.add_argument("--shipped-only", action="store_true",
                        help="ignore records merge.py drops as needs_repair")
    parser.add_argument("--examples", type=int, default=3,
                        help="example findings printed per code per module (default 3)")
    parser.add_argument("--json", metavar="PATH",
                        help="write every finding as JSON for progress tracking")
    parser.add_argument("--no-katex", action="store_true",
                        help="skip the node/KaTeX parse pass")
    # The step-5 lever: nothing here fails today, and turning a module
    # build-failing is this flag plus --module, not a code change.
    parser.add_argument("--fail-on", choices=["A", "B"], default=None,
                        help="exit 1 if any finding of this tier survives the filters "
                             "(spec §6.4 step 5; unset = warn-only)")
    args = parser.parse_args()

    records = load_bank()
    baseline = load_baseline()
    if not baseline:
        print(f"WARNING: no pre-pass snapshot at {PRE_PASS}; §4.19 cannot be enforced",
              file=sys.stderr)

    findings = collect(records, baseline, katex=not args.no_katex)

    tiers = sorted(set(args.tier)) if args.tier else ["A", "B"]
    if args.module:
        findings = [f for f in findings if f.module in args.module]
        records = [q for q in records if q.get("module") in args.module]
    if args.code:
        findings = [f for f in findings if f.code in args.code]
    if args.shipped_only:
        findings = [f for f in findings if f.ships]
    findings = [f for f in findings if f.tier in tiers]

    report(findings, records, tiers, args.examples)

    if args.json:
        payload = {
            "records": len(records),
            "counts": {
                "by_tier": dict(Counter(f.tier for f in findings)),
                "by_module": dict(Counter(f.module for f in findings)),
                "by_code": dict(Counter(f.code for f in findings)),
            },
            "titles": {c: CHECK_TITLES.get(c, "") for c in {f.code for f in findings}},
            "findings": [asdict(f) for f in findings],
        }
        Path(args.json).write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
        print(f"\nWrote {len(findings)} findings -> {args.json}")

    if args.fail_on and any(f.tier == args.fail_on for f in findings):
        print(f"\nFAILING: --fail-on {args.fail_on} and tier {args.fail_on} findings remain",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
