'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const fingerprint = s => createHash('sha256').update(s).digest('hex');
const pattern = () => /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

function browserPath(explicit) {
  if (explicit || process.env.MDBROWN_BROWSER) {
    const selected = explicit || process.env.MDBROWN_BROWSER;
    if (!fs.existsSync(selected)) throw new Error('Browser not found: ' + selected);
    return selected;
  }
  const candidates = process.platform === 'win32' ? [
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ] : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/microsoft-edge'];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('Chrome/Edge/Chromium not found; set --browser <path> or MDBROWN_BROWSER.');
  return found;
}

async function render(html, options = {}) {
  const matches = [...html.matchAll(pattern())];
  if (!matches.length || options.mermaid === false) return html;
  const warnings = [], results = [];
  let browser;
  try {
    let puppeteer, library;
    try {
      puppeteer = require('puppeteer-core');
      library = path.join(path.dirname(require.resolve('mermaid')), 'mermaid.min.js');
      if (!fs.existsSync(library)) throw new Error('Missing Mermaid browser bundle');
    } catch {
      throw new Error('Mermaid dependencies missing. Run npm ci --prefix "' + path.resolve(__dirname, '..') + '" (Node 22.12+).');
    }
    browser = await puppeteer.launch({ executablePath: browserPath(options.browser), headless: true,
      timeout: 30000, args: ['--disable-background-networking'],
      ...(process.env.MDBROWN_NO_SANDBOX === '1' ? { args: ['--disable-background-networking', '--no-sandbox'] } : {}) });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => request.abort());
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.addScriptTag({ path: library });
    for (let i = 0; i < matches.length; i++) {
      const source = decode(matches[i][1]);
      const result = await page.evaluate(async ({ source, index }) => {
        try {
          mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict',
            deterministicIds: true, deterministicIDSeed: 'mdbrown-' + index,
            fontFamily: 'Arial, "Malgun Gothic", sans-serif',
            secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'suppressErrorRendering'],
            suppressErrorRendering: true, sequence: { useMaxWidth: true }, flowchart: { useMaxWidth: true } });
          const value = await Promise.race([
            mermaid.render('mdbrown-diagram-' + index, source),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Diagram render timed out')), 20000))
          ]);
          const doc = new DOMParser().parseFromString(value.svg, 'image/svg+xml');
          if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('Invalid SVG');
          // The generated file remains inert and offline even if diagram configuration changes.
          for (const node of doc.querySelectorAll('script, foreignObject script, image, iframe, object, embed')) node.remove();
          for (const node of doc.querySelectorAll('*')) for (const attr of [...node.attributes]) {
            if (/^on/i.test(attr.name) || (/^(?:xlink:)?href$/i.test(attr.name) && !attr.value.startsWith('#')) ||
                /url\(\s*["']?(?!#)[^)]/i.test(attr.value)) node.removeAttribute(attr.name);
          }
          for (const style of doc.querySelectorAll('style')) {
            style.textContent = style.textContent.replace(/@import[^;]*;/gi, '').replace(/url\(\s*["']?(?!#)[^)]*\)/gi, 'none');
          }
          return { svg: new XMLSerializer().serializeToString(doc.documentElement) };
        } catch (error) { return { error: String(error.message || error).slice(0, 400) }; }
      }, { source, index: i });
      if (result.error) warnings.push('diagram ' + (i + 1) + ': ' + result.error);
      results.push(result.svg || null);
    }
  } catch (error) { warnings.push(error.message); }
  finally { if (browser) await browser.close(); }
  for (const warning of warnings) console.error('WARN Mermaid: ' + warning);
  if (options.mermaid === 'required' && (warnings.length || results.some(x => !x))) {
    throw new Error('Mermaid rendering failed; output was not written. Use --no-mermaid to retain code.');
  }
  let index = 0, count = 0;
  html = html.replace(pattern(), (original, encoded) => {
    const svg = results[index++];
    if (!svg) return original;
    count++;
    return '<figure class="mermaid-rendered" data-mermaid-source="' + fingerprint(decode(encoded)) +
      '" data-mermaid-svg="' + fingerprint(svg) + '">' + svg + '</figure>';
  });
  if (count) {
    const assets = path.join(__dirname, '../assets');
    html = html.replace('</head>', '<style>\n' + fs.readFileSync(path.join(assets, 'mermaid-viewer.css'), 'utf8') + '\n</style>\n</head>')
      .replace('</body>', '<script>\n' + fs.readFileSync(path.join(assets, 'mermaid-viewer.js'), 'utf8') + '\n</script>\n</body>');
  }
  console.log('  Mermaid ' + count + '/' + matches.length + ' rendered as static SVG');
  return html;
}
module.exports = { render, fingerprint, decode, browserPath };
