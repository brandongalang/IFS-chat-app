# Parts Systems Architecture Overview

**Last Updated**: 2025-01-14  
**Status**: Current production architecture

## Summary

The parts system consists of **two active systems** working together, plus one orphaned system that should be deleted.

## Active Systems

### System 2: Memory Layer (Markdown Source of Truth)
**Location**: `lib/memory/`  
**Purpose**: User-scoped markdown storage with YAML frontmatter  
**Used By**: AI agents via `mastra/tools/memory-markdown-tools.ts`

**Key Files**:
- `lib/memory/markdown/frontmatter.ts` - YAML frontmatter parsing/serialization
- `lib/memory/parts-repository.ts` - Repository API for querying/updating parts
- `lib/memory/snapshots/grammar.ts` - Part profile markdown generation
- `lib/memory/parts-sync.ts` - Syncs markdown → database
- `lib/memory/read.ts` - Read operations for profiles

**Storage**:
- **Production**: Supabase Storage bucket `memory-snapshots`
- **Development**: Local filesystem `.data/memory-snapshots/`
- **Path Pattern**: `users/{userId}/parts/{partId}/profile.md`

**Format**:
```markdown
---
id: uuid
name: Part Name
emoji: 🎭
category: manager
status: active
tags: [tag1, tag2]
related_parts: [uuid1, uuid2]
created_at: 2024-01-01T00:00:00Z
updated_at: 2024-01-01T00:00:00Z
last_active: 2024-01-01T00:00:00Z
---

# Part: Part Name

## Identity
[//]: # (anchor: identity v1)

- Part ID: uuid
- Status: active

## Role
[//]: # (anchor: role v1)

Narrative content...
```

**Characteristics**:
- ✅ User-scoped (multi-tenant safe)
- ✅ YAML frontmatter for structured metadata
- ✅ Section anchors for precise editing
- ✅ StorageAdapter abstraction (Supabase or local)
- ✅ Full CRUD operations via repository API
- ✅ Backward compatible (handles files without frontmatter)

### System 3: Database Layer (UI Query Layer)
**Location**: `lib/data/`  
**Purpose**: Fast database queries for UI components  
**Used By**: Garden UI, check-ins, all user-facing features

**Key Files**:
- `lib/data/parts-lite.ts` - Lightweight client-side queries
- `lib/data/parts-server.ts` - Server-side queries with more features
- `lib/data/parts.ts` - Full database API
- `lib/data/parts.schema.ts` - Zod schemas for validation
- `lib/data/parts-query.ts` - Query builder utilities

**Storage**:
- Supabase database tables: `parts`, `part_relationships`

**Characteristics**:
- ✅ Optimized for UI queries
- ✅ Indexed for fast searches
- ✅ Supports filtering, sorting, pagination
- ✅ Read-heavy, write through System 2

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Agent creates/updates part via tool                  │
│    (mastra/tools/memory-markdown-tools.ts)              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. System 2: Markdown stored with frontmatter           │
│    - Location: memory/users/{userId}/parts/{id}/        │
│                profile.md                                │
│    - Storage: Supabase Storage or local filesystem      │
│    - Format: YAML frontmatter + section content         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ Sync via lib/memory/parts-sync.ts
                        │ (automatic on create/update)
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. System 3: Database updated                           │
│    - Table: parts                                        │
│    - Fields: id, name, category, status, visualization, │
│              role, triggers, emotions, beliefs, etc.     │
│    - Emoji synced from frontmatter → visualization      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. UI reads from database                               │
│    - Garden: searchParts() from parts-lite.ts           │
│    - Check-ins: Load parts for selection                │
│    - Detail pages: getPartById() from parts-server.ts   │
└─────────────────────────────────────────────────────────┘
```

## Why Two Systems?

### System 2 (Markdown) - Write Path
**Optimized for**:
- AI agent interactions
- Narrative content with context
- Version history (file-based)
- Human readability
- Structured metadata (YAML)

**Trade-offs**:
- Slower queries (needs to read/parse files)
- No built-in indexing
- Requires sync to database for UI

### System 3 (Database) - Read Path  
**Optimized for**:
- Fast UI queries
- Filtering and sorting
- Pagination
- Relationships between parts
- Real-time updates

**Trade-offs**:
- Less suitable for long narrative content
- Requires sync from markdown
- AI agents work better with markdown

## Sync Layer

**File**: `lib/memory/parts-sync.ts`

**Functions**:
- `syncPartToDatabase(userId, partId)` - Sync single part
- `syncAllUserParts(userId)` - Bulk sync all parts
- `onPartProfileChanged(userId, partId)` - Hook called on markdown changes

**Sync Behavior**:
- **Automatic**: Triggered on part creation/update via agents
- **Manual**: Garden "Refresh" button calls `syncPartsAction()`
- **Smart**: Prefers frontmatter, falls back to section parsing
- **Emoji handling**: Syncs emoji from frontmatter → database visualization field

**What Gets Synced**:
```typescript
From Markdown Frontmatter → Database:
- id, name, category, status
- emoji → visualization.emoji
- tags → (future)
- related_parts → (future via relationships table)

From Markdown Sections → Database:
- role (from Role section)
- evidence (from Evidence section)
```

## Repository APIs

### System 2 API (Markdown)

```typescript
import { listParts, readPart, updatePartFrontmatter } from '@/lib/memory/parts-repository'

// List parts with filters
const parts = await listParts(userId, {
  category: 'manager',
  status: 'active',
  limit: 20
})

