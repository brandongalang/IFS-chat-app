# Task: Enable Parts Garden with Markdown-Only Architecture

## Objective

Migrate Parts to a pure markdown system with YAML frontmatter, eliminate database dependency for parts, and enable the Garden UI to work with markdown files directly.

## Current State

- Parts table exists in database but has no data
- Markdown memory system can create part profiles but they're unused
- Garden UI reads from empty database
- Check-ins show no parts because none exist
- Two parallel systems that don't communicate

## Target State

- Parts stored as markdown files with YAML frontmatter
- Garden UI reads directly from markdown files
- Check-ins load parts from markdown
- Database parts table removed
- Single source of truth for parts

## Architecture Decision

**Pure Markdown with YAML Frontmatter**

- No database for parts
- No sync complexity
- Direct agent read/write
- <30 parts per user makes this viable

## File Structure

```
memory/users/{userId}/
├── overview.md
├── parts/
│   ├── {partId}.md
│   └── ...
└── relationships/
    └── {relId}.md
```

## Part File Format

```markdown
---
id: uuid-here
name: Inner Critic
emoji: 🎭
category: manager
status: active
created: 2024-01-01
last_active: 2024-12-15
relationships:
  protects: [part-id-1, part-id-2]
  conflicts_with: [part-id-3]
tags: [perfectionism, protection]
---

# Inner Critic

## Role

[Role description]

## Evidence

- Evidence item 1
- Evidence item 2

## Notes

[Additional notes]
```

## High-Level Implementation Plan

### Overview

Transform Parts from database-driven to markdown-driven in 5 phases, maintaining UI functionality while simplifying the backend. Each phase is independently deployable.

### Phase Sequence

```
Phase 1: Build Foundation (Markdown Repository)
    ↓
Phase 2: Update UI (Garden reads markdown)
    ↓
Phase 3: Integrate (Check-ins use markdown)
    ↓
Phase 4: Prune (Remove database code)
    ↓
Phase 5: Clean (Migration & cleanup)
```

### Critical Path

1. **Create repository layer** → Enables all other work
2. **Update Garden UI** → Users can create/view parts
3. **Update Check-ins** → Parts appear in daily flow
4. **Remove old code** → Reduce maintenance burden

## Implementation Tasks

### Phase 1: Markdown Infrastructure (Priority: Critical)

**Goal**: Create the foundation for markdown-based parts storage

#### Task 1.1: Create Parts Repository

**New File**: `lib/parts/repository.ts`

**Sub-tasks**:

- [ ] Install gray-matter dependency: `npm install gray-matter`
- [ ] Create repository class with storage adapter integration
- [ ] Implement CRUD operations for parts
- [ ] Add error handling and validation
- [ ] Write unit tests

**Sample Implementation**:

```typescript
import matter from 'gray-matter';
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers';

export class PartsRepository {
  async getAll(userId: string): Promise<Part[]> {
    const storage = await getStorageAdapter();
    const basePath = `users/${userId}/parts`;
    const files = await storage.list(basePath);

    const parts = await Promise.all(
      files.map(async (file) => {
        const content = await storage.getText(`${basePath}/${file}`);
        return this.parsePartFile(content, file.replace('.md', ''));
      })
    );

    return parts.filter((p) => p.status === 'active');
  }

  private parsePartFile(content: string, partId: string): Part {
    const { data, content: body } = matter(content);
    return {
      id: partId,
      ...data,
      content: body,
    };
  }
}
```

**Files to Edit**:

- `package.json` - Add gray-matter dependency

#### Task 1.2: Create Part Type Definitions

**New File**: `lib/parts/types.ts`

**Sub-tasks**:

- [ ] Define Part interface with all fields
- [ ] Define PartData for creation/updates
- [ ] Define PartRelationships type
- [ ] Export type guards for validation

**Sample Implementation**:

```typescript
export interface Part {
  id: string;
  name: string;
  emoji: string;
  category: 'manager' | 'firefighter' | 'exile' | 'unknown';
  status: 'active' | 'archived';
  created: string;
  last_active: string;
  relationships?: PartRelationships;
  tags?: string[];
  content?: string; // Markdown body
}

export interface PartRelationships {
  protects?: string[];
  conflicts_with?: string[];
  allied_with?: string[];
}

export type PartData = Omit<Part, 'id' | 'created' | 'content'>;
```

