'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { nextVersion, bumpVersion } = require('../scripts/bump-version');
const { tmpDir } = require('./helpers');

test('bump keywords', () => {
  assert.equal(nextVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
});

test('explicit version, with or without v', () => {
  assert.equal(nextVersion('0.1.0', '0.1.1'), '0.1.1');
  assert.equal(nextVersion('0.1.0', 'v0.2.0'), '0.2.0');
});

test('rejects anything else', () => {
  assert.throws(() => nextVersion('0.1.0', '0.1'), /expected X.Y.Z/);
  assert.throws(() => nextVersion('0.1.0', undefined), /expected X.Y.Z/);
});

function fixture(packageText = '{"version": "0.1.0"}') {
  const root = tmpDir('compressor-bump-');
  fs.mkdirSync(path.join(root, '.claude-plugin'));
  fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), '{"version": "0.1.0"}');
  fs.writeFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), '{"plugins": [{"version": "0.1.0"}]}');
  fs.writeFileSync(path.join(root, 'package.json'), packageText);
  fs.writeFileSync(path.join(root, 'README.md'), 'Install #v0.1.0');
  return root;
}

test('a late validation or read failure leaves every version unchanged', () => {
  for (const packageText of ['{"version": "0.2.0"}', '{"version": "0.1.0", broken}']) {
    const root = fixture(packageText);
    assert.throws(() => bumpVersion('patch', root));
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'))).version, '0.1.0');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'))).plugins[0].version, '0.1.0');
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), packageText);
  }
  const root = fixture();
  fs.unlinkSync(path.join(root, 'README.md'));
  assert.throws(() => bumpVersion('patch', root), /ENOENT/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '0.1.0');
});

test('bump updates all manifests and README after validation', () => {
  const root = fixture();
  bumpVersion('patch', root);
  for (const file of ['.claude-plugin/plugin.json', 'package.json']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, file))).version, '0.1.1');
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/marketplace.json'))).plugins[0].version, '0.1.1');
  assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), 'Install #v0.1.1');
});
