'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextVersion } = require('../scripts/bump-version');

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
