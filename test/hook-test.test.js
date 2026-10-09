'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { samplePayload } = require('../scripts/hook-test');
const { isolatedEnv } = require('./helpers');

test('sample payload preserves shell syntax and cwd through JSON', () => {
  const command = 'git commit -m "message"\necho \\path "$HOME" `uname`';
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'hook-test.js')], {
    env: isolatedEnv({ CMD: command }), encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), samplePayload(command));
});

test('make hook-test handles quotes and newlines without a JSON parse error', () => {
  const result = spawnSync('make', ['--silent', 'hook-test'], {
    env: isolatedEnv({ CMD: 'git commit -m "message"\necho \\path', COMPRESSOR_COMPRESSORS: '' }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});
