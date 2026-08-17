#!/usr/bin/env python3
"""Parse a layout-preserving BIEK gazette text file into structured JSON.

Usage:
    python tools/parse_gazette.py [gazette_layout.txt] [data_dir] [--pages 29-151] [--withheld-pages 152-153]
"""
import argparse
import json
import re
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("layout", nargs="?", default="gazette_layout.txt")
ap.add_argument("data_dir", nargs="?", default="data")
ap.add_argument("--pages", default="29-151", help="Result page range, e.g. 29-151")
ap.add_argument("--withheld-pages", default="152-153", help="Withheld page range, e.g. 152-153")
args = ap.parse_args()

LAYOUT = Path(args.layout)
DATA_DIR = Path(args.data_dir)
OUT_RESULTS = DATA_DIR / "results.json"
OUT_COLLEGES = DATA_DIR / "colleges.json"
OUT_WITHHELD = DATA_DIR / "withheld.json"

RESULT_PAGES = tuple(map(int, args.pages.split("-")))
WITHHELD_PAGES = tuple(map(int, args.withheld_pages.split("-")))
PASS_NOTE = args.pages is None  # backward-compat: no explicit pages

TOKEN_RE = re.compile(r"(\d{6})\s*\(([^)]*)\)")
PAGE_RE = re.compile(r"^========== PAGE (\d+) ==========$")
GRADE_RE = re.compile(r"^Grade\s*:\s*(.+)$")

NOTE_LINES = (
    "CANDIDATES BEARING THE FOLLOWING ROLL NUMBERS ARE DECLARED TO HAVE",
    "PASSED THE INTERMEDIATE SCIENCE (PRE-ENGINEERING) GROUP PART - II (CLASS",
    "XII) ANNUAL EXAMINATION 2026.",
    "NOTE: MARKS OBTAINED BY ALL THE SUCCESSFUL CANDIDATES ARE INDICATED WITHIN",
    "PARANTHESIS AGAINST THEIR ROLL NUMBER AND THE EXTRA MARKS GIVEN (MAXIMUM FIVE",
    "MARKS) TO RAISE THEIR GRADES IN HARDSHIP CASES ARE INDICATED WITH PLUS(+) SIGN AND",
    "GRACE MARKS CASES ARE INDICATED WITH CARET(^) SIGN",
)

GRADE_ORDER = ["A-1", "A", "B", "C", "D", "E"]


def parse_marks(raw: str):
    """Parse '421^ 5' -> (421, 5, 'grace'); '439+ 1' -> (439, 1, 'extra'); '894' -> (894, 0, None)."""
    raw = raw.strip()
    m = re.search(r"^(\d+)\s*([+^])\s*(\d+)?$", raw)
    if m:
        base = int(m.group(1))
        kind = "extra" if m.group(2) == "+" else "grace"
        add = int(m.group(3)) if m.group(3) else 0
        return base, add, kind
    m2 = re.fullmatch(r"(\d+)/(\d+)", raw)
    if m2:
        return int(m2.group(1)), int(m2.group(2)), "partial"
    m3 = re.fullmatch(r"(\d+)", raw.strip())
    if m3:
        return int(m3.group(1)), 0, None
    return None


def is_college_name_line(stripped: str) -> bool:
    """A college name line is a text-only line (no roll tokens, no grade label, no stars/NIL)."""
    if not stripped:
        return False
    if GRADE_RE.match(stripped):
        return False
    if TOKEN_RE.search(stripped):
        return False
    if "***********" in stripped or "NIL" in stripped:
        return False
    if stripped in NOTE_LINES:
        return False
    if re.fullmatch(r"[\d\s()ivIV.,/\\-]+", stripped):
        return False
    if stripped.startswith("=========="):
        return False
    return True


