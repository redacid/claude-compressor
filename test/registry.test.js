'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCompressors } = require('../src/registry');

const DIR = path.join(__dirname, 'fixtures', 'compressors');

test('loads compressors in configured order', () => {
  const list = loadCompressors(['upper'], DIR);
  assert.deepEqual(list.map((c) => c.name), ['upper']);
});

test('skips missing, malformed and unsafe names', () => {
  const list = loadCompressors(['missing', 'broken', '../helpers', 'upper'], DIR);
  assert.deepEqual(list.map((c) => c.name), ['upper']);
});
