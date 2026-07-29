# md-in-pdf2md

Recover the original Markdown from a PDF that was **printed from Markdown**.

Not OCR. Not a general PDF parser. This is for the case where a report, spec or
research note was authored in Markdown, exported to PDF, and now you want the
source back.

## Install

```bash
/plugin marketplace add SoliEstre/EstreTools
/plugin install md-in-pdf2md@estretools
```

## Use it

Ask for it in passing — *"이 pdf를 md로 옮겨줘"*, *"give me the markdown back"* —
and the skill picks the work up on its own.

To be explicit, call the command:

```bash
/pdf2md report.pdf
```

The command is a thin entry point: it invokes the skill, which holds the
procedure.

## The problem it solves

Such a PDF has lost exactly one thing — **line structure**. Every character
survives, and the damage is mechanical:

- long lines wrapped, so a space now sits mid-word (`가맹본 부`)
- tables and lists flattened onto one physical line
- URLs split across lines
- page breaks inserting or removing blank lines

Recovering it means re-deciding where the breaks were. One question, repeated a
few dozen times per document: **was there a space at this junction?**

There is no rule for that. CJK text may break between any two characters with no
space, so `하이클` + `래스가` joins into `하이클래스가` — but `동시에` + `서울
교과교육` must keep its space. The script surfaces every junction; the skill
reads the text and decides.

## Pipeline

```bash
# 1. two views of the same text, plus a numbered junction report
node scripts/pdfextract.cjs "report.pdf" --out .md-in-pdf2md

# 2. …the skill reconstructs report.md…

# 3. prove it
node scripts/verify-md.cjs "report.pdf" "report.md"
```

`verify-md.cjs` strips all whitespace from both character streams and compares
them. Since reconstruction only adds and removes whitespace, anything else is a
dropped, duplicated or invented word.

```
pdf 8418 chars · md 8422 chars
REVIEW [md-only] "-"  … guide.on-hi.com/e6068bde | -aa26-478c-873e-21fa3c82b981)…
0 failure(s), 4 review item(s).
```

`REVIEW` is the one expected difference class: `pdftotext` in reading-order mode
**deletes a hyphen that fell on a line break**, assuming word hyphenation. It is
usually real — `per-seat`, a UUID, a URL slug — and the layout extraction proves
it. Confirm each, then treat as clean. Any `FAIL` is a genuine defect.

## Requires

`pdftotext` on PATH — either the poppler-utils build or the Xpdf one; both
accept the flags used here.

| Platform | |
|---|---|
| Windows | Git Bash ships a usable build, or `winget install oschwartz10612.Poppler` |
| macOS | `brew install poppler` |
| Linux | `apt install poppler-utils` |

## Pairs with

[**mdbrown**](../mdbrown) — turn the recovered Markdown into a self-contained
HTML report.

MIT © SoliEstre
