# Benchmark

Date: 2026-10-09. rtk 0.49.0, Claude Code 2.1.294, Node 22.

## Method

`npm run bench -- [--md] <repo> ...` (`scripts/benchmark.js`) runs a fixed set of read-only commands in each
repository twice: as is, and as the plugin rewrites it (the same `compress()` and rtk adapter the hook uses).
It measures stdout+stderr: bytes and approximate tokens (characters / 4).
"— (unchanged)" means the plugin leaves the command alone (here: `$(...)`, the guard against substitutions).

Repositories: `compressor` (this one, 4 commits), `obot-mcp-catalog` (474 commits, 99 files),
`kubeconform` (398 commits, 288 files; the working tree is dirty, so `git status` is large).

## Summary

| Repository | Tokens before | Tokens after | Savings |
|---|---:|---:|---:|
| compressor | 6370 | 5721 | 10.2% |
| obot-mcp-catalog | 7224 | 3304 | 54.3% |
| kubeconform | 353401 | 39946 | 88.7% |

The biggest effect is on large output: `git diff` (96%), `grep -rn` (90%), `find` (93%), `ls -la` (71–77%),
`git log` (35–79%). Almost no effect: `git log --stat`, `git diff --stat`, `git log --oneline | head`;
rtk passes them through unchanged.

Note: rtk compression is **lossy**. A large diff is truncated with the hint
`[full diff: rtk git diff --no-compact]`, and `git log` shows `[+N lines omitted]` markers.
The agent sees that the output was shortened and can ask for the full version.

## Details

### compressor

| Command | Rewritten to | Bytes before | Bytes after | Tokens before | Tokens after | Savings |
|---|---|---:|---:|---:|---:|---:|
| `git status` | `rtk git status` | 389 | 49 | 98 | 13 | 86.7% |
| `git log -20` | `rtk git log -20` | 1156 | 754 | 289 | 189 | 34.6% |
| `git log --stat -5` | `rtk git log --stat -5` | 2607 | 2607 | 652 | 652 | 0.0% |
| `git show HEAD~1` | `rtk git show HEAD~1` | 16540 | 15380 | 4135 | 3845 | 7.0% |
| `git diff HEAD~3 --stat` | `rtk git diff HEAD~3 --stat` | 187 | 187 | 47 | 47 | 0.0% |
| `git diff HEAD~3` | `rtk git diff HEAD~3` | 187 | 187 | 47 | 47 | 0.0% |
| `git branch -a` | `rtk git branch -a` | 7 | 7 | 2 | 2 | 0.0% |
| `ls -la` | `rtk ls -la` | 781 | 181 | 196 | 46 | 76.5% |
| `find . -type f -not -path "./.git/*"` | `rtk find . -type f -not -path "./.git/*"` | 652 | 555 | 163 | 139 | 14.7% |
| `grep -rn "func\\|function" --include=*.go --include=*.js .` | `rtk grep -rn "func\\|function" --include=*.go --include=*.js .` | 2239 | 2239 | 560 | 560 | 0.0% |
| `wc -l $(git ls-files \| head -50)` | — (unchanged) | 610 | 610 | 153 | 153 | — |
| `git log --oneline -50 \| head -20` | `rtk git log --oneline -50 \| head -20` | 112 | 112 | 28 | 28 | 0.0% |
| **Total** | | 25467 | 22868 | 6370 | 5721 | **10.2%** |

### obot-mcp-catalog

| Command | Rewritten to | Bytes before | Bytes after | Tokens before | Tokens after | Savings |
|---|---|---:|---:|---:|---:|---:|
| `git status` | `rtk git status` | 100 | 49 | 25 | 12 | 52.0% |
| `git log -20` | `rtk git log -20` | 10876 | 2298 | 2719 | 575 | 78.9% |
| `git log --stat -5` | `rtk git log --stat -5` | 2095 | 2095 | 524 | 524 | 0.0% |
| `git show HEAD~1` | `rtk git show HEAD~1` | 1416 | 929 | 354 | 233 | 34.2% |
| `git diff HEAD~3 --stat` | `rtk git diff HEAD~3 --stat` | 994 | 994 | 249 | 249 | 0.0% |
| `git diff HEAD~3` | `rtk git diff HEAD~3` | 2922 | 2074 | 731 | 519 | 29.0% |
| `git branch -a` | `rtk git branch -a` | 66 | 7 | 17 | 2 | 88.2% |
| `ls -la` | `rtk ls -la` | 5656 | 1401 | 1414 | 351 | 75.2% |
| `find . -type f -not -path "./.git/*"` | `rtk find . -type f -not -path "./.git/*"` | 2300 | 890 | 575 | 223 | 61.2% |
| `grep -rn "func\\|function" --include=*.go --include=*.js .` | `rtk grep -rn "func\\|function" --include=*.go --include=*.js .` | 0 | 0 | 0 | 0 | — |
| `wc -l $(git ls-files \| head -50)` | — (unchanged) | 1326 | 1326 | 332 | 332 | — |
| `git log --oneline -50 \| head -20` | `rtk git log --oneline -50 \| head -20` | 1135 | 1135 | 284 | 284 | 0.0% |
| **Total** | | 28886 | 13198 | 7224 | 3304 | **54.3%** |

### kubeconform

