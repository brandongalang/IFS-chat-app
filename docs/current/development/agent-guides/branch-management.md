# Branch Management Guide

## Before Starting ANY Work

**CRITICAL**: Always verify you're on a clean branch appropriate for the task.

```bash
# Check current branch
git branch --show-current

# If branch has existing PR or wrong task, create new branch:
git checkout main
git pull
git checkout -b feature/new-task-name
```

## Branch Naming Conventions

- **`feature/description`** - New features
- **`fix/description`** - Bug fixes
- **`refactor/description`** - Code refactoring
- **`docs/description`** - Documentation-only changes

### Examples
- `feature/inbox-to-chat-bridge`
- `fix/check-in-validation-error`
- `refactor/simplify-auth-flow`
- `docs/update-agent-guidelines`

## Common Issues & Solutions

### Problem: Commits from previous work appearing
**Cause**: You're on a branch that was used for different work

**Solution**:
```bash
git checkout main
git pull
git checkout -b feature/correct-task-name
```

### Problem: Branch already has open PR
**Cause**: Trying to add new work to existing PR branch

**Solution**: Never add new work to existing PR branch. Create fresh branch:
```bash
git checkout main
git pull
git checkout -b feature/new-separate-task
```

### Problem: Unsure if branch is clean
**Check**:
```bash
# See branch history
git log --oneline -10

# See what's different from main
git diff main...HEAD --name-only

# Check for open PRs on this branch
gh pr list --head $(git branch --show-current)
```

## Workflow

### Starting New Work
1. **Check current branch**: `git branch --show-current`
2. **If wrong/used, create new**: `git checkout -b feature/task-name`
3. **Verify clean state**: `git status`
4. **Start implementation**

### During Work
- **Commit frequently** with clear messages
- **Push regularly** to backup work
- **Keep branch updated** with main if needed:
  ```bash
  git checkout main
  git pull
  git checkout feature/your-branch
  git rebase main
  ```

### Before Opening PR
1. **Clean up commits** if needed (squash WIP commits)
2. **Ensure tests pass**: `npm run test`
3. **Ensure docs updated**: `node .github/scripts/docs-check.mjs`
4. **Push final changes**: `git push`

### After PR Merged
1. **Switch to main**: `git checkout main`
2. **Pull latest**: `git pull`
3. **Delete old branch**: `git branch -d feature/old-branch`
4. **Start fresh** for next task

## Best Practices

### Do:
- ✅ Create new branch for each task
- ✅ Use descriptive branch names
- ✅ Verify branch before starting work
- ✅ Keep branches focused on single task
- ✅ Delete branches after PR merged

### Don't:
- ❌ Reuse branches for different tasks
- ❌ Add new work to branches with open PRs
- ❌ Use vague branch names like `fix-stuff`
- ❌ Keep stale branches around
- ❌ Work directly on `main`

## GitHub CLI Commands

```bash
# Create PR from current branch
gh pr create

# View PRs for current branch
gh pr list --head $(git branch --show-current)

# Check PR status
gh pr status

# View PR in browser
gh pr view --web
```

## Quick Reference

```bash
# Start new work
git checkout main && git pull && git checkout -b feature/task-name

# Check branch status
git branch --show-current
git status
git log --oneline -5

# Clean up after PR merged
git checkout main && git pull && git branch -d feature/old-branch
```
