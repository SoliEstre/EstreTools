#!/usr/bin/env node
/**
 * mdBrown verify — assert the rendered HTML carries exactly the Markdown's text,
 * and flag source constructs whose rendering is ambiguous.
 *
 * Two independent checks:
 *
 *  1. TEXT EQUALITY — strip tags from the HTML, strip syntax from the Markdown,
 *     compare with whitespace removed. Catches a dropped table cell, a swallowed
 *     list item, a mangled entity.
 *
 *     Escape-aware: `\*` is content, not a marker, so an escaped asterisk must
 *     survive into the HTML and is compared like any other character.
 *
 *  2. AMBIGUITY LINT — text equality alone cannot see emphasis markers being
 *     eaten, because both sides lose them. `0105715****` inside a bold span
 *     renders as `0105715` with the mask silently gone, and the character
 *     streams still match. So the source is linted separately for runs of three
 *     or more emphasis characters and for odd marker counts, which is where
 *     that failure always comes from.
 *
 * Usage:
 *   node verify-html.cjs <input.md> <output.html> [--strict]
 *
 * Exit: 0 clean (warnings allowed) · 1 text mismatch, or any warning under
 *       --strict · 2 bad invocation
 *
 * MIT © SoliEstre
 */
'use strict';

const fs = require('fs');

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const [MD, HTML] = args.filter(a => !a.startsWith('--'));

if (!MD || !HTML) {
  console.error('Usage: node verify-html.cjs <input.md> <output.html> [--strict]');
  process.exit(2);
}

const SEN = String.fromCharCode(0);
const RE_TOKEN = new RegExp(SEN + '([CE])(\\d+)' + SEN, 'g');
const RE_ESCAPE = /\\([\\`*_{}\[\]()#+\-.!~|<>])/g;

// ───────────────────────── 1. text equality ─────────────────────────

function htmlText(h) {
  h = h.replace(/<style[\s\S]*?<\/style>/gi, '')
       .replace(/<script[\s\S]*?<\/script>/gi, '')
       .replace(/<nav[\s\S]*?<\/nav>/gi, '')
       .replace(/<title>[\s\S]*?<\/title>/gi, '')
       .replace(/<[^>]+>/g, '');
  // &amp; last, or "&amp;lt;" would collapse incorrectly
  return h.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
}

function mdText(m) {
  const code = [], lit = [];

  let s = m.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');       // YAML frontmatter

  // Protect code spans and backslash escapes before any marker is stripped,
  // mirroring the renderer, so their contents are compared rather than removed.
  s = s.replace(/`([^`]+)`/g, (_, c) => { code.push(c); return SEN + 'C' + (code.length - 1) + SEN; });
  s = s.replace(RE_ESCAPE, (_, ch) => { lit.push(ch); return SEN + 'E' + (lit.length - 1) + SEN; });

  s = s.split(/\r?\n/)
    // pipes are structural only inside table rows
    .map(l => /^\s*\|/.test(l)
      ? (/^\s*\|[\s:|-]+\|?\s*$/.test(l) ? '' : l.replace(/\|/g, ' '))
      : l)
    .join('\n')
    .replace(/^\s*(?:```|~~~).*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)\s]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/~~/g, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '');

  return s.replace(RE_TOKEN, (_, kind, i) => kind === 'C' ? code[+i] : lit[+i]);
}

const strip = s => s.replace(/[\s ]+/g, '');

const A = strip(mdText(fs.readFileSync(MD, 'utf8')));
const B = strip(htmlText(fs.readFileSync(HTML, 'utf8')));

console.log('md ' + A.length + ' chars · html ' + B.length + ' chars');

let failed = false;

if (A === B) {
  console.log('OK   text identical, nothing lost or duplicated.');
} else {
  failed = true;
  let i = 0;
  while (i < A.length && i < B.length && A[i] === B[i]) i++;
  console.error('FAIL text mismatch at char ' + i);
  console.error('  md   … ' + JSON.stringify(A.slice(Math.max(0, i - 60), i + 60)));
  console.error('  html … ' + JSON.stringify(B.slice(Math.max(0, i - 60), i + 60)));
}

// ───────────────────────── 2. ambiguity lint ─────────────────────────

const warnings = [];
const src = fs.readFileSync(MD, 'utf8').split(/\r?\n/);
let inFence = false;

src.forEach((line, n) => {
  if (/^\s*(?:```|~~~)/.test(line)) { inFence = !inFence; return; }
  if (inFence) return;

  // blank out code spans, escaped characters and a leading "*" list marker
  // before counting emphasis markers
  const bare = line
    .replace(/`[^`]*`/g, '')
    .replace(RE_ESCAPE, '')
    .replace(/^\s*[*+-]\s+/, '');

  const run = bare.match(/\*{3,}|_{3,}/);
  if (run && !/^\s*(?:\*{3,}|_{3,})\s*$/.test(line)) {
    warnings.push({
      line: n + 1,
      msg: 'run of ' + run[0].length + ' "' + run[0][0] + '" — ambiguous emphasis; ' +
           'markers may be eaten and the literal characters lost',
      text: line.trim().slice(0, 96)
    });
    return;
  }

  const stars = (bare.match(/\*/g) || []).length;
  if (stars % 2 === 1) {
    warnings.push({
      line: n + 1,
      msg: 'odd number of "*" (' + stars + ') — unbalanced emphasis',
      text: line.trim().slice(0, 96)
    });
  }
});

if (warnings.length) {
  console.log('\n' + warnings.length + ' ambiguity warning(s):');
  for (const w of warnings) {
    console.log('  L' + w.line + '  ' + w.msg);
    console.log('        ' + w.text);
  }
  console.log('\n  Fix in the SOURCE — escape the literal characters (\\*\\*\\*\\*) or');
  console.log('  wrap them in backticks. Every CommonMark renderer hits this, not just mdBrown.');
} else {
  console.log('OK   no ambiguous emphasis in source.');
}

if (STRICT && warnings.length) failed = true;
process.exit(failed ? 1 : 0);