| Command | Rewritten to | Bytes before | Bytes after | Tokens before | Tokens after | Savings |
|---|---|---:|---:|---:|---:|---:|
| `git status` | `rtk git status` | 16305 | 13153 | 4077 | 3289 | 19.3% |
| `git log -20` | `rtk git log -20` | 4780 | 2353 | 1195 | 589 | 50.7% |
| `git log --stat -5` | `rtk git log --stat -5` | 39483 | 39483 | 9871 | 9871 | 0.0% |
| `git show HEAD~1` | `rtk git show HEAD~1` | 25044 | 24196 | 6261 | 6049 | 3.4% |
| `git diff HEAD~3 --stat` | `rtk git diff HEAD~3 --stat` | 18204 | 18204 | 4551 | 4551 | 0.0% |
| `git diff HEAD~3` | `rtk git diff HEAD~3` | 1113088 | 40898 | 278200 | 10225 | 96.3% |
| `git branch -a` | `rtk git branch -a` | 158 | 67 | 40 | 17 | 57.5% |
| `ls -la` | `rtk ls -la` | 1572 | 450 | 393 | 113 | 71.2% |
| `find . -type f -not -path "./.git/*"` | `rtk find . -type f -not -path "./.git/*"` | 13125 | 965 | 3282 | 242 | 92.6% |
| `grep -rn "func\\|function" --include=*.go --include=*.js .` | `rtk grep -rn "func\\|function" --include=*.go --include=*.js .` | 179389 | 17268 | 44848 | 4317 | 90.4% |
| `wc -l $(git ls-files \| head -50)` | — (unchanged) | 1742 | 1742 | 436 | 436 | — |
| `git log --oneline -50 \| head -20` | `rtk git log --oneline -50 \| head -20` | 985 | 985 | 247 | 247 | 0.0% |
| **Total** | | 1413875 | 159764 | 353401 | 39946 | **88.7%** |

(`compressor` had only 3 commits at the time, so `git diff HEAD~3` is an error message.)

## Live run in `claude -p`

Command: `claude -p --plugin-dir . --model haiku --output-format stream-json --verbose`
with `COMPRESSOR_LOG=<file>`, in a clean environment (`env -i HOME PATH TERM LANG`).

**Run 1**: `--allowedTools "Bash(git status:*)" "Bash(git log:*)" "Bash(ls:*)" "Bash(rtk:*)"`:

```
rtk: git status -> rtk git status
rtk: git log -5 -> rtk git log -5
rtk: ls -la -> rtk ls -la
rtk: git status > /dev/null && echo done -> rtk git status > /dev/null && echo done
rtk: skip (redirect to file): git log -3 > .../out.txt
```

All four rewritten commands ran and the agent received rtk's compressed output.
The plugin left the file redirect alone, and the normal permission mechanism blocked it
(a write outside the working directory): the permission flow works as it does without the plugin.

**Run 2**: only `Bash(git status:*)` allowed, commands `git status` and `ls -la`:
both were rewritten to `rtk ...` and both were **rejected** ("This command requires approval").

**Run 3**: no plugin and no rules: `ls -la` and `git diff --stat` ran without a prompt,
because Claude Code auto-approves read-only commands itself.

## Finding: permissions are checked against the rewritten command

Claude Code applies permission rules to the command **after** `updatedInput`. So:

- a `Bash(git status:*)` rule does not cover `rtk git status`;
- the built-in auto-approval of read-only commands (`ls`, `git diff`, ...) does not recognise `rtk ...`.

The behaviour at that point (no `permissionDecision`) was safe, but in practice every rewritten command
needed confirmation. Adding `Bash(rtk:*)` to permissions is a bad idea: `rtk run` / `rtk proxy`
execute arbitrary commands.

How rtk's own hook (`rtk hook claude`) handles it: `rtk rewrite` reads the rules from settings.json
(user and project) and exits 0 if the original is **fully** allowed (every part of a chain),
3 if there is no rule or it is `ask`, and 2 if it is denied. On 0 rtk's hook sets
`permissionDecision: "allow"`, on 3 nothing, on 2 it does not rewrite. Verified:
`git status && rm -rf zzz` → 3, `git status && git push` (push denied) → 2,
`git status && git status` → 0. rtk cannot see rules from `--allowedTools` or the built-in auto-approval.

## Decision: option A (same as rtk)

The plugin sets `permissionDecision: "allow"` **only** when `rtk rewrite` exits 0, that is, when the settings.json
rules already allow the whole original command. On 3 no decision is set (a normal prompt);
on 2 the command is not rewritten and the deny rule applies to the original. `rtk rewrite` runs in the `cwd`
from the hook payload so it sees the project's `.claude/settings.json`. The plugin never widens permissions.

Live run (temporary clone, `.claude/settings.json`: allow `git status`, `git log`; deny `git push`;
no `--allowedTools`):

```
rtk: git status -> rtk git status (allow)    ran without a prompt
rtk: git log -3 -> rtk git log -3 (allow)    ran without a prompt
rtk: ls -la -> rtk ls -la                    "requires approval" (no rule)
git push                                     not rewritten, rejected by the deny rule
```

Limitation: commands Claude Code approves by itself (read-only: `ls`, `git diff`, ...) and rules from
`--allowedTools` are invisible to rtk, so after rewriting they prompt. To compress them without
prompts, add explicit allow rules for the original commands, for example `Bash(ls:*)`, `Bash(git diff:*)`.
