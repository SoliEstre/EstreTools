#!/usr/bin/env node
/**
 * mdBrown verify — assert the rendered HTML carries exactly the Markdown's text.
 *
 * Strips tags from the HTML and syntax from the Markdown, then compares the two
 * with all whitespace removed. Any surviving difference is a real defect: a
 * dropped table cell, a swallowed list item, a mangled entity.
 *
 * Usage:
 *   node verify-html.cjs <input.md> <output.html>
 *
 * Exit: 0 identical · 1 mismatch · 2 bad invocation
 *
 * MIT © SoliEstre
 */
'use strict';

const fs = require('fs');

const [, , MD, HTML] = process.argv;
if (!MD || !HTML) {
  console.error('Usage: node verify-html.cjs <input.md> <output.html>');
  process.exit(2);
}

function htmlText(h) {
  h = h.replace(/<style[\s\S]*?<\/style>/gi, '')
       .replace(/<script[\s\S]*?<\/script>/gi, '')
       .replace(/<nav[\s\S]*?<\/nav>/gi, '')
       .replace(/<title>[\s\S]*?<\/title>/gi, '')
       .replace(/<[^>]+>/g, '');
  // &amp; must be decoded last, or "&amp;lt;" would collapse incorrectly
  return h.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
}

function mdText(m) {
  return m
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')            // YAML frontmatter
    .split(/\r?\n/)
    // pipes are structural only inside table rows; elsewhere (code spans) they are content
    .map(l => /^\s*\|/.test(l)
      ? (/^\s*\|[\s:|-]+\|?\s*$/.test(l) ? '' : l.replace(/\|/g, ' '))
      : l)
    .join('\n')
    .replace(/^\s*(?:```|~~~).*$/gm, '')                       // fence markers
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)\s]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/~~/g, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '');
}

const strip = s => s.replace(/[\s ]+/g, '');

const A = strip(mdText(fs.readFileSync(MD, 'utf8')));
const B = strip(htmlText(fs.readFileSync(HTML, 'utf8')));

console.log('md ' + A.length + ' chars · html ' + B.length + ' chars');

if (A === B) {
  console.log('OK — text identical, nothing lost or duplicated.');
  process.exit(0);
}

let i = 0;
while (i < A.length && i < B.length && A[i] === B[i]) i++;
console.error('MISMATCH at char ' + i);
console.error('  md   … ' + JSON.stringify(A.slice(Math.max(0, i - 60), i + 60)));
console.error('  html … ' + JSON.stringify(B.slice(Math.max(0, i - 60), i + 60)));
process.exit(1);
