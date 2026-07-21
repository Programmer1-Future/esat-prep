#!/usr/bin/env python3
"""Transcribe past-paper questions with the Gemini API, for the fabrication audit.

Some questions in the bank were invented rather than transcribed from the papers
(proven: ENGAA-2023-M2-008). We ask Gemini for a VERBATIM transcription rather than
a verdict, because a model asked "is this real?" drifts toward agreeing, and a
confident fabrication is exactly the case that fools it. A transcription can be
diffed mechanically; a verdict can only be trusted.

Every chunk is cached to disk. Tokens cost real money, so a crash, a rate-limit or
a re-run must never re-buy a response we already have.

Usage:
    python scripts/gemini_transcribe.py --list-models
    python scripts/gemini_transcribe.py --paper ENGAA_2016_S1
    python scripts/gemini_transcribe.py --all [--dry-run]

The API key is read from .env (GEMINI_API_KEY=...) or the environment. It is never
passed on the command line, where it would land in shell history.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
PDFS = ROOT / "question-bank" / "source-pdfs"
MAP_DIR = ROOT / "question-bank" / "id-qnum-mapping"
CACHE = ROOT / "scripts" / ".fabrication_audit" / "gemini"

API = "https://generativelanguage.googleapis.com/v1beta"
USAGE: list[dict] = []   # per-request token counts, so spend is visible not guessed
FAILED: list[str] = []   # chunks abandoned; a bad chunk must not abort the census
# Pro is quota-blocked on this key (429 with zero quota on both 2.5 and 3.x), and
# Flash is ~10x cheaper anyway. A whole paper is only ~9k input tokens, so the full
# 16-paper census costs a couple of dollars.
DEFAULT_MODEL = "gemini-3.5-flash"
# Free tier grants 20 requests/day PER MODEL, so several models together carry the
# whole census without billing. Ordered strongest first; each chunk records the model
# that produced it, so rotation stays auditable.
MODELS = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
]
CHUNK = 15          # questions per request; keeps output under the token ceiling
# Few retries, because a failing chunk is now split rather than merely repeated —
# doubling the backoff eight times would idle for twenty minutes to no purpose.
MAX_RETRIES = 4
MAX_DELAY = 40.0
PACE = 6.0         # seconds between requests; stay under the per-minute quota
# A chunk normally answers in well under a minute. A long patient timeout just means
# one hung socket burns ten minutes before retrying, so fail fast and retry more.
TIMEOUT = 180

PROMPT = """The attached PDF is the official {series} {year} Section 1 past paper.

Transcribe questions {lo} to {hi} EXACTLY as they appear in the paper.

Rules — these matter more than being helpful:
- Transcribe VERBATIM. Do not summarise, correct, paraphrase, modernise or tidy
  anything, even if the paper contains an obvious typo.
- Include every answer option, in the paper's original order, with its letter.
- Use LaTeX between $...$ for any mathematics.
- If a question has a diagram, do NOT describe it in the question text. Put a short
  description in the "diagram" field instead.
- If you cannot clearly read a question, or that question number does not exist in
  this paper, set "readable": false and leave the text empty. DO NOT guess or
  reconstruct it. An honest "I can't read it" is far more useful than a plausible
  reconstruction — I am specifically checking for invented content, so a confident
  guess actively defeats the purpose.

