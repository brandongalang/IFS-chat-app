# Memory Markdown Module

This module provides markdown parsing and editing utilities for the memory system, specifically for user part profiles.

## Quick Start

### Creating a Part Profile with Frontmatter

```typescript
import { buildPartProfileMarkdown } from '@/lib/memory/snapshots/grammar'
import { getStorageAdapter, partProfilePath } from '@/lib/memory/snapshots/fs-helpers'

const markdown = buildPartProfileMarkdown({
  userId: 'user-id',
  partId: 'part-id',
  name: 'Inner Critic',
  status: 'active',
  category: 'manager',
  emoji: '🎭',
})

const storage = await getStorageAdapter()
const path = partProfilePath('user-id', 'part-id')
await storage.putText(path, markdown, { contentType: 'text/markdown; charset=utf-8' })
```

### Reading a Part Profile

```typescript
import { readPartProfile } from '@/lib/memory/read'

const profile = await readPartProfile('user-id', 'part-id')
if (profile) {
  console.log('Frontmatter:', profile.frontmatter)
  console.log('Sections:', Object.keys(profile.sections))
}
```

### Using the Repository API

```typescript
import { listParts, readPart, updatePartFrontmatter } from '@/lib/memory/parts-repository'

// List all active manager parts
const parts = await listParts('user-id', {
  category: 'manager',
  status: 'active',
})

// Read a specific part
const part = await readPart('user-id', 'part-id')

// Update frontmatter
await updatePartFrontmatter('user-id', 'part-id', {
  emoji: '🌟',
  tags: ['updated', 'star'],
})
```

## Architecture

### Modules

- **`frontmatter.ts`** - YAML frontmatter parsing and serialization using gray-matter
- **`md.ts`** - Markdown section parsing and editing (anchor-based)
- **`editor.ts`** - High-level markdown editing (wraps md.ts)

### Flow

```
Part Creation:
  buildPartProfileMarkdown() 
  → generates YAML frontmatter + section content 
  → StorageAdapter.putText()

Part Reading:
  StorageAdapter.getText() 
  → parsePartMarkdown() (extracts frontmatter) 
  → buildSectionMap() (parses sections)
  → { frontmatter, sections }

Database Sync:
  readPartProfile() 
  → prefer frontmatter data 
  → fallback to section parsing 
  → syncPartToDatabase()
```

## Format

Part profiles use a hybrid format:

### YAML Frontmatter (Structured Metadata)
```yaml
---
id: uuid
name: Part Name
emoji: 🎭
category: manager|firefighter|exile|unknown
status: emerging|acknowledged|active|integrated
tags: [tag1, tag2]
related_parts: [uuid1, uuid2]
created_at: 2024-01-01T00:00:00Z
updated_at: 2024-01-01T00:00:00Z
last_active: 2024-01-01T00:00:00Z
---
```

### Section Content (Narrative)
```markdown
## Identity
[//]: # (anchor: identity v1)

- Part ID: uuid
- Status: active

## Role
[//]: # (anchor: role v1)

Narrative content here...

## Evidence (curated)
[//]: # (anchor: evidence v1)

- Evidence item 1
- Evidence item 2
```

## Backward Compatibility

Files without frontmatter are still supported:
- `parsePartMarkdown()` returns `null` frontmatter if not present
- `readPartProfile()` falls back to parsing sections for metadata
- `syncPartToDatabase()` extracts data from sections if no frontmatter

## Storage

Files are stored via the `StorageAdapter` interface:
- **Production**: Supabase Storage bucket `memory-snapshots`
- **Development**: Local filesystem `.data/memory-snapshots/`
- **Path pattern**: `users/{userId}/parts/{partId}/profile.md`

Configure via environment variable:
```bash
MEMORY_STORAGE_ADAPTER=supabase  # or 'local' (default)
```

## Testing

Run the manual test script:
```bash
IFS_DEFAULT_USER_ID=<your-user-id> tsx scripts/test-frontmatter-system.ts
```

## Related Documentation

- `docs/current/features/parts-markdown.md` - Feature documentation
- `docs/planning/implementation/parts-frontmatter-implementation-2025-01-14.md` - Implementation notes
- `lib/memory/parts-repository.ts` - Repository API reference

## Migration Notes

If you have old parts without frontmatter:
1. They will continue to work (backward compatible)
2. Reading prefers frontmatter but falls back to sections
3. Syncing to database works with both formats
4. To add frontmatter, use `updatePartFrontmatter()` (requires existing frontmatter)
5. Or recreate the file using `buildPartProfileMarkdown()`
