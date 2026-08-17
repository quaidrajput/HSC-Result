# BIEK HSC Part-II Result Checker

A fast, fully-animated, static result-checking website for the **Board of Intermediate Education Karachi (BIEK)** annual results. Built for the **HSC Part-II Annual 2026** gazettes, and designed so any future group/paper (e.g. Computer Science) can be added in one command.

**Important:** This is an **unofficial** search interface — NOT the official Sindh Board / BIEK website. The official marks certificate remains authoritative.

- 100% static (plain HTML + CSS + JS) — works on **GitHub Pages** for free, no backend needed
- Instant O(1) roll-number lookup (no server requests after page load)
- Multi-group support: Pre-Engineering and Computer Science students are separate — tabs switch between them automatically when a new group is added
- College autocomplete, college-vs-result mismatch detection, withheld-result notices
- End-level animations: preloader, particle background, 3D card tilt, PASSED confetti, cursor glow, scroll progress bar, magnetic buttons, count-ups
- Fully responsive (mobile + desktop)

## Live preview

Open `index.html` directly in a browser, or serve locally:

```
python -m http.server 8731
# then open http://localhost:8731
```

## Dataset (current build)

| | |
|---|---|
| Exam | HSC Part-II Annual 2026 |
| Groups | Science — Pre-Engineering |
| Records | 9,913 (regular + private + PASS sections) |
| Colleges | 257 |
| Withheld | 554 (unfair means 14, computerized enrolment 459, verification 81) |
| Total marks | 1100 |

Notes:
- **Candidate names are not listed** in the result section of the gazette, so the site shows "Candidate Name Not Listed". Only roll numbers, marks, grades, and colleges are official.
- **Extra marks (`+ N`)** from the gazette are included in the grand total; **grace marks (`^ N`)** are stored separately and NOT added to the grand total.
- When a roll number appears in both a result list and the withheld section, the **withheld notice takes priority**.
- Each group has its **own student body** — a roll number from Pre-Engineering will NOT match under the Computer Science group.

## How to run the tests

Requires Node.js and Microsoft Edge (headless browser tests against `http://localhost:8731`):

```
python -m http.server 8731
node "C:\Users\Quaid\AppData\Local\Temp\opencode\biek-test\test.js"
```

The suite verifies data loading, valid/not-found/withheld/private/grace searches, autocomplete, college mismatch detection, count-up animations, group switching, and responsive layout.

## Project structure

```
index.html            — single-page site
assets/
  css/style.css       — all styling + animations
  js/app.js           — preloader, particles, group tabs, search/autocomplete/result logic
  js/data.js          — generated data bundle (window.BIEK_DATA), auto-built
data/
  groups/
    pre-engineering-2026/
      exam.json       — exam/group config (edit per group)
      results.json    — parsed marks records
      colleges.json   — college list
      withheld.json   — withheld roll numbers + reasons
    cs-2026/          — (created automatically when CS data arrives)
tools/
  extract_layout.py   — PDF → layout text (pdfplumber)
  parse_gazette.py    — layout text → data/groups/<id>/*.json
  build_data.py       — data/groups/*/ → assets/js/data.js
  update_exam.py      — ONE-COMMAND pipeline (PDF → ready site)
old-war-computer/     — previous website (kept separately)
```

## Adding a new group (e.g. Computer Science) — one command

When the CS gazette arrives, just run:

```
python tools/update_exam.py "path\to\CS-2026-gazette.pdf" --group cs-2026 --order 1 ^
    --group-name "Science — Computer Science" --group-short "CS" ^
    --group-display "Computer Science" --year 2026 --total-marks 1100 ^
    --pages 29-151 --withheld-pages 152-153
```

That single command:
1. Extracts layout text from the PDF
2. Parses it into `data/groups/cs-2026/`
3. Writes the group's `exam.json`
4. Rebuilds `assets/js/data.js`

Then commit and push — the site automatically shows a **Computer Science** tab next to Pre-Engineering. No HTML/JS edits needed.

Adjust `--pages` / `--withheld-pages` if the CS gazette uses different page ranges, and tweak `--total-marks` if the total differs. All flags are optional except `--group`.

## Deploying to GitHub Pages

1. Create a repo (e.g. `hsc-result`) on GitHub.
2. Push this folder's contents (keep `index.html` at the repo root).
3. Repo **Settings → Pages → Branch**: `main` / `/(root)` → **Save**.
4. Your site is live at `https://<user>.github.io/<repo>/` within a minute or two.

No extra build step is needed — the site is already static.

## Reusing for a future exam (manual, step-by-step)

1. Extract the new gazette text:

```
python tools/extract_layout.py "path\to\gazette.pdf" gazette_layout.txt
```

2. Parse it into a group folder:

```
python tools/parse_gazette.py gazette_layout.txt data/groups/cs-2026 --pages 29-151 --withheld-pages 152-153
```

3. Write/edit `data/groups/cs-2026/exam.json` (id, order, title, group, year, totalMarks).
4. Rebuild the bundle:

```
python tools/build_data.py
```

5. Reload the page. That's it.

Requirements for the tools: Python 3.9+ with `pip install pdfplumber pypdf`.

## About the developer

Built by **Quaid Rajput** with HTML · CSS · JavaScript. Contact: **0331 2226920**.