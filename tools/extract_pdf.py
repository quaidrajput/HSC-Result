#!/usr/bin/env python3
"""Extract text from BIEK HSC Part-II 2026 gazette PDF into a readable text file."""
import sys
from pathlib import Path

from pypdf import PdfReader


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        r"C:\Users\Quaid\Downloads\HSC PART-II-RESULT-GAZETTE-PRE-ENGINEERING-ANNUAL-2026-COMPLETE.pdf"
    )
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("gazette_text.txt")

    reader = PdfReader(str(pdf_path))
    total = len(reader.pages)
    print(f"Total pages: {total}")

    with out_path.open("w", encoding="utf-8") as fh:
        for i, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception as exc:  # noqa: BLE001
                text = f"[ERROR extracting page {i}: {exc}]"
            fh.write(f"\n========== PAGE {i} ==========\n")
            fh.write(text)
            if i % 25 == 0 or i == total:
                print(f"  processed {i}/{total}")

    print(f"Done. Output -> {out_path.resolve()}")


if __name__ == "__main__":
    main()