def main() -> None:
    text = LAYOUT.read_text(encoding="utf-8")
    lines = text.split("\n")

    records = []
    withheld = {"unfair_means": [], "computerized_enrolment": [], "verification_enrolment": []}
    current_section = None  # "unfair_means" | "computerized_enrolment" | "verification_enrolment"
    current_college = None
    current_grade = None
    page = 0
    in_result = False
    in_withheld = False
    pass_section = None  # "PASS (Male)" / "PASS (Female)"

    i = 0
    n = len(lines)
    while i < n:
        raw = lines[i]
        stripped = raw.strip()

        pm = PAGE_RE.match(stripped)
        if pm:
            page = int(pm.group(1))
            pass_section = None
            if RESULT_PAGES[0] <= page <= RESULT_PAGES[1]:
                in_result = True
                in_withheld = False
                current_section = None
            elif WITHHELD_PAGES[0] <= page <= WITHHELD_PAGES[1]:
                in_result = False
                in_withheld = True
                current_section = None
            else:
                in_result = False
                in_withheld = False
            i += 1
            continue

        if in_withheld:
            if "unfair means" in raw:
                current_section = "unfair_means"
                i += 1
                continue
            if "Computerized Enrolment Card" in raw:
                current_section = "computerized_enrolment"
                i += 1
                continue
            if "Verification of Enrolment Card" in raw:
                current_section = "verification_enrolment"
                i += 1
                continue
            if current_section:
                nums = re.findall(r"\b(\d{6})\b", stripped)
                for num in nums:
                    withheld[current_section].append(num)
            i += 1
            continue

        if in_result:
            # Detect PASS male/female sections
            pmf = re.search(r"PASS \((Male|Female)\)", stripped)
            if pmf:
                pass_section = "PASS (" + pmf.group(1) + ")"
                current_grade = None
                i += 1
                continue

            gm = GRADE_RE.match(stripped)
            if gm:
                current_grade = gm.group(1).strip()
                i += 1
                continue

            if is_college_name_line(stripped):
                # Repeated college header across page break keeps current grade
                if stripped == current_college:
                    i += 1
                    continue
                current_college = stripped
                current_grade = None
                i += 1
                continue

            # Roll-token line
            tokens = TOKEN_RE.findall(stripped)
            if tokens:
                for roll, marks_raw in tokens:
                    parsed = parse_marks(marks_raw)
                    if parsed is None:
                        continue
                    base, add, kind = parsed
                    college = current_college or ""
                    grade = current_grade or ""
                    if pass_section:
                        # Partial / supplementary results
                        if kind == "partial":
                            obtained, total = base, add
                            records.append({
                                "roll_number": roll,
                                "candidate_name": "",
                                "college_name": pass_section,
                                "total_marks": total,
                                "obtained_marks": obtained,
                                "extra_marks": 0,
                                "grace_marks": 0,
                                "percentage": round(obtained / total * 100, 2) if total else 0,
                                "grade": "",
                                "status": "PASSED",
                            })
                    else:
                        # Extra marks (+) are added to grand total; grace (^) are not
                        if kind == "extra":
                            obtained = base + add
                        else:
                            obtained = base
                        total = 1100
                        records.append({
                            "roll_number": roll,
                            "candidate_name": "",
                            "college_name": college,
                            "total_marks": total,
                            "obtained_marks": obtained,
                            "extra_marks": add if kind == "extra" else 0,
                            "grace_marks": add if kind == "grace" else 0,
                            "percentage": round(obtained / total * 100, 2),
                            "grade": grade,
                            "status": "PASSED",
                        })
            i += 1
            continue

        i += 1

    # Deduplicate by roll number (keep last record)
    dedup = {}
    for rec in records:
        dedup[rec["roll_number"]] = rec
    records = list(dedup.values())

    # Build college list
    colleges = sorted({r["college_name"] for r in records if r["college_name"]})

    # Normalize withheld lists and dedupe
    for k in withheld:
        withheld[k] = sorted(set(withheld[k]))

    data_dir = DATA_DIR
    data_dir.mkdir(exist_ok=True)
    with (data_dir / "results.json").open("w", encoding="utf-8") as fh:
        json.dump(records, fh, ensure_ascii=False, indent=1)
    with (data_dir / "colleges.json").open("w", encoding="utf-8") as fh:
        json.dump(colleges, fh, ensure_ascii=False, indent=1)
    with (data_dir / "withheld.json").open("w", encoding="utf-8") as fh:
        json.dump(withheld, fh, ensure_ascii=False, indent=1)

    print(f"Total records: {len(records)}")
    print(f"Unique colleges: {len(colleges)}")
    for k, v in withheld.items():
        print(f"Withheld ({k}): {len(v)}")


if __name__ == "__main__":
    main()