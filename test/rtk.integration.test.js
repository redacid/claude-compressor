'use strict';

// Runs against the real rtk binary; skipped when rtk is not installed.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const rtk = require('../src/compressors/rtk');

const real = rtk.findOnPath('rtk');
const opts = { skip: real ? false : 'rtk is not installed' };

function answer(command, cwd) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'dispatch.js')], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, COMPRESSOR_CONFIG: '/nonexistent/compressor.json', COMPRESSOR_RTK_BIN: real || '' },
  });
  assert.equal(r.status, 0);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}

function hook(command, cwd) {
  const out = answer(command, cwd);
  return out ? out.updatedInput.command : null;
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

test('real rtk: allow only when project rules already allow the original', opts, () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compressor-perm-'));
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({
    permissions: { allow: ['Bash(git status:*)'], ask: ['Bash(git log:*)'], deny: ['Bash(git push:*)'] },
  }));

  const allowed = answer('git status', dir);
  assert.equal(allowed.updatedInput.command, 'rtk git status');
  assert.equal(allowed.permissionDecision, 'allow');

  for (const cmd of ['git log -3', 'git diff', 'git status && rm -rf zzz']) {
    const out = answer(cmd, dir);
    assert.ok(out, cmd);
    assert.equal('permissionDecision' in out, false, cmd);
  }

  assert.equal(answer('git push', dir), null, 'denied command is not rewritten');
  assert.equal(answer('git status && git push', dir), null);
});
