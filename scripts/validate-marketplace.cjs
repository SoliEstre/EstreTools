'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'));
const names = new Set();
assert.equal(catalog.name, 'estretools');
assert.ok(catalog.owner.name);
for (const entry of catalog.plugins) {
  assert.match(entry.name, /^[a-z][a-z0-9-]*$/);
  assert.ok(!names.has(entry.name), 'Duplicate plugin ' + entry.name); names.add(entry.name);
  assert.match(entry.source, /^\.\/plugins\/[a-z0-9-]+$/);
  let current = root;
  for (const part of entry.source.slice(2).split('/')) {
    assert.ok(fs.readdirSync(current).includes(part), 'Path casing mismatch: ' + entry.source);
    current = path.join(current, part);
  }
  const plugin = JSON.parse(fs.readFileSync(path.join(current, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(plugin.name, entry.name); assert.equal(plugin.version, entry.version);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(fs.statSync(path.join(current, 'skills')).isDirectory());
  if (fs.existsSync(path.join(current, 'package.json'))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8'));
    assert.equal(pkg.version, plugin.version);
  }
  console.log('OK ' + entry.name + '@' + entry.version + ' → ' + entry.source);
}
for (const target of Object.values(catalog.renames || {})) assert.ok(target === null || names.has(target));
assert.ok(names.has('mdbrown')); assert.ok(names.has('md-in-pdf2md'));
