#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function runGit(args) {
  const result = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const message = result.stderr.trim() || `git ${args.join(' ')} failed`;
    throw new Error(message);
  }

  return result.stdout.trim();
}

function main() {
  let repoRoot;
  try {
    repoRoot = runGit(['rev-parse', '--show-toplevel']);
  } catch (error) {
    console.error(`❌ ERROR: Unable to determine repository root: ${error.message}`);
    process.exit(1);
  }

  const staged = runGit(['diff', '--cached', '--name-only'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (staged.length === 0) {
    return;
  }

  const allowed = new Set(['.beads/issues.jsonl']);
  const invalid = staged.filter((file) => !allowed.has(file));

  if (invalid.length > 0) {
    console.error('❌ ERROR: Ledger commits can only modify .beads/issues.jsonl');
    console.error('');
    console.error(`Repository: ${repoRoot}`);
    console.error(`Blocked files: ${invalid.join(', ')}`);
    console.error('');
    console.error('Action: Reset those paths and commit from the appropriate feature worktree instead.');
    process.exit(1);
  }
}

main();
