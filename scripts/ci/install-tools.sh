#!/bin/sh
# Installs the tools CI needs: rtk (for the integration tests) and the Claude
# Code CLI (for `claude plugin validate`). Versions are pinned for repeatable runs.
set -eu

RTK_VERSION=${RTK_VERSION:-0.49.0}
CLAUDE_CODE_VERSION=${CLAUDE_CODE_VERSION:-2.1.294}
BIN_DIR=${BIN_DIR:-$HOME/.local/bin}

mkdir -p "$BIN_DIR"
url="https://github.com/rtk-ai/rtk/releases/download/v$RTK_VERSION/rtk-x86_64-unknown-linux-musl.tar.gz"
curl -fsSL "$url" | tar -xz -C "$BIN_DIR" rtk
chmod +x "$BIN_DIR/rtk"

npm install --global --no-fund --no-audit "@anthropic-ai/claude-code@$CLAUDE_CODE_VERSION"

# Make BIN_DIR visible to later steps (GitHub and Gitea both honour GITHUB_PATH).
[ -n "${GITHUB_PATH:-}" ] && echo "$BIN_DIR" >> "$GITHUB_PATH"
"$BIN_DIR/rtk" --version
claude --version
