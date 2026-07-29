#!/usr/bin/env node
/**
 * mdBrown — Markdown → self-contained HTML report.
 *
 * No dependencies, no network, no build step. Emits one HTML file with all CSS
 * inlined, so it renders identically offline, on an intranet, or as an email
 * attachment.
 *
 * Usage:
 *   node mdbrown.cjs <input.md> [output.html] [options]
 *
 * Options:
 *   --no-toc          Omit the section sidebar
 *   --title <text>    Override <title> (defaults to the H1 text)
 *   --lang <code>     <html lang> value (default: ko)
 *   -h, --help
 *
 * Supported Markdown: ATX headings, thematic breaks, tables (incl. :---:
 * alignment), ordered/unordered lists with one level of nesting, blockquotes,
 * fenced code blocks, YAML frontmatter (skipped), and inline code / images /
 * links / bold / italic / strikethrough.
 *
 * Deliberately NOT supported: raw HTML passthrough (escaped instead), setext
 * headings, reference links, footnotes, definition lists, task lists.
 *
 * MIT © SoliEstre
 */
'use strict';

const fs = require('fs');

// ─────────────────────────────── CLI ───────────────────────────────

function usage() {
  console.log('Usage: node mdbrown.cjs <input.md> [output.html] [--no-toc] [--title <text>] [--lang <code>]');
}

const argv = process.argv.slice(2);
const opt = { toc: true, title: null, lang: 'ko' };
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--no-toc') opt.toc = false;
  else if (a === '--title') opt.title = argv[++i];
  else if (a === '--lang') opt.lang = argv[++i];
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else if (a.startsWith('--')) { console.error('Unknown option: ' + a); usage(); process.exit(2); }
  else positional.push(a);
}

if (!positional.length) { usage(); process.exit(2); }

const SRC = positional[0];
const OUT = positional[1] || SRC.replace(/\.md$/i, '') + '.html';

// ──────────────────────────── inline pass ────────────────────────────

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Code spans are lifted out before escaping so that markdown inside them
 * (pipes, asterisks, brackets) is never interpreted.
 */
const SEN = String.fromCharCode(0);            // sentinel — cannot occur in Markdown source
const RE_SEN = new RegExp(SEN + '(\\d+)' + SEN, 'g');

