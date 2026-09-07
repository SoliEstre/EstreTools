'use strict';

// Shared fence boundaries; code contents must never pass through inline Markdown.
function opening(line) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/);
  if (!match || (match[1][0] === '`' && match[2].includes('`'))) return null;
  return { marker: match[1][0], length: match[1].length, lang: match[2].trim().split(/\s+/)[0] };
}
function closing(line, fence) {
  const match = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
  return !!match && match[1][0] === fence.marker && match[1].length >= fence.length;
}
function protect(text, replace) {
  const lines = text.split(/\r?\n/), output = [];
  for (let i = 0; i < lines.length; i++) {
    const fence = opening(lines[i]);
    if (!fence) { output.push(lines[i]); continue; }
    const body = [];
    while (++i < lines.length && !closing(lines[i], fence)) body.push(lines[i]);
    output.push(replace(body.join('\n'), fence.lang));
  }
  return output.join('\n');
}
module.exports = { opening, closing, protect };
