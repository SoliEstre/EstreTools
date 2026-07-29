---
name: mdbrown
description: >
  Render a Markdown file into one self-contained HTML report — every style
  inlined, no CDN, no fonts fetched, no build step — then verify the output
  carries exactly the source text. Light/dark aware, CJK-tuned typography,
  sticky section index, responsive tables, and a separate print stylesheet so
  the page prints back to a clean PDF. Use when asked to turn Markdown into
  HTML, produce a shareable or printable report from a .md, or publish notes as
  a single portable page.
  Korean triggers: md를 html로, html로 뽑아줘, 리포트 html, 마크다운 html 변환,
  단일 파일 html, 인쇄용 html.
  Do NOT use for a website, a multi-page docs site, or when the user wants a
  React/Vue component — this produces one standalone document.
---

# mdbrown

## Run the script — do not hand-write the HTML

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/mdbrown.cjs "<input.md>" ["<output.html>"]
```

Output defaults to the input path with `.html`.

Writing the HTML by hand instead is the main failure mode here, and it is worse
on both axes that matter:

- **Consistency.** A model that re-derives the styling each run produces
  slightly different spacing, colour and type every time. A set of reports then
  fails to look like a set. The script guarantees byte-identical styling.
- **Cost.** A 40 KB page written token by token, every time, for output that is
  fully determined by the input.

Only edit the CSS block inside `mdbrown.cjs` when the user wants the *house
style itself* changed — and then it changes for every document at once, which is
the point.

## Options

| Flag | Effect |
|---|---|
| `--no-toc` | Omit the section sidebar (auto-omitted when the document has ≤1 `##` heading) |
| `--title <text>` | Override `<title>`; defaults to the H1 text |
| `--lang <code>` | `<html lang>` value, default `ko` |

## Verify before reporting

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/verify-html.cjs "<input.md>" "<output.html>"
```

Two checks run. **Text equality** compares both character streams with
whitespace removed — `OK text identical` means no cell, list item or link label
was dropped. **Ambiguity lint** reads the source for runs of three or more
emphasis characters and unbalanced marker counts.

Take the lint seriously even though it exits 0. It covers the one failure text
comparison cannot see: in `**…휴대폰번호(0105715****), 학생 이름…**` the four
masking asterisks are eaten as delimiters, the number renders as `0105715` with
the mask gone, and both streams still match. The document now says something
different and the comparison is happy.

When it warns, **do not silently edit the user's source.** Report the line, show
what it renders as, and offer the fix — escape the literals (`\*\*\*\*`) or wrap
them in backticks. Add `--strict` to make warnings fatal in a pipeline.

Worth also checking, cheaply, that element counts match the source: tables,
`<tr>`, `<strong>`, `<a>`. A structural bug can preserve text while wrecking a
table.

## Supported syntax

ATX headings · thematic breaks · tables including `:---:` alignment · ordered and
unordered lists with one level of nesting · blockquotes · fenced code blocks ·
YAML frontmatter (skipped) · backslash escapes · inline code, images, links,
bold, italic, strikethrough.

**Not supported, by choice:** raw HTML passthrough (escaped instead), setext
headings, reference links, footnotes, definition lists, task lists. If a
document needs one of these, say so rather than silently shipping a page that
dropped it.

## Notes that matter for CJK

The stylesheet sets `word-break: keep-all` so Korean lines break between words
rather than mid-word, with `overflow-wrap: anywhere` as the escape hatch for long
URLs. Wide tables scroll inside their own container, so the page body never
scrolls sideways. Both are easy to lose if the CSS is rewritten by hand.

## Pairs with

**md-in-pdf2md** — when the Markdown itself has to be recovered from a PDF first.
