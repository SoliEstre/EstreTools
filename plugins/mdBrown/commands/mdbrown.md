---
description: Render a Markdown file into one self-contained HTML report
argument-hint: <input.md> [output.html] [--no-toc] [--title <text>] [--lang <code>]
allowed-tools: Skill, Bash, Read, SendUserFile
---

Render the Markdown given in `$ARGUMENTS` to a self-contained HTML report.

First argument is the input `.md`. An optional second argument is the output
path — without it, the output is the input path with `.html`. Remaining flags
pass straight through: `--no-toc`, `--title <text>`, `--lang <code>`. If no
input path was given, ask for one rather than guessing.

Invoke the **`mdBrown:mdbrown`** skill and follow its procedure. The skill is the
single source of truth for the script paths, the verification gate and the
reporting rules; this command exists only so the work can be asked for
explicitly instead of inferred from intent.

Two things to hold onto even before the skill loads:

**Never hand-write the HTML.** Re-deriving the styling each run makes a set of
reports stop looking like a set, and it bills tokens for output the input
already determines. Run `scripts/mdbrown.cjs` — same Markdown, byte-identical
page. Edit the CSS inside that script only when the *house style itself* should
change, which changes every document at once by design.

**Run `verify-html.cjs` before reporting success.** It checks text equality and
lints the source for ambiguous emphasis. When the lint warns, report the line
and offer the fix — escaping the literals or wrapping them in backticks — but do
not silently edit the user's source. Whether their document changes is their
call, not yours.