// Read complete part
const part = await readPart(userId, partId)
console.log(part.frontmatter, part.sections)

// Update metadata
await updatePartFrontmatter(userId, partId, {
  emoji: '🌟',
  tags: ['updated']
})

// Update section content
await updatePartSection(userId, partId, 'role v1', {
  replace: 'New role description'
})
```

### System 3 API (Database)

```typescript
import { searchParts, getPartById } from '@/lib/data/parts-lite'

// Search parts (client-side)
const parts = await searchParts({
  query: 'critic',
  category: 'manager',
  limit: 10
})

// Get single part (server-side)
import { getPartById } from '@/lib/data/parts-server'
const part = await getPartById({ partId }, deps)
```

## Orphaned System (TO DELETE)

### System 1: lib/parts/ - ORPHANED ❌
**Status**: Accidentally created, never integrated, ready for deletion

**Files to Delete**:
- `lib/parts/repository.ts`
- `lib/parts/spec.ts`
- `lib/parts/` (directory)
- `mastra/tools/part-content-tools.ts`
- `content/parts/` (directory)

**Why Delete**:
- Not connected to any system
- Duplicates System 2 functionality
- Not user-scoped
- Confuses developers
- All useful code ported to System 2

See: `docs/planning/next/tech-cleanup-system-1-orphaned-parts.md`

## Common Tasks

### Creating a Part (Agent)
```typescript
// Via agent tool
{
  partId: uuid(),
  name: 'Inner Critic',
  category: 'manager',
  status: 'active',
  emoji: '🎭'
}
// → Creates markdown in System 2
// → Auto-syncs to System 3
```

### Reading Parts (UI)
```typescript
// Garden/UI reads from System 3 (database)
const parts = await searchParts({ limit: 50 })
// Fast, indexed, optimized for display
```

### Updating Part Content (Agent)
```typescript
// Agent updates via markdown tools
await updatePartSection(userId, partId, 'role v1', {
  append: 'Additional role information'
})
// → Updates markdown in System 2
// → Auto-triggers sync to System 3
```

### Manual Sync
```typescript
// If sync gets out of date, user clicks Refresh
await syncAllUserParts(userId)
// → Re-syncs all markdown → database
```

## Backward Compatibility

### Parts Without Frontmatter
Old parts without YAML frontmatter continue to work:
- `parsePartMarkdown()` returns `null` frontmatter
- Sync layer falls back to parsing sections for metadata
- No breaking changes to existing files

### Migration Path
No migration needed! The system handles both formats:
```markdown
<!-- Old format (still works) -->
# Part: Name

## Identity
[//]: # (anchor: identity v1)
- Part ID: uuid
- Status: active

<!-- New format (preferred) -->
---
id: uuid
name: Name
status: active
---

# Part: Name

## Identity
[//]: # (anchor: identity v1)
- Part ID: uuid
- Status: active
```

## Testing

### System 2 (Markdown)
```bash
tsx scripts/test-frontmatter-system.ts
```

### System 3 (Database)
- Garden UI loads and displays parts
- Check-ins show parts for selection
- Filtering/searching works

### Sync Layer
- Create part via agent → appears in Garden
- Click Refresh → syncs markdown → database
- Emoji in markdown → shows in Garden

## Configuration

### Storage Mode
```bash
# .env or environment variable
MEMORY_STORAGE_ADAPTER=supabase  # Production
MEMORY_STORAGE_ADAPTER=local     # Development (default)
```

### Local Development
```bash
# Markdown files stored at:
.data/memory-snapshots/users/{userId}/parts/{partId}/profile.md
```

### Production
```bash
# Markdown files in Supabase Storage:
Bucket: memory-snapshots
Path: users/{userId}/parts/{partId}/profile.md
```

## Troubleshooting

### Parts not showing in Garden
1. Check if markdown files exist in storage
2. Run manual sync: Click "Refresh" in Garden
3. Check sync logs for errors
4. Verify database has records: `SELECT * FROM parts WHERE user_id = '{userId}'`

### Emoji not displaying
1. Check frontmatter has emoji field
2. Run sync to update database
3. Check database: `SELECT visualization FROM parts WHERE id = '{partId}'`
4. Should see: `{"emoji": "🎭"}`

### Sync failing
1. Check storage adapter configuration
2. Verify Supabase credentials
3. Check frontmatter is valid YAML
4. Look for parse errors in logs

## Future Improvements

### Potential Optimizations
1. **Direct markdown reading in Garden** - Skip database, read from System 2 directly
2. **Real-time sync** - WebSocket updates when markdown changes
3. **Incremental sync** - Only sync changed files
4. **Cache layer** - Redis cache for frequently accessed parts

### Not Recommended
- ❌ Merging System 2 and System 3 - They serve different purposes
- ❌ Making Garden write to markdown - Keep UI writes through API
- ❌ Removing database - UI needs fast queries

## Related Documentation

- `docs/current/features/parts-markdown.md` - Feature documentation
- `docs/planning/implementation/parts-frontmatter-implementation-2025-01-14.md` - Implementation notes
- `docs/planning/next/tech-cleanup-system-1-orphaned-parts.md` - Cleanup plan
- `lib/memory/markdown/README.md` - System 2 module documentation

## Conclusion

The two-system architecture (System 2 for writes, System 3 for reads) provides:
- ✅ Best developer experience for AI agents (markdown)
- ✅ Best performance for UI (database)
- ✅ Clear separation of concerns
- ✅ Flexibility (can optimize each independently)

The sync layer keeps them in harmony, and the system is production-ready.