#### Task 1.3: Create Markdown Builder Utilities

**New File**: `lib/parts/markdown-utils.ts`

**Sub-tasks**:

- [ ] Create buildPartMarkdown function
- [ ] Create appendToSection function
- [ ] Create updateFrontmatter function
- [ ] Add section parsing utilities

**Sample Implementation**:

```typescript
import matter from 'gray-matter';

export function buildPartMarkdown(part: PartData): string {
  const frontmatter = matter.stringify('', {
    name: part.name,
    emoji: part.emoji,
    category: part.category,
    status: part.status,
    created: new Date().toISOString(),
    last_active: new Date().toISOString(),
    relationships: part.relationships || {},
    tags: part.tags || [],
  });

  return `${frontmatter}
# ${part.name}

## Role
[To be defined]

## Evidence
- [Add evidence here]

## Notes
[Add notes here]
`;
}

export function appendToSection(content: string, section: string, text: string): string {
  const lines = content.split('\n');
  const sectionIndex = lines.findIndex((line) => line.startsWith(section));

  if (sectionIndex === -1) {
    return `${content}\n\n${section}\n${text}`;
  }

  // Find next section or end of file
  let endIndex = lines.findIndex((line, i) => i > sectionIndex && line.startsWith('##'));
  if (endIndex === -1) endIndex = lines.length;

  lines.splice(endIndex, 0, text);
  return lines.join('\n');
}
```

### Phase 2: Update Garden UI (Priority: Critical)

**Goal**: Make the Garden functional with markdown-based parts

#### Task 2.1: Update Garden Main Page

**Edit File**: `app/(tabs)/garden/page.tsx`

**Sub-tasks**:

- [ ] Import PartsRepository instead of database functions
- [ ] Replace searchParts with partsRepo.getAll()
- [ ] Add "Create Part" button to header
- [ ] Remove database client imports
- [ ] Keep graph visualization logic unchanged

**Changes Required**:

```typescript
// REMOVE:
import { searchParts, getPartRelationships } from '@/lib/data/parts-lite';

// ADD:
import { PartsRepository } from '@/lib/parts/repository';
import { CreatePartDialog } from '@/components/garden/CreatePartDialog';

// CHANGE in component:
// FROM:
const partsResult = await searchParts({ limit: 50 });

// TO:
const partsRepo = new PartsRepository();
const partsResult = await partsRepo.getAll(userId);
```

**Files to Edit**:

- `app/(tabs)/garden/page.tsx` - Main garden view
- Remove imports from `@/lib/data/parts-lite`

#### Task 2.2: Create Part Creation Dialog

**New File**: `components/garden/CreatePartDialog.tsx`

**Sub-tasks**:

- [ ] Create dialog component with form
- [ ] Add name, emoji picker, category selector
- [ ] Implement form validation
- [ ] Call repository create method
- [ ] Handle success/error states

**Sample Implementation**:

```typescript
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { PartsRepository } from '@/lib/parts/repository'

export function CreatePartDialog({
  open,
  onOpenChange,
  onSuccess
}: CreatePartDialogProps) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🧩')
  const [category, setCategory] = useState<PartCategory>('unknown')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const repo = new PartsRepository()
    const part = await repo.create(userId, {
      name,
      emoji,
      category,
      status: 'active'
    })
    onSuccess(part)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Part</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {/* Form fields */}
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

#### Task 2.3: Update Part Detail Page

**Edit File**: `app/garden/[partId]/page.tsx`

**Sub-tasks**:

- [ ] Replace getPartById with partsRepo.get()
- [ ] Display markdown content sections
- [ ] Parse and show evidence items
- [ ] Keep existing UI layout

**Changes Required**:

```typescript
// REMOVE:
import { getPartById, getPartRelationships } from '@/lib/data/parts-server';

// ADD:
import { PartsRepository } from '@/lib/parts/repository';
import { remark } from 'remark';
import html from 'remark-html';

