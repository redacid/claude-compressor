'use strict';

const { loadConfig } = require('./config');
const { loadCompressors } = require('./registry');
const { debug } = require('./log');

// A compressor's rewrite() returns either the new command string or
// { command, allow }. allow: true asserts that the user's own permission rules
// already allow the original command, so the rewritten one may run without a
// new prompt; anything else leaves the decision to Claude Code.
function normalize(rewritten) {
  if (typeof rewritten === 'string') return { command: rewritten, allow: false };
  if (rewritten && typeof rewritten.command === 'string') {
    return { command: rewritten.command, allow: rewritten.allow === true };
  }
  return null;
}

// Returns the first rewrite produced by an available, matching compressor,
// or null. A compressor that throws is skipped. ctx carries the hook's cwd.
function compress(command, compressors, ctx = {}) {
  if (typeof command !== 'string' || command.trim() === '') return null;
  for (const c of compressors) {
    try {
      if (!c.isAvailable() || !c.matches(command)) continue;
      const r = normalize(c.rewrite(command, ctx));
      if (r && r.command.trim() !== '' && r.command !== command) {
        return { compressor: c.name, command: r.command, allow: r.allow };
      }
    } catch (err) {
      debug(`compressor ${c.name} failed: ${err.message}`);
    }
  }
  return null;
}

// Builds the PreToolUse answer. permissionDecision "allow" is set only when
// the compressor vouched that the original command is already allowed by the
// user's rules; otherwise Claude Code's normal permission flow decides.
function buildOutput(toolInput, result) {
  const out = {
    hookEventName: 'PreToolUse',
    permissionDecisionReason: `compressor: rewritten by ${result.compressor}`,
    updatedInput: { ...toolInput, command: result.command },
  };
  if (result.allow) out.permissionDecision = 'allow';
  return { hookSpecificOutput: out };
}

// Pure core of the hook: hook payload in, hook answer (or null) out.
function handle(payload, { env = process.env, compressors } = {}) {
  if (!payload || payload.tool_name !== 'Bash') return null;
  const toolInput = payload.tool_input;
  if (!toolInput || typeof toolInput.command !== 'string') return null;

  const config = loadConfig(env);
  if (!config.enabled) return null;

  const list = compressors || loadCompressors(config.compressors);
  const result = compress(toolInput.command, list, { cwd: payload.cwd });
  if (!result) return null;

  debug(`${result.compressor}: ${toolInput.command} -> ${result.command}${result.allow ? ' (allow)' : ''}`);
  return buildOutput(toolInput, result);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  try {
    const payload = JSON.parse(await readStdin());
    const output = handle(payload);
    if (output) process.stdout.write(JSON.stringify(output));
  } catch (err) {
    debug(`dispatch failed: ${err.message}`);
  }
  return 0;
}

module.exports = { compress, buildOutput, handle, main };
