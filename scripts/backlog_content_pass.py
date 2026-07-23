"""
Backlog content pass (notes excluded):
  - tag spec_status for every bank question
  - author maths1 hints from first solution step (no option letters)
  - generate thin-topic fillers (origin: generated)
  - structural answer-value audit report

Usage: python scripts/backlog_content_pass.py
Then: python scripts/merge.py
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QB = ROOT / "question-bank"
REPORT = ROOT / "scripts" / ".content_pass" / "answer_value_audit.json"

# ESAT topic ids from src/lib/moduleMap.js — keep in sync manually.
ESAT_TOPICS = {
    "m1-units", "m1-number", "m1-ratio", "m1-algebra", "m1-geometry", "m1-stats", "m1-probability",
    "m2-algebra", "m2-sequences", "m2-coord-geom", "m2-trig", "m2-exp-log", "m2-differentiation",
    "m2-integration", "m2-graphs",
    "phy-electricity", "phy-magnetism", "phy-mechanics", "phy-thermal", "phy-matter", "phy-waves",
    "phy-radioactivity",
    "chem-atomic", "chem-periodic", "chem-reactions", "chem-quant", "chem-redox", "chem-bonding",
    "chem-groups", "chem-separation", "chem-acids", "chem-rates", "chem-energetics", "chem-electrolysis",
    "chem-organic", "chem-metals", "chem-kinetic", "chem-tests", "chem-air-water",
    "bio-cells", "bio-membranes", "bio-cell-division", "bio-inheritance",
    "bio-dna", "bio-gene-tech", "bio-variation", "bio-enzymes",
    "bio-animal-physiology", "bio-ecosystems", "bio-plant-physiology",
}

OPTION_LETTER_RE = re.compile(r"\b(?:option|answer)\s+[A-H]\b|\b[A-H]\s*\)", re.I)
SCRATCH_RE = re.compile(
    r"garbled|reconstructed|could not be|PDF extraction|as printed in the original|illegible|\[NOTE:",
    re.I,
)

THIN_GENERATED = [
    {
        "id": "GEN-CHEM-KINETIC-001",
        "source": "ESATprep",
        "year": 2026,
        "paper": "generated",
        "module": "chemistry",
        "topic": "chem-kinetic",
        "subtopic": "Particle model / states of matter",
        "difficulty": 2,
        "origin": "generated",
        "quality_tier": 1,
        "spec_status": "on_spec",
        "question": "In the particle model of matter, which statement correctly compares a liquid with a gas of the same substance at the same temperature?",
        "options": {
            "A": "Particles in the liquid have no kinetic energy; particles in the gas do.",
            "B": "Particles in the liquid are typically closer together than particles in the gas.",
            "C": "Particles in the liquid move only by vibration about fixed positions.",
            "D": "Particles in the gas have stronger intermolecular forces than in the liquid.",
            "E": "The average kinetic energy of particles is higher in the liquid than in the gas.",
        },
        "answer": "B",
        "hint": "Compare spacing and freedom of movement, not temperature.",
        "solution": {
            "steps": [
                {
                    "title": "Recall the particle model",
                    "content": "In a liquid, particles are close (touching neighbours) but can move past each other. In a gas at the same temperature, particles are much farther apart on average.",
                },
                {
                    "title": "Eliminate distractors",
                    "content": "Average kinetic energy depends on temperature, so it is the same for liquid and gas at the same temperature. Liquids are not fixed-lattice solids. Intermolecular forces are stronger in liquids than gases.",
                },
            ]
        },
    },
    {
        "id": "GEN-CHEM-KINETIC-002",
        "source": "ESATprep",
        "year": 2026,
        "paper": "generated",
        "module": "chemistry",
        "topic": "chem-kinetic",
        "subtopic": "Brownian motion",
        "difficulty": 3,
        "origin": "generated",
        "quality_tier": 1,
        "spec_status": "on_spec",
        "question": "Brownian motion of smoke particles in air is best explained by:",
        "options": {
            "A": "smoke particles being electrically charged and repelling each other",
            "B": "uneven bombardment of smoke particles by fast-moving air molecules",
            "C": "convection currents caused only by temperature differences in the room",
            "D": "gravity pulling denser smoke particles downward in zig-zag paths",
            "E": "smoke particles absorbing light and heating unevenly",
        },
        "answer": "B",
        "hint": "Think about collisions with invisible air molecules.",
        "solution": {
            "steps": [
                {
                    "title": "Link observation to molecular collisions",
                    "content": "Smoke particles are large enough to see but small enough that random collisions with air molecules are unbalanced at any instant, producing a jittery path.",
                },
                {
                    "title": "Why not the alternatives",
                    "content": "Charge, convection, gravity, and heating can move particles, but they do not explain the characteristic random zig-zag of Brownian motion.",
                },
            ]
        },
    },
    {
        "id": "GEN-CHEM-KINETIC-003",
        "source": "ESATprep",
        "year": 2026,
        "paper": "generated",
        "module": "chemistry",
        "topic": "chem-kinetic",
        "subtopic": "Gas pressure",
        "difficulty": 2,
        "origin": "generated",
        "quality_tier": 1,
        "spec_status": "on_spec",
        "question": "According to the kinetic theory of gases, gas pressure on a container wall arises mainly from:",
        "options": {
            "A": "attractive forces between gas particles and the wall",
            "B": "particles colliding with the wall and changing momentum",
            "C": "particles vibrating within a fixed crystal lattice",
            "D": "electrons flowing from the gas into the wall",
            "E": "the weight of the gas resting on the bottom of the container only",
        },
        "answer": "B",
        "hint": "Pressure is force per area — what force do particles exert on the wall?",
        "solution": {
            "steps": [
                {
                    "title": "Momentum change at the wall",
                    "content": "Each collision with the wall changes the particle's momentum; the rate of momentum change is a force. Averaged over many collisions, this is the gas pressure.",
                },
                {
                    "title": "Check the claim",
                    "content": "Attraction, lattice vibration, electron flow, and weight-only pictures do not match the kinetic-theory account of pressure throughout the gas.",
                },
            ]
        },
    },
    {
        "id": "GEN-CHEM-AIR-001",
        "source": "ESATprep",
        "year": 2026,
        "paper": "generated",
        "module": "chemistry",
        "topic": "chem-air-water",
        "subtopic": "Composition of air",
        "difficulty": 1,
        "origin": "generated",
        "quality_tier": 1,
        "spec_status": "on_spec",
        "question": "Which gas makes up the largest percentage by volume of dry air?",
        "options": {
            "A": "Oxygen",
            "B": "Carbon dioxide",
            "C": "Nitrogen",
            "D": "Argon",
            "E": "Hydrogen",
        },
        "answer": "C",
        "hint": "Recall the approximate percentages of the main gases in air.",
        "solution": {
            "steps": [
                {
                    "title": "Recall dry-air composition",
                    "content": "Dry air is roughly 78% nitrogen, 21% oxygen, ~1% argon, and a small fraction of carbon dioxide and other gases.",
                },
                {
                    "title": "Select the majority component",
                    "content": "Nitrogen is by far the largest component by volume.",
                },
            ]
        },
    },
    {
        "id": "GEN-M1-UNITS-001",
        "source": "ESATprep",
        "year": 2026,
        "paper": "generated",
        "module": "maths1",
        "topic": "m1-units",
        "subtopic": "SI prefixes",
        "difficulty": 1,
        "origin": "generated",
        "quality_tier": 1,
        "spec_status": "on_spec",
        "question": "How many millimetres are there in $2.5$ metres?",
        "options": {
            "A": "25",
            "B": "250",
            "C": "2500",
            "D": "25000",
            "E": "0.0025",
        },
        "answer": "C",
        "hint": "Convert metres to millimetres using powers of ten.",
        "solution": {
            "steps": [
                {
                    "title": "Use the milli prefix",
                    "content": "$1\\,\\mathrm{m} = 1000\\,\\mathrm{mm}$, so $2.5\\,\\mathrm{m} = 2.5 \\times 1000 = 2500\\,\\mathrm{mm}$.",
                },
                {
                    "title": "Check scale",
                    "content": "A few metres should be thousands of millimetres, not tens or hundred-thousands.",
                },
            ]
        },
    },
]


def load_bank():
    files = sorted(QB.glob("*_S1.json"))
    return {p: json.load(open(p, encoding="utf-8")) for p in files}


def save_bank(bank):
    for p, qs in bank.items():
        json.dump(qs, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        p.write_text(p.read_text(encoding="utf-8") + "\n", encoding="utf-8")


def first_hint(q: dict) -> str | None:
    sol = q.get("solution") or {}
    steps = sol.get("steps") or []
    if not steps:
        return None
    step = steps[0]
    text = (step.get("content") if isinstance(step, dict) else str(step)) or ""
    text = re.sub(r"\s+", " ", text).strip()
    # First sentence-ish, capped
    cut = re.split(r"(?<=[.!?])\s+", text)[0]
    cut = cut[:180].rstrip(" ,;:")
    if not cut or OPTION_LETTER_RE.search(cut):
        sub = q.get("subtopic") or q.get("topic")
        return f"Start from the {sub} idea in the stem." if sub else None
    # Soften into a nudge
    if not cut.lower().startswith(("consider", "start", "try", "use", "look", "rewrite", "factor", "set")):
        cut = "First move: " + cut[0].lower() + cut[1:] if cut else cut
    return cut


def tag_and_hint(bank):
    hinted = tagged = 0
    for qs in bank.values():
        for q in qs:
            topic = q.get("topic")
            if topic in ESAT_TOPICS:
                if q.get("spec_status") in (None, "", "null"):
                    q["spec_status"] = "on_spec"
                    tagged += 1
            elif q.get("spec_status") in (None, "", "null"):
                q["spec_status"] = "off_spec"
                tagged += 1

            if q.get("module") == "maths1" and not (q.get("hint") or "").strip():
                h = first_hint(q)
                if h:
                    q["hint"] = h
                    hinted += 1
    return tagged, hinted


def add_generated(bank):
    # Prefer ENGAA_2023_S1 as a home for generated chem/maths fillers — or a dedicated file.
    # Store in a new bank file so past-paper papers stay clean.
    path = QB / "GENERATED_FILLERS.json"
    existing_ids = set()
    for qs in bank.values():
        for q in qs:
            existing_ids.add(q["id"])
    to_add = [q for q in THIN_GENERATED if q["id"] not in existing_ids]
    if path.exists():
        current = json.load(open(path, encoding="utf-8"))
    else:
        current = []
    have = {q["id"] for q in current}
    for q in to_add:
        if q["id"] not in have:
            current.append(q)
    json.dump(current, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    path.write_text(path.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    return len(to_add), path.name


def leak_scan(bank):
    leaks = []
    for qs in bank.values():
        for q in qs:
            if q.get("needs_repair"):
                continue
            blob = " ".join(
                [
                    str(q.get("question", "")),
                    str(q.get("technique", "")),
                    json.dumps(q.get("options") or {}),
                    json.dumps(q.get("solution") or {}),
                    str(q.get("hint") or ""),
                ]
            )
            if SCRATCH_RE.search(blob):
                leaks.append(q["id"])
    return leaks


def answer_audit(bank):
    issues = []
    for qs in bank.values():
        for q in qs:
            opts = q.get("options") or {}
            ans = q.get("answer")
            if ans not in opts:
                issues.append({"id": q["id"], "issue": "answer_letter_missing", "answer": ans})
                continue
            val = opts[ans]
            if val is None or str(val).strip() == "":
                issues.append({"id": q["id"], "issue": "empty_answer_value", "answer": ans})
            # Duplicate option values can make letter adjudication ambiguous
            counts = Counter(str(v) for v in opts.values())
            if counts[str(val)] > 1:
                issues.append({"id": q["id"], "issue": "duplicate_correct_value", "value": val})
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    json.dump({"issues": issues, "count": len(issues)}, open(REPORT, "w", encoding="utf-8"), indent=2)
    return issues


def sync_paper_qnums():
    out = {}
    for p in sorted((QB / "id-qnum-mapping").glob("*_S1.json")):
        out[p.stem] = json.load(open(p, encoding="utf-8"))
    dest = ROOT / "src" / "data" / "paperQnums.json"
    json.dump(out, open(dest, "w", encoding="utf-8"), indent=2)
    dest.write_text(dest.read_text(encoding="utf-8") + "\n", encoding="utf-8")


def main():
    # Ensure merge.py picks up GENERATED_FILLERS.json — check merge glob
    bank = load_bank()
    tagged, hinted = tag_and_hint(bank)
    save_bank(bank)
    added, gen_file = add_generated(bank)
    leaks = leak_scan(bank)
    # Also scan generated file
    gen_path = QB / "GENERATED_FILLERS.json"
    if gen_path.exists():
        leaks += leak_scan({gen_path: json.load(open(gen_path, encoding="utf-8"))})
    issues = answer_audit({**bank, gen_path: json.load(open(gen_path, encoding="utf-8"))} if gen_path.exists() else bank)
    sync_paper_qnums()
    print(f"spec_status updates: {tagged}")
    print(f"maths1 hints added: {hinted}")
    print(f"generated fillers added: {added} -> {gen_file}")
    print(f"commentary leaks: {len(leaks)}")
    if leaks:
        print("  ", ", ".join(leaks[:20]))
    print(f"answer-value issues: {len(issues)} (see {REPORT})")


if __name__ == "__main__":
    main()
