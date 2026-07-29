---
name: md-in-pdf2md
description: >
  Recover the original Markdown from a PDF that is really Markdown wrapped in a
  PDF — a report, research note, or spec that was authored in Markdown and
  printed. Rebuilds tables, lists, blockquotes and links that the PDF flattened,
  and resolves every line-wrap junction as a language judgement rather than a
  blind join. Ends with a character-level gate that proves nothing was lost.
  Use when the user says the PDF "is just markdown", wants a .md back from a
  PDF, or asks to convert/extract/re-edit a text PDF as Markdown.
  Korean triggers: pdf를 md로, 마크다운으로 되돌려줘, pdf가 md로 래핑돼 있어,
  pdf 원문 복원, 순수 md로 옮겨줘.
  Do NOT use for scanned/image PDFs (needs OCR) or for PDFs that were never
  Markdown (design-laid-out brochures, forms, spreadsheets).
---

# md-in-pdf2md

## What this is actually solving

A PDF printed from Markdown has lost exactly one thing: **line structure**. Every
character survives. The damage is mechanical and predictable:

| What the PDF did | What you see after extraction |
|---|---|
| Wrapped long lines | A space appears mid-word: `가맹본 부`, `설치비` + `나` |
| Flattened tables | One physical line holds an entire table |
| Flattened lists | `- a - b - c` on one line |
| Broke long URLs | `https://x.com/a/` + `b?c=1` |
| Page breaks | Blank lines inserted mid-paragraph, or removed between blocks |

So this is not "PDF parsing". It is **re-deciding where the line breaks were**,
and the only hard part is one question repeated a few dozen times: *at this
junction, was there a space or not?*

That question cannot be answered by a rule. In CJK text a line may break between
any two characters with no space at all, so `가맹본` + `부` must join to
`가맹본부`, while `국면 —` + `SW 지불여력` must keep its space. **Read the text
and decide.** That is why this is a skill and not a script.

## Procedure

### 1. Extract both views

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/pdfextract.cjs "<input.pdf>" --out .md-in-pdf2md
```

Produces `<name>.raw.txt` (reading order — paragraphs rejoined, wrap points
turned into spaces) and `<name>.layout.txt` (original line breaks preserved),
then prints every wrap junction it found.

Read **both**. The layout view tells you where the breaks were; the raw view
tells you how the paragraphs group. Neither alone is enough.

### 2. Rebuild block structure from the layout view

The layout view usually preserves the author's Markdown almost intact — table
rows are already one-per-line, list items already start with `-`. Take structure
from there, not from the raw view.

### 3. Resolve every wrap junction

For each junction the extractor listed, join with a space or with nothing:

- **Mid-word CJK** → no space. `하이클` + `래스가` → `하이클래스가`
- **Word boundary** → space. `동시에` + `서울 교과교육` → keep the space
- **Emphasis markers split from their text** → no space. `없음. **` + `최우선 타깃**` → `없음. **최우선 타깃**`
- **Inside a URL** → no space, always
- **Before an opening bracket** → follow the document's own convention; most Korean documents write `직접계약(HQ는`, not `직접계약 (HQ는`
- **Hyphen at the end of a line** → **keep the hyphen.** Reading-order mode
  deletes it, assuming word hyphenation. It is usually real: `per-seat`, a UUID
  (`e6068bde-aa26-…`), a URL slug. Check the layout view, which preserves it.

Also restore blank lines the page breaks ate, and rejoin URLs that were split
across lines.

### 4. Do not improve the author's Markdown

If the source has `낮음|` with no space before the pipe, keep it. You are
transferring a document, not editing it. Mention such quirks in your summary and
let the user decide.

### 5. Gate the result

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/verify-md.cjs "<input.pdf>" "<output.md>"
```

Compares both character streams with all whitespace removed. Since
reconstruction only adds and removes whitespace, anything else is a defect.

- `0 failure(s)` → the reconstruction is exact.
- `REVIEW [md-only] "-"` → a hyphen present only in your Markdown. Expected; confirm
  each against the layout view (URL slug, UUID, compound word) and say so.
- Any `FAIL` → you dropped, duplicated or invented text. Fix before reporting.

**Never report success without running this.** Eyeballing a Korean document of a
few thousand characters does not catch a swallowed table cell.

## Output

Write `<same-name>.md` beside the PDF unless the user says otherwise. Leave the
PDF in place.

To continue on to a styled HTML report, hand off to **mdBrown**.

## Requirements

`pdftotext` (poppler-utils) on PATH. Git Bash on Windows ships a usable build;
otherwise `winget install oschwartz10612.Poppler`, `brew install poppler`, or
`apt install poppler-utils`.
