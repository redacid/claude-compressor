#!/usr/bin/env node
'use strict';

// Sets the plugin version everywhere it is written down: plugin.json,
// marketplace.json, package.json and the pinned-release example in README.
// Edits the text in place so the files keep their formatting.
//
//   node scripts/bump-version.js <X.Y.Z | vX.Y.Z | major | minor | patch>

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

const FILES = [
  ['.claude-plugin/plugin.json', (s, from, to) => s.replace(`"version": "${from}"`, `"version": "${to}"`)],
  ['.claude-plugin/marketplace.json', (s, from, to) => s.split(`"version": "${from}"`).join(`"version": "${to}"`)],
  ['package.json', (s, from, to) => s.replace(`"version": "${from}"`, `"version": "${to}"`)],
  ['README.md', (s, from, to) => s.split(`#v${from}`).join(`#v${to}`)],
];

function nextVersion(current, arg) {
  const [, ma, mi, pa] = current.match(SEMVER).map(Number);
  if (arg === 'major') return `${ma + 1}.0.0`;
  if (arg === 'minor') return `${ma}.${mi + 1}.0`;
  if (arg === 'patch') return `${ma}.${mi}.${pa + 1}`;
  const m = arg && arg.match(SEMVER);
  if (!m) throw new Error(`expected X.Y.Z, vX.Y.Z, major, minor or patch, got "${arg || ''}"`);
  return `${m[1]}.${m[2]}.${m[3]}`;
}

function main([arg]) {
  const current = require(path.join(ROOT, '.claude-plugin/plugin.json')).version;
  const next = nextVersion(current, arg);
  if (next === current) {
    console.log(`version is already ${current}`);
    return;
  }
  for (const [file, edit] of FILES) {
    const full = path.join(ROOT, file);
    const before = fs.readFileSync(full, 'utf8');
    const after = edit(before, current, next);
    if (after === before && file !== 'README.md') throw new Error(`${file}: version ${current} not found`);
    fs.writeFileSync(full, after);
    console.log(`${file}: ${after === before ? 'unchanged' : `${current} -> ${next}`}`);
  }
  console.log(`\nNext: commit, open a PR to main, merge, then tag v${next} on main.`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`bump-version: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { nextVersion };
