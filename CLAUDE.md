# choehanmin.github.io

Personal site + portfolio for 최한민 (Choi Hanmin). Plain static HTML, no
build step — GitHub Pages serves straight from `main`.

## Site map

- `index.html` — root landing page (dark "Soodal Games" terminal-style
  theme). Has its own **curated** activity list under `#log` ("COMMIT LOG"),
  styled as fake git commits. This is a highlights reel, not the full
  history — it does not have to list every single activity.
- `portfolio/index.html` — light resume-style page (navy `#1F2A44` / gold
  `#B8862F` theme) linked from the root page and from the "Projects /
  Activities / Volunteer" nav. Has the **full** Activities and Volunteer
  timelines (`<div class="trow">` rows inside `.timeline` sections).
- `portfolio/portfolio.pdf` — downloadable PDF version of the same resume
  content as `portfolio/index.html`. It's a real generated PDF, not an
  export of the HTML — see `scripts/generate_portfolio_pdf.py`.
- `photos/`, `portfolio/photos/`, `portfolio/shots/`, `images/` — static
  images referenced by the two index.html files.

## Adding a new activity / spec / credential

When asked to add a new "스펙" (activity, award, certification, etc.),
update all three of these, in chronological order relative to existing
entries (newest first, by start date):

1. **`portfolio/index.html`** — add a `<div class="trow">` row to the
   right `.timeline` (`#activities` or `#volunteer`). Bump the stat number
   in `.stats-5` (e.g. `21<span>개</span>` → `22<span>개</span>`) if it's
   an activity/volunteer entry, and the "21건 이상" text isn't present
   there but is echoed in the PDF's 핵심 강점 section (see below).
2. **`portfolio/portfolio.pdf`** — this is a binary file, so it must be
   regenerated rather than hand-edited:
   - Edit the matching Python list at the bottom of
     `scripts/generate_portfolio_pdf.py` (`ACTIVITIES`, `VOLUNTEER`,
     `PROJECTS`, or `AWARDS`), and bump `STATS` / the "21건 이상" mentions
     inside `STRENGTHS` if the activity count changed.
   - Run: `pip install pymupdf fonttools` (first time only), then
     `python3 scripts/generate_portfolio_pdf.py` — writes
     `scripts/portfolio_generated.pdf` (gitignored scratch output).
   - Render it to PNG and actually look at it before shipping:
     ```python
     import pymupdf
     doc = pymupdf.open("scripts/portfolio_generated.pdf")
     for i, p in enumerate(doc):
         p.get_pixmap(dpi=150).save(f"/tmp/preview_p{i+1}.png")
     ```
     Read the PNGs (all pages) to confirm the new row landed in the right
     place and nothing overflowed a page oddly.
   - Once it looks right: `cp scripts/portfolio_generated.pdf
     portfolio/portfolio.pdf`.
3. **`index.html`** (root) — **always** add a matching entry to the
   `#log` commit list (`.commit` div, with a made-up short git-style hash
   like the existing ones, `.commit-msg`, and `.commit-meta`), per
   explicit standing instruction from the user (don't skip this one even
   though the list reads as a curated highlights reel — every new spec
   gets an entry here too). Its `.stats` "15+" 대내외 활동 number is an
   independent, intentionally-smaller highlight count — don't feel
   obligated to keep it in lockstep with the portfolio page's total.

All three files above are updated together, every time, with no
exceptions, per explicit standing instruction from the user — don't ask
whether to touch all three, just do it. Commit all changed files together
with one descriptive commit message and push straight to `main` (see Git
workflow below) without asking for confirmation first.

## Git workflow for this repo

- Push directly to `main` — this is a single-owner personal site with no
  review process, and direct-to-main pushes have been explicitly
  authorized. No PR needed unless the user asks for one.
- The sandbox may also have a `claude/...`-named branch checked out from
  earlier session scaffolding; that's incidental — just push the actual
  work to `origin main`.

## PDF generation notes (`scripts/generate_portfolio_pdf.py`)

- Built directly on PyMuPDF (`pymupdf`) drawing primitives (rects, lines,
  text) rather than reportlab, because reportlab's `TTFont` cannot load
  the Noto CJK **OTF/CFF** fonts and PyMuPDF's own CFF-subsetting path
  (`doc.subset_fonts()`) is broken for this font — it silently fails to
  shrink the file, or (if fontTools pre-subsets a CFF/OTF font first)
  PyMuPDF mis-renders the subsetted glyphs as garbage. Both problems went
  away by switching to a real TrueType (glyf-outline) Korean font,
  **NanumGothic** (`scripts/fonts/NanumGothic-{Regular,Bold}.ttf`,
  committed in full, ~2MB each) instead of a CFF/OTF one.
- The script re-subsets those two fonts on every run (via
  `fontTools.subset`, see `setup_fonts()`/`_collect_used_chars()`) down to
  only the glyphs the current content actually needs, so the output stays
  ~200–300KB instead of multiple MB. This means it's safe to just edit the
  Python content lists and rerun — no manual font-subsetting step needed,
  and it stays correct even when new content introduces Korean syllables
  that weren't used before.
- Colors/column widths/table styling were reverse-engineered from the
  original hand-made `portfolio.pdf` (via `page.get_drawings()` /
  `get_text("dict")` in PyMuPDF) to match `portfolio/index.html`'s navy/
  gold theme. Page size is A4 (595.3 × 841.9pt), left/right margin 50pt.
