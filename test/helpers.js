'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after } = require('node:test');

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function tmpDir(prefix = 'compressor-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function isolatedEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('COMPRESSOR_')) delete env[key];
  }
  const home = tmpDir('compressor-home-');
  const config = path.join(home, '.claude');
  fs.mkdirSync(config);
  return {
    ...env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    CLAUDE_CONFIG_DIR: config,
    COMPRESSOR_CONFIG: path.join(home, 'compressor.json'),
    ...overrides,
  };
}

function fake(name, { available = true, matches = () => true, rewrite = (c) => `${name} ${c}` } = {}) {
  return { name, isAvailable: () => available, matches, rewrite };
}

function tmpJson(data) {
  const dir = tmpDir();
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  return file;
}

function bashPayload(command, extra = {}) {
  return { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, ...extra } };
}

module.exports = { fake, tmpDir, tmpJson, bashPayload, isolatedEnv };
