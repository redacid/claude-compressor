'use strict';

// rtk adapter (https://github.com/rtk-ai/rtk). The decision which commands rtk
// supports is delegated to `rtk rewrite`; this module only adds guards for
// cases where a compressed output would be wrong or the command would hang.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { maskQuotes, segments, redirectsToFile } = require('../shell');
const { debug } = require('../log');

// Exit codes of `rtk rewrite` that carry a rewritten command on stdout.
// 0 = rewrite, 3 = rewrite but leave the permission decision to the host.
const REWRITE_CODES = new Set([0, 3]);
const TIMEOUT_MS = 3000;

const INTERACTIVE = new Set([
  'vi', 'vim', 'nvim', 'nano', 'emacs', 'less', 'more', 'most', 'man',
  'top', 'htop', 'btop', 'watch', 'ssh', 'tmux', 'screen', 'fzf', 'tig',
]);

let cachedBin;

function findOnPath(name, envPath = process.env.PATH || '') {
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    const file = path.join(dir, name);
    try {
      fs.accessSync(file, fs.constants.X_OK);
      if (fs.statSync(file).isFile()) return file;
    } catch {
      // not here
    }
  }
  return null;
}

function rtkBin() {
  if (cachedBin === undefined) {
    cachedBin = process.env.COMPRESSOR_RTK_BIN || findOnPath('rtk');
  }
  return cachedBin;
}

function resetCache() {
  cachedBin = undefined;
}

function isInteractive(words) {
  const [cmd, sub] = words;
  const args = words.slice(1);
  const has = (...flags) => args.some((a) => flags.includes(a));
  if (INTERACTIVE.has(cmd)) return true;
  if (cmd === 'git') {
    if (sub === 'add' && has('-p', '-i', '--patch', '--interactive')) return true;
    if (sub === 'rebase' && has('-i', '--interactive')) return true;
    if (sub === 'commit' && has('-p', '--patch')) return true;
  }
  if (['docker', 'podman', 'kubectl', 'oc'].includes(cmd) && ['exec', 'run', 'attach'].includes(sub)) {
    if (args.some((a) => /^-[a-z]*[it][a-z]*$/.test(a) && !a.startsWith('--')) || has('--interactive', '--tty', '--stdin')) {
      return true;
    }
  }
  // Streaming / follow modes never finish, so a buffering filter would hide everything.
  if ((cmd === 'tail' || sub === 'logs') && has('-f', '-F', '--follow')) return true;
  return false;
}

// Reasons to leave the command alone, checked before asking rtk.
function skipReason(command) {
  // Checked on the raw text: substitutions still run inside double quotes,
  // and over-skipping is harmless.
  if (command.includes('<<')) return 'heredoc';
  if (/\$\(|`/.test(command)) return 'command substitution';
  const masked = maskQuotes(command);
  if (masked === null) return 'unbalanced quotes';
  if (redirectsToFile(masked)) return 'redirect to file';
  const segs = segments(masked);
  if (segs.length === 0) return 'empty';
  for (const words of segs) {
    if (words[0] === 'rtk') return 'already rtk';
    if (words[0] === 'tee') return 'tee';
    if (isInteractive(words)) return 'interactive';
  }
  return null;
}

module.exports = {
  name: 'rtk',

  isAvailable() {
    return Boolean(rtkBin());
  },

  matches(command) {
    const reason = skipReason(command);
    if (reason) debug(`rtk: skip (${reason}): ${command}`);
    return reason === null;
  },

  rewrite(command) {
    const r = spawnSync(rtkBin(), ['rewrite', command], {
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (r.error || !REWRITE_CODES.has(r.status)) return null;
    const out = r.stdout.replace(/\n+$/, '');
    if (!out || !/(^|[\s;&|(])rtk\s/.test(out)) return null;
    return out;
  },

  // exported for tests
  skipReason,
  isInteractive,
  findOnPath,
  resetCache,
};
