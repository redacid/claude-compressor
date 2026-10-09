'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { isolatedEnv } = require('./helpers');

test('isolated environment ignores inherited compressor settings', () => {
  const saved = { ...process.env };
  try {
    process.env.COMPRESSOR_DISABLE = '1';
    process.env.COMPRESSOR_COMPRESSORS = '';
    process.env.COMPRESSOR_LOG = '/nonexistent/user.log';
    process.env.CLAUDE_CONFIG_DIR = '/nonexistent/user-claude';
    const env = isolatedEnv({ COMPRESSOR_COMPRESSORS: 'rtk' });
    assert.equal(env.COMPRESSOR_DISABLE, undefined);
    assert.equal(env.COMPRESSOR_LOG, undefined);
    assert.equal(env.COMPRESSOR_COMPRESSORS, 'rtk');
    assert.notEqual(env.HOME, saved.HOME);
    assert.notEqual(env.CLAUDE_CONFIG_DIR, process.env.CLAUDE_CONFIG_DIR);
    assert.ok(fs.statSync(env.CLAUDE_CONFIG_DIR).isDirectory());
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
});
