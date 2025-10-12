# Bug Fix Guide

## Investigation Phase

### 1. Understand Current Behavior
- Read feature docs: `/docs/current/features/[feature].md`
- Review related code in codebase
- Check recent PRs that might have introduced the bug

### 2. Reproduce the Bug
- Follow reproduction steps
- Verify bug exists in current codebase
- Document exact conditions that trigger bug

### 3. Identify Root Cause
- Use debugger or logging
- Trace code execution path
- Identify where behavior diverges from expected

## Fix Process

### 1. Create Branch
```bash
git checkout main
git pull
git checkout -b fix/descriptive-bug-name
```

### 2. Write Failing Test First
- Add test that demonstrates the bug
- Verify test fails with current code
- This prevents regression

### 3. Implement Fix
- Make minimal changes to fix the bug
- Avoid scope creep (separate refactors into different PRs)
- Add comments explaining non-obvious fixes

### 4. Verify Fix
- Ensure new test passes
- Run full test suite
- Manually test the fix
- Check for side effects

### 5. Update Documentation
**Only needed if fix changes expected behavior**
- Update feature docs if behavior changes
- Add note to changelog/release notes
- Update examples if needed

## Documentation Requirements

### When to Update Docs
- **YES** if fix changes expected behavior
- **YES** if fix reveals incorrect documentation
- **NO** if fix restores documented behavior
- **NO** if purely internal bug fix

### What to Update
If docs need updating:
- Update feature docs in `/docs/current/features/`
- Add PR number to `related_prs`
- Update `last_updated` date
- Clarify correct behavior

## Common Bug Types

### UI/UX Bugs
- Check component props and state
- Verify event handlers
- Test responsive behavior
- Check accessibility

### API Bugs
- Verify request/response format
- Check validation logic
- Test error handling
- Verify database queries

### Data Bugs
- Check database migrations
- Verify data transformations
- Test edge cases (null, empty, large values)
- Check data consistency

### Logic Bugs
- Review conditional logic
- Check loop boundaries
- Verify calculations
- Test edge cases

## Testing Checklist

- [ ] Added test that reproduces bug
- [ ] Test fails before fix
- [ ] Test passes after fix
- [ ] All existing tests still pass
- [ ] Manual testing confirms fix
- [ ] No new bugs introduced

## Before Opening PR

1. **Run all checks**:
   ```bash
   npm run test
   npm run typecheck
   node .github/scripts/docs-check.mjs  # if docs changed
   ```

2. **Verify fix**:
   - Bug no longer reproducible
   - No side effects
   - Tests cover the bug

3. **PR description**:
   - Describe the bug
   - Explain root cause
   - Describe the fix
   - Link to issue if exists
   - Note any behavior changes

## Example Bug Fix Flow

```markdown
# Bug: Check-in validation allows empty responses

## Investigation
- Feature: Check-in system
- Current behavior: Empty responses pass validation
- Expected: Should require non-empty response
- Root cause: Validation only checks for null, not empty string

## Fix
- Added empty string check to validation
- Updated validation tests
- No docs update needed (restores documented behavior)

## Testing
- Added test for empty string
- Verified existing tests pass
- Manually tested check-in flow

## PR: #123
```

## Tips

### Finding the Bug
- Use `console.log` or debugger
- Check error logs and stack traces
- Bisect git history if needed: `git bisect`
- Ask for help if stuck

### Writing Good Bug Fixes
- Keep changes minimal and focused
- Add comments for non-obvious fixes
- Consider edge cases
- Don't introduce new features

### Avoiding Regressions
- Always add test for the bug
- Run full test suite
- Consider related code paths
- Document the fix clearly
