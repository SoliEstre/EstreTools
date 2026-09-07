# mdbrown

Markdown → **one self-contained HTML report**.

All CSS inlined. No CDN, no webfont fetch, no build step, no `node_modules`.
Open it offline, drop it on an intranet share, attach it to mail — it renders
the same everywhere.

Mermaid diagrams are rendered to static inline SVG during generation. The
optional renderer needs local packages and a browser; the delivered HTML does not.

## Install

```bash
/plugin marketplace add SoliEstre/EstreTools
/plugin install mdbrown@estretools
```

For Cowork, add `https://github.com/SoliEstre/EstreTools` through **Customize →
Plugins → Add marketplace**. For missing entries, update `estretools` first.
See [installation troubleshooting](../../docs/installation.md) and
[uploadable ZIP releases](https://github.com/SoliEstre/EstreTools/releases/latest).

Or just run the script — it is plain Node with zero dependencies:

```bash
node scripts/mdbrown.cjs input.md [output.html] [--no-toc] [--title "…"] [--lang ko]
```

## Use it

Ask for it in passing — *"이걸 html로 뽑아줘"*, *"turn this into a report"* — and
the skill picks the work up on its own.

To be explicit, or to be sure the script runs rather than the model improvising a
page, call the command:

```bash
/mdbrown report.md
```

Same arguments as the script. The command is a thin entry point: it invokes the
skill, which holds the procedure.

## What you get

- **Light and dark** via `prefers-color-scheme`
- **CJK typography** — `word-break: keep-all` so Korean breaks between words
  rather than mid-word, with `overflow-wrap: anywhere` as the escape hatch for
  long URLs
- **Responsive tables** — wide tables scroll inside their own container, so the
  page body never scrolls sideways
- **Sticky section index** built from `##` headings; folds below the content on
  narrow screens, hidden in print
- **Separate print stylesheet** — prints back to a clean black-on-white PDF
- **Mermaid** — static SVG plus a fullscreen viewer with wheel zoom, drag pan,
  screen fit, Escape and keyboard focus restoration

## Mermaid setup and options

From this plugin directory, using Node 22.12+:

```bash
npm ci
node scripts/mdbrown.cjs input.md output.html --mermaid
```

This installs locked Mermaid and puppeteer-core packages. It does not download a
browser. Chrome, Edge or Chromium must exist in the execution environment. Common
Windows, macOS and Linux locations are detected; use `--browser "<executable>"`
or `MDBROWN_BROWSER` for another path.

| Mode | Behavior |
| --- | --- |
| Default | Render Mermaid if available; warn and keep code for failures |
| `--mermaid` | Require every Mermaid diagram; any failure leaves the output file unchanged |
| `--no-mermaid` | Keep Mermaid as ordinary fenced code, without extra dependencies |

The HTML contains static SVG and a small inline viewer, with no Mermaid runtime
and no external requests introduced by the renderer. Diagram content remains
visible with JavaScript disabled. Repeated renders are deterministic with the same
Mermaid version, browser and fonts; different environments can change layout.

The browser sandbox is enabled by default. `MDBROWN_NO_SANDBOX=1` is available
only for already isolated trusted CI/containers that require it.

## Verify

```bash
node scripts/verify-html.cjs input.md output.html [--strict]
```

Two independent checks.

**Text equality** — strips tags from the HTML and syntax from the Markdown, then
compares with whitespace removed. Escape-aware, so a `\*` is compared as
content. Exits non-zero on mismatch and prints the divergence point.

Fenced code is compared literally. For static Mermaid figures, verification
checks source/SVG fingerprints and block counts, replacing each SVG with its
original source for the ordered text comparison. This catches lost, changed or
duplicated blocks; it is an integrity check, not proof of diagram semantics.

**Ambiguity lint** — because text equality alone is blind to one real failure:
emphasis markers being eaten. In

```markdown
**…휴대폰번호(0105715****), 학생 이름…**
```

the four masking asterisks are consumed as delimiters, the number renders as
`0105715` with the mask gone, and *both* character streams still match — so the
comparison passes on a document that now says something different. The lint
therefore reads the source directly and flags runs of three or more emphasis
characters and unbalanced marker counts, which is where that failure always
comes from.

```
md 5300 chars · html 5300 chars
OK   text identical, nothing lost or duplicated.

1 ambiguity warning(s):
  L16  run of 4 "*" — ambiguous emphasis; markers may be eaten and the literal characters lost
```

Warnings do not fail the run unless you pass `--strict`. Fix them in the
**source** — escape the literals (`\*\*\*\*`) or wrap them in backticks. Every
CommonMark renderer hits this, not just mdbrown.

## Why a script rather than a prompt

Determinism. A model that re-derives the styling on each run drifts — slightly
different spacing, colour, type — and a set of reports stops looking like a set.
Same input, same page, every time, at no token cost.

Change the CSS block in `mdbrown.cjs` when you want the *house style* to change;
it then changes for every document at once, which is the point.

## Supported syntax

ATX headings · thematic breaks · tables incl. `:---:` alignment · ordered and
unordered lists with one level of nesting · blockquotes · fenced code blocks ·
YAML frontmatter (skipped) · backslash escapes · inline code, images, links,
bold, italic, strikethrough.

**Not supported, deliberately:** raw HTML passthrough (escaped instead), setext
headings, reference links, footnotes, definition lists, task lists. The scope is
"documents people write", not CommonMark conformance — if a document needs one
of these, the tool should say so rather than silently drop it.

## Pairs with

[**md-in-pdf2md**](../md-in-pdf2md) — when the Markdown has to be recovered from
a PDF first.

MIT © SoliEstre
