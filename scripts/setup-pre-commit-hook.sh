#!/bin/bash

# Install the appropriate pre-commit hook for the current worktree.
# Usage: bash scripts/setup-pre-commit-hook.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
GIT_DIR="$(git rev-parse --git-dir)"
HOOKS_DIR="$GIT_DIR/hooks"
HOOK_PATH="$HOOKS_DIR/pre-commit"

mkdir -p "$HOOKS_DIR"

if [[ -L "$HOOK_PATH" || -f "$HOOK_PATH" ]]; then
  rm -f "$HOOK_PATH"
fi

if [[ "$REPO_ROOT" == *"/ifs-ledger" ]]; then
  TARGET_SCRIPT="$SCRIPT_DIR/pre-commit-ledger-worktree.sh"
  echo "Installing ledger pre-commit hook → $TARGET_SCRIPT"
else
  TARGET_SCRIPT="$SCRIPT_DIR/pre-commit-code-worktree.sh"
  echo "Installing code worktree pre-commit hook → $TARGET_SCRIPT"
fi

ln -sf "$TARGET_SCRIPT" "$HOOK_PATH"
chmod +x "$TARGET_SCRIPT" "$HOOK_PATH"

echo "✅ Pre-commit hook installed at $HOOK_PATH"
