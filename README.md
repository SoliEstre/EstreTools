# EstreTools

Small, sharp document tools for [Claude Code](https://claude.com/claude-code).

Two plugins, one pipeline: **get a real Markdown file back out of a PDF**, then
**turn Markdown into a report you can actually send someone**.

```
report.pdf  ──md-in-pdf2md──▶  report.md  ──mdbrown──▶  report.html
```

Each stage ends with a verifier that compares character streams. Nothing here
reports success on a vibe.

---

## Install

```bash
/plugin marketplace add SoliEstre/EstreTools
/plugin install md-in-pdf2md@estretools
/plugin install mdbrown@estretools
```

Then restart Claude Code.

Each plugin ships a skill and a command. Ask in passing — *"이 pdf를 md로
옮겨줘"*, *"이걸 html로 뽑아줘"* — and the skill picks the work up on its own; the
commands are there for when you want to say so explicitly:

```bash
/pdf2md   report.pdf
/mdbrown  report.md
```

The scripts also run **standalone** — plain Node, no dependencies, no install:

```bash
node plugins/md-in-pdf2md/scripts/pdfextract.cjs  report.pdf --out .work
node plugins/mdbrown/scripts/mdbrown.cjs          report.md  report.html
node plugins/mdbrown/scripts/verify-html.cjs      report.md  report.html
```

---

## md-in-pdf2md — PDF → Markdown

For PDFs that **were Markdown to begin with**: a research note, a spec, a report
written in Markdown and printed. Not an OCR tool, not a general PDF parser.

Such a PDF has lost exactly one thing — line structure. Every character
survives, and the damage is predictable:

| The PDF did this | You get this |
|---|---|
| Wrapped a long line | A space appears mid-word — `가맹본 부` |
| Flattened a table | The whole table on one physical line |
| Flattened a list | `- a - b - c` |
| Broke a URL | `https://x.com/a/` + `b?c=1` |
| Paged | Blank lines inserted mid-paragraph, or lost between blocks |

So the job is re-deciding where the breaks were. The only hard part is one
question repeated a few dozen times: **at this junction, was there a space?**

That has no mechanical answer. CJK text may break between any two characters
with no space at all, so `하이클` + `래스가` must join to `하이클래스가` while
`동시에` + `서울 교과교육` must keep its space. The script finds and lists every
junction; the skill decides each one by reading the text.

**Then it proves the result.** `verify-md.cjs` strips all whitespace from both
the PDF's own text and the reconstruction and compares them character by
character. Since reconstruction only adds and removes whitespace, anything else
is a dropped, duplicated or invented word.

One difference class is expected and is reported as `REVIEW`, not failure:
`pdftotext` in reading-order mode **deletes a hyphen that fell on a line break**,
assuming word hyphenation. It is usually real — `per-seat`, a UUID
(`e6068bde-aa26-…`), a URL slug. The layout extraction preserves it.

**Requires** `pdftotext` on PATH — either the poppler-utils build or the Xpdf
one; both accept the flags used here. Git Bash on Windows ships a usable build;
otherwise `winget install oschwartz10612.Poppler`, `brew install poppler`, or
`apt install poppler-utils`.

---

## mdbrown — Markdown → HTML

One file. All CSS inlined. No CDN, no webfont fetch, no build step, no
`node_modules`. Open it offline, drop it on an intranet share, attach it to
mail — it renders the same everywhere.

- **Light and dark** via `prefers-color-scheme`
- **CJK typography** — `word-break: keep-all` so Korean breaks between words, not
  mid-word, with `overflow-wrap: anywhere` as the escape hatch for long URLs
- **Responsive tables** — wide tables scroll in their own container, so the page
  body never scrolls sideways
- **Sticky section index**, auto-built from `##` headings, folded away on narrow
  screens and hidden in print
- **Separate print stylesheet** — prints back to a clean black-on-white PDF

```bash
node scripts/mdbrown.cjs input.md [output.html] [--no-toc] [--title "…"] [--lang ko]
```

### Why a script and not a prompt

Determinism. A model that re-derives the styling on each run drifts — slightly
different spacing, colour, type — and a set of reports stops looking like a set.
Same input, same page, every time.

### Supported syntax

ATX headings · thematic breaks · tables incl. `:---:` alignment · ordered and
unordered lists with one level of nesting · blockquotes · fenced code blocks ·
YAML frontmatter (skipped) · backslash escapes · inline code, images, links,
bold, italic, strikethrough.

`verify-html.cjs` checks text equality **and** lints the source for ambiguous
emphasis — runs of three or more `*`, unbalanced markers. That second check
exists because text comparison is structurally blind to it: when
`0105715****` sits inside a bold span the mask is eaten as delimiters, the
number renders as `0105715`, and both character streams still match.

**Not supported, deliberately:** raw HTML passthrough (escaped instead), setext
headings, reference links, footnotes, definition lists, task lists. The scope is
"documents people write", not CommonMark conformance.

---

## Design rules

Both plugins draw the line in the same place, and it is the only opinion this
repo really has:

1. **Deterministic work belongs in a script.** Rendering, extraction, diffing —
   no judgement required, so no tokens spent and no output drift.
2. **Judgement belongs in the skill.** Deciding whether `가맹본`+`부` is one word
   needs a reader, not a regex.
3. **Nothing ships unverified.** Each plugin carries a checker that compares
   character streams and exits non-zero. Eyeballing a few thousand characters of
   Korean does not catch a swallowed table cell.

---

## Licence

MIT © SoliEstre
