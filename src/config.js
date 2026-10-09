'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_CONFIG = path.join(__dirname, '..', 'config', 'compressors.json');

function userConfigPath(env = process.env) {
  if (env.COMPRESSOR_CONFIG) return env.COMPRESSOR_CONFIG;
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'compressor', 'config.json');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function parseList(value) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Resolution order (later wins): bundled config -> user config -> env vars.
//   COMPRESSOR_DISABLE=1         turn everything off
//   COMPRESSOR_COMPRESSORS=a,b   enabled compressors, in order
//   COMPRESSOR_CONFIG=/path.json user config location
function loadConfig(env = process.env, defaultPath = DEFAULT_CONFIG) {
  const config = { enabled: true, compressors: [] };

  for (const file of [defaultPath, userConfigPath(env)]) {
    const data = readJson(file);
    if (!data || typeof data !== 'object') continue;
    if (typeof data.enabled === 'boolean') config.enabled = data.enabled;
    if (Array.isArray(data.compressors)) {
      config.compressors = data.compressors.filter((n) => typeof n === 'string');
    }
  }

  if (env.COMPRESSOR_COMPRESSORS !== undefined) {
    config.compressors = parseList(env.COMPRESSOR_COMPRESSORS);
  }
  if (env.COMPRESSOR_DISABLE && env.COMPRESSOR_DISABLE !== '0') {
    config.enabled = false;
  }
  return config;
}

module.exports = { loadConfig, userConfigPath, DEFAULT_CONFIG };
