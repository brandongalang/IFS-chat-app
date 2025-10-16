#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
exec node "$REPO_ROOT/scripts/pre-commit-code-worktree.mjs"
