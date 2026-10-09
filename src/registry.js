'use strict';

const path = require('node:path');
const { debug } = require('./log');

const COMPRESSORS_DIR = path.join(__dirname, 'compressors');
const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
const REQUIRED = ['isAvailable', 'matches', 'rewrite'];

function isCompressor(mod) {
  return mod && typeof mod.name === 'string' && REQUIRED.every((k) => typeof mod[k] === 'function');
}

// Loads src/compressors/<name>.js for each configured name, in order.
// Unknown or malformed compressors are skipped, never fatal.
function loadCompressors(names, dir = COMPRESSORS_DIR) {
  const loaded = [];
  for (const name of names) {
    if (!NAME_RE.test(name)) {
      debug(`skip invalid compressor name: ${name}`);
      continue;
    }
    let mod;
    try {
      mod = require(path.join(dir, `${name}.js`));
    } catch (err) {
      debug(`cannot load compressor ${name}: ${err.message}`);
      continue;
    }
    if (!isCompressor(mod)) {
      debug(`compressor ${name} does not implement the interface`);
      continue;
    }
    loaded.push(mod);
  }
  return loaded;
}

module.exports = { loadCompressors, isCompressor, COMPRESSORS_DIR };
