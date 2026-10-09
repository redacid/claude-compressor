'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, userConfigPath } = require('../src/config');
const { tmpJson } = require('./helpers');

const NO_USER = { COMPRESSOR_CONFIG: '/nonexistent/compressor.json' };

test('bundled config is used when nothing overrides it', () => {
  const def = tmpJson({ compressors: ['a', 'b'] });
  assert.deepEqual(loadConfig(NO_USER, def), { enabled: true, compressors: ['a', 'b'] });
});

test('user config overrides bundled config', () => {
  const def = tmpJson({ compressors: ['a'] });
  const user = tmpJson({ compressors: ['b'], enabled: false });
  assert.deepEqual(loadConfig({ COMPRESSOR_CONFIG: user }, def), { enabled: false, compressors: ['b'] });
});

test('env list overrides config files, empty env list disables all', () => {
  const def = tmpJson({ compressors: ['a'] });
  assert.deepEqual(loadConfig({ ...NO_USER, COMPRESSOR_COMPRESSORS: ' b , c ,' }, def).compressors, ['b', 'c']);
  assert.deepEqual(loadConfig({ ...NO_USER, COMPRESSOR_COMPRESSORS: '' }, def).compressors, []);
});

test('COMPRESSOR_DISABLE turns everything off, except "0"', () => {
  const def = tmpJson({ compressors: ['a'] });
  assert.equal(loadConfig({ ...NO_USER, COMPRESSOR_DISABLE: '1' }, def).enabled, false);
  assert.equal(loadConfig({ ...NO_USER, COMPRESSOR_DISABLE: '0' }, def).enabled, true);
});

test('malformed config files are ignored', () => {
  const def = tmpJson('{not json');
  assert.deepEqual(loadConfig(NO_USER, def), { enabled: true, compressors: [] });
});

test('user config path honours XDG_CONFIG_HOME', () => {
  assert.equal(userConfigPath({ XDG_CONFIG_HOME: '/x' }), '/x/compressor/config.json');
});
