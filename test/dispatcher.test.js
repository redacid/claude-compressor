'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { compress, handle } = require('../src/dispatcher');
const { fake, tmpDir, tmpJson, bashPayload, isolatedEnv } = require('./helpers');

const ENV = { COMPRESSOR_CONFIG: '/nonexistent/compressor.json' };

test('first available matching compressor wins', () => {
  const list = [
    fake('off', { available: false }),
    fake('nomatch', { matches: () => false }),
    fake('a'),
    fake('b'),
  ];
  assert.deepEqual(compress('ls', list), { compressor: 'a', command: 'a ls', allow: false });
});

test('no-op, empty and throwing rewrites fall through', () => {
  const list = [
    fake('same', { rewrite: (c) => c }),
    fake('empty', { rewrite: () => '  ' }),
    fake('null', { rewrite: () => null }),
    fake('boom', { rewrite: () => { throw new Error('x'); } }),
    fake('ok'),
  ];
  assert.equal(compress('ls', list).compressor, 'ok');
  assert.equal(compress('ls', list.slice(0, 4)), null);
  assert.equal(compress('   ', [fake('a')]), null);
});

test('handle builds updatedInput without permissionDecision and keeps other fields', () => {
  const out = handle(bashPayload('ls', { description: 'list', timeout: 5 }), { env: ENV, compressors: [fake('a')] });
  assert.deepEqual(out, {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecisionReason: 'compressor: rewritten by a',
      updatedInput: { command: 'a ls', description: 'list', timeout: 5 },
    },
  });
  assert.equal('permissionDecision' in out.hookSpecificOutput, false);
});

test('allow verdict becomes permissionDecision allow, only when strictly true', () => {
  const allowed = handle(bashPayload('ls'), {
    env: ENV,
    compressors: [fake('a', { rewrite: (c) => ({ command: `a ${c}`, allow: true }) })],
  });
  assert.equal(allowed.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(allowed.hookSpecificOutput.updatedInput.command, 'a ls');

  for (const allow of [false, 'yes', 1, undefined]) {
    const out = handle(bashPayload('ls'), {
      env: ENV,
      compressors: [fake('a', { rewrite: (c) => ({ command: `a ${c}`, allow }) })],
    });
    assert.equal('permissionDecision' in out.hookSpecificOutput, false, String(allow));
  }
});

test('compress passes the hook cwd to compressors', () => {
  let seen;
  compress('ls', [fake('a', { rewrite: (c, ctx) => { seen = ctx; return `a ${c}`; } })], { cwd: '/x' });
  assert.deepEqual(seen, { cwd: '/x' });
});

test('handle ignores non-Bash tools, bad input and disabled config', () => {
  const list = [fake('a')];
  assert.equal(handle({ tool_name: 'Read', tool_input: { command: 'ls' } }, { env: ENV, compressors: list }), null);
  assert.equal(handle({ tool_name: 'Bash', tool_input: {} }, { env: ENV, compressors: list }), null);
  assert.equal(handle(null, { env: ENV, compressors: list }), null);
  assert.equal(handle(bashPayload('ls'), { env: { ...ENV, COMPRESSOR_DISABLE: '1' }, compressors: list }), null);
});

test('handle respects user config disabling', () => {
  const user = tmpJson({ enabled: false });
  assert.equal(handle(bashPayload('ls'), { env: { COMPRESSOR_CONFIG: user }, compressors: [fake('a')] }), null);
});

function runHook(stdin, env = {}) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'dispatch.js')], {
    input: stdin,
    encoding: 'utf8',
    env: isolatedEnv(env),
  });
}

test('hook entry fails open on garbage input', () => {
  const r = runHook('not json');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('hook entry prints nothing when no compressor is enabled', () => {
  const r = runHook(JSON.stringify(bashPayload('git status')), { COMPRESSOR_COMPRESSORS: '' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('COMPRESSOR_LOG appends debug lines to a file', () => {
  const fs = require('node:fs');
  const log = path.join(tmpDir('compressor-log-'), 'hook.log');
  const fixtures = path.join(__dirname, 'fixtures', 'bin');
  const r = runHook(JSON.stringify(bashPayload('git status')), {
    COMPRESSOR_LOG: log,
    COMPRESSOR_COMPRESSORS: 'rtk',
    COMPRESSOR_RTK_BIN: path.join(fixtures, 'fake-rtk'),
  });
  assert.equal(r.status, 0);
  assert.match(fs.readFileSync(log, 'utf8'), /rtk: git status -> rtk git status/);
});
