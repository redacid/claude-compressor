'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const rtk = require('../src/compressors/rtk');

const FAKE = path.join(__dirname, 'fixtures', 'bin', 'fake-rtk');

function withBin(bin, fn) {
  const saved = process.env.COMPRESSOR_RTK_BIN;
  process.env.COMPRESSOR_RTK_BIN = bin;
  rtk.resetCache();
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.COMPRESSOR_RTK_BIN;
    else process.env.COMPRESSOR_RTK_BIN = saved;
    rtk.resetCache();
  }
}

test('skips commands that must not be compressed', () => {
  const cases = {
    'rtk git status': 'already rtk',
    'cd x && rtk git diff': 'already rtk',
    'cat <<EOF > f\nhi\nEOF': 'heredoc',
    'git commit -m "$(cat <<EOF\nmsg\nEOF\n)"': 'heredoc',
    'echo $(git status)': 'command substitution',
    'git log `git rev-parse HEAD`': 'command substitution',
    'git status > out.txt': 'redirect to file',
    'git log >> log.txt 2>&1': 'redirect to file',
    'git diff | tee out.txt': 'tee',
    'vim foo': 'interactive',
    'git add -p': 'interactive',
    'git rebase -i HEAD~3': 'interactive',
    'docker exec -it box sh': 'interactive',
    'kubectl exec -ti pod -- bash': 'interactive',
    'kubectl logs -f pod': 'interactive',
    'tail -f app.log': 'interactive',
    'echo "unterminated': 'unbalanced quotes',
    '   ': 'empty',
  };
  for (const [cmd, reason] of Object.entries(cases)) {
    assert.equal(rtk.skipReason(cmd), reason, cmd);
    assert.equal(rtk.matches(cmd), false, cmd);
  }
});

test('lets ordinary commands, chains and pipes through', () => {
  for (const cmd of [
    'git status',
    'cd /tmp && git status',
    'FOO=1 git diff',
    'git log -5 | head',
    'cargo test && git push',
    'git status 2>/dev/null',
    'npm test 2>&1',
    'git commit -m "a > b"',
    'docker ps -a',
    'kubectl logs pod',
  ]) {
    assert.equal(rtk.skipReason(cmd), null, cmd);
  }
});

test('isAvailable reflects the configured binary', () => {
  withBin(FAKE, () => assert.equal(rtk.isAvailable(), true));
  withBin('', () => {
    const saved = process.env.PATH;
    process.env.PATH = '/nonexistent';
    rtk.resetCache();
    try {
      assert.equal(rtk.isAvailable(), false);
    } finally {
      process.env.PATH = saved;
    }
  });
});

test('findOnPath finds executables only', () => {
  assert.equal(rtk.findOnPath('fake-rtk', path.dirname(FAKE)), FAKE);
  assert.equal(rtk.findOnPath('fake-rtk', '/nonexistent'), null);
});

test('rewrite uses rtk output and rejects anything else', () => {
  withBin(FAKE, () => {
    assert.equal(rtk.rewrite('git status'), 'rtk git status');
    assert.equal(rtk.rewrite('echo hi'), null);
    assert.equal(rtk.rewrite('garbage'), null);
  });
  withBin('/nonexistent/rtk', () => assert.equal(rtk.rewrite('git status'), null));
});

test('rewrite gives up on a hanging rtk', { timeout: 8000 }, () => {
  withBin(FAKE, () => assert.equal(rtk.rewrite('hang'), null));
});
