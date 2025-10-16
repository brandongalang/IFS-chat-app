#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

function normalizePath(input) {
  return input.replace(/\\/g, '/');
}

function main() {
  let repoRoot;
  try {
    repoRoot = runGit(['rev-parse', '--show-toplevel']);
  } catch (error) {
    console.error(`❌ ERROR: Unable to detect repository root: ${error.message}`);
    process.exit(1);
  }

  const stagedOutput = runGit(['diff', '--cached', '--name-only']);
  const stagedFiles = stagedOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizePath);

  if (stagedFiles.length === 0) {
    return;
  }

  const beadFiles = stagedFiles.filter((file) => file.startsWith('.beads/'));
  if (beadFiles.length > 0) {
    console.error('❌ ERROR: Staging blocked');
    console.error('');
    console.error('Reason: Code worktree commits cannot include .beads/ files.');
    console.error('Action: Run `git reset HEAD -- .beads/` and commit from the ledger worktree instead.');
    process.exit(1);
  }

  const branchName = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branchName === 'HEAD') {
    console.error('❌ ERROR: Staging blocked');
    console.error('');
    console.error('Reason: Detached HEAD is not allowed for commits.');
    console.error('Action: Create a branch following feature/<number>-<description> and retry.');
    process.exit(1);
  }

  const branchPattern = /^feature\/([0-9]+)-[a-z0-9-]+$/;
  const match = branchPattern.exec(branchName);
  if (!match) {
    console.error('❌ ERROR: Staging blocked');
    console.error('');
    console.error('Reason: Branch must match feature/<number>-<description> (e.g., feature/6-agent-tools).');
    console.error('Action: Rename branch to the required format.');
    process.exit(1);
  }

  const beadNumber = match[1];
  const currentBeadId = `ifs-chat-app-${beadNumber}`;

  const ledgerRoot = resolve(repoRoot, '..', 'ifs-ledger');
  const ledgerFile = resolve(ledgerRoot, '.beads', 'issues.jsonl');
  if (!existsSync(ledgerFile)) {
    console.error('❌ ERROR: Staging blocked');
    console.error('');
    console.error(`Reason: Ledger file missing at ${ledgerFile}`);
    console.error('Action: Run `git worktree add ../ifs-ledger -b beads-ledger` from the main repository.');
    process.exit(1);
  }

  const locksResult = spawnSync(resolve(repoRoot, 'scripts', 'bead'), ['locks', '--json'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (locksResult.status !== 0) {
    const stderr = locksResult.stderr.trim();
    console.error('❌ ERROR: Unable to inspect current locks.');
    if (stderr.length > 0) {
      console.error(`Details: ${stderr}`);
    }
    process.exit(1);
  }

  const locksOutput = locksResult.stdout.trim();
  let locks = {};
  if (locksOutput) {
    try {
      locks = JSON.parse(locksOutput);
    } catch (error) {
      console.error('❌ ERROR: Failed to parse lock data from ledger.');
      console.error(`Details: ${(error && error.message) || error}`);
      process.exit(1);
    }
  }

  const conflicts = [];
  stagedFiles.forEach((file) => {
    const lockInfo = locks[file];
    if (!lockInfo) {
      return;
    }

    if (lockInfo.beadId !== currentBeadId) {
      conflicts.push({ file, lock: lockInfo });
    }
  });

  if (conflicts.length > 0) {
    console.error('❌ ERROR: Staging blocked');
    console.error('');
    conflicts.forEach(({ file, lock }) => {
      console.error(`Reason: File '${file}' is locked by bead ${lock.beadId}${lock.title ? ` (${lock.title})` : ''}`);
    });
    console.error('');
    console.error('Run: bead who <path> → see current owner');
    console.error('Tip: bead locks → list all active locks');
    process.exit(1);
  }
}

main();