// CHANGE data fetching:
// FROM:
const partResult = await getPartById({ partId }, deps);

// TO:
const partsRepo = new PartsRepository();
const part = await partsRepo.get(userId, partId);

// ADD markdown rendering:
const processedContent = await remark()
  .use(html)
  .process(part.content || '');
const contentHtml = processedContent.toString();
```

**Files to Edit**:

- `app/garden/[partId]/page.tsx` - Part detail view
- `package.json` - Add remark dependencies if needed

#### Task 2.4: Update Part Actions

**Edit File**: `app/garden/actions.ts`

**Sub-tasks**:

- [ ] Replace updatePart with repository methods
- [ ] Update addPartNote to append to markdown
- [ ] Remove Supabase client usage
- [ ] Add markdown file updates

**Changes Required**:

```typescript
// REMOVE:
import { updatePart } from '@/lib/data/parts-server'
import { getServerSupabaseClient } from '@/lib/supabase/clients'

// ADD:
import { PartsRepository } from '@/lib/parts/repository'
import { appendToSection } from '@/lib/parts/markdown-utils'

// CHANGE updatePartDetails:
// FROM:
const updated = await updatePart({ partId, updates: {...} })

// TO:
const repo = new PartsRepository()
const updated = await repo.update(userId, partId, {
  name,
  emoji,
  last_active: new Date().toISOString()
})

// CHANGE addPartNote to append to markdown:
const part = await repo.get(userId, partId)
const updatedContent = appendToSection(
  part.content || '',
  '## Notes',
  `- ${content} (${new Date().toISOString()})`
)
await repo.updateContent(userId, partId, updatedContent)
```

**Files to Edit**:

- `app/garden/actions.ts` - Server actions

### Phase 3: Update Check-ins (Priority: High)

**Goal**: Make check-ins load and track parts from markdown

#### Task 3.1: Update Parts Loading for Check-ins

**Edit File**: `lib/check-ins/server.ts`

**Sub-tasks**:

- [ ] Replace database query with repository call
- [ ] Maintain same return format for compatibility
- [ ] Filter for active parts only
- [ ] Sort by last_active date

**Changes Required**:

```typescript
// In loadAvailableParts() function:

// REMOVE:
const { data, error } = await supabase
  .from('parts')
  .select('id, name, visualization')
  .eq('user_id', userId)
  .order('name', { ascending: true });

// ADD:
import { PartsRepository } from '@/lib/parts/repository';

const repo = new PartsRepository();
const parts = await repo.getAll(userId);

// Transform to expected format:
return parts
  .filter((p) => p.status === 'active')
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((part) => ({
    id: part.id,
    name: part.name,
    emoji: part.emoji,
  }));
```

**Files to Edit**:

- `lib/check-ins/server.ts` - loadAvailableParts function

#### Task 3.2: Track Part Activity in Check-ins

**Edit File**: `lib/check-ins/server.ts`

**Sub-tasks**:

- [ ] Update part's last_active when selected
- [ ] Add check-in tracking to part history
- [ ] Batch update selected parts

**Changes Required**:

```typescript
// In submitCheckIn() function, after successful submission:

// ADD:
if (selectedParts.length > 0) {
  const repo = new PartsRepository();

  // Update last_active for all selected parts
  await Promise.all(
    selectedParts.map((partId) =>
      repo.update(userId, partId, {
        last_active: new Date().toISOString(),
      })
    )
  );

  // Optionally append to part's evidence/notes
  for (const partId of selectedParts) {
    const part = await repo.get(userId, partId);
    const note = `Present during ${payload.type} check-in`;
    const updated = appendToSection(
      part.content || '',
      '## Check-in History',
      `- ${targetDateIso} (${payload.type})`
    );
    await repo.updateContent(userId, partId, updated);
  }
}
```

**Files to Edit**:

- `lib/check-ins/server.ts` - submitCheckIn function

### Phase 4: Prune Deprecated Code (Priority: Medium)

**Goal**: Remove all database-related parts code

#### Task 4.1: Delete Database Part Files

**Files to DELETE**:

**Sub-tasks**:

- [ ] Delete `lib/data/parts.ts`
- [ ] Delete `lib/data/parts-lite.ts`
- [ ] Delete `lib/data/parts-server.ts`
- [ ] Delete `lib/data/parts-query.ts`
- [ ] Update imports in any files that referenced these

**Files that may need import updates**:

- `app/(tabs)/garden/page.tsx`
- `app/garden/[partId]/page.tsx`
- `app/garden/actions.ts`
- `components/garden/PartCard.tsx`

#### Task 4.2: Clean Up Parts Schema File

**Edit File**: `lib/data/parts.schema.ts`

**Sub-tasks**:

- [ ] Keep type definitions
- [ ] Remove Zod schemas for database
- [ ] Remove database validation
- [ ] Export only types needed for UI

**Changes Required**:

```typescript
// KEEP:
export type PartCategory = 'manager' | 'firefighter' | 'exile' | 'unknown'
export type PartStatus = 'active' | 'archived'

