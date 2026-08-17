#!/usr/bin/env python3
"""Extract layout-preserving text from a BIEK gazette PDF for parsing.

Usage:
    python tools/extract_layout.py "path/to/gazette.pdf" [output.txt]
"""
import sys
from pathlib import Path

import pdfplumber

PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    r"C:\Users\Quaid\Downloads\HSC PART-II-RESULT-GAZETTE-PRE-ENGINEERING-ANNUAL-2026-COMPLETE.pdf"
)
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("gazette_layout.txt")

with pdfplumber.open(str(PDF)) as pdf:
    total = len(pdf.pages)
    print(f"Total pages: {total}")
    with OUT.open("w", encoding="utf-8") as fh:
        for i, page in enumerate(pdf.pages, start=1):
            try:
                text = page.extract_text(layout=True) or ""
            except Exception as exc:  # noqa: BLE001
                text = f"[ERROR page {i}: {exc}]"
            fh.write(f"\n========== PAGE {i} ==========\n")
            fh.write(text)
            if i % 30 == 0 or i == total:
                print(f"  {i}/{total}")
print(f"Done -> {OUT.resolve()}")