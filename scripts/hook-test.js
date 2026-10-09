#!/usr/bin/env node
'use strict';

// JSON encoding preserves quotes, backslashes and newlines in sample commands.
function samplePayload(command = 'git status', cwd = process.cwd()) {
  return { hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command } };
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(samplePayload(process.env.CMD || 'git status')));
}

module.exports = { samplePayload };
