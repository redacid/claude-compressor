# Adding a compressor

A compressor is one module in `src/compressors/<name>.js` plus one entry in `config/compressors.json`.
The dispatcher asks compressors in config order. The first one that returns a new command wins; the rest do not run.

## Interface

```js
module.exports = {
  name: 'mytool',                  // matches the file name: [a-z0-9][a-z0-9_-]*

  isAvailable() {                  // is the tool installed; cache the result
    return true;
  },

  matches(command) {               // cheap filter: is it worth trying at all
    return /^\s*terraform plan\b/.test(command);
  },

  rewrite(command, { cwd }) {      // cwd is the Claude Code session's working directory
    return `mytool ${command}`;    // or { command, allow }, or null to leave it unchanged
  },
};
```

Rules:

- `rewrite` returns a string, `{ command, allow }` or `null`. An empty string or an unchanged command means "no change".
- Set `allow: true` **only** when you know for certain that the user's rules already allow the whole original
  command. The plugin then sets `permissionDecision: "allow"`. When in doubt, leave it out: Claude Code will
  simply ask for permission.
- An exception in any method does not break the hook: the compressor is skipped and the command moves on.
- The hook has a 10 s timeout for the whole chain, so run external processes with their own timeout (see `rtk.js`).
- Use `src/shell.js` to inspect the command: `maskQuotes`, `segments`, `redirectsToFile`.
  Do not rewrite heredocs, substitutions, redirects to files or interactive commands.
- Debug output goes through `debug()` from `src/log.js`, because stdout carries the hook's answer.

## Enabling

```json
{ "compressors": ["mytool", "rtk"] }
```

Order matters: put a narrower compressor before rtk. To try it without editing the config:
`COMPRESSOR_COMPRESSORS=mytool,rtk make hook-test CMD="terraform plan"`.

## Tests

Add `test/<name>.test.js` using `node:test`. Replace the external tool with a script in `test/fixtures/bin/`,
like `fake-rtk`, and put tests against the real binary in a separate `*.integration.test.js` file that is skipped
when the tool is missing. Then run `make check` and `make bench`.
