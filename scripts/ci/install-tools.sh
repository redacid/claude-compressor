#!/bin/sh
# Installs the tools CI needs: rtk (for the integration tests) and the Claude
# Code CLI (for `claude plugin validate`). Versions are pinned for repeatable runs.
set -eu

RTK_VERSION=${RTK_VERSION:-0.49.0}
CLAUDE_CODE_VERSION=${CLAUDE_CODE_VERSION:-2.1.294}
BIN_DIR=${BIN_DIR:-$HOME/.local/bin}
INSTALL_CLAUDE=${INSTALL_CLAUDE:-1}

if [ "$RTK_VERSION" = '0.49.0' ]; then
  RTK_SHA256=${RTK_SHA256:-7278231dfd7e6a730a4ab7f847b195bcf02289c2d57622b0dab75a6411100c8f}
else
  : "${RTK_SHA256:?set RTK_SHA256 when overriding RTK_VERSION}"
fi

mkdir -p "$BIN_DIR"
download_dir=$(mktemp -d)
trap 'rm -rf "$download_dir"' 0
url="https://github.com/rtk-ai/rtk/releases/download/v$RTK_VERSION/rtk-x86_64-unknown-linux-musl.tar.gz"
curl -fsSL "$url" -o "$download_dir/rtk.tar.gz"
printf '%s  %s\n' "$RTK_SHA256" "$download_dir/rtk.tar.gz" | sha256sum -c -
tar -xz -C "$BIN_DIR" -f "$download_dir/rtk.tar.gz" rtk
chmod +x "$BIN_DIR/rtk"

if [ "$INSTALL_CLAUDE" = '1' ]; then
  npm install --global --no-fund --no-audit "@anthropic-ai/claude-code@$CLAUDE_CODE_VERSION"
fi

# Make BIN_DIR visible to later steps (GitHub and Gitea both honour GITHUB_PATH).
[ -n "${GITHUB_PATH:-}" ] && echo "$BIN_DIR" >> "$GITHUB_PATH"
"$BIN_DIR/rtk" --version
if [ "$INSTALL_CLAUDE" = '1' ]; then claude --version; fi
