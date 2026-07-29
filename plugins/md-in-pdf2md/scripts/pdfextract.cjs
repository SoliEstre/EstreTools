#!/usr/bin/env node
/**
 * md-in-pdf2md · step 1 — dual-mode extraction + wrap-junction report.
 *
 * A PDF that was printed from Markdown has lost nothing but its line structure.
 * Recovering it needs two views of the same text:
 *
 *   raw    (pdftotext, reading order)  — paragraphs re-joined, but every wrap
 *                                        point became a space, and hyphens at
 *                                        line ends were silently DELETED
 *   layout (pdftotext -layout)         — original line breaks preserved, so the
 *                                        exact wrap points are visible
 *
 * This script produces both and then lists every junction where a line
 * continues the previous one. Each junction is a decision the reconstruction
 * has to make: join with a space, or join with nothing.
 *
 * Usage:
 *   node pdfextract.cjs <input.pdf> [--out <dir>]
 *
 * Requires `pdftotext` (poppler-utils) on PATH.
 *
 * MIT © SoliEstre
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
let SRC = null, OUTDIR = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') OUTDIR = argv[++i];
  else if (argv[i] === '-h' || argv[i] === '--help') {
    console.log('Usage: node pdfextract.cjs <input.pdf> [--out <dir>]');
    process.exit(0);
  } else SRC = argv[i];
}
if (!SRC) {
  console.error('Usage: node pdfextract.cjs <input.pdf> [--out <dir>]');
  process.exit(2);
}

// Probe for the binary, not for a zero exit status: Xpdf's pdftotext exits 99
// on -v, poppler's exits 0. Only ENOENT means it is actually missing.
try {
  execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
} catch (e) {
  if (e && (e.code === 'ENOENT' || e.errno === 'ENOENT')) {
    console.error('pdftotext not found on PATH. Install poppler-utils or Xpdf:');
    console.error('  Windows  winget install oschwartz10612.Poppler   (Git Bash also ships a build)');
    console.error('  macOS    brew install poppler');
    console.error('  Linux    apt install poppler-utils');
    process.exit(3);
  }
  // any other failure just means this build reports its version differently
}

const base = path.basename(SRC).replace(/\.pdf$/i, '');
const dir = OUTDIR || path.join(process.cwd(), '.md-in-pdf2md');
fs.mkdirSync(dir, { recursive: true });

const RAW = path.join(dir, base + '.raw.txt');
const LAY = path.join(dir, base + '.layout.txt');

execFileSync('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', SRC, RAW]);
execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', '-nopgbrk', SRC, LAY]);

console.log('raw    ' + RAW);
console.log('layout ' + LAY);

// ── junction report ───────────────────────────────────────────────

const L = fs.readFileSync(LAY, 'utf8').split(/\r?\n/);

const startsBlock = l =>
  !l.trim() ||
  /^#{1,6}\s/.test(l) ||
  /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l) ||
  /^\s*\|/.test(l) ||
  /^\s*[-*+]\s/.test(l) ||
  /^\s*\d+\.\s/.test(l) ||
  /^\s*>/.test(l) ||
  /^\s*(?:```|~~~)/.test(l);

const junctions = [];
for (let i = 1; i < L.length; i++) {
  if (!L[i].trim() || !L[i - 1].trim()) continue;
  if (startsBlock(L[i])) continue;
  junctions.push({ line: i + 1, prev: L[i - 1], next: L[i] });
}

const tail = s => s.slice(-24);
const head = s => s.slice(0, 24);

console.log('\n' + junctions.length + ' wrap junction(s) — decide space vs no-space for each:\n');
junctions.forEach((j, n) => {
  const hyphen = /-$/.test(j.prev.trimEnd());
  console.log(
    String(n + 1).padStart(3) + '  L' + String(j.line).padStart(4) + '  ' +
    '…' + tail(j.prev.trimEnd()) + '  ⏎  ' + head(j.next.trimStart()) + '…' +
    (hyphen ? '   [!] hyphen at break — raw mode DELETED it; keep it unless it is true word hyphenation' : '')
  );
});

console.log('\nNext: reconstruct the .md, then gate it with verify-md.cjs.');
