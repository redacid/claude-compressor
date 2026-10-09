#!/usr/bin/env node
'use strict';

// PreToolUse entry point. Any failure falls through to exit 0 with no output,
// so the original command runs unchanged (fail open).
const { main } = require('../src/dispatcher');

main().then(
  (code) => process.exit(code),
  () => process.exit(0),
);
