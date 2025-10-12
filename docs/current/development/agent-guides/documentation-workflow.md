# Documentation Workflow

## When to Update Docs

### ALWAYS Update When:
- Behavior, data flow, or system design changes
- User-facing features or UI/UX changes
- API contracts, database schemas, or data models change
- Configuration or environment variables change
- Tool/agent capabilities or workflows change

### SKIP Only When:
- Code formatting or style fixes
- Comment updates only
- Test refactors (no behavior change)
- Dependency version bumps without API changes
- **If skipping, add `docs:skip` label and justify in PR description**

## Step-by-Step Process

### 1. Identify Affected Docs
```bash
# See what files changed
git diff main...HEAD --name-only

# Check docs/.docmap.json for mappings
# Match changed paths against docmap patterns
```

### 2. Update Feature Docs (`docs/current/features/**`)
- [ ] Add PR number to `related_prs` list
- [ ] Update `last_updated` date (YYYY-MM-DD format)
- [ ] Update relevant sections:
  - How it works
  - UI/UX notes
  - Data model
  - API contracts
- [ ] Add changed files to `code_paths` array

### 3. Update Runbooks (`docs/current/runbooks/**`)
Update when changing:
- Operational procedures
- Deployment workflows
- Cron jobs or scheduled tasks
- Database migrations or data maintenance

### 4. Create New Docs
For new features or major subsystems:
1. Create feature doc in `docs/current/features/`
2. Add entry to `docs/.docmap.json`
3. Link from related docs

### 5. Verify Docs CI Will Pass
```bash
# Run locally (requires BASE_SHA and HEAD_SHA env vars)
node .github/scripts/docs-check.mjs

# Or push and let GitHub Actions validate
```

## Documentation Standards

### Writing Style
- Use clear, concise language
- Include code examples where helpful
- Link to related PRs, issues, and other docs
- Use present tense for current behavior
- Use future tense for planned features

### Frontmatter Metadata
Keep up to date:
- `last_updated`: YYYY-MM-DD format
- `related_prs`: Array of PR numbers
- `code_paths`: Array of file paths
- `status`: active, deprecated, planned

### File Organization
```
docs/
├── current/
│   ├── features/          # Feature documentation
│   ├── runbooks/          # Operational guides
│   ├── architecture/      # System architecture
│   └── ops/              # Operations and deployment
├── planning/
│   ├── next/             # High-priority work
│   ├── backlog/          # Future work
│   └── implementation/   # Active sessions
└── vision/               # Long-term strategy
```

## Common Documentation Tasks

### Documenting a New Feature
1. Create `docs/current/features/feature-name.md`
2. Include sections:
   - Overview
   - How it works
   - UI/UX notes
   - Data model
   - API contracts
   - Code paths
   - Related PRs
3. Add to `.docmap.json`

### Updating Existing Feature Docs
1. Find doc via `.docmap.json` or browse `docs/current/features/`
2. Update changed sections
3. Add PR number to `related_prs`
4. Update `last_updated` date
5. Add new files to `code_paths`

### Documenting Database Changes
1. Update data model section in feature doc
2. Document migration in runbook if complex
3. Update any affected API contracts

### Documenting Agent/Tool Changes
1. Update `docs/current/features/agents.md` or specific agent doc
2. Document new tool capabilities
3. Update tool usage examples
4. Link to tool implementation

## Troubleshooting

### Docs CI Check Failing
**Error**: "Feature docs missing for changed files"
- Check `.docmap.json` for file mappings
- Update all mapped docs
- Ensure `code_paths` includes changed files

**Error**: "Missing PR number in related_prs"
- Add PR number to `related_prs` array
- Update `last_updated` date

**Error**: "Invalid frontmatter"
- Check YAML syntax
- Ensure required fields present
- Validate date format (YYYY-MM-DD)

### Can't Find Which Docs to Update
1. Check `docs/.docmap.json` for patterns
2. Search docs for file paths: `grep -r "path/to/file" docs/`
3. Look for related feature docs in `docs/current/features/`
4. Ask for clarification if unclear

## Reference

### Docmap Pattern Matching
The `.docmap.json` uses glob patterns:
- `**/*.ts` - All TypeScript files
- `app/api/**` - All API routes
- `mastra/tools/**` - All tool files

### Documentation Checklist
Before opening PR:
- [ ] All affected docs updated
- [ ] PR numbers added to `related_prs`
- [ ] `last_updated` dates current
- [ ] `code_paths` includes changed files
- [ ] Docs CI check passes locally
- [ ] New docs added to `.docmap.json` if needed
