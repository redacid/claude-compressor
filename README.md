# compressor

A Claude Code plugin that automatically compresses the output of the agent's shell commands through rtk, built so
other compressors can be plugged in.

A `PreToolUse` hook intercepts every Bash tool call and, when the command can be compressed, rewrites it without the
agent noticing: `git status` → `rtk git status`, `cd x && git diff` → `cd x && rtk git diff`.
The agent gets the same result, only several times shorter. On large repositories that is 50–90% of output tokens
(see [benchmark](docs/benchmark.md)).

## Requirements

- Claude Code with plugin support.
- Node.js ≥ 18 (built-in modules only, no npm dependencies).
- [rtk](https://github.com/rtk-ai/rtk) on `PATH` (tested with 0.49.0). Without rtk the plugin does nothing.

Do not enable rtk's own global hook (`rtk init -g`) at the same time: commands would be rewritten twice.

## Installation

### From GitHub

```bash
claude plugin marketplace add redacid/claude-compressor
claude plugin install compressor@redacid
```

Or inside Claude Code: `/plugin marketplace add redacid/claude-compressor`, then `/plugin install compressor@redacid`.

- Pin a release instead of following `main`: `claude plugin marketplace add 'redacid/claude-compressor#v0.1.2'`.
- Update: `claude plugin marketplace update redacid && claude plugin update compressor@redacid`.
- Offer the plugin to everyone working in a project: add `--scope project` to `marketplace add`; the marketplace is
  then recorded in that project's `.claude/settings.json`.
- Release archives (zip, sha256, changelog) are on the [releases page](https://github.com/redacid/claude-compressor/releases).

### From a local checkout

```bash
make install
```

This is the same as:

```bash
claude plugin marketplace add /path/to/compressor
claude plugin install compressor@redacid
```

Both sources register a marketplace named `redacid`. Adding one when the other is already there switches the
marketplace to the new source, and installed plugins update from it from then on.
Try it without installing: `make run` (that is `claude --plugin-dir .`).

## How it works

```
Bash tool call ─► hooks/dispatch.js ─► src/dispatcher.js ─► compressors from the config, in order
                                                            the first one that rewrites the command wins
                       ◄─ updatedInput.command (+ allow if the original is already allowed)
```

- Compressors live in `src/compressors/` and are enabled and ordered in `config/compressors.json`.
- Any error means the hook prints nothing and the command runs as is (fail open).
- The rtk adapter (`src/compressors/rtk.js`) asks rtk itself (`rtk rewrite`) whether the command has a compact
  equivalent, and adds its own guards. These are not rewritten:
  - commands that already use `rtk`;
  - wrapper commands such as `env`, `sudo` and `command`, and quoted executable names that cannot be scanned reliably;
  - heredocs, `$(...)` and backticks;
  - redirects to a file (`2>&1` and `/dev/null` are fine) and `tee`, so compressed output never lands in a file;
  - interactive commands: `vim`, `less`, `ssh`, `git add -p`, `git rebase -i`, `docker/kubectl exec -it`;
  - follow modes, including combined flags and `--follow=...`: `tail -fn 20`, `docker logs --follow=true`.

Guards also recognize executable paths such as `/usr/bin/tee` and interactive Git commands with global options.

rtk compression is **lossy**: a large diff is truncated with a hint on how to get the full one
(`rtk git diff --no-compact`), and `git log` shows `[+N lines omitted]` markers.

## Permissions

Claude Code checks permission rules against the **rewritten** command, so a `Bash(git status:*)` rule on its own
does not cover `rtk git status`. The plugin does what rtk's own hook does:

| `rtk rewrite` | Meaning | What the plugin does |
|---|---|---|
| exit 0 | your settings.json rules already allow the whole original (every part of a chain) | rewrites and sets `permissionDecision: "allow"` |
| exit 3 | no rule, or an `ask` rule | rewrites and leaves the decision to Claude Code (a normal prompt) |
| exit 2 | the original is denied | does not rewrite; the deny rule applies to the original |

The plugin never widens permissions. rtk reads `~/.claude/settings.json` and the project's `.claude/settings.json`,
but it **cannot see** rules from `--allowedTools` or Claude Code's built-in auto-approval of read-only commands
(`ls`, `git diff`, ...). To compress those without prompts, add explicit rules for the **originals**:

```json
{
  "permissions": {
    "allow": ["Bash(ls:*)", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(grep:*)", "Bash(find:*)"]
  }
}
```

Do not add `Bash(rtk:*)`: `rtk run` and `rtk proxy` execute arbitrary commands.

## Configuration

Order of precedence (later overrides earlier):

1. `config/compressors.json` in the plugin: `{ "compressors": ["rtk"] }`.
2. User config `~/.config/compressor/config.json` (or `$XDG_CONFIG_HOME/compressor/config.json`):
   `{ "enabled": true, "compressors": ["rtk"] }`.
3. Environment variables.

| Variable | Effect |
|---|---|
| `COMPRESSOR_DISABLE=1` | turn the plugin off entirely |
| `COMPRESSOR_COMPRESSORS=rtk,foo` | list and order of compressors (empty = none) |
| `COMPRESSOR_CONFIG=/path.json` | another path for the user config |
| `COMPRESSOR_RTK_BIN=/path/rtk` | explicit path to rtk |
| `COMPRESSOR_LOG=/path.log` | append hook decisions to a file |
| `COMPRESSOR_DEBUG=1` | write hook decisions to stderr |

Environment variables must be set for the `claude` process, for example `COMPRESSOR_DISABLE=1 claude`.

## Development

```
.claude-plugin/   plugin.json, marketplace.json
hooks/            hooks.json, dispatch.js (hook entry point)
src/              dispatcher.js, registry.js, config.js, shell.js, log.js
src/compressors/  rtk.js (compressor adapters)
config/           compressors.json (enabled compressors and their order)
scripts/          benchmark.js, changelog.js, release-check.sh, ci/
test/             node:test, fake rtk in test/fixtures/bin
docs/             benchmark.md, adding-compressor.md
AGENTS.md         instructions for AI agents (.claude/CLAUDE.md imports it)
```

| Target | What it does |
|---|---|
| `make` / `make help` | list targets |
| `make check-deps` | check node, git, rtk |
| `make lint` | `node --check` on all JS and JSON validation |
| `make test` | all tests (`npm test`), integration tests with real rtk when it is installed |
| `make test-unit` | unit tests only |
| `make validate` | `claude plugin validate` on plugin.json and marketplace.json |
| `make check` | lint + test + validate |
| `make bench` / `make bench-md` | measure savings, `BENCH_REPOS="dir1 dir2"` |
| `make build` | check, then zip the plugin into `dist/` (from `HEAD`) |
| `make package` | zip the plugin from `HEAD` into `dist/` with a sha256 file, no checks |
| `make run` | `claude --plugin-dir .` with a log in `compressor.log` |
| `make run-print` | one `claude -p` run, `PROMPT="..."` |
| `make hook-test` | run the hook on a command, `CMD="git log -5"` |
| `make install` / `make update` / `make uninstall` | local marketplace and plugin |
| `make bump V=0.1.1` | set the version in plugin.json, marketplace.json, package.json and README (`V=patch`, `minor`, `major` also work) |
| `make release-check TAG=v0.2.0` | check a tag: format, commit on main, manifest versions |
| `make changelog TAG=v0.2.0` | release notes from PRs merged into main |
| `make clean` | remove `dist/` and logs |

Adding your own compressor: [docs/adding-compressor.md](docs/adding-compressor.md).
Instructions for AI agents working on the repository: [AGENTS.md](AGENTS.md) (Claude Code reads it through `.claude/CLAUDE.md`).

## CI/CD

The same pipelines for GitHub (`.github/workflows/`) and Gitea (`.gitea/workflows/`):

- **Push to any branch** (`ci.yml`): `make lint`, `make test` with real rtk, `make validate`.
- **`vX.Y.Z` tag** (`release.yml`): the tag must point at a commit on `main` and its version must match `version`
  in plugin.json, marketplace.json and package.json, otherwise the release fails. Then lint, tests, validation,
  `make package` and a release with the archive, its sha256 and `CHANGELOG.md`.
- **The changelog** is built from PRs merged into `main` since the previous tag (merge or squash; a rebase merge
  leaves no PR number, so such PRs are not listed). Direct commits to `main` are not included.

Cutting a release: `make bump V=0.2.0` (or `V=patch`) in a branch → PR → merge into `main` →
`git tag v0.2.0 origin/main && git push origin v0.2.0`.

Tags outside `main` can only be blocked server-side, in the repository settings (GitHub: a tag ruleset for `v*`;
Gitea: protected tags). CI checks it, but the tag will already exist. Gitea needs a runner with the `ubuntu-latest`
label; if the job token cannot create releases, add a `RELEASE_TOKEN` secret.

## Benchmark

`make bench` on three local repositories (tokens ≈ characters / 4):

| Repository | Before | After | Savings |
|---|---:|---:|---:|
| compressor (small) | 6370 | 5721 | 10% |
| obot-mcp-catalog | 7224 | 3304 | 54% |
| kubeconform | 353401 | 39946 | 89% |

Per-command details and the live `claude -p` runs: [docs/benchmark.md](docs/benchmark.md).

## Roadmap

1. ✅ Plugin skeleton and compressor architecture: plugin.json, PreToolUse hook for Bash, dispatcher and registry.
2. ✅ rtk adapter: rtk detection, rewriting supported commands, handling pipes, heredocs and chains.
3. ✅ Tests and benchmark: rewrite unit tests, a `claude -p` run, output size comparison.
4. ✅ Packaging: marketplace.json, README, guide for adding a compressor.
5. ✅ CI/CD for GitHub and Gitea, releases with an automatic changelog.
