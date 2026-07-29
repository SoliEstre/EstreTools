---
description: Recover the original Markdown from a PDF that was authored in Markdown
argument-hint: <input.pdf> [output.md]
allowed-tools: Skill, Bash, Read, SendUserFile
---

Recover Markdown from the PDF given in `$ARGUMENTS`.

First argument is the input `.pdf`. An optional second argument is the output
path — without it, write `<same-name>.md` beside the PDF. If no input path was
given, ask for one rather than guessing.

Invoke the **`md-in-pdf2md:md-in-pdf2md`** skill and follow its procedure. The
skill is the single source of truth for the extraction commands, the wrap-
junction rules and the verification gate; this command exists only so the work
can be asked for explicitly instead of inferred from intent.

Two things to hold onto even before the skill loads:

**The reconstruction is yours to do, not the script's.** `pdfextract.cjs` only
produces two views of the text — reading order and preserved layout. Deciding
whether each wrap junction was a space or nothing is a language judgement that
no rule gets right in CJK, which is why this is a skill at all. Read both views.

**Gate the result with `verify-md.cjs` before reporting success.** Reconstruction
only adds and removes whitespace, so the character streams must match exactly.
Eyeballing a few thousand characters of Korean does not catch a swallowed table
cell.

If the PDF is scanned or image-only there is no text layer to recover; say that
outright rather than returning something that looks like a result.

To carry the recovered Markdown on to a styled HTML report, hand off to
**mdBrown**.