Return one entry for every number in the range, including unreadable ones."""

SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "qnum": {"type": "INTEGER"},
            "readable": {"type": "BOOLEAN"},
            "question": {"type": "STRING"},
            "options": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "letter": {"type": "STRING"},
                        "text": {"type": "STRING"},
                    },
                    "required": ["letter", "text"],
                },
            },
            "diagram": {"type": "STRING"},
        },
        "required": ["qnum", "readable", "question", "options"],
    },
}


def api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key.strip()
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            k, _, v = line.partition("=")
            if k.strip() == "GEMINI_API_KEY":
                return v.strip().strip('"').strip("'")
    sys.exit(
        "No GEMINI_API_KEY found.\n"
        f"Add a line to {env} :\n"
        "    GEMINI_API_KEY=your-key-here\n"
        ".env is gitignored, so the key stays out of the repo."
    )


def list_models(key: str) -> int:
    r = requests.get(f"{API}/models", params={"key": key}, timeout=60)
    r.raise_for_status()
    for m in r.json().get("models", []):
        if "generateContent" in m.get("supportedGenerationMethods", []):
            print(f"{m['name'].removeprefix('models/'):40} {m.get('displayName','')}")
    return 0


def max_qnum(paper: str) -> int:
    mf = MAP_DIR / f"{paper}.json"
    if not mf.exists():
        return 0
    nums = [v for v in json.load(open(mf, encoding="utf-8")).values() if isinstance(v, int)]
    return max(nums) if nums else 0


def transcribe(key: str, model: str, paper: str, pdf_b64: str,
               lo: int, hi: int) -> tuple:
    """Returns (rows, exhausted). `exhausted` means this model's daily quota is gone
    and the caller should switch models rather than retry."""
    series, year, _ = paper.split("_")
    body = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "application/pdf", "data": pdf_b64}},
                {"text": PROMPT.format(series=series, year=year, lo=lo, hi=hi)},
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": SCHEMA,
            "temperature": 0,
            # Reasoning tokens bill as output at $10/M. Verbatim transcription needs
            # none, but 2.5 Pro cannot be set to 0 — 128 is the floor.
            "thinkingConfig": {"thinkingBudget": 128},
        },
    }
    url = f"{API}/models/{model}:generateContent"
    delay = 5.0
    for attempt in range(MAX_RETRIES):
        # A hung socket raises rather than returning a response, so status-code
        # branching alone would let it escape the retry loop and kill the run.
        try:
            r = requests.post(url, params={"key": key}, json=body, timeout=TIMEOUT)
        except requests.RequestException as e:
            print(f"    {type(e).__name__}, retry in {delay:.0f}s "
                  f"({attempt + 1}/{MAX_RETRIES})", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, MAX_DELAY)
            continue
        if r.status_code == 200:
            payload = r.json()
            USAGE.append(payload.get("usageMetadata", {}))
            # Reasoning models emit multiple parts; a thought part can precede the
            # answer, so index by content rather than position.
            parts = payload["candidates"][0]["content"]["parts"]
            text = "".join(p["text"] for p in parts
                           if "text" in p and not p.get("thought"))
            return json.loads(text), False
        # Gemini 3 renamed the reasoning control. Rather than hardcode a guess at the
        # new field, drop it and take the model's default budget.
        if r.status_code == 400 and "thinking" in r.text.lower():
            if body["generationConfig"].pop("thinkingConfig", None) is not None:
                print("    (dropping thinkingConfig, unsupported by this model)",
                      flush=True)
                continue
        # A daily-quota 429 will not clear by waiting, so switching model beats
        # burning retries. A per-minute 429 is worth a backoff.
        if r.status_code == 429:
            if "PerDay" in r.text or "free_tier" in r.text:
                print("daily quota gone for this model", flush=True)
                return None, True
            print(f"    429, retry in {delay:.0f}s "
                  f"({attempt + 1}/{MAX_RETRIES})", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, MAX_DELAY)
            continue
        if r.status_code in (500, 503, 504):
            print(f"    {r.status_code}, retry in {delay:.0f}s "
                  f"({attempt + 1}/{MAX_RETRIES})", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, MAX_DELAY)
            continue
        if r.status_code in (401, 403):
            sys.exit(f"HTTP {r.status_code} (auth/quota): {r.text[:400]}")
        print(f"    HTTP {r.status_code}: {r.text[:200]}", flush=True)
        return None, False
    return None, False


def run_paper(key: str, models: list, paper: str, dry: bool, chunk: int) -> None:
    pdf = PDFS / f"{paper}_QuestionPaper.pdf"
    if not pdf.exists():
        print(f"  {paper}: no PDF, skipped")
        return
    top = max_qnum(paper)
    if not top:
        print(f"  {paper}: no mapping, skipped")
        return

    out = CACHE / paper
    out.mkdir(parents=True, exist_ok=True)
    # Resume by which question NUMBERS are already cached, not by filename. A chunk
    # that failed and was split writes different filenames than the ones a fresh run
    # computes, so name-matching would silently re-buy work we already have.
    have = set()
    for f in out.glob("*.json"):
        have.update(r["qnum"] for r in json.load(open(f, encoding="utf-8")))

    chunks = [(lo, min(lo + chunk - 1, top)) for lo in range(1, top + 1, chunk)]
    todo = [(lo, hi) for lo, hi in chunks
            if not all(q in have for q in range(lo, hi + 1))]

    print(f"  {paper}: {top} questions, {len(chunks)} chunks, {len(todo)} to fetch")
    if dry or not todo:
        return

    pdf_b64 = base64.b64encode(pdf.read_bytes()).decode()
    queue = list(todo)
    first = True
    while queue:
        lo, hi = queue.pop(0)
        if not first:
            time.sleep(PACE)
        first = False
        print(f"    q{lo}-{hi} ...", end=" ", flush=True)

        # Quota is per-model per-day, so an exhausted model is a routing signal, not
        # a stop signal: move to the next one and retry the same chunk.
        rows = None
        while models:
            rows, exhausted = transcribe(key, models[0], paper, pdf_b64, lo, hi)
            if not exhausted:
                break
            print(f"    -> {models[0]} exhausted, switching", flush=True)
            models.pop(0)
        if not models:
            FAILED.append(f"{paper} q{lo}-{hi}")
            print("    all models exhausted for today", flush=True)
            return

        if rows is not None:
            # Record which model produced this chunk. Rotating models keeps the census
            # moving, but a discrepancy must be checkable against its source rather
            # than assumed to be a content problem.
            for r in rows:
                r["_model"] = models[0]

        if rows is None:
            # Retrying an identical request that keeps timing out just repeats the
            # same overlong generation. Halving it asks for less output, which is
            # usually what actually clears the failure.
            if hi > lo:
                mid = (lo + hi) // 2
                queue[:0] = [(lo, mid), (mid + 1, hi)]
                print(f"failed -> splitting into q{lo}-{mid}, q{mid + 1}-{hi}")
            else:
                FAILED.append(f"{paper} q{lo}")
                print("FAILED (skipped)")
            continue

        (out / f"q{lo:03d}-{hi:03d}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        got = sum(1 for r in rows if r.get("readable"))
        print(f"{got}/{len(rows)} readable")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-models", action="store_true")
    ap.add_argument("--paper", action="append", help="repeatable, e.g. ENGAA_2016_S1")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--model", default=",".join(MODELS),
                    help="comma-separated, tried in order. Free-tier quota is per "
                         "model per day, so listing several finishes the census "
                         "without paid billing.")
    ap.add_argument("--chunk", type=int, default=CHUNK,
                    help="questions per request. Free tier allows only 20 requests "
                         "per day per model, so a bigger chunk buys more per request.")
    ap.add_argument("--dry-run", action="store_true", help="show the plan, spend nothing")
    args = ap.parse_args()

    key = "" if args.dry_run else api_key()
    if args.list_models:
        return list_models(key)
    models = [m.strip() for m in args.model.split(",") if m.strip()]

    if args.all:
        papers = sorted(p.stem for p in MAP_DIR.glob("*_S1.json"))
    elif args.paper:
        papers = args.paper
    else:
        return ap.print_usage() or 2

    print(f"model: {args.model}{'  (dry run)' if args.dry_run else ''}")
    for i, paper in enumerate(papers):
        if i and not args.dry_run:
            time.sleep(PACE)
        run_paper(key, models, paper, args.dry_run, args.chunk)

    if USAGE:
        pin = sum(u.get("promptTokenCount", 0) for u in USAGE)
        pout = sum(u.get("candidatesTokenCount", 0) for u in USAGE)
        think = sum(u.get("thoughtsTokenCount", 0) for u in USAGE)
        print(f"\n{len(USAGE)} requests | in {pin:,} | out {pout:,} | thinking {think:,}")
    if FAILED:
        print(f"\n{len(FAILED)} questions could not be fetched: {', '.join(FAILED)}")
    print(f"cache: {CACHE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
