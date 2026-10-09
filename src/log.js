'use strict';

const fs = require('node:fs');

// Debug output goes to stderr when COMPRESSOR_DEBUG is set, and is appended to
// the file named by COMPRESSOR_LOG when that is set; stdout is reserved for
// the hook's JSON answer.
function debug(...args) {
  const line = `[compressor] ${args.join(' ')}\n`;
  if (process.env.COMPRESSOR_DEBUG) process.stderr.write(line);
  if (process.env.COMPRESSOR_LOG) {
    try {
      fs.appendFileSync(process.env.COMPRESSOR_LOG, `${new Date().toISOString()} ${line}`);
    } catch {
      // logging must never break the hook
    }
  }
}

module.exports = { debug };
