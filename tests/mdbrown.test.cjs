'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const scripts = path.resolve(__dirname, '../plugins/mdbrown/scripts');
const fixture = path.join(__dirname, 'fixtures/report.md');
function run(script, args) {
  return spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: 'utf8', timeout: 120000 });
}
function ok(result) { assert.equal(result.status, 0, result.stdout + result.stderr); }
function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdbrown-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
test('fences preserve literal syntax, nested fences, entities and CJK', t => {
  const dir = workspace(t), output = path.join(dir, 'report.html');
  ok(run('mdbrown.cjs', [fixture, output, '--no-mermaid']));
  ok(run('verify-html.cjs', [fixture, output, '--strict']));
  const html = fs.readFileSync(output, 'utf8');
  assert.equal((html.match(/<pre>/g) || []).length, 4);
  assert.ok(!html.includes('mmdOverlay'));
  fs.writeFileSync(output, html.replace('요청 &amp; 확인', '확인'));
  assert.equal(run('verify-html.cjs', [fixture, output]).status, 1);
});
test('fallback warns; explicit Mermaid fails without overwriting output', t => {
  const dir = workspace(t), output = path.join(dir, 'report.html');
  const fallback = run('mdbrown.cjs', [fixture, output, '--browser', path.join(dir, 'missing-browser')]);
  ok(fallback); assert.match(fallback.stderr, /WARN Mermaid/);
  ok(run('verify-html.cjs', [fixture, output, '--strict']));
  fs.writeFileSync(output, 'existing output');
  const required = run('mdbrown.cjs', [fixture, output, '--mermaid', '--browser', path.join(dir, 'missing-browser')]);
  assert.equal(required.status, 1);
  assert.equal(fs.readFileSync(output, 'utf8'), 'existing output');
});
test('missing flag value fails clearly', () => assert.equal(run('mdbrown.cjs', [fixture, '--browser']).status, 2));

test('real SVG rendering, integrity checks, offline viewer, zoom, pan and print', { skip: !process.env.MDBROWN_TEST_BROWSER }, async t => {
  const dir = workspace(t), output = path.join(dir, 'report.html'), second = path.join(dir, 'second.html');
  ok(run('mdbrown.cjs', [fixture, output, '--mermaid']));
  ok(run('verify-html.cjs', [fixture, output, '--strict']));
  const html = fs.readFileSync(output, 'utf8');
  assert.equal((html.match(/<figure class="mermaid-rendered"/g) || []).length, 2);
  assert.equal((html.match(/<pre>/g) || []).length, 2);
  assert.ok(!html.includes('mermaid.min.js'));
  ok(run('mdbrown.cjs', [fixture, second, '--mermaid']));
  assert.equal(fs.readFileSync(second, 'utf8'), html, 'same environment must render deterministically');
  fs.writeFileSync(second, html.replace(/data-mermaid-source="./, 'data-mermaid-source="0'));
  assert.equal(run('verify-html.cjs', [fixture, second]).status, 1);
  fs.writeFileSync(second, html.replace('<svg ', '<svg data-corrupt="yes" '));
  assert.equal(run('verify-html.cjs', [fixture, second]).status, 1);
  fs.writeFileSync(second, html.replace(/<figure class="mermaid-rendered"[\s\S]*?<\/figure>/, ''));
  assert.equal(run('verify-html.cjs', [fixture, second]).status, 1);
  const puppeteer = require('../plugins/mdbrown/node_modules/puppeteer-core');
  const { browserPath } = require('../plugins/mdbrown/scripts/mermaid.cjs');
  const browser = await puppeteer.launch({ executablePath: browserPath(), headless: true,
    args: process.env.MDBROWN_NO_SANDBOX === '1' ? ['--no-sandbox'] : [] });
  t.after(() => browser.close());
  const page = await browser.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  await page.setViewport({ width: 1000, height: 700 });
  await page.goto(pathToFileURL(output).href);
  const assertHeadingsVisible = async () => {
    assert.deepEqual(await page.$$eval('main h2', elements => elements.map(element => ({
      text: element.textContent,
      visible: getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().height > 0
    }))), [{ text: '처리 흐름', visible: true }, { text: '호출 순서', visible: true }]);
  };
  await assertHeadingsVisible();
  await page.click('.mmd-full');
  assert.equal(await page.$eval('#mmdOverlay', element => element.open), true);
  await page.click('[data-act="plus"]');
  assert.equal(await page.$eval('.mmd-zoom', element => element.textContent), '125%');
  await page.mouse.move(400, 300); await page.mouse.wheel({ deltaY: -200 });
  await page.waitForFunction(() => document.querySelector('.mmd-zoom').textContent !== '125%');
  for (let i = 0; i < 8; i++) await page.click('[data-act="plus"]');
  await page.mouse.move(500, 350); await page.mouse.down(); await page.mouse.move(300, 200, { steps: 5 }); await page.mouse.up();
  assert.ok(await page.$eval('.mmd-body', element => element.scrollLeft > 0 || element.scrollTop > 0));
  await page.click('[data-act="fit"]');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#mmdOverlay', element => element.open), false);
  assert.equal(await page.$$eval('.mermaid-rendered > svg', elements => elements.length), 2);
  assert.equal(await page.evaluate(() => document.activeElement.className), 'mmd-full');
  await page.click('.mmd-full');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.$$eval('.mermaid-rendered > svg', elements => elements.length), 2);
  await page.emulateMediaType('print');
  await assertHeadingsVisible();
  assert.equal(await page.$eval('.mmd-full', element => getComputedStyle(element).display), 'none');
  await page.setJavaScriptEnabled(false); await page.reload();
  assert.equal(await page.$$eval('.mermaid-rendered > svg', elements => elements.length), 2);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
});

test('invalid Mermaid keeps valid diagrams in auto mode', { skip: !process.env.MDBROWN_TEST_BROWSER }, t => {
  const dir = workspace(t), input = path.join(dir, 'mixed.md'), output = path.join(dir, 'mixed.html');
  fs.writeFileSync(input, '# Mixed\n\n```mermaid\nflowchart LR\nA-->B\n```\n\n```mermaid\nnot-a-diagram\n```\n');
  const result = run('mdbrown.cjs', [input, output]);
  ok(result); assert.match(result.stderr, /diagram 2/);
  const html = fs.readFileSync(output, 'utf8');
  assert.equal((html.match(/<figure class="mermaid-rendered"/g) || []).length, 1);
  assert.equal((html.match(/language-mermaid/g) || []).length, 1);
  ok(run('verify-html.cjs', [input, output, '--strict']));
});
