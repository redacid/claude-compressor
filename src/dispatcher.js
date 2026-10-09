'use strict';

const { loadConfig } = require('./config');
const { loadCompressors } = require('./registry');
const { debug } = require('./log');

// Returns the first rewrite produced by an available, matching compressor,
// or null. A compressor that throws is skipped.
function compress(command, compressors) {
  if (typeof command !== 'string' || command.trim() === '') return null;
  for (const c of compressors) {
    try {
      if (!c.isAvailable() || !c.matches(command)) continue;
      const rewritten = c.rewrite(command);
      if (typeof rewritten === 'string' && rewritten.trim() !== '' && rewritten !== command) {
        return { compressor: c.name, command: rewritten };
      }
    } catch (err) {
      debug(`compressor ${c.name} failed: ${err.message}`);
    }
  }
  return null;
}

// Builds the PreToolUse answer. No permissionDecision: the user's own
// permission rules still decide whether the rewritten command may run.
function buildOutput(toolInput, result) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecisionReason: `compressor: rewritten by ${result.compressor}`,
      updatedInput: { ...toolInput, command: result.command },
    },
  };
}

// Pure core of the hook: hook payload in, hook answer (or null) out.
function handle(payload, { env = process.env, compressors } = {}) {
  if (!payload || payload.tool_name !== 'Bash') return null;
  const toolInput = payload.tool_input;
  if (!toolInput || typeof toolInput.command !== 'string') return null;

  const config = loadConfig(env);
  if (!config.enabled) return null;

  const list = compressors || loadCompressors(config.compressors);
  const result = compress(toolInput.command, list);
  if (!result) return null;

  debug(`${result.compressor}: ${toolInput.command} -> ${result.command}`);
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
