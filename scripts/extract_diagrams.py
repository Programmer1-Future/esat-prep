#!/usr/bin/env python3
"""Regenerate diagram crops from the source PDFs, deterministically.

The source PDFs have scrambled embedded text layers, so we OCR the rendered
pages (glyph positions are fine but reading order is jumbled). OCR reads *stem
prose* reliably but is weak on tiny isolated margin digits, so questions are
located by matching stem text, not by reading the printed number.

Per paper:
  1. OCR every page (cached to scripts/.ocr_cache/<paper>.json).
  2. A diagram is DRAWN INK, not text: on each page white-out the OCR text boxes
     and take contiguous residual-ink bands -> candidate figure regions (whole
     figures, arrows/labels included).
  3. Associate each figure to a question by matching the OCR stem text just above
     it to the JSON question stems. Crop the ORIGINAL render (labels survive).
  A JSON [DIAGRAM] question that matches no ink region has no real figure (the tag
  is a misfiled note) -> reported for tag removal.

Outputs to public/diagrams_v2/ + a JSON report. Never touches public/diagrams/.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

import numpy as np
import pypdfium2 as pdfium
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parent.parent
QB = ROOT / "question-bank"
MAP_DIR = QB / "id-qnum-mapping"
PDF_DIR = QB / "source-pdfs"
OUT_DIR = ROOT / "public" / "diagrams_v2"
REPORT = ROOT / "scripts" / "diagram_extract_report.json"
CACHE_DIR = ROOT / "scripts" / ".ocr_cache"

SCALE = 3.0            # crop render resolution
OCR_SCALE = 2.0        # OCR render resolution (lower = less memory); boxes scaled to SCALE
DIAGRAM_RE = re.compile(r"\[DIAGRAM:", re.I)
INK_THRESH = 160
MIN_INK_ROWS = 3
MARGIN_FRAC = 0.05
MIN_FIG_HFRAC = 0.035      # a figure band must be at least this tall (frac of page)
CROP_PAD = 16
STEM_LOOKUP = 0.16         # gather stem text within this frac of page height above a figure

_ocr = None


def ocr_engine():
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    return _ocr


def pdf_for(paper: str):
    hits = list(PDF_DIR.glob(f"{paper}_*.pdf"))
    return hits[0] if hits else None


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def ocr_paper(paper: str, pdf):
    """Return list (per page) of boxes [x0,y0,x1,y1,text], with disk cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache = CACHE_DIR / f"{paper}.json"
    if cache.exists():
        return json.load(open(cache, encoding="utf-8"))
    eng = ocr_engine()
    ratio = SCALE / OCR_SCALE   # OCR at lower res (memory), store boxes in SCALE space
    pages = []
    for pi in range(len(pdf)):
        img = pdf[pi].render(scale=OCR_SCALE).to_pil().convert("RGB")
        try:
            res, _ = eng(np.asarray(img))
        except Exception as e:
            print(f"    ocr page {pi+1} FAILED ({e}); skipping", flush=True)
            res = None
        boxes = []
        for box, txt, _c in (res or []):
            xs = [p[0] for p in box]; ys = [p[1] for p in box]
            boxes.append([min(xs) * ratio, min(ys) * ratio, max(xs) * ratio, max(ys) * ratio, txt])
        pages.append(boxes)
        del img
        print(f"    ocr page {pi+1}/{len(pdf)}", flush=True)
    json.dump(pages, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
    return pages


def ink_bands(img: Image.Image, boxes):
    """Return list of figure bboxes (x0,y0,x1,y1) px. Erase text, then use
    connected components on the residual ink so a figure is one 2D blob and
    thin rules / stray marks are rejected by size filters."""
    import cv2
    arr = np.asarray(img.convert("RGB")).copy()
    H, W, _ = arr.shape
    for x0, y0, x1, y1, _t in boxes:
        arr[max(0, int(y0) - 2):int(y1) + 2, max(0, int(x0) - 2):int(x1) + 2] = 255
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    ink = (gray < INK_THRESH).astype(np.uint8)
    mbx = int(MARGIN_FRAC * W); mby = int(MARGIN_FRAC * H)
    ink[:mby] = 0; ink[H - mby:] = 0; ink[:, :mbx] = 0; ink[:, W - mbx:] = 0
    # connect strokes of one figure into a single blob
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (23, 23))
    dil = cv2.dilate(ink, k, iterations=1)
    n, _lbl, stats, _c = cv2.connectedComponentsWithStats(dil, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, _area = stats[i]
        if w < 0.09 * W or h < MIN_FIG_HFRAC * H:      # thin rule / tiny mark
            continue
        if w < 0.14 * W and h < 0.10 * H:              # tiny both ways
            continue
        if w > 0.97 * W and h > 0.93 * H:              # whole page
            continue
        sub = ink[y:y + h, x:x + w]
        if sub.sum() < 0.0009 * W * H:                 # too sparse to be a figure
            continue
        ys, xs = np.where(sub > 0)                     # tighten to real ink
        out.append((int(x + xs.min()), int(y + ys.min()),
                    int(x + xs.max()), int(y + ys.max())))
    return out


def text_inside(fig, boxes):
    """OCR text contained within an ink blob (its own labels / cells)."""
    x0, y0, x1, y1 = fig
    return " ".join(t for bx0, by0, bx1, by1, t in boxes
                    if bx0 >= x0 - 6 and bx1 <= x1 + 6 and by0 >= y0 - 6 and by1 <= y1 + 6)


def text_rows_inside(fig, boxes, tol=14):
    """Number of distinct horizontal text rows inside a blob. An options table
    stacks ~8 option rows; a labelled figure has only a few scattered labels, so
    this separates the two even when they share the same numbers."""
    x0, y0, x1, y1 = fig
    ys = sorted((by0 + by1) / 2 for bx0, by0, bx1, by1, _t in boxes
                if bx0 >= x0 - 6 and bx1 <= x1 + 6 and by0 >= y0 - 6 and by1 <= y1 + 6)
    rows, last = 0, None
    for y in ys:
        if last is None or y - last > tol:
            rows += 1
            last = y
    return rows


def looks_like_options(blob_text: str, options: dict) -> float:
    """How much of a question's OPTION VALUES appear inside this blob. High =>
    the blob is the multiple-choice options table, which duplicates the JSON
    options. The UI shuffles and re-letters options, so showing the paper's
    table would contradict the buttons — such blobs must never be the diagram.
    A data table the student must READ won't echo the option values like this."""
    if not isinstance(options, dict) or len(options) < 3:
        return 0.0
    want = set()
    for v in options.values():
        want |= set(re.findall(r"\d+(?:\.\d+)?", str(v)))
        want |= words(str(v))
    if len(want) < 3:
        return 0.0
    have = set(re.findall(r"\d+(?:\.\d+)?", blob_text)) | words(blob_text)
    return len(want & have) / len(want)


def stem_above(boxes, fig, W, H):
    """OCR prose around a figure (above and below) as its matching context. The
    describing sentence may sit either side of the figure, so use both."""
    fx0, fy0, fx1, fy1 = fig
    picked = [(y0, x0, t) for x0, y0, x1, y1, t in boxes
              if (fy0 - STEM_LOOKUP * H <= y0 < fy0 or fy1 < y0 <= fy1 + STEM_LOOKUP * H)
              and x0 > 0.10 * W]
    picked.sort()
    return " ".join(t for _y, _x, t in picked)


_STOP = {"which", "what", "following", "diagram", "shown", "figure", "shows",
         "value", "that", "this", "with", "from", "have", "there", "they",
         "their", "into", "then", "when", "where", "each", "some", "such",
         "these", "those", "will", "would", "about", "above", "below",
         # running page headers on the papers — pure noise for matching
         "part", "section", "mathematics", "physics", "chemistry", "biology",
         "advanced", "scale"}


def words(s: str) -> set:
    return {w for w in re.findall(r"[a-z]{4,}", (s or "").lower()) if w not in _STOP}


def score(ocr_stem: str, json_stem: str) -> float:
    """Overlap coefficient between the figure's surrounding OCR prose and the
    JSON stem: |shared| / min(|a|,|b|). Normalising by the SMALLER set means a
    correct match isn't punished when the OCR context also sweeps up a page
    header or a neighbouring question — which plain precision/Jaccard does."""
    ow, jw = words(ocr_stem), words(json_stem)
    if len(ow) < 2 or len(jw) < 2:
        return 0.0
    return len(ow & jw) / min(len(ow), len(jw))


def process_paper(paper, diagram_qs, report):
    pdf_path = pdf_for(paper)
    if not pdf_path:
        for q in diagram_qs:
            report["unmapped"].append({"id": q["id"], "reason": "no pdf"})
        return
    pdf = pdfium.PdfDocument(str(pdf_path))
    pages = ocr_paper(paper, pdf)

    # collect every candidate figure across the paper, with its stem text.
    # Do NOT retain page images (memory) — re-render lazily when cropping.
    figures = []
    for pi in range(len(pdf)):
        img = pdf[pi].render(scale=SCALE).to_pil().convert("RGB")
        W, H = img.size
        for fig in ink_bands(img, pages[pi]):
            figures.append({"page": pi, "bbox": fig, "wh": (W, H),
                            "stem": stem_above(pages[pi], fig, W, H),
                            "text": text_inside(fig, pages[pi]),
                            "rows": text_rows_inside(fig, pages[pi])})
        del img

    # Some questions ARE answered by picking a picture ("Options A-G show
    # different...", "eight candidate velocity-time graphs"). For those the
    # options block IS the figure, so the options-table rejection must be off —
    # otherwise we discard the only thing that makes the question answerable.
    OPTION_FIGURE = re.compile(
        r"candidate|options?\s+[A-H]\s*(?:-|–|to)\s*[A-H]|answer options", re.I)
    wanted = []
    for q in diagram_qs:
        raw = str(q.get("question", ""))
        cap = re.search(r"\[DIAGRAM:([^\]]*)\]", raw, re.I)
        # Keep the caption in the matching text. It DESCRIBES the figure we are
        # hunting, and for figure-heavy questions it carries nearly all the
        # distinctive wording — e.g. NSAA-2023-M1-005's stem is only "What is the
        # area of triangle MNP?" while the caption holds "Square WXYZ of side
        # length 1, points M on WX, N on XY". Stripping it starved the match.
        stem = re.sub(r"\[DIAGRAM:.*?\]", " ", raw) + " " + (cap.group(1) if cap else "")
        wanted.append({"id": q["id"], "stem": stem, "options": q.get("options"),
                       "option_figure": bool(cap and OPTION_FIGURE.search(cap.group(1)))})

    # global greedy over all (figure, question) pairs: assign the strongest
    # matches first so no question can steal a blob another matches better.
    # Tie-break toward the topmost blob (a diagram precedes its options table).
    THRESH = 0.34
    pairs = []
    # A real options table reproduces EVERY option value (~1.0). A labelled
    # figure can coincidentally echo many of them (measured up to 0.86 on
    # NSAA-2016-PHY-025), so the bar must sit above that.
    OPTS_MAX = 0.92
    for fi, fig in enumerate(figures):
        for qi, q in enumerate(wanted):
            s = score(fig["stem"], q["stem"])
            # only reject as an options table when it BOTH echoes the option
            # values AND is stacked like a table — a labelled figure may share
            # the numbers but has few text rows.
            is_table = (not q["option_figure"]
                        and looks_like_options(fig["text"], q["options"]) >= OPTS_MAX
                        and fig["rows"] >= 5)
            if s >= THRESH and not is_table:
                pairs.append((s, -(figures[fi]["page"] * 100000 + figures[fi]["bbox"][1]), fi, qi))
    pairs.sort(reverse=True)
    assign, used_f, used_q = {}, set(), set()
    for s, _tb, fi, qi in pairs:
        if fi in used_f or qi in used_q:
            continue
        assign[qi] = (fi, s); used_f.add(fi); used_q.add(qi)

    # Fallback for anything stem-matching couldn't place. Matching against text
    # NEAR a blob fails when a figure has little surrounding prose (picture-option
    # questions especially). OCR reads whole pages accurately, so instead find the
    # PAGE whose full text matches the stem, then take the largest unused blob on
    # it. Page text is far more distinctive than a blob's neighbourhood.
    PAGE_MIN = 0.55
    page_text = [" ".join(t for _a, _b, _c, _d, t in boxes) for boxes in pages]
    for qi, q in enumerate(wanted):
        if qi in assign:
            continue
        best = max(((score(page_text[pi], q["stem"]), pi) for pi in range(len(page_text))),
                   default=(0.0, None))
        if best[1] is None or best[0] < PAGE_MIN:
            continue
        pi = best[1]
        cands = [((f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1]), fi)
                 for fi, f in enumerate(figures) if fi not in used_f and f["page"] == pi]
        if cands:
            fi = max(cands)[1]
            assign[qi] = (fi, round(best[0], 2)); used_f.add(fi)
            report.setdefault("by_page", []).append(
                {"id": q["id"], "page": pi + 1, "match": round(best[0], 2)})

    rendered = {}
    for qi, q in enumerate(wanted):
        if qi not in assign:
            report["no_figure"].append({"id": q["id"], "reason": "no matching ink region"})
            continue
        fi, s = assign[qi]
        fig = figures[fi]
        if fig["page"] not in rendered:
            rendered[fig["page"]] = pdf[fig["page"]].render(scale=SCALE).to_pil().convert("RGB")
        img = rendered[fig["page"]]; W, H = img.size
        x0, y0, x1, y1 = fig["bbox"]
        # absorb side labels just outside the ink box (30 cm, microphone, ...)
        # generous horizontally, tight vertically so stem lines aren't swallowed
        rx, ry = 0.03 * W, 0.006 * H
        for bx0, by0, bx1, by1, _t in pages[fig["page"]]:
            if bx1 >= x0 - rx and bx0 <= x1 + rx and by1 >= y0 - ry and by0 <= y1 + ry:
                x0 = min(x0, bx0); y0 = min(y0, by0)
                x1 = max(x1, bx1); y1 = max(y1, by1)
        crop = img.crop((max(0, int(x0) - CROP_PAD), max(0, int(y0) - CROP_PAD),
                         min(W, int(x1) + CROP_PAD), min(H, int(y1) + CROP_PAD)))
        crop.save(OUT_DIR / f"{q['id']}.png")
        report["figures"].append({"id": q["id"], "page": fig["page"] + 1,
                                  "size": list(crop.size), "match": round(s, 2)})
    # figures that matched nothing (possible extra/mislabeled)
    for fi, fig in enumerate(figures):
        if fi not in used_f:
            report["orphan_figures"].append({"page": fig["page"] + 1,
                                             "stem": fig["stem"][:60]})
    pdf.close()


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    report = {"figures": [], "no_figure": [], "unmapped": [], "orphan_figures": []}
    for qb_file in sorted(QB.glob("*.json")):
        paper = qb_file.stem
        if only and only not in paper:
            continue
        questions = json.load(open(qb_file, encoding="utf-8"))
        diagram_qs = [q for q in questions if DIAGRAM_RE.search(str(q.get("question", "")))]
        if not diagram_qs:
            continue
        print(f"[{paper}] {len(diagram_qs)} diagram questions ...", flush=True)
        process_paper(paper, diagram_qs, report)

    # per-paper runs write their own report so a subprocess loop can merge later
    out = CACHE_DIR / f"report_{only}.json" if only else REPORT
    json.dump(report, open(out, "w", encoding="utf-8"), indent=2)
    print(f"\nfigures written : {len(report['figures'])}")
    print(f"no-figure (strip tag): {len(report['no_figure'])}")
    print(f"orphan figures  : {len(report['orphan_figures'])}")
    print(f"unmapped        : {len(report['unmapped'])}")


if __name__ == "__main__":
    main()
