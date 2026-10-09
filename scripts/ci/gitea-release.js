#!/usr/bin/env node
'use strict';

// Creates a Gitea release for a tag and uploads its assets through the API.
//
//   node scripts/ci/gitea-release.js <tag> <notes-file> <asset> [asset ...]
//
// Env: GITEA_URL (server, e.g. https://git.example.com), GITEA_REPO (owner/name),
//      GITEA_TOKEN (token allowed to write releases).

const fs = require('node:fs');
const path = require('node:path');

async function api(method, url, token, body) {
  const headers = { Authorization: `token ${token}`, Accept: 'application/json' };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main([tag, notesFile, ...assets]) {
  const { GITEA_URL, GITEA_REPO, GITEA_TOKEN } = process.env;
  if (!tag || !notesFile || !GITEA_URL || !GITEA_REPO || !GITEA_TOKEN) {
    throw new Error('usage: GITEA_URL=… GITEA_REPO=… GITEA_TOKEN=… gitea-release.js <tag> <notes> <asset>…');
  }
  const base = `${GITEA_URL.replace(/\/$/, '')}/api/v1/repos/${GITEA_REPO}/releases`;
  const release = await api('POST', base, GITEA_TOKEN, {
    tag_name: tag,
    name: tag,
    body: fs.readFileSync(notesFile, 'utf8'),
    draft: false,
    prerelease: false,
  });
  for (const file of assets) {
    const name = path.basename(file);
    const form = new FormData();
    form.append('attachment', new Blob([fs.readFileSync(file)]), name);
    await api('POST', `${base}/${release.id}/assets?name=${encodeURIComponent(name)}`, GITEA_TOKEN, form);
    console.log(`uploaded ${name}`);
  }
  console.log(`released ${tag}: ${release.html_url}`);
}

main(process.argv.slice(2)).catch((err) => {
  console.error(`gitea-release: ${err.message}`);
  process.exitCode = 1;
});
