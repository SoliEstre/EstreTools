#!/usr/bin/env node
/**
 * md-in-pdf2md · step 3 — character-level fidelity gate.
 *
 * Compares the reconstructed Markdown against the PDF's own text with all
 * whitespace removed. Since reconstruction only ever adds or removes spaces
 * and line breaks, the two character streams must otherwise be identical.
 * Anything else means a word was dropped, duplicated, or invented.
 *
 * One difference class is expected and benign: `pdftotext` in reading-order
 * mode DELETES a hyphen that fell at a line break, assuming hyphenation. URLs
 * and UUIDs legitimately contain those hyphens, so a hyphen present only in the
 * Markdown is reported as REVIEW rather than FAIL.
 *
 * Usage:
 *   node verify-md.cjs <source.pdf | source.raw.txt> <reconstructed.md>
 *
 * Exit: 0 clean · 1 real difference found · 2 bad invocation
 *
 * MIT © SoliEstre
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const [, , SRC, MD] = process.argv;
if (!SRC || !MD) {
  console.error('Usage: node verify-md.cjs <source.pdf|source.raw.txt> <reconstructed.md>');
  process.exit(2);
}

let pdfText;
if (/\.pdf$/i.test(SRC)) {
  const tmp = path.join(os.tmpdir(), 'mdinpdf-' + Date.now() + '.txt');
  execFileSync('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', SRC, tmp]);
  pdfText = fs.readFileSync(tmp, 'utf8');
  fs.unlinkSync(tmp);
} else {
  pdfText = fs.readFileSync(SRC, 'utf8');
}

const strip = s => s.replace(/[\s ]+/g, '');
const A = strip(pdfText);                            // PDF's own text
const B = strip(fs.readFileSync(MD, 'utf8'));        // reconstruction

console.log('pdf ' + A.length + ' chars · md ' + B.length + ' chars');

const CTX = 34;
let i = 0, j = 0, review = 0, fail = 0;

while (i < A.length && j < B.length) {
  if (A[i] === B[j]) { i++; j++; continue; }

  let resynced = false;
  for (let k = 1; k <= 8 && !resynced; k++) {
    if (A.substr(i + k, 25) === B.substr(j, 25)) {
      report('pdf-only', A.substr(i, k), A, i);
      i += k; resynced = true;
    } else if (A.substr(i, 25) === B.substr(j + k, 25)) {
      report('md-only', B.substr(j, k), B, j);
      j += k; resynced = true;
    }
  }
  if (!resynced) {
    fail++;
    console.error('FAIL  could not resynchronise');
    console.error('  pdf … ' + JSON.stringify(A.substr(i, 60)));
    console.error('  md  … ' + JSON.stringify(B.substr(j, 60)));
    break;
  }
  if (review + fail > 60) { console.error('… too many differences, stopping'); break; }
}

function report(side, text, buf, at) {
  const benign = side === 'md-only' && /^-+$/.test(text);
  const tag = benign ? 'REVIEW' : 'FAIL  ';
  if (benign) review++; else fail++;
  console.log(tag + ' [' + side + '] ' + JSON.stringify(text) +
    '  … ' + buf.slice(Math.max(0, at - CTX), at) + ' | ' + buf.substr(at, CTX));
}

if (i < A.length || j < B.length) {
  const tailA = A.length - i, tailB = B.length - j;
  if (tailA || tailB) console.log('trailing: pdf ' + tailA + ' chars, md ' + tailB + ' chars unconsumed');
}

console.log('\n' + fail + ' failure(s), ' + review + ' review item(s).');
if (review && !fail) {
  console.log('REVIEW entries are hyphens present only in the Markdown — expected when a');
  console.log('hyphen fell on a line break (URLs, UUIDs, slugs). Confirm each against the');
  console.log('layout extraction, then treat as clean.');
}
process.exit(fail ? 1 : 0);
