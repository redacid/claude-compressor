@../AGENTS.md

## Claude Code specifics

- Load the plugin from this checkout: `claude --plugin-dir .` (`make run`), headless: `make run-print PROMPT="..."`.
- Validate manifests: `make validate` (`claude plugin validate` on plugin.json and marketplace.json).
  Do not put a `CLAUDE.md` in the repo root: the plugin validator warns that root `CLAUDE.md` is not shipped.
- Live check from inside another Claude Code session (e.g. the desktop app): inherited `ANTHROPIC_BASE_URL` /
  `CLAUDE_CODE_*` vars break auth ("Invalid API key"), so run with a clean env and read the hook log, since hook
  stderr is not visible in `-p` mode:

  ```bash
  env -i HOME=$HOME PATH=$PATH TERM=xterm COMPRESSOR_LOG=/tmp/compressor.log \
    claude -p --plugin-dir . --model haiku --output-format stream-json --verbose < prompt.txt
  ```

  `--allowedTools` is variadic and swallows a trailing prompt argument: pass the prompt on stdin.
- Inspect rtk's own hook answer for reference: `echo '<payload>' | rtk hook claude`.
