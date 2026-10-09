'use strict';

// Runs against the real rtk binary; skipped when rtk is not installed.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const rtk = require('../src/compressors/rtk');

const real = rtk.findOnPath('rtk');
const opts = { skip: real ? false : 'rtk is not installed' };

function hook(command) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'dispatch.js')], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, COMPRESSOR_CONFIG: '/nonexistent/compressor.json', COMPRESSOR_RTK_BIN: real || '' },
  });
  assert.equal(r.status, 0);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.updatedInput.command : null;
}

test('real rtk: supported commands are rewritten', opts, () => {
  assert.equal(hook('git status'), 'rtk git status');
  assert.equal(hook('cd /tmp && git status'), 'cd /tmp && rtk git status');
});

test('real rtk: unsupported and guarded commands pass through', opts, () => {
  for (const cmd of ['echo hi', 'rtk git status', 'git status > out.txt', 'cat <<EOF\nx\nEOF', 'git add -p']) {
    assert.equal(hook(cmd), null, cmd);
  }
});