// REMOVE:
- All Zod schemas (searchPartsSchema, updatePartSchema, etc.)
- Database input/output types
- Validation functions
```

#### Task 4.3: Update API Routes

**Edit File**: `app/api/parts/route.ts`

**Sub-tasks**:

- [ ] Update GET to use PartsRepository
- [ ] Add POST for part creation
- [ ] Remove database client imports
- [ ] Add proper error handling

**Changes Required**:

```typescript
import { PartsRepository } from '@/lib/parts/repository';
import { jsonResponse, errorResponse } from '@/lib/api/response';

export async function GET() {
  const repo = new PartsRepository();
  const userId = await getUserId(); // Get from session

  try {
    const parts = await repo.getAll(userId);
    return jsonResponse(parts);
  } catch (error) {
    return errorResponse('Failed to fetch parts', 500);
  }
}

export async function POST(request: Request) {
  const repo = new PartsRepository();
  const userId = await getUserId();
  const data = await request.json();

  try {
    const part = await repo.create(userId, data);
    return jsonResponse(part, 201);
  } catch (error) {
    return errorResponse('Failed to create part', 500);
  }
}
```

**Files to Edit**:

- `app/api/parts/route.ts`

#### Task 4.4: Remove Memory Sync Code

**Edit Files**: Various memory-related files

**Sub-tasks**:

- [ ] Remove parts sync from memory queue handlers
- [ ] Delete any parts-specific memory update logic
- [ ] Remove unused imports

**Files to Check and Clean**:

- `lib/memory/queue.ts` - Remove parts-related handlers
- `lib/memory/service.ts` - Remove parts sync logic
- `lib/memory/update-runner.ts` - Remove parts processing
- Delete `lib/memory/parts-sync.ts` if it exists

### Phase 5: Migration & Cleanup (Priority: Low)

**Goal**: Migrate any existing data and clean up database

#### Task 5.1: Create Migration Script (If Needed)

**New File**: `scripts/migrate-parts-to-markdown.ts`

**Sub-tasks**:

- [ ] Query all existing parts from database
- [ ] Create markdown file for each part
- [ ] Preserve all relationships and data
- [ ] Verify migration success
- [ ] Create rollback option

**Sample Implementation**:

```typescript
import { createClient } from '@supabase/supabase-js';
import { PartsRepository } from '../lib/parts/repository';

async function migrateParts() {
  const supabase = createClient(url, key);
  const repo = new PartsRepository();

  // Get all users with parts
  const { data: users } = await supabase.from('parts').select('user_id').distinct();

  for (const { user_id } of users) {
    // Get all parts for user
    const { data: parts } = await supabase.from('parts').select('*').eq('user_id', user_id);

    // Create markdown for each part
    for (const part of parts) {
      await repo.create(user_id, {
        name: part.name,
        emoji: part.visualization?.emoji || '🧩',
        category: part.category,
        status: part.status,
        // Map relationships if they exist
      });

      console.log(`Migrated part: ${part.name} for user ${user_id}`);
    }
  }
}
```

**Files to Create**:

- `scripts/migrate-parts-to-markdown.ts`

#### Task 5.2: Database Schema Cleanup

**Edit File**: `supabase/migrations/` (new migration file)

**Sub-tasks**:

- [ ] Create migration to drop parts table
- [ ] Remove parts-related RLS policies
- [ ] Drop unused indexes
- [ ] Clean up foreign key references

**Sample Migration**:

```sql
-- Drop parts-related objects
DROP POLICY IF EXISTS "Users can view own parts" ON parts;
DROP POLICY IF EXISTS "Users can insert own parts" ON parts;
DROP POLICY IF EXISTS "Users can update own parts" ON parts;
DROP POLICY IF EXISTS "Users can delete own parts" ON parts;

