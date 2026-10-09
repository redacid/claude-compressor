# AGENTS.md

Instructions for AI coding agents working on this repository (Claude Code, Codex, Cursor, Gemini, Copilot, ...).
Human docs are in Ukrainian: [README.md](README.md).

## Purpose

A Claude Code plugin. A `PreToolUse` hook on the Bash tool rewrites the agent's shell commands so their output is
shorter, currently via [rtk](https://github.com/rtk-ai/rtk) (`git status` → `rtk git status`). Compressors are
pluggable; rtk is the first one.

## Data flow

```
Claude Code ─PreToolUse JSON (stdin)─► hooks/dispatch.js ─► src/dispatcher.js handle()
   config (src/config.js) ─► registry (src/registry.js) loads src/compressors/<name>.js in configured order
   compress(): first compressor with isAvailable() && matches(cmd) && rewrite(cmd, {cwd}) != cmd wins
◄─ stdout: {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{...,"command":"<new>"},
                                  "permissionDecision":"allow"  ← only if the compressor returned allow: true}}
   nothing applies / any error → exit 0, empty stdout → command runs unchanged (fail open)
```

rtk adapter (`src/compressors/rtk.js`): own guards first, then delegates to `rtk rewrite "<cmd>"`, run in the
hook payload's `cwd` so rtk sees the project's `.claude/settings.json`. Exit codes:

| code | meaning | adapter |
|---|---|---|
| 0 | rewritten; user's settings rules allow every part of the original | `{ command, allow: true }` |
| 3 | rewritten; no rule or an `ask` rule (undocumented in `rtk --help`) | `{ command, allow: false }` |
| 2 | original is denied | `null`, so the deny rule applies to the original |
| 1 | no rtk equivalent | `null` |

## File map

| Path | Role |
|---|---|
| `.claude-plugin/plugin.json`, `marketplace.json` | manifests; keep `version` equal in both |
| `hooks/hooks.json` | hook registration: `PreToolUse`, matcher `Bash`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.js`, timeout 10 s |
| `hooks/dispatch.js` | thin entry point, always exits 0 |
| `src/dispatcher.js` | `handle()`, `compress()`, `buildOutput()` |
| `src/registry.js` | loads compressor modules; skips missing/malformed/unsafe names |
| `src/config.js` | layers: `config/compressors.json` → `~/.config/compressor/config.json` (`$COMPRESSOR_CONFIG`, `$XDG_CONFIG_HOME`) → env |
| `src/shell.js` | `maskQuotes`, `segments`, `redirectsToFile`: conservative scanning, not a shell parser |
| `src/compressors/rtk.js` | rtk adapter |
| `src/log.js` | `debug()` → stderr (`COMPRESSOR_DEBUG=1`) and/or file (`COMPRESSOR_LOG=path`) |
| `scripts/benchmark.js` | raw vs rewritten output size on real repos |
| `test/` | `node:test`; `fixtures/bin/fake-rtk` emulates rtk exit codes; `*.integration.test.js` use real rtk, skipped if absent |
| `docs/` | `benchmark.md` (results), `adding-compressor.md` (compressor API) — Ukrainian |

Env vars: `COMPRESSOR_DISABLE`, `COMPRESSOR_COMPRESSORS` (comma list, empty = none), `COMPRESSOR_CONFIG`,
`COMPRESSOR_RTK_BIN`, `COMPRESSOR_LOG`, `COMPRESSOR_DEBUG`.

## Commands

npm scripts are the source of truth; `make` wraps them (`make help` lists all targets).

- `make check` — lint + all tests + manifest validation. **Run before every commit.**
- `make test` / `make test-unit` / `node --test test/<file>.test.js`
- `make hook-test CMD="git log -5"` — pipe a sample payload through the hook with debug output
- `make bench BENCH_REPOS=". ../other"` — measure savings (real commands, read-only)
- `make build` — zip of plugin files from `HEAD` into `dist/` (commit first)

## Hard rules

1. **Fail open.** The hook must never block or break a command. Any error → exit 0, empty stdout.
2. **stdout is the hook answer only.** No `console.log`; use `debug()`.
3. **Never widen permissions.** `permissionDecision: "allow"` only when a compressor returns `allow: true`;
   the rtk adapter does so only on `rtk rewrite` exit 0. No home-grown "safe command" allow lists without the
   owner's explicit decision. Never suggest `Bash(rtk:*)` in docs or config: `rtk run`/`rtk proxy` execute
   arbitrary commands.
4. **Be conservative.** Not rewriting is always safe; a bad rewrite is not. Guards: commands already using
   `rtk`; heredoc, `$(...)`, backticks (checked on raw text — they run inside double quotes too); redirects to
   files (`2>&1`, `>&2`, `/dev/null` are fine); `tee`; interactive commands; `-f`/`--follow` streams.
5. **No npm dependencies.** Node ≥ 18 built-ins only.
6. **Never touch the user's real Claude Code config in tests or experiments.** For `make install`/`uninstall` or
   `claude plugin ...` checks use an isolated `CLAUDE_CONFIG_DIR=$(mktemp -d)`.
7. No git remote, no push, no PR unless the owner asks.

## Conventions

- One compressor = one file in `src/compressors/` + one entry in `config/compressors.json`.
  API and checklist: [docs/adding-compressor.md](docs/adding-compressor.md).
- Every behaviour change or fix gets a test. External binaries are faked in `test/fixtures/bin/`.
- Code style: CommonJS, `'use strict'`, 2-space indent, single quotes, short comments that explain *why*.
- Commits: one logical step per commit; short imperative English subject (`rtk adapter`,
  `Preserve user allow rules for rewritten commands`), wrapped body explaining what and why.
- Human-facing docs (README, `docs/`) are written in Ukrainian; this file and code comments in English.

## Gotchas

- Claude Code evaluates permission rules against the **rewritten** command. `Bash(git status:*)` does not match
  `rtk git status`; hence the exit-0 → allow logic. rtk cannot see `--allowedTools` or Claude Code's built-in
  read-only auto-approval, so e.g. `ls -la` → `rtk ls -la` prompts unless the user has `Bash(ls:*)`. Expected.
- rtk compression is lossy (truncated diffs with `[full diff: rtk git diff --no-compact]`, `[+N lines omitted]`).
- `make bench` runs real rtk commands; rtk records them in its own stats DB (`rtk gain`). Harmless.
