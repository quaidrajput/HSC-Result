#!/usr/bin/env python3
"""One-shot pipeline: PDF gazette -> assets/js/data.js.

Makes adding a new exam group lightning fast. You only need to provide
the gazette PDF and a group id; everything else is handled.

Usage:
    python tools/update_exam.py "path/to/gazette.pdf" --group cs-2026

Optional flags:
    --title "BIEK RESULT 2026"         exam title (default: BIEK RESULT <year>)
    --board "Board of ..."             board name (default: existing/default)
    --examination "HSC Part-II ..."    exam description
    --class "HSC PART-II"              class label
    --group-name "Computer Science"    full group name (display)
    --group-short "CS"                 short group label (tabs)
    --group-display "Computer Science" short display label
    --year 2026                        exam year
    --total-marks 1100                 total marks for the grade scale
    --source "BIEK Result Gazette"     source note
    --grades '["A-1",80]...'           optional grades list
    --pages "29-151"                   result pages (defaults to BIEK HSC pattern)
    --withheld-pages "152-153"         withheld pages

Examples:
    python tools/update_exam.py "CS-2026-gazette.pdf" --group cs-2026 \
        --year 2026 --total-marks 1100
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
GROUPS = ROOT / "data" / "groups"

DEFAULT_EXAM = {
    "board": "Board of Intermediate Education Karachi",
    "class": "HSC PART-II",
    "grades": [
        {"grade": "A-1", "min": 80},
        {"grade": "A", "min": 70},
        {"grade": "B", "min": 60},
        {"grade": "C", "min": 50},
        {"grade": "D", "min": 40},
        {"grade": "E", "min": 33},
        {"grade": "FAIL", "min": 0},
    ],
}


def parse_pages(s: str):
    """'29-151' -> (29, 151). Also accepts '29' or '29,151'."""
    s = s.strip()
    nums = [int(x) for x in re.split(r"[-,]", s) if x.strip()]
    if not nums:
        return None
    return (nums[0], nums[-1])


def build_exam_json(args, year_str):
    exam = {
        "id": args.group,
        "title": args.title or f"BIEK RESULT {year_str}",
        "board": args.board or DEFAULT_EXAM["board"],
        "examination": args.examination or f"HSC Part-II Annual Examination {year_str}",
        "class": args.class_name or DEFAULT_EXAM["class"],
        "group": args.group_name or "Science",
        "groupShort": args.group_short or "SCIENCE",
        "groupDisplay": args.group_display or (args.group_name or "Science"),
        "year": year_str,
        "totalMarks": args.total_marks,
        "sourceNote": args.source or f"BIEK Result Gazette {year_str}",
        "grades": args.grades or DEFAULT_EXAM["grades"],
    }
    return exam


def main() -> None:
    parser = argparse.ArgumentParser(description="Add/update an exam group from a gazette PDF.")
    parser.add_argument("pdf", help="Path to the gazette PDF")
    parser.add_argument("--group", required=True, help="Group id (folder name, e.g. cs-2026)")
    parser.add_argument("--title", default=None)
    parser.add_argument("--board", default=None)
    parser.add_argument("--examination", default=None)
    parser.add_argument("--class", dest="class_name", default=None)
    parser.add_argument("--group-name", dest="group_name", default=None)
    parser.add_argument("--group-short", dest="group_short", default=None)
    parser.add_argument("--group-display", dest="group_display", default=None)
    parser.add_argument("--year", default=None)
    parser.add_argument("--total-marks", dest="total_marks", type=int, default=1100)
    parser.add_argument("--source", default=None)
    parser.add_argument("--grades", default=None, help="JSON string of grades list")
    parser.add_argument("--pages", default=None, help="Result page range, e.g. 29-151")
    parser.add_argument("--withheld-pages", default=None, help="Withheld page range, e.g. 152-153")
    args = parser.parse_args()

    pdf = Path(args.pdf)
    if not pdf.is_file():
        raise SystemExit(f"PDF not found: {pdf}")

    grades = None
    if args.grades:
        grades = json.loads(args.grades)

    year_str = args.year or "2026"

    exam = build_exam_json(args, year_str)

    group_dir = GROUPS / args.group
    group_dir.mkdir(parents=True, exist_ok=True)

    # 1) extract layout text from the PDF (into a temp file)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
        layout_tmp = Path(tf.name)

    print(f"[1/4] Extracting layout from {pdf.name} ...")
    subprocess.run(
        [sys.executable, str(TOOLS / "extract_layout.py"), str(pdf), str(layout_tmp)],
        check=True,
    )

    # 2) parse into the group data folder
    print(f"[2/4] Parsing gazette -> data/groups/{args.group} ...")
    pages = parse_pages(args.pages) if args.pages else None
    cmd = [sys.executable, str(TOOLS / "parse_gazette.py"), str(layout_tmp), str(group_dir)]
    if pages:
        cmd += ["--pages", f"{pages[0]}-{pages[1]}"]
    if args.withheld_pages:
        cmd += ["--withheld-pages", args.withheld_pages]
    subprocess.run(cmd, check=True)

    # 3) write/merge exam.json
    exam_path = group_dir / "exam.json"
    print(f"[3/4] Writing {exam_path.relative_to(ROOT)}")
    (group_dir / "exam.json").write_text(json.dumps(exam, ensure_ascii=False, indent=2), encoding="utf-8")

    # 4) rebuild the bundle
    print("[4/4] Rebuilding assets/js/data.js ...")
    subprocess.run([sys.executable, str(TOOLS / "build_data.py")], check=True)

    print("\nDone! The site now includes group: " + args.group)
    print("Commit data/groups/" + args.group + " and assets/js/data.js to GitHub.")


if __name__ == "__main__":
    main()
