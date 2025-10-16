# Tech: Cleanup Orphaned System 1 (lib/parts/)

**Status**: Ready to implement  
**Priority**: Low (cleanup, non-breaking)  
**Effort**: Small (simple deletion)  
**Created**: 2025-01-14

## Problem

During the parts markdown frontmatter work, we discovered **three separate part systems** in the codebase:

### System 1: `lib/parts/` - ORPHANED ❌
- **Files**: `lib/parts/repository.ts`, `lib/parts/spec.ts`, `content/parts/`, `mastra/tools/part-content-tools.ts`
- **Storage**: Local filesystem only (not user-scoped)
- **Purpose**: YAML frontmatter parts (was accidentally created)
- **Used by**: Nothing - completely orphaned
- **Problem**: Confusing, duplicates functionality, not connected to anything

### System 2: `lib/memory/` - PRODUCTION ✅
- **Files**: `lib/memory/parts-repository.ts`, `lib/memory/markdown/frontmatter.ts`, etc.
- **Storage**: StorageAdapter (Supabase Storage or local filesystem)
- **Purpose**: User-scoped markdown with YAML frontmatter
- **Used by**: Agents via `mastra/tools/memory-markdown-tools.ts`
- **Status**: Enhanced with frontmatter, fully functional

### System 3: `lib/data/parts-*.ts` - DATABASE LAYER ✅
- **Files**: `lib/data/parts-lite.ts`, `lib/data/parts-server.ts`, `lib/data/schema/**` (legacy `lib/data/parts.ts` removed 2025-10-17)
- **Storage**: Supabase database tables
- **Purpose**: Database query layer for UI
- **Used by**: Garden UI, check-ins, all UI components
- **Status**: Working, receives synced data from System 2

## Discovery

System 1 was accidentally created when someone tried to add YAML frontmatter support but didn't realize System 2 already existed. Instead of enhancing System 2, they created a parallel implementation in `lib/parts/`.

**The correct solution** (which we implemented) was to enhance System 2 with frontmatter, making System 1 obsolete.

## Current Data Flow (Correct)

```
Agent creates part
    ↓
System 2: lib/memory/ (markdown with frontmatter)
    ↓
Sync layer: lib/memory/parts-sync.ts
    ↓
System 3: lib/data/parts-*.ts (database)
    ↓
Garden UI displays parts
```

System 1 is not in this flow at all - it's orphaned.

## Solution

**Delete System 1 entirely** - it's not connected to anything and serves no purpose.

### Files to Delete

```bash
# Core System 1 files
lib/parts/repository.ts
lib/parts/spec.ts

# Directory (will be empty after removing files)
lib/parts/

# Orphaned agent tools that depend on System 1
mastra/tools/part-content-tools.ts

# Empty content directory
content/parts/
```

### Verification Steps

Before deletion, verify nothing uses these files:

```bash
# Check for imports of System 1 files
rg "from.*lib/parts" --type ts
rg "import.*lib/parts" --type ts

# Check for imports of orphaned tools
rg "part-content-tools" --type ts

# Check for content/parts references
rg "content/parts" --type ts
```

Expected result: **No matches** (or only in documentation/specs)

## Implementation Steps

1. **Verify no usage** (run grep commands above)
2. **Delete files**:
   ```bash
   rm -f lib/parts/repository.ts
   rm -f lib/parts/spec.ts
   rmdir lib/parts/
   rm -f mastra/tools/part-content-tools.ts
   rm -rf content/parts/
   ```
3. **Update imports** if any are found (shouldn't be any)
4. **Run type check**: `npx tsc --noEmit`
5. **Run tests** to ensure nothing broke
6. **Commit**: 
   ```
   chore: Delete orphaned System 1 (lib/parts/)
   
   Removes accidentally-created duplicate parts system that was
   never integrated. System 2 (lib/memory/) now has all the
   functionality that System 1 attempted to provide.
   
   Deleted:
   - lib/parts/repository.ts
   - lib/parts/spec.ts  
   - lib/parts/ directory
   - mastra/tools/part-content-tools.ts
   - content/parts/ directory
   
   System 2 (lib/memory/) is the correct, production-ready
   implementation with YAML frontmatter support.
   ```

## Why This is Safe

1. **No imports**: Grep confirms nothing imports from `lib/parts/`
2. **Orphaned tools**: `part-content-tools.ts` exports tools that aren't registered with any agent
3. **Empty directory**: `content/parts/` only contains `.gitkeep`
4. **Parallel system**: System 1 was created in parallel, never integrated
5. **Functionality preserved**: System 2 has all the features System 1 tried to provide

## Alternative Considered

**Keep both systems** - Rejected because:
- Confusing for developers
- Maintenance burden
- System 1 provides no unique value
- System 1 is not user-scoped (would need rewrite)
- System 1 doesn't use StorageAdapter (less flexible)

## Benefits of Deletion

✅ **Reduced confusion** - One clear system for markdown parts  
✅ **Less maintenance** - Fewer files to maintain  
✅ **Clearer architecture** - Single data flow  
✅ **Smaller codebase** - ~500 lines of code removed  
✅ **Better onboarding** - New developers see clear system  

## Risks

⚠️ **Very Low Risk** - Files are orphaned and unused

Only risk: If someone added an import to System 1 very recently that we missed. Mitigation: Grep before deletion, run type check after.

## Documentation Updates

After deletion, update:
- `docs/current/features/parts-markdown.md` - Remove references to `lib/parts/`
- This planning doc - Move to `docs/archive/` when complete

## Testing

1. **Before deletion**: Run grep commands to verify no usage
2. **After deletion**: 
   - `npx tsc --noEmit` (should pass)
   - Run any part-related tests
   - Verify Garden still works
   - Verify agents can still create parts

## Success Criteria

- [ ] Files deleted
- [ ] No TypeScript errors
- [ ] Garden loads and displays parts
- [ ] Agents can create parts with emoji
- [ ] Sync button works in Garden
- [ ] No broken imports found

## Timeline

**Effort**: 30 minutes  
**When**: Any time (non-critical cleanup)

## Related Work

- ✅ **Completed**: Enhanced System 2 with frontmatter (PR #TBD)
- ⏭️ **This task**: Delete orphaned System 1
- 🔮 **Future**: Consider if Garden should read from System 2 directly (optional optimization)

## Questions & Answers

**Q: Should Garden read from System 2 (markdown) instead of System 3 (database)?**  
A: Not necessary. The sync layer works well, and database queries are fast. Only consider if we want to eliminate database entirely (much larger change).

**Q: What if we need System 1's features?**  
A: System 2 now has all of System 1's features (YAML frontmatter, parsing, serialization) plus more (StorageAdapter, user-scoping, production-ready).

**Q: Is there anything unique in System 1 we should preserve?**  
A: No. System 1's parsing logic was ported to System 2 (`lib/memory/markdown/frontmatter.ts`). System 1 is now redundant.

## Notes

- System 1 was discovered during the frontmatter enhancement work on 2025-01-14
- All useful code from System 1 has been ported to System 2
- System 1 files are dated Oct 12, 2025 - recently created but never integrated
- No PRs reference these files, confirming they're orphaned
