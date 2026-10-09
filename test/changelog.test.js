'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePullRequest, render } = require('../scripts/changelog');

test('GitHub merge commit takes the title from the body', () => {
  assert.deepEqual(parsePullRequest('Merge pull request #12 from me/feat-x', '\nAdd whitespace compressor\n'),
    { number: 12, title: 'Add whitespace compressor' });
  assert.deepEqual(parsePullRequest('Merge pull request #3 from me/fix'), { number: 3, title: 'me/fix' });
});

test('Gitea merge commit carries the title in the subject', () => {
  assert.deepEqual(parsePullRequest("Merge pull request 'Fix git log width' (#7) from fix-log into main"),
    { number: 7, title: 'Fix git log width' });
});

test('squash merge on either forge', () => {
  assert.deepEqual(parsePullRequest('Keep ls -l columns (#9)'), { number: 9, title: 'Keep ls -l columns' });
});

test('commits without a pull request are ignored', () => {
  assert.equal(parsePullRequest('Bump version to 0.2.0'), null);
  assert.equal(parsePullRequest('Merge branch main into feat'), null);
});

test('render lists pull requests and handles empty ranges', () => {
  assert.equal(render('v0.2.0', 'v0.1.0', [{ number: 9, title: 'A' }]),
    '## v0.2.0\n\n- A (#9)\n\nChanges since v0.1.0.\n');
  assert.equal(render('v0.1.0', null, []), '## v0.1.0\n\nInitial release.\n');
  assert.match(render('v0.2.0', 'v0.1.0', []), /No pull requests merged since v0.1.0/);
});
