'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function fake(name, { available = true, matches = () => true, rewrite = (c) => `${name} ${c}` } = {}) {
  return { name, isAvailable: () => available, matches, rewrite };
}

function tmpJson(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compressor-test-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  return file;
}

function bashPayload(command, extra = {}) {
  return { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, ...extra } };
}

module.exports = { fake, tmpJson, bashPayload };
