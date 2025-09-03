# Branch Management Workflow

## Quick Start Commands

```bash
# Analyze current branch situation
./.scripts/analyze-stale-branches.sh

# Safe cleanup of merged branches
./.scripts/cleanup-merged-branches.sh
```

## Branch Cleanup Strategy

### Phase 1: Immediate Safe Cleanup ✅

**What to clean:**
- Branches merged to main 
- Stale local tracking branches
- Orphaned remote references

**Risk Level:** Low - These changes are already in main

```bash
# Automated safe cleanup
./.scripts/cleanup-merged-branches.sh
```

### Phase 2: Team Coordination Required 🤝

**What to review:**
- PR branches (`pr/seeds-*`)
- Documentation branches that may have been merged manually
- Feature branches older than 2 weeks

**Process:**
1. Identify candidates with analysis script
2. Check with branch authors before deletion
3. Verify no important work is lost

### Phase 3: Ongoing Maintenance 🔄

**Weekly Routine:**
```bash
# Every Monday morning
git checkout main && git pull
./.scripts/analyze-stale-branches.sh
./.scripts/cleanup-merged-branches.sh
```

## Branch Lifecycle Best Practices

### Naming Conventions ✨
```
feat/descriptive-feature-name
fix/issue-description  
chore/maintenance-task
docs/documentation-update
test/test-description
refactor/what-being-refactored
```

### Lifecycle Rules
1. **Create:** Branch from main for each feature/fix
2. **Develop:** Keep branches focused and short-lived (days, not weeks)
3. **Review:** Use Pull Requests for all merges
4. **Clean:** Delete branch after successful merge
5. **Automate:** Set up auto-deletion in GitHub/GitLab

### Recommended Branch Limits
- **Active feature branches:** 5-10 max
- **Total branches:** Keep under 20 
- **Branch age:** Delete after 30 days if unmerged

## Automated GitHub/GitLab Settings

### GitHub Repository Settings
```
Settings → General → Pull Requests
✅ Automatically delete head branches
```

### Branch Protection Rules
```
Settings → Branches → Add rule
- Branch name pattern: main
✅ Require pull request reviews
✅ Dismiss stale PR approvals
✅ Require status checks
```

## Emergency Branch Recovery

If you accidentally delete a branch:

```bash
# Find the commit hash
git reflog

# Recreate the branch
git branch recovered-branch-name <commit-hash>

# Or checkout directly
git checkout -b recovered-branch-name <commit-hash>
```

## Integration with Development Workflow

### Daily Workflow Integration
```bash
# Start of day
git checkout main && git pull
./.scripts/analyze-stale-branches.sh

# End of feature
git checkout main
git pull
git branch -d feature-branch-name
git push origin --delete feature-branch-name
```

### Weekly Team Review
- Run analysis script in team standup
- Review stale branches together
- Coordinate cleanup of ambiguous branches
- Update branch management practices

## Monitoring & Alerts

### Git Aliases for Quick Checks
```bash
# Add to ~/.gitconfig
[alias]
    branches-by-date = "for-each-ref --sort=committerdate refs/heads/ --format='%(HEAD) %(color:yellow)%(refname:short)%(color:reset) - %(color:red)%(objectname:short)%(color:reset) - %(contents:subject) - %(authorname) (%(color:green)%(committerdate:relative)%(color:reset))'"
    merged-branches = "branch --merged main"
    cleanup-merged = "!git branch --merged main | grep -v 'main$' | xargs git branch -d"
```

### Success Metrics
- **Target:** < 15 total branches
- **Target:** < 7 day average branch age
- **Target:** 0 branches older than 30 days
- **Target:** < 3 merged but undeleted branches

## Team Communication

### Before Deleting Branches
1. Check branch author and last commit date
2. Verify branch is actually merged or abandoned
3. Post in team chat if uncertain
4. Wait 24 hours for response on questionable branches

### Documentation Updates
- Update this guide monthly
- Share cleanup results with team
- Celebrate clean branch hygiene achievements

---

**Last Updated:** $(date)
**Next Review:** $(date -d '+1 month')