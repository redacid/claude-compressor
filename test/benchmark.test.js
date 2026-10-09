'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run, benchRepo, totals, printText, printMd } = require('../scripts/benchmark');
const { fake, tmpDir } = require('./helpers');

test('benchmark records nonzero exits, missing cwd and timeouts', () => {
  const cwd = tmpDir();
  const failed = run('printf output; printf error >&2; exit 7', cwd);
  assert.equal(failed.text, 'outputerror');
  assert.equal(failed.status, 7);
  assert.equal(failed.error, 'exit 7');
  assert.equal(run('printf ok', '/nonexistent/compressor-benchmark').error, 'ENOENT');
  const timeout = run(`exec "${process.execPath}" -e 'setTimeout(() => {}, 2000)'`, cwd, { timeout: 50 });
  assert.equal(timeout.error, 'ETIMEDOUT');
});

test('benchmark uses target cwd and excludes failed pairs from savings', () => {
  const cwd = tmpDir();
  const seen = [];
  const compressor = fake('compressed', { rewrite: (command, ctx) => {
    seen.push(ctx.cwd);
    return `compressed ${command}`;
  } });
  const rows = benchRepo(cwd, [compressor], {
    commands: ['ok', 'raw-fail', 'compressed-fail'],
    execute: (command, dir) => {
      assert.equal(dir, cwd);
      const fail = command === 'raw-fail' || command === 'compressed compressed-fail';
      return { text: command.startsWith('compressed ') ? 'x' : '12345678', error: fail ? 'exit 1' : null, status: fail ? 1 : 0 };
    },
  });
  assert.deepEqual(seen, [cwd, cwd, cwd]);
  assert.match(rows[1].error, /raw: exit 1/);
  assert.match(rows[2].error, /rewritten: exit 1/);
  assert.ok(rows.every((r) => r.rewriteMs >= 0));
  assert.deepEqual(totals(rows), { excluded: 2, raw: { bytes: 8, tokens: 2 }, out: { bytes: 1, tokens: 1 } });

  const lines = [];
  const log = console.log;
  console.log = (line) => lines.push(line);
  try {
    printText(cwd, rows);
    printMd(cwd, rows);
  } finally {
    console.log = log;
  }
  assert.match(lines.join('\n'), /estimated tokens/i);
  assert.match(lines.join('\n'), /2 failed measurements excluded/);
  const failedMd = lines.find((line) => line.startsWith('| `compressed-fail`'));
  assert.match(failedMd, /\| — \|/);
});