function inline(s) {
  const code = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { code.push(c); return SEN + (code.length - 1) + SEN; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(RE_SEN, (_, i) => '<code>' + esc(code[+i]) + '</code>');
  return s;
}

// ──────────────────────────── block pass ────────────────────────────

const RE_H     = /^(#{1,6})\s+(.*)$/;
const RE_HR    = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const RE_FENCE = /^\s*(?:```|~~~)\s*(\S*)\s*$/;
const RE_TABLE = /^\s*\|/;
const RE_UL    = /^(\s*)[-*+]\s+(.*)$/;
const RE_OL    = /^(\s*)\d+\.\s+(.*)$/;
const RE_QUOTE = /^\s*>\s?(.*)$/;

const splitRow = l =>
  l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

const isSeparatorRow = cells =>
  cells.length > 0 && cells.every(c => /^:?-{1,}:?$/.test(c));

const raw = fs.readFileSync(SRC, 'utf8');
const L = raw.split(/\r?\n/);

const out = [];
const toc = [];
let title = '';
let h2n = 0;
let i = 0;

// YAML frontmatter
if (L[0] !== undefined && L[0].trim() === '---') {
  let j = 1;
  while (j < L.length && L[j].trim() !== '---') j++;
  if (j < L.length) i = j + 1;
}

const startsBlock = l =>
  !l.trim() || RE_H.test(l) || RE_HR.test(l) || RE_FENCE.test(l) ||
  RE_TABLE.test(l) || RE_UL.test(l) || RE_OL.test(l) || RE_QUOTE.test(l);

while (i < L.length) {
  const line = L[i];

  if (!line.trim()) { i++; continue; }

  // fenced code — must be checked before HR so that ``` is not eaten
  let m = line.match(RE_FENCE);
  if (m) {
    const lang = m[1];
    const buf = [];
    i++;
    while (i < L.length && !RE_FENCE.test(L[i])) { buf.push(L[i]); i++; }
    i++; // closing fence
    out.push('<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' +
             esc(buf.join('\n')) + '</code></pre>');
    continue;
  }

  m = line.match(RE_H);
  if (m) {
    const lvl = m[1].length;
    const text = inline(m[2]);
    if (lvl === 1) {
      title = title || m[2];
      out.push('<h1>' + text + '</h1>');
    } else if (lvl === 2) {
      const id = 'sec' + (++h2n);
      toc.push({ id, text: m[2] });
      out.push('<h2 id="' + id + '">' + text + '</h2>');
    } else {
      out.push('<h' + lvl + '>' + text + '</h' + lvl + '>');
    }
    i++; continue;
  }

  if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }

  if (RE_TABLE.test(line)) {
    const rows = [];
    while (i < L.length && RE_TABLE.test(L[i])) { rows.push(splitRow(L[i])); i++; }

    let head = null, body = rows, align = [];
    if (rows.length > 1 && isSeparatorRow(rows[1])) {
      head = rows[0];
      align = rows[1].map(c => {
        const l = c.startsWith(':'), r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
      });
      body = rows.slice(2);
    }
    const at = n => align[n] ? ' style="text-align:' + align[n] + '"' : '';

    out.push('<div class="tw"><table>');
    if (head) out.push('<thead><tr>' + head.map((c, n) => '<th' + at(n) + '>' + inline(c) + '</th>').join('') + '</tr></thead>');
    out.push('<tbody>' + body.map(r =>
      '<tr>' + r.map((c, n) => '<td' + at(n) + '>' + inline(c) + '</td>').join('') + '</tr>').join('\n') + '</tbody>');
    out.push('</table></div>');
    continue;
  }

  if (RE_QUOTE.test(line)) {
    const paras = [[]];
    while (i < L.length && RE_QUOTE.test(L[i])) {
      const t = L[i].match(RE_QUOTE)[1];
      if (!t.trim()) paras.push([]); else paras[paras.length - 1].push(t);
      i++;
    }
    out.push('<blockquote>' +
      paras.filter(p => p.length).map(p => '<p>' + inline(p.join(' ')) + '</p>').join('') +
      '</blockquote>');
    continue;
  }

  if (RE_UL.test(line) || RE_OL.test(line)) {
    const items = [];
    while (i < L.length) {
      const l = L[i];
      let mm = l.match(RE_UL);
      if (mm) { items.push({ indent: mm[1].length, type: 'ul', text: mm[2] }); i++; continue; }
      mm = l.match(RE_OL);
      if (mm) { items.push({ indent: mm[1].length, type: 'ol', text: mm[2] }); i++; continue; }
      // lazy continuation of the previous item
      if (items.length && l.trim() && /^\s{2,}\S/.test(l) && !RE_TABLE.test(l) && !RE_FENCE.test(l)) {
        items[items.length - 1].text += ' ' + l.trim(); i++; continue;
      }
      break;
    }

    let html = '';
    const stack = [];
    for (const it of items) {
      while (stack.length && it.indent < stack[stack.length - 1].indent) {
        html += '</li></' + stack.pop().type + '>';
      }
      if (!stack.length || it.indent > stack[stack.length - 1].indent) {
        html += '<' + it.type + '>';
        stack.push({ type: it.type, indent: it.indent });
        html += '<li>' + inline(it.text);
      } else if (it.type !== stack[stack.length - 1].type) {
        html += '</li></' + stack.pop().type + '>';
        html += '<' + it.type + '>';
        stack.push({ type: it.type, indent: it.indent });
        html += '<li>' + inline(it.text);
      } else {
        html += '</li><li>' + inline(it.text);
      }
    }
    while (stack.length) html += '</li></' + stack.pop().type + '>';
    out.push(html);
    continue;
  }

  // paragraph
  const buf = [];
  while (i < L.length && !startsBlock(L[i])) { buf.push(L[i].trim()); i++; }
  out.push('<p>' + inline(buf.join(' ')) + '</p>');
}

// ──────────────────────────── document ────────────────────────────

const docTitle = opt.title || title || SRC.replace(/^.*[\\/]/, '').replace(/\.md$/i, '');
const showToc = opt.toc && toc.length > 1;

const nav = showToc
  ? '<nav><b>목차</b>\n' + toc.map(t => '<a href="#' + t.id + '">' + esc(t.text) + '</a>').join('\n') + '\n</nav>'
  : '';

const html = `<!DOCTYPE html>
<html lang="${esc(opt.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="mdBrown">
<title>${esc(docTitle)}</title>
<style>
:root{
  --bg:#fbfaf8; --surface:#fff; --ink:#1c1b19; --ink-2:#4a4741; --ink-3:#7a766e;
  --line:#e4e0d8; --line-2:#efece5; --accent:#8a5a2b; --accent-ink:#6d4520;
  --mark:#fdf3e3; --quote:#f5f2ec;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#161513; --surface:#1d1c19; --ink:#eceae5; --ink-2:#bdb8ae; --ink-3:#8b867c;
    --line:#33312c; --line-2:#282621; --accent:#d6a570; --accent-ink:#e8bf90;
    --mark:#2a231a; --quote:#211f1b;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,
    "Apple SD Gothic Neo","Segoe UI","Malgun Gothic","맑은 고딕","Noto Sans KR",sans-serif;
  font-size:16px; line-height:1.78; letter-spacing:-.003em;
  word-break:keep-all; overflow-wrap:anywhere;
}
.wrap{max-width:1180px; margin:0 auto; padding:56px 28px 96px; display:grid;
  grid-template-columns:minmax(0,1fr)${showToc ? ' 232px' : ''}; gap:56px; align-items:start}
main{min-width:0}
h1{font-size:2.05rem; line-height:1.32; letter-spacing:-.022em; margin:0 0 20px; font-weight:800}
h2{font-size:1.42rem; line-height:1.4; letter-spacing:-.017em; font-weight:750;
  margin:64px 0 18px; padding-top:22px; border-top:2px solid var(--line)}
h3{font-size:1.08rem; letter-spacing:-.012em; font-weight:700; margin:38px 0 12px}
h4,h5,h6{font-size:.98rem; font-weight:700; margin:26px 0 10px; color:var(--ink-2)}
h1+p{color:var(--ink-2); font-size:.94rem; margin-top:0}
p{margin:0 0 17px}
hr{border:0; height:1px; background:var(--line); margin:44px 0}
h2+hr,hr+h2{display:none}
a{color:var(--accent); text-decoration:none;
  border-bottom:1px solid color-mix(in srgb,var(--accent) 34%,transparent)}
a:hover{color:var(--accent-ink); border-bottom-color:currentColor}
strong{font-weight:700; color:var(--ink)}
em{font-style:normal; background:var(--mark); padding:.1em .3em; border-radius:3px}
del{color:var(--ink-3)}
img{max-width:100%; height:auto; border-radius:8px}
code{font-family:ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;
  font-size:.86em; background:var(--line-2); padding:.14em .42em; border-radius:4px; color:var(--ink-2)}
pre{background:var(--line-2); border:1px solid var(--line); border-radius:10px;
  padding:16px 18px; overflow-x:auto; margin:0 0 22px}
pre code{background:none; padding:0; font-size:.85rem; line-height:1.6; color:var(--ink)}
ul,ol{margin:0 0 18px; padding-left:1.35em}
li{margin:0 0 9px}
li>ul,li>ol{margin:9px 0 0}
li::marker{color:var(--ink-3)}
blockquote{margin:22px 0; padding:18px 22px; background:var(--quote);
  border-left:3px solid var(--accent); border-radius:0 8px 8px 0}
blockquote p{margin:0 0 10px; color:var(--ink-2)}
blockquote p:last-child{margin:0}
.tw{overflow-x:auto; margin:0 0 24px; border:1px solid var(--line);
  border-radius:10px; background:var(--surface)}
table{border-collapse:collapse; width:100%; font-size:.9rem; line-height:1.6}
th,td{padding:11px 14px; text-align:left; vertical-align:top; border-bottom:1px solid var(--line-2)}
th{background:var(--line-2); font-weight:700; white-space:nowrap; color:var(--ink-2);
  font-size:.83rem; letter-spacing:.01em}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:color-mix(in srgb,var(--mark) 55%,transparent)}
nav{position:sticky; top:56px; font-size:.83rem; line-height:1.5;
  border-left:1px solid var(--line); padding-left:18px}
nav b{display:block; font-size:.72rem; letter-spacing:.09em; text-transform:uppercase;
  color:var(--ink-3); margin-bottom:12px; font-weight:650}
nav a{display:block; padding:5px 0; color:var(--ink-2); border:0}
nav a:hover{color:var(--accent)}
@media (max-width:960px){
  .wrap{grid-template-columns:minmax(0,1fr); gap:0; padding:36px 20px 72px}
  nav{position:static; border-left:0; border-top:1px solid var(--line);
    padding:22px 0 0; margin-top:48px; order:2}
  nav a{display:inline-block; margin-right:16px}
  h1{font-size:1.68rem}
}
@media print{
  :root{--bg:#fff; --surface:#fff; --ink:#000; --ink-2:#333; --line:#bbb; --line-2:#eee;
    --accent:#000; --mark:#f2f2f2; --quote:#f7f7f7}
  .wrap{display:block; max-width:none; padding:0}
  nav{display:none}
  h2{break-after:avoid} table,blockquote,ul,ol,pre{break-inside:avoid}
  a{border:0}
}
</style>
</head>
<body>
<div class="wrap">
<main>
${out.join('\n')}
</main>
${nav}
</div>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('mdBrown → ' + OUT);
console.log('  blocks ' + out.length + ' · sections ' + toc.length + ' · ' + Buffer.byteLength(html) + ' bytes');