DROP TABLE IF EXISTS part_relationships CASCADE;
DROP TABLE IF EXISTS part_notes CASCADE;
DROP TABLE IF EXISTS parts CASCADE;

-- Remove parts from check_ins if stored there
ALTER TABLE check_ins
  DROP COLUMN IF EXISTS parts_data;
```

**Files to Edit**:

- Create new migration file in `supabase/migrations/`

#### Task 5.3: Update Documentation

**Files to Update**:

**Sub-tasks**:

- [ ] Update README with new architecture
- [ ] Document markdown file format
- [ ] Update API documentation
- [ ] Add troubleshooting guide

**Files to Edit**:

- `README.md` - Update architecture section
- `docs/features/parts-garden.md` - Update to reflect markdown approach
- Create `docs/architecture/parts-markdown.md` - Document new system

## Code to Remove/Deprecate

### Files to DELETE:

- `lib/data/parts.ts`
- `lib/data/parts-lite.ts`
- `lib/data/parts-server.ts`
- `lib/data/parts-query.ts`
- `components/garden/PartActions.tsx` (after rewrite)

### Code to REMOVE:

- Database parts queries in check-ins
- Parts sync in memory queue
- Parts-related database types
- Unused parts schemas

## Testing Checklist

- [ ] Can create a part through UI
- [ ] Part appears in Garden immediately
- [ ] Part shows in check-in selection
- [ ] Can update part name/emoji
- [ ] Can add notes to part
- [ ] Relationships display correctly
- [ ] No database queries for parts
- [ ] Agent can read part files
- [ ] Agent can update part files

## Performance Considerations

With <30 parts per user:

- Loading all parts: ~5-10ms
- No indexing needed
- No caching required
- Direct file reads are fast enough

## Rollback Plan

If issues arise:

1. Keep database table (don't drop immediately)
2. Can dual-write during transition
3. Markdown files can regenerate from database
4. Feature flag to switch between systems

## Success Metrics

- [ ] Garden displays parts
- [ ] Check-ins show parts for selection
- [ ] No sync errors (because no sync!)
- [ ] Agent can read/write parts
- [ ] Code reduction of ~40%

## Implementation Order

1. **Week 1**:
   - Create PartsRepository
   - Update Garden to read from markdown
   - Add part creation UI

2. **Week 2**:
   - Update check-ins
   - Update part detail pages
   - Test agent interactions

3. **Week 3**:
   - Remove deprecated code
   - Clean up database
   - Performance testing

## Dependencies

- gray-matter library for YAML frontmatter
- Supabase Storage configured
- User authentication working

## Open Questions Resolved

1. **Complex queries?** → Not needed, <30 parts
2. **Real-time updates?** → Direct file writes are instant
3. **Relationships?** → YAML arrays of IDs
4. **Performance?** → 30 files is negligible
5. **Backup?** → Files in Supabase Storage are backed up

## Key Benefits of This Approach

1. **Simplicity**: One source of truth
2. **Maintainability**: No sync logic
3. **Agent-friendly**: Direct file access
4. **Debuggable**: Just look at files
5. **Portable**: User owns their data
6. **Version control**: Can track changes

## What We're NOT Doing

- NOT maintaining database parts table
- NOT syncing between systems
- NOT building complex query layers
- NOT caching or indexing
- NOT over-engineering for scale we don't need

## Definition of Done

- [ ] Parts stored only as markdown
- [ ] Garden fully functional with markdown
- [ ] Check-ins load from markdown
- [ ] Database parts code removed
- [ ] Agent can manipulate parts
- [ ] Documentation updated
- [ ] No performance degradation
