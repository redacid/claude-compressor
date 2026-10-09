'use strict';

// rtk adapter (https://github.com/rtk-ai/rtk). The decision which commands rtk
// supports is delegated to `rtk rewrite`; this module only adds guards for
// cases where a compressed output would be wrong or the command would hang.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { maskQuotes, segments, redirectsToFile } = require('../shell');
const { debug } = require('../log');

// Exit codes of `rtk rewrite` (it reads the user's and project's
// settings.json permission rules, relative to its cwd):
//   0 = rewritten, and every part of the original command is allowed
//   1 = no rtk equivalent
//   2 = original is denied: leave it alone so the deny rule applies
//   3 = rewritten, no allow rule (or an ask rule): host decides
const EXIT_ALLOWED = 0;
const EXIT_REWRITTEN = 3;
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
  const cmd = path.posix.basename(words[0]);
  const args = words.slice(1);
  const has = (...flags) => args.some((arg) => flags.some((flag) => {
    if (flag.startsWith('--')) return arg === flag || arg.startsWith(`${flag}=`);
    return /^-[^-]/.test(arg) && arg.slice(1).includes(flag.slice(1));
  }));
  if (INTERACTIVE.has(cmd)) return true;
  if (cmd === 'git') {
    // Global options can precede the subcommand; ambiguous forms are skipped.
    if (args.includes('add') && has('-p', '-i', '--patch', '--interactive')) return true;
    if (args.includes('rebase') && has('-i', '--interactive')) return true;
    if (args.includes('commit') && has('-p', '-i', '--patch', '--interactive')) return true;
  }
  if (['docker', 'podman', 'kubectl', 'oc'].includes(cmd) && args.some((a) => ['exec', 'run', 'attach'].includes(a))) {
    if (has('-i', '-t', '--interactive', '--tty', '--stdin')) {
      return true;
    }
  }
  // Streaming / follow modes never finish, so a buffering filter would hide everything.
  if ((cmd === 'tail' || args.includes('logs')) && has('-f', '-F', '--follow')) return true;
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
    const cmd = path.posix.basename(words[0]);
    if (cmd === 'rtk') return 'already rtk';
    if (cmd === 'tee') return 'tee';
    // Wrapper options and quoted executable names need a real shell parser.
    if (/['"]/.test(words[0]) || ['env', 'command', 'sudo', 'doas', 'exec', 'nohup', 'nice', 'timeout', 'stdbuf'].includes(cmd)) {
      return 'ambiguous command';
    }
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

  rewrite(command, { cwd } = {}) {
    const r = spawnSync(rtkBin(), ['rewrite', command], {
      cwd: cwd || undefined,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (r.error || (r.status !== EXIT_ALLOWED && r.status !== EXIT_REWRITTEN)) {
      debug(`rtk: no rewrite (${r.error ? r.error.code || r.error.message : `exit ${r.status}`}): ${command}`);
      return null;
    }
    const out = r.stdout.replace(/\n+$/, '');
    if (!out || !/(^|[\s;&|(])rtk\s/.test(out)) return null;
    return { command: out, allow: r.status === EXIT_ALLOWED };
  },

  // exported for tests
  skipReason,
  isInteractive,
  findOnPath,
  resetCache,
};
