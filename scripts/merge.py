#!/usr/bin/env python3
"""Merge question-bank/*.json into src/data/questions.json, validating every record.

Fails loudly and merges nothing if any record violates the schema.
"""
import json
import glob
import re
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
QUESTION_BANK = ROOT / "question-bank"
OUTPUT = ROOT / "src" / "data" / "questions.json"

# Canonical module -> topic list, from E:\brain\ESAT\Module & Topic Map.md
MODULE_TOPICS = {
    "maths1": {
        "m1-units", "m1-number", "m1-ratio", "m1-algebra",
        "m1-geometry", "m1-stats", "m1-probability",
    },
    "maths2": {
        "m2-algebra", "m2-sequences", "m2-coord-geom", "m2-trig",
        "m2-exp-log", "m2-differentiation", "m2-integration", "m2-graphs",
    },
    "physics": {
        "phy-electricity", "phy-magnetism", "phy-mechanics", "phy-thermal",
        "phy-matter", "phy-waves", "phy-radioactivity",
    },
    "chemistry": {
        "chem-atomic", "chem-periodic", "chem-reactions", "chem-quant",
        "chem-redox", "chem-bonding", "chem-groups", "chem-separation",
        "chem-acids", "chem-rates", "chem-energetics", "chem-electrolysis",
        "chem-organic", "chem-metals", "chem-kinetic", "chem-tests",
        "chem-air-water",
    },
    "biology": {
        "bio-cells", "bio-membranes", "bio-cell-division", "bio-inheritance",
        "bio-dna", "bio-gene-tech", "bio-variation", "bio-enzymes",
        "bio-animal-physiology", "bio-ecosystems", "bio-plant-physiology",
    },
}

REQUIRED_FIELDS = [
    "id", "source", "year", "paper", "module", "topic", "subtopic",
    "difficulty", "question", "options", "answer", "technique",
    "origin", "quality_tier",
]

DIFFICULTY_MIN, DIFFICULTY_MAX = 1, 5

# An option carrying the author's unfinished working renders as garbage to a student
# but is neither empty nor a dash, so it slips past those checks. One shipped reading
# "$34\sqrt3$... wait recheck" before this existed.
SCRATCH_RE = re.compile(
    r"\b(wait|recheck|re-check|check this|TODO|FIXME|XXX|unsure|not sure)\b|\?\?|\.\.\.",
    re.IGNORECASE,
)


def validate(question, filename, seen_ids):
    """Return a list of violation strings for a single question record."""
    violations = []
    qid = question.get("id", "<missing id>")

    for field in REQUIRED_FIELDS:
        if field not in question:
            violations.append(f"{filename}:{qid}: missing required field '{field}'")

    if "id" in question:
        if question["id"] in seen_ids:
            violations.append(f"{filename}:{qid}: duplicate id (also seen in {seen_ids[question['id']]})")
        else:
            seen_ids[question["id"]] = filename

    module = question.get("module")
    if module is not None and module not in MODULE_TOPICS:
        violations.append(
            f"{filename}:{qid}: invalid module '{module}' "
            f"(must be one of {sorted(MODULE_TOPICS)})"
        )

    topic = question.get("topic")
    if module in MODULE_TOPICS and topic is not None:
        if topic not in MODULE_TOPICS[module]:
            violations.append(
                f"{filename}:{qid}: topic '{topic}' does not belong to module '{module}' "
                f"(valid topics: {sorted(MODULE_TOPICS[module])})"
            )

    options = question.get("options")
    answer = question.get("answer")
    if answer is not None:
        if not (isinstance(answer, str) and len(answer) == 1 and answer.isupper() and answer.isalpha()):
            violations.append(f"{filename}:{qid}: answer '{answer}' is not a single uppercase letter")
        elif isinstance(options, dict) and answer not in options:
            violations.append(f"{filename}:{qid}: answer '{answer}' not present in options {sorted(options.keys())}")

    # An empty option renders as a blank button — and 'answer in options' above
    # still passes when the keyed value is "", so check the values too. A bare
    # dash is a placeholder from a failed extraction, not a real option.
    if isinstance(options, dict):
        for letter in sorted(options):
            value = str(options[letter]).strip()
            if not value:
                violations.append(f"{filename}:{qid}: option '{letter}' is empty")
            elif value in ("—", "-", "–"):
                violations.append(f"{filename}:{qid}: option '{letter}' is a placeholder dash")
            elif SCRATCH_RE.search(value):
                violations.append(
                    f"{filename}:{qid}: option '{letter}' contains unfinished working: {value!r}"
                )

    difficulty = question.get("difficulty")
    if difficulty is not None:
        if not isinstance(difficulty, (int, float)) or not (DIFFICULTY_MIN <= difficulty <= DIFFICULTY_MAX):
            violations.append(
                f"{filename}:{qid}: difficulty {difficulty!r} out of range [{DIFFICULTY_MIN}, {DIFFICULTY_MAX}]"
            )

    technique = question.get("technique")
    if technique is not None and not str(technique).strip():
        violations.append(f"{filename}:{qid}: technique is empty")

    return violations


def main():
    files = sorted(glob.glob(str(QUESTION_BANK / "*.json")))
    if not files:
        print(f"No question-bank files found at {QUESTION_BANK}", file=sys.stderr)
        sys.exit(1)

    all_violations = []
    seen_ids = {}
    merged = []
    excluded = 0

    for filepath in files:
        filename = Path(filepath).name
        with open(filepath, encoding="utf-8") as fh:
            questions = json.load(fh)

        for question in questions:
            violations = validate(question, filename, seen_ids)
            all_violations.extend(violations)
            if question.get("needs_repair"):
                excluded += 1
                continue
            merged.append({
                "id": question.get("id"),
                "source": question.get("source"),
                "year": question.get("year"),
                "paper": question.get("paper"),
                "module": question.get("module"),
                "topic": question.get("topic"),
                "subtopic": question.get("subtopic"),
                "difficulty": question.get("difficulty"),
                "question": question.get("question"),
                "options": question.get("options"),
                "answer": question.get("answer"),
                "technique": question.get("technique"),
                "origin": question.get("origin"),
                "quality_tier": question.get("quality_tier"),
                "spec_status": question.get("spec_status"),
            })

    if all_violations:
        print(f"MERGE FAILED — {len(all_violations)} validation violation(s):\n", file=sys.stderr)
        for v in all_violations:
            print(f"  - {v}", file=sys.stderr)
        sys.exit(1)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, indent=2)

    print(f"Merged {len(merged)} questions from {len(files)} files -> {OUTPUT}")
    print(f"Excluded {excluded} questions flagged needs_repair (kept in question-bank/ for repair)\n")

    by_module = defaultdict(int)
    by_module_topic = defaultdict(lambda: defaultdict(int))
    for q in merged:
        by_module[q["module"]] += 1
        by_module_topic[q["module"]][q["topic"]] += 1

    print(f"{'Module':<12} {'Topic':<24} {'Count':>5}")
    print("-" * 43)
    for module in sorted(MODULE_TOPICS):
        topics = by_module_topic.get(module, {})
        print(f"{module:<12} {'(total)':<24} {by_module.get(module, 0):>5}")
        for topic in sorted(MODULE_TOPICS[module]):
            count = topics.get(topic, 0)
            print(f"{'':<12} {topic:<24} {count:>5}")
    print("-" * 43)
    print(f"{'TOTAL':<12} {'':<24} {len(merged):>5}")


if __name__ == "__main__":
    main()
