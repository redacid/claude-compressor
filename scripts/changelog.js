#!/usr/bin/env node
'use strict';

// Builds release notes from the pull requests merged into main between the
// previous release tag and the given one. Walks main's first-parent history,
// so each entry is one merge (or squash) commit created by a pull request.
//
//   node scripts/changelog.js <tag> [previous-tag]
//
// Recognised commit subjects (GitHub and Gitea, merge and squash):
//   Merge pull request #12 from user/branch           (title: first body line)
//   Merge pull request 'Title' (#12) from branch into main
//   Title (#12)
// Commits pushed to main without a pull request are not listed.

const { spawnSync } = require('node:child_process');

const TAG_RE = /^v\d+\.\d+\.\d+$/;

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`);
  return r.stdout;
}

function previousTag(tag) {
  const r = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*', `${tag}^`],
    { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Returns { number, title } for a pull request commit, or null.
function parsePullRequest(subject, body = '') {
  let m = subject.match(/^Merge pull request #(\d+) from (\S+)/);
  if (m) {
    const title = body.split('\n').map((l) => l.trim()).find(Boolean);
    return { number: Number(m[1]), title: title || m[2] };
  }
  m = subject.match(/^Merge pull request '(.+)' \(#(\d+)\) from \S+ into \S+/);
  if (m) return { number: Number(m[2]), title: m[1] };
  m = subject.match(/^(.+?) \(#(\d+)\)$/);
  if (m) return { number: Number(m[2]), title: m[1] };
  return null;
}

function commits(range) {
  return git(['log', '--first-parent', '--format=%s%x1f%b%x1e', range])
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [subject, body = ''] = r.split('\x1f');
      return { subject, body };
    });
}

function render(tag, prev, prs) {
  const lines = [`## ${tag}`, ''];
  if (prs.length === 0) {
    lines.push(prev ? `No pull requests merged since ${prev}.` : 'Initial release.');
  } else {
    for (const pr of prs) lines.push(`- ${pr.title} (#${pr.number})`);
  }
  if (prev) lines.push('', `Changes since ${prev}.`);
  return lines.join('\n') + '\n';
}

function main(argv) {
  const [tag, prevArg] = argv;
  if (!tag || !TAG_RE.test(tag)) {
    process.stderr.write('usage: changelog.js <vX.Y.Z> [previous-tag]\n');
    return 2;
  }
  const prev = prevArg || previousTag(tag);
  const prs = commits(prev ? `${prev}..${tag}` : tag)
    .map((c) => parsePullRequest(c.subject, c.body))
    .filter(Boolean);
  process.stdout.write(render(tag, prev, prs));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`changelog: ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parsePullRequest, render };
