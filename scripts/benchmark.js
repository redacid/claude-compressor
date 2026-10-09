#!/usr/bin/env node
'use strict';

// Runs a fixed set of read-only commands in each target repository, raw and
// rewritten by the plugin, and compares output size.
//
//   node scripts/benchmark.js [--md] [dir ...]     (default dir: this repo)

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { compress } = require('../src/dispatcher');
const { loadCompressors } = require('../src/registry');

const COMMANDS = [
  'git status',
  'git log -20',
  'git log --stat -5',
  'git show HEAD~1',
  'git diff HEAD~3 --stat',
  'git diff HEAD~3',
  'git branch -a',
  'ls -la',
  'find . -type f -not -path "./.git/*"',
  'grep -rn "func\\|function" --include=*.go --include=*.js .',
  'wc -l $(git ls-files | head -50)',
  'git log --oneline -50 | head -20',
];

const TIMEOUT_MS = 60000;

function run(command, cwd, { timeout = TIMEOUT_MS } = {}) {
  const start = performance.now();
  const r = spawnSync('sh', ['-c', command], {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  const error = r.error ? r.error.code || r.error.message
    : r.signal ? `signal ${r.signal}` : r.status !== 0 ? `exit ${r.status}` : null;
  return {
    text: (r.stdout || '') + (r.stderr || ''),
    status: r.status,
    error,
    durationMs: performance.now() - start,
  };
}

function measure(text) {
  const bytes = Buffer.byteLength(text);
  return { bytes, lines: text ? text.split('\n').length : 0, tokens: Math.ceil(text.length / 4) };
}

function pct(before, after) {
  return before ? `${(((before - after) / before) * 100).toFixed(1)}%` : '—';
}

function benchRepo(dir, compressors, { commands = COMMANDS, execute = run } = {}) {
  const rows = [];
  for (const command of commands) {
    const start = performance.now();
    const result = compress(command, compressors, { cwd: dir });
    const rewriteMs = performance.now() - start;
    const rawResult = execute(command, dir);
    const raw = { ...measure(rawResult.text), ...rawResult };
    const rewritten = result ? result.command : null;
    const outResult = rewritten ? execute(rewritten, dir) : rawResult;
    const out = { ...measure(outResult.text), ...outResult };
    const errors = [];
    if (raw.error) errors.push(`raw: ${raw.error}`);
    if (rewritten && out.error) errors.push(`rewritten: ${out.error}`);
    rows.push({ command, rewritten, raw, out, rewriteMs, error: errors.join('; ') || null });
  }
  return rows;
}

function totals(rows) {
  const valid = rows.filter((r) => !r.error);
  const sum = (key, field) => valid.reduce((n, r) => n + r[key][field], 0);
  return {
    excluded: rows.length - valid.length,
    raw: { bytes: sum('raw', 'bytes'), tokens: sum('raw', 'tokens') },
    out: { bytes: sum('out', 'bytes'), tokens: sum('out', 'tokens') },
  };
}

function printText(dir, rows) {
  console.log(`\n${dir}`);
  for (const r of rows) {
    const mark = r.error ? '  error' : r.rewritten ? pct(r.raw.tokens, r.out.tokens).padStart(7) : '   skip';
    console.log(`${mark}  ${String(r.raw.tokens).padStart(7)} -> ${String(r.out.tokens).padEnd(7)} ${r.command} (rewrite ${r.rewriteMs.toFixed(1)} ms)${r.error ? ` [${r.error}]` : ''}`);
  }
  const t = totals(rows);
  console.log(`  total ${t.raw.tokens} -> ${t.out.tokens} estimated tokens (${pct(t.raw.tokens, t.out.tokens)} saved; ${t.excluded} failed measurements excluded)`);
}

function printMd(dir, rows) {
  console.log(`\n### ${path.basename(dir)}\n`);
  console.log('| Command | Rewritten to | Bytes before | Bytes after | Estimated tokens before | Estimated tokens after | Savings | Rewrite ms | Status |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) {
    const cmd = `\`${r.command.replace(/\|/g, '\\|')}\``;
    const rw = r.rewritten ? `\`${r.rewritten.replace(/\|/g, '\\|')}\`` : '— (unchanged)';
    const save = !r.error && r.rewritten ? pct(r.raw.tokens, r.out.tokens) : '—';
    const status = (r.error || 'ok').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    console.log(`| ${cmd} | ${rw} | ${r.raw.bytes} | ${r.out.bytes} | ${r.raw.tokens} | ${r.out.tokens} | ${save} | ${r.rewriteMs.toFixed(1)} | ${status} |`);
  }
  const t = totals(rows);
  console.log(`| **Total** | | ${t.raw.bytes} | ${t.out.bytes} | ${t.raw.tokens} | ${t.out.tokens} | **${pct(t.raw.tokens, t.out.tokens)}** | | ${t.excluded} failed measurements excluded |`);
}

function main(argv) {
  const md = argv.includes('--md');
  const dirs = argv.filter((a) => a !== '--md');
  if (dirs.length === 0) dirs.push(path.join(__dirname, '..'));

  const compressors = loadCompressors(['rtk']);
  if (!compressors.length || !compressors[0].isAvailable()) {
    console.error('rtk is not available on PATH');
    return 1;
  }
  let failed = false;
  for (const dir of dirs) {
    const rows = benchRepo(path.resolve(dir), compressors);
    if (rows.some((r) => r.error)) failed = true;
    (md ? printMd : printText)(path.resolve(dir), rows);
  }
  return failed ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { run, benchRepo, totals, printText, printMd };
