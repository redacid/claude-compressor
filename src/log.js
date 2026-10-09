'use strict';

// Debug output goes to stderr only when COMPRESSOR_DEBUG is set; stdout is
// reserved for the hook's JSON answer.
function debug(...args) {
  if (process.env.COMPRESSOR_DEBUG) {
    process.stderr.write(`[compressor] ${args.join(' ')}\n`);
  }
}

module.exports = { debug };
