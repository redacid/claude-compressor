'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maskQuotes, segments, redirectsToFile } = require('../src/shell');

test('maskQuotes blanks quoted text and escapes, keeps length', () => {
  const cmd = `git commit -m "a > b" && echo 'x|y' \\>`;
  const masked = maskQuotes(cmd);
  assert.equal(masked.length, cmd.length);
  assert.equal(masked.includes('>'), false);
  assert.equal(masked.includes('|'), false);
  assert.equal(maskQuotes('echo "open'), null);
});

test('segments splits on control operators and drops env assignments', () => {
  assert.deepEqual(segments('FOO=1 git diff && cd x; ls | wc -l'), [
    ['git', 'diff'], ['cd', 'x'], ['ls'], ['wc', '-l'],
  ]);
  assert.deepEqual(segments('(cd x && make)'), [['cd', 'x'], ['make']]);
});

test('redirectsToFile ignores fd duplication and /dev/null', () => {
  for (const ok of ['cmd 2>&1', 'cmd >&2', 'cmd 2>&-', 'cmd 2>&1-', 'cmd 2>/dev/null', 'cmd > /dev/null 2>&1', 'cmd']) {
    assert.equal(redirectsToFile(ok), false, ok);
  }
  for (const bad of ['cmd > out', 'cmd >> log', 'cmd 2> err', 'cmd &> all', 'cmd >| f', 'cmd>out', 'cmd >&out.txt', 'cmd >&', 'cmd >&$FD', 'cmd 2>|file', 'cmd 2>&1 >out']) {
    assert.equal(redirectsToFile(bad), true, bad);
  }
});
