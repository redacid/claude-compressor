#!/usr/bin/env node
'use strict';

// Runs a fixed set of read-only commands in each target repository, raw and
// rewritten by the plugin, and compares output size.
//
//   node scripts/benchmark.js [--md] [dir ...]     (default dir: this repo)

const path = require('node:path');
const { spawnSync } = require('node:child_process');
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

function run(command, cwd) {
  const r = spawnSync('sh', ['-c', `${command} 2>&1`], {
    cwd,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  return r.stdout || '';
}

function measure(text) {
  const bytes = Buffer.byteLength(text);
  return { bytes, lines: text ? text.split('\n').length : 0, tokens: Math.ceil(text.length / 4) };
}

function pct(before, after) {
  return before ? `${(((before - after) / before) * 100).toFixed(1)}%` : '—';
}

function benchRepo(dir, compressors) {
  const rows = [];
  for (const command of COMMANDS) {
    const result = compress(command, compressors);
    const raw = measure(run(command, dir));
    const rewritten = result ? result.command : null;
    const out = rewritten ? measure(run(rewritten, dir)) : raw;
    rows.push({ command, rewritten, raw, out });
  }
  return rows;
}

function totals(rows) {
  const sum = (key, field) => rows.reduce((n, r) => n + r[key][field], 0);
  return {
    raw: { bytes: sum('raw', 'bytes'), tokens: sum('raw', 'tokens') },
    out: { bytes: sum('out', 'bytes'), tokens: sum('out', 'tokens') },
  };
}

function printText(dir, rows) {
  console.log(`\n${dir}`);
  for (const r of rows) {
    const mark = r.rewritten ? pct(r.raw.tokens, r.out.tokens).padStart(7) : '   skip';
    console.log(`${mark}  ${String(r.raw.tokens).padStart(7)} -> ${String(r.out.tokens).padEnd(7)} ${r.command}`);
  }
  const t = totals(rows);
  console.log(`  total ${t.raw.tokens} -> ${t.out.tokens} tokens (${pct(t.raw.tokens, t.out.tokens)} saved)`);
}

function printMd(dir, rows) {
  console.log(`\n### ${path.basename(dir)}\n`);
  console.log('| Команда | Переписано на | Байти до | Байти після | Токени до | Токени після | Економія |');
  console.log('|---|---|---:|---:|---:|---:|---:|');
  for (const r of rows) {
    const cmd = `\`${r.command.replace(/\|/g, '\\|')}\``;
    const rw = r.rewritten ? `\`${r.rewritten.replace(/\|/g, '\\|')}\`` : '— (без змін)';
    const save = r.rewritten ? pct(r.raw.tokens, r.out.tokens) : '—';
    console.log(`| ${cmd} | ${rw} | ${r.raw.bytes} | ${r.out.bytes} | ${r.raw.tokens} | ${r.out.tokens} | ${save} |`);
  }
  const t = totals(rows);
  console.log(`| **Разом** | | ${t.raw.bytes} | ${t.out.bytes} | ${t.raw.tokens} | ${t.out.tokens} | **${pct(t.raw.tokens, t.out.tokens)}** |`);
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
  for (const dir of dirs) {
    const rows = benchRepo(path.resolve(dir), compressors);
    (md ? printMd : printText)(path.resolve(dir), rows);
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
