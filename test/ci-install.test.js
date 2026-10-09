'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { tmpDir, isolatedEnv } = require('./helpers');

function install(overrides = {}) {
  const root = tmpDir('compressor-ci-');
  const mockBin = path.join(root, 'mock-bin');
  fs.mkdirSync(mockBin);
  for (const name of ['curl', 'tar', 'npm', 'claude']) {
    const target = path.join(mockBin, name);
    fs.copyFileSync(path.join(__dirname, 'fixtures', 'bin', 'fake-ci-tool'), target);
    fs.chmodSync(target, 0o755);
  }
  const archive = path.join(root, 'archive');
  fs.writeFileSync(archive, 'test archive');
  const checksum = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  const log = path.join(root, 'calls.jsonl');
  const bin = path.join(root, 'installed');
  const env = isolatedEnv({
    PATH: `${mockBin}${path.delimiter}${process.env.PATH}`,
    BIN_DIR: bin,
    INSTALL_CLAUDE: '0',
    CLAUDE_CODE_VERSION: '2.1.294',
    GITHUB_PATH: path.join(root, 'github-path'),
    RTK_VERSION: 'test',
    RTK_SHA256: checksum,
    TEST_CI_ARCHIVE: archive,
    TEST_CI_LOG: log,
    TEST_CI_CURL_FAIL: '',
    ...overrides,
  });
  if (!env.RTK_SHA256) delete env.RTK_SHA256;
  const result = spawnSync('sh', [path.join(__dirname, '..', 'scripts', 'ci', 'install-tools.sh')], {
    env, encoding: 'utf8',
  });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [];
  return { result, calls, bin };
}

test('CI extracts only a verified archive and can skip Claude installation', () => {
  const { result, calls, bin } = install();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.map((c) => c.name), ['curl', 'tar']);
  assert.ok(fs.statSync(path.join(bin, 'rtk')).mode & 0o111);
  const download = calls[0].args[calls[0].args.indexOf('-o') + 1];
  assert.equal(fs.existsSync(path.dirname(download)), false, 'temporary download is cleaned up');
});

test('CI rejects checksum mismatches and failed downloads before extraction', () => {
  for (const overrides of [{ RTK_SHA256: '0'.repeat(64) }, { TEST_CI_CURL_FAIL: '1' }]) {
    const { result, calls, bin } = install(overrides);
    assert.notEqual(result.status, 0);
    assert.deepEqual(calls.map((c) => c.name), ['curl']);
    assert.equal(fs.existsSync(path.join(bin, 'rtk')), false);
  }
});

test('a custom rtk version requires an explicit checksum', () => {
  const { result, calls } = install({ RTK_SHA256: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /set RTK_SHA256/);
  assert.deepEqual(calls, []);
});

test('CI installs the pinned Claude CLI when requested', () => {
  const { result, calls } = install({ INSTALL_CLAUDE: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.map((c) => c.name), ['curl', 'tar', 'npm', 'claude']);
  assert.ok(calls[2].args.includes('@anthropic-ai/claude-code@2.1.294'));
});
