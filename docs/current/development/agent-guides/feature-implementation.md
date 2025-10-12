# Feature Implementation Guide

## Pre-Implementation

1. **Read planning doc** from `/docs/planning/next/feat-*.md`
2. **Review related docs** in `/docs/current/features/`
3. **Check codebase structure** (see Navigation Map below)
4. **Verify branch**: `git branch --show-current` - ensure clean branch

## Implementation Steps

1. **Create implementation log**: `/docs/planning/implementation/feat-name-session-1.md`
2. **Use task tracking format** (see Template below)
3. **Update docs as you build** (not after)
4. **Run tests continuously**
5. **Commit frequently** with clear messages

## Documentation Requirements

### Always Update When Changing:
- **User-facing behavior** → `/docs/current/features/[feature].md`
- **API contracts** → Update feature docs + add to `code_paths`
- **Database schema** → Update data model sections
- **Configuration** → Document in feature docs
- **Tool/agent capabilities** → Update relevant docs

### Update Checklist:
- [ ] Add PR number to `related_prs` list
- [ ] Update `last_updated` date (YYYY-MM-DD)
- [ ] Add changed files to `code_paths`
- [ ] Update relevant sections (How it works, UI/UX, Data model)
- [ ] Run `node .github/scripts/docs-check.mjs`

## Navigation Map

### Code Structure
- **`app/`** - Next.js routes and pages
  - `app/(tabs)/` - Main app tabs (chat, garden, journey, insights)
  - `app/api/` - API routes
  - `app/auth/` - Authentication flows
- **`components/`** - React components
  - `components/ai-elements/` - AI-specific UI components
  - `components/auth/` - Authentication components
  - `components/check-in/` - Check-in experience components
- **`lib/`** - Business logic and utilities
  - `lib/data/` - Data access layer
  - `lib/check-ins/` - Check-in logic
  - `lib/supabase/` - Supabase client and utilities
- **`mastra/`** - AI agents and tools
  - `mastra/agents/` - Agent definitions
  - `mastra/tools/` - Tool implementations
- **`supabase/migrations/`** - Database migrations

### Key Configuration Files
- `config/app.ts` - App-wide configuration
- `config/env.ts` - Environment variables
- `mastra.config.ts` - Mastra agent configuration
- `middleware.ts` - Next.js middleware

## Implementation Log Template

Create: `/docs/planning/implementation/feat-name-session-1.md`

```markdown
# Feature Name - Implementation Session 1

## Session Overview
- **Date**: YYYY-MM-DD
- **Related Planning Doc**: `/docs/planning/next/feat-name.md`
- **Scope**: Brief description of what this session will accomplish

## Tasks
- [x] **Setup database migration** - 30min
  - **Decisions**: Used UUID for primary key instead of serial
  - **Code changes**: `supabase/migrations/025_feature.sql`
  
- [ ] **Build API endpoint** - In progress
  - **Progress**: Created route handler, working on validation
  - **Code changes**: `app/api/feature/route.ts`
  
- [ ] **Add tests** - Next up

## Issues & Adjustments
- **Original Plan**: Use REST API
- **Change**: Switched to tRPC for type safety
  - **Reason**: Better DX and type inference across client/server
  - **Impact**: +1 hour for setup, but saves time long-term

## Next Session
- **Continue from**: API endpoint validation
- **Goals**: Complete endpoint, add tests, update docs
- **Dependencies**: None

## Code Changes
- Files modified: `app/api/feature/route.ts`, `supabase/migrations/025_feature.sql`
- Tests added: (pending)
- Docs updated: (pending)
```

## Common Patterns

### Adding a New Feature
1. Database migration in `supabase/migrations/`
2. API route in `app/api/[feature]/`
3. Data access in `lib/data/[feature].ts`
4. UI components in `components/[feature]/`
5. Tests in `__tests__/` or co-located `.test.ts`

### Adding Agent Tools
1. Tool implementation in `mastra/tools/[tool-name].ts`
2. Export from `mastra/tools/index.ts`
3. Wire into agent in `mastra/agents/[agent-name].ts`
4. Update agent docs in `/docs/current/features/`

### Database Changes
1. Create migration: `supabase migration new feature_name`
2. Write SQL in `supabase/migrations/`
3. Test locally: `supabase db reset`
4. Update data model docs

## Before Opening PR

1. **Run all checks**:
   ```bash
   npm run test
   npm run typecheck
   node .github/scripts/docs-check.mjs
   ```

2. **Update documentation**:
   - Feature docs in `/docs/current/`
   - Implementation log complete
   - All checkboxes reviewed

3. **Clean commit history**:
   - Meaningful commit messages
   - Squash WIP commits if needed

4. **PR description**:
   - Link to planning doc
   - Link to implementation log
   - Summary of changes
   - Testing notes
