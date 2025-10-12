# Task: Parts Markdown Migration (Updated with YAML/Markdown Separation)

## Objective

Migrate Parts to markdown with clear separation: YAML frontmatter for structured metadata, markdown body for narrative content. Conversational agent reads YAML context but only writes markdown sections.

## Key Principles

1. **YAML = Metadata** (machine-queryable, system/metadata-agent managed)
   - Identity: id, name, emoji
   - Classification: category, status, tags
   - Timestamps: created, last_active
   - Activity metrics: check_in_count, total_mentions, interaction_frequency
   - Relationships: related_parts (just IDs, not descriptions)

2. **Markdown = Content** (human-readable, conversational-agent written)
   - Role & Purpose: Narrative description
   - Evidence & Observations: Specific instances and patterns
   - Therapeutic Notes: Insights and hypotheses
   - Session Log: Dated conversation entries

3. **No Overlap** between YAML and markdown
   - YAML has no narrative text
   - Markdown has no metadata/metrics
   - Each field has one owner

## File Structure

```text
memory/users/{userId}/
├── overview.md
├── parts/
│   ├── {partId}.md
│   └── ...
└── relationships/
    └── {relId}.md (future)
```

## Part File Format (Updated)

```markdown
---
# Identity
id: "part_123"
name: "Inner Critic"
emoji: "🎭"

# Classification
category: "manager"
status: "active"
tags: ["perfectionism", "performance", "anxiety"]

# Timestamps
created: "2025-01-01T00:00:00.000Z"
last_active: "2025-10-11T00:00:00.000Z"

# Activity (managed by metadata agent/hooks - see parts-yaml-metadata-agent.md)
activity_metrics:
  check_in_count: 12
  last_check_in: "2025-10-11T00:00:00.000Z"
  total_mentions: 47
  interaction_frequency: "high"

# Relationships (managed by metadata agent/hooks)
related_parts:
  protects: ["part_456"]
  conflicts_with: ["part_789"]
  allied_with: []
---

## Role & Purpose

The Inner Critic serves as a performance guardian, stepping in during high-stakes 
situations to prevent failure through hyper-vigilant self-monitoring.

## Evidence & Observations

- Appeared prominently during Q4 performance review (2025-10-11)
- User reported "constant voice critiquing every decision"
- Most active during afternoon work sessions (3-5pm)
- Intensity increases when deadlines approach

## Therapeutic Notes

- Protects against shame by preventing perceived mistakes
- Likely emerged during childhood academic pressure
- Consider exploring: what would happen if the Critic took a break?

## Session Log

### 2025-10-11
User noticed the Critic during our check-in. Acknowledged its protective intent.
Explored: "What are you afraid will happen if you're not vigilant?"
```

## Implementation Plan (Updated)

### Phase 1: Core Infrastructure

#### Task 1.1: Create Spec Module (Single Source of Truth)

**New File**: `lib/parts/spec.ts`

```typescript
import { z } from 'zod';
import matter from 'gray-matter';

// YAML Frontmatter Schema (strict, no userId)
export const PartFrontmatterSchema = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  
  // Classification
  category: z.enum(['manager', 'firefighter', 'exile', 'unknown']),
  status: z.enum(['active', 'archived']),
  tags: z.array(z.string()),
  
  // Timestamps
  created: z.string(), // ISO
  last_active: z.string(), // ISO
  
  // Activity (optional, managed by metadata agent)
  activity_metrics: z.object({
    check_in_count: z.number(),
    last_check_in: z.string().optional(),
    total_mentions: z.number(),
    interaction_frequency: z.enum(['high', 'medium', 'low']).optional(),
  }).optional(),
  
  // Relationships (optional, managed by metadata agent)
  related_parts: z.object({
    protects: z.array(z.string()),
    conflicts_with: z.array(z.string()),
    allied_with: z.array(z.string()),
  }).optional(),
}).strict();

export type Part = z.infer<typeof PartFrontmatterSchema>;

// Markdown Section Definitions
export const PART_SECTIONS = [
  '## Role & Purpose',
  '## Evidence & Observations',
  '## Therapeutic Notes',
  '## Session Log',
] as const;

// Parser
export function parsePartMarkdown(text: string, options?: { compat?: boolean }) {
  const { data, content } = matter(text);
  const frontmatter = PartFrontmatterSchema.parse(data);
  
  // Simple section parser
  const sections: Record<string, string> = {};
  const lines = content.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.trim();
      sections[currentSection] = '';
    } else if (currentSection) {
      sections[currentSection] += line + '\n';
    }
  }
  
  return { frontmatter, sections };
}

// Serializer (canonical format)
export function serializePart(
  frontmatter: Part, 
  sections: Record<string, string>
): string {
  // Serialize YAML with stable field order
  const yamlContent = matter.stringify('', frontmatter);
  
  // Serialize sections in defined order
  const sectionContent = PART_SECTIONS
    .map(heading => {
      const content = sections[heading] || '';
      return `${heading}\n${content.trim()}`;
    })
    .join('\n\n');
  
  return yamlContent + '\n' + sectionContent;
}

// Template for new parts
export const PART_TEMPLATE = (data: Partial<Part>) => serializePart(
  {
    id: data.id || 'PLACEHOLDER',
    name: data.name || 'Unnamed Part',
    emoji: data.emoji || '🧩',
    category: data.category || 'unknown',
    status: data.status || 'active',
    tags: data.tags || [],
    created: data.created || new Date().toISOString(),
    last_active: data.last_active || new Date().toISOString(),
  },
  {
    '## Role & Purpose': '[To be defined]',
    '## Evidence & Observations': '',
    '## Therapeutic Notes': '',
    '## Session Log': '',
  }
);
```

**Sub-tasks:**
- [ ] Install gray-matter: `npm install gray-matter`
- [ ] Create spec.ts with schema, parser, serializer
- [ ] Add unit tests for parse → serialize idempotency
- [ ] Add golden-file tests for canonical format

---

#### Task 1.2: Create Parts Repository

**New File**: `lib/parts/repository.ts`

```typescript
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers';
import { parsePartMarkdown, serializePart, Part } from './spec';

export class PartsRepository {
  async list(userId: string, filters?: {
    status?: 'active' | 'archived' | 'all';
    category?: Part['category'];
    tags?: string[];
  }): Promise<Part[]> {
    const storage = await getStorageAdapter();
    const files = await storage.list(`users/${userId}/parts`);
    
    const parts = await Promise.all(
      files.map(async (file) => {
        const content = await storage.getText(`users/${userId}/parts/${file}`);
        const { frontmatter } = parsePartMarkdown(content);
        return frontmatter;
      })
    );
    
    // Apply filters
    let filtered = parts;
    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter(p => p.status === filters.status);
    }
    if (filters?.category) {
      filtered = filtered.filter(p => p.category === filters.category);
    }
    if (filters?.tags?.length) {
      filtered = filtered.filter(p => 
        filters.tags!.some(tag => p.tags.includes(tag))
      );
    }
    
    return filtered;
  }
  
  async get(userId: string, partId: string) {
    const storage = await getStorageAdapter();
    const content = await storage.getText(`users/${userId}/parts/${partId}.md`);
    return parsePartMarkdown(content);
  }
  
  async create(userId: string, data: {
    name: string;
    emoji?: string;
    category?: Part['category'];
    status?: Part['status'];
    tags?: string[];
    initial_content?: Record<string, string>;
  }): Promise<string> {
    const storage = await getStorageAdapter();
    const partId = randomUUID();
    const now = new Date().toISOString();
    
    const frontmatter: Part = {
      id: partId,
      name: data.name,
      emoji: data.emoji || '🧩',
      category: data.category || 'unknown',
      status: data.status || 'active',
      tags: data.tags || [],
      created: now,
      last_active: now,
    };
    
    const sections = {
      '## Role & Purpose': data.initial_content?.['role'] || '[To be defined]',
      '## Evidence & Observations': data.initial_content?.['evidence'] || '',
      '## Therapeutic Notes': data.initial_content?.['notes'] || '',
      '## Session Log': '',
    };
    
    const markdown = serializePart(frontmatter, sections);
    await storage.write(`users/${userId}/parts/${partId}.md`, markdown);
    
    return partId;
  }
  
  async updateContent(
    userId: string, 
    partId: string, 
    section: string, 
    content: string, 
    operation: 'replace' | 'append' | 'prepend'
  ): Promise<void> {
    const storage = await getStorageAdapter();
    const existing = await storage.getText(`users/${userId}/parts/${partId}.md`);
    const { frontmatter, sections } = parsePartMarkdown(existing);
    
    const current = sections[section] || '';
    switch (operation) {
      case 'replace':
        sections[section] = content;
        break;
      case 'append':
        sections[section] = current + '\n' + content;
        break;
      case 'prepend':
        sections[section] = content + '\n' + current;
        break;
    }
    
    // Update last_active timestamp
    frontmatter.last_active = new Date().toISOString();
    
    const markdown = serializePart(frontmatter, sections);
    await storage.write(`users/${userId}/parts/${partId}.md`, markdown);
  }
  
  // Note: Frontmatter updates will be handled by metadata service (see parts-yaml-metadata-agent.md)
  // Repository only provides read access to frontmatter for conversational agent
}
```

**Sub-tasks:**
- [ ] Create repository with list, get, create, updateContent
- [ ] Add error handling and validation
- [ ] Write integration tests with fixture files

---

### Phase 2: Conversational Agent Tools (Markdown-Only)

#### Task 2.1: Core CRUD Tools

**New File**: `mastra/tools/part-content-tools.ts`

Tools for conversational agent (reads YAML context, writes markdown content):

1. **get_parts_metadata_summary** - Overview of all parts metadata (tags, categories, counts)
2. **list_parts** - Discover parts by querying YAML
3. **query_parts** - Advanced filtering on YAML fields
4. **read_part** - Get YAML context + markdown content
5. **create_part** - Create with minimal YAML, optional initial content
6. **update_part_metadata** - Update YAML frontmatter fields (simple, direct updates)
7. **update_part_content** - Modify markdown sections only
8. **search_part_sections** - Find text in markdown
9. **replace_in_part_section** - Edit markdown text
10. **batch_update_part_content** - Multiple section updates atomically

**Key principle:** Agent can update YAML when user explicitly requests it ("tag this part with X", "change category to manager"). Complex inference (auto-tagging, relationship detection) handled by metadata agent (future).

**Implementation:** See detailed tool specs below

---

#### Task 2.2: System Prompt Update

**Edit File**: `mastra/agents/ifs_agent_prompt.ts`

Update prompt to clarify:
- Agent reads metadata from YAML for context
- Agent only writes to markdown sections
- Metadata updates handled by separate system (transparent to agent)

---

### Phase 3: Metadata Management (Out of Scope for This Task)

See `task/parts-yaml-metadata-agent.md` for:
- LLM-powered metadata inference
- Event hooks for activity tracking
- Relationship detection
- Tag suggestions

This task only sets up the infrastructure for clean separation.

---

### Phase 4: Migration & Cleanup

#### Task 4.1: Update Garden UI

**Edit Files:**
- `app/(tabs)/garden/page.tsx` - Use PartsRepository
- `app/garden/[partId]/page.tsx` - Display YAML + markdown
- `app/garden/actions.ts` - Remove, replaced by tools

#### Task 4.2: Update Check-ins

**Edit File**: `lib/check-ins/server.ts`

Update `loadAvailableParts` to read from PartsRepository

#### Task 4.3: Delete Deprecated Code

**Files to DELETE:**
- `lib/data/parts.ts`
- `lib/data/parts-lite.ts`
- `lib/data/parts-server.ts`
- `lib/data/parts-query.ts`

#### Task 4.4: Database Cleanup

**New Migration**: Drop parts table (after confirming no data loss)

---

## Conversational Agent Tools (Detailed Spec)

### 1. get_parts_metadata_summary

```typescript
export const getPartsMetadataSummaryTool = createTool({
  id: 'get_parts_metadata_summary',
  description: 'Get overview of all parts metadata: tag list, category distribution, status counts. Use this to discover what query options are available.',
  inputSchema: z.object({}), // No inputs needed
  execute: async (input, { userId }) => {
    const repo = new PartsRepository();
    const allParts = await repo.list(userId, { status: 'all' });
    
    // Collect all unique tags
    const tagSet = new Set<string>();
    const tagCounts: Record<string, number> = {};
    
    // Count by category and status
    const byCategoryStatus: Record<string, Record<string, number>> = {
      manager: { active: 0, archived: 0 },
      firefighter: { active: 0, archived: 0 },
      exile: { active: 0, archived: 0 },
      unknown: { active: 0, archived: 0 },
    };
    
    // Activity stats
    let oldestCreated = allParts[0]?.created || new Date().toISOString();
    let newestCreated = allParts[0]?.created || new Date().toISOString();
    let mostRecentlyActive = allParts[0]?.last_active || new Date().toISOString();
    
    for (const part of allParts) {
      // Tags
      (part.tags || []).forEach(tag => {
        tagSet.add(tag);
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      
      // Category/status counts
      byCategoryStatus[part.category][part.status]++;
      
      // Timestamps
      if (part.created < oldestCreated) oldestCreated = part.created;
      if (part.created > newestCreated) newestCreated = part.created;
      if (part.last_active > mostRecentlyActive) mostRecentlyActive = part.last_active;
    }
    
    // Sort tags by frequency
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
    
    return {
      success: true,
      summary: {
        total_parts: allParts.length,
        by_status: {
          active: allParts.filter(p => p.status === 'active').length,
          archived: allParts.filter(p => p.status === 'archived').length,
        },
        by_category: {
          manager: byCategoryStatus.manager.active + byCategoryStatus.manager.archived,
          firefighter: byCategoryStatus.firefighter.active + byCategoryStatus.firefighter.archived,
          exile: byCategoryStatus.exile.active + byCategoryStatus.exile.archived,
          unknown: byCategoryStatus.unknown.active + byCategoryStatus.unknown.archived,
        },
        by_category_and_status: byCategoryStatus,
        tags: {
          total_unique: tagSet.size,
          all_tags: Array.from(tagSet).sort(),
          top_tags: topTags,
        },
        activity: {
          oldest_created: oldestCreated,
          newest_created: newestCreated,
          most_recently_active: mostRecentlyActive,
        },
      },
    };
  }
});
```

**Use cases:**
- User: "What tags do I have?" → Agent calls this tool, shows tag list
- User: "How many parts do I have?" → Agent calls this tool, shows counts
- User: "Find parts tagged with X" → Agent can first check if tag X exists
- Agent planning: Before querying, agent can see what categories/tags/statuses exist

**Returns:**
```json
{
  "summary": {
    "total_parts": 12,
    "by_status": { "active": 10, "archived": 2 },
    "by_category": { "manager": 5, "firefighter": 3, "exile": 2, "unknown": 2 },
    "by_category_and_status": {
      "manager": { "active": 4, "archived": 1 },
      ...
    },
    "tags": {
      "total_unique": 15,
      "all_tags": ["anxiety", "boundaries", "control", ...],
      "top_tags": [
        { "tag": "anxiety", "count": 7 },
        { "tag": "perfectionism", "count": 5 },
        ...
      ]
    },
    "activity": {
      "oldest_created": "2024-01-01T00:00:00Z",
      "newest_created": "2025-10-11T00:00:00Z",
      "most_recently_active": "2025-10-11T12:00:00Z"
    }
  }
}
```

### 2. list_parts

```typescript
export const listPartsTool = createTool({
  id: 'list_parts',
  description: 'List all parts with optional filtering. Returns metadata only.',
  inputSchema: z.object({
    status: z.enum(['active', 'archived', 'all']).optional().default('active'),
    category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
    tags: z.array(z.string()).optional(),
    sort_by: z.enum(['name', 'last_active', 'created']).optional().default('last_active'),
  }),
  execute: async (input, { userId }) => {
    const repo = new PartsRepository();
    const parts = await repo.list(userId, {
      status: input.status,
      category: input.category,
      tags: input.tags,
    });
    
    // Sort and return minimal metadata
    return {
      success: true,
      parts: parts.map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        category: p.category,
        status: p.status,
        tags: p.tags,
        last_active: p.last_active,
      }))
    };
  }
});
```

### 2. query_parts

```typescript
export const queryPartsTool = createTool({
  id: 'query_parts',
  description: 'Advanced filtering across parts metadata.',
  inputSchema: z.object({
    filters: z.object({
      categories: z.array(z.enum(['manager', 'firefighter', 'exile', 'unknown'])).optional(),
      statuses: z.array(z.enum(['active', 'archived'])).optional(),
      tags_all: z.array(z.string()).optional(),
      tags_any: z.array(z.string()).optional(),
      tags_none: z.array(z.string()).optional(),
      name_contains: z.string().optional(),
      last_active_after: z.string().optional(),
      last_active_before: z.string().optional(),
    }),
    limit: z.number().optional(),
  }),
  execute: async (input, { userId }) => {
    // Implementation filters parts based on criteria
    // Returns same minimal metadata as list_parts
  }
});
```

### 3. read_part

```typescript
export const readPartTool = createTool({
  id: 'read_part',
  description: 'Read complete part with metadata context and content sections.',
  inputSchema: z.object({
    partId: z.string(),
  }),
  execute: async (input, { userId }) => {
    const repo = new PartsRepository();
    const { frontmatter, sections } = await repo.get(userId, input.partId);
    
    return {
      success: true,
      // Read-only metadata context
      metadata: {
        id: frontmatter.id,
        name: frontmatter.name,
        emoji: frontmatter.emoji,
        category: frontmatter.category,
        status: frontmatter.status,
        tags: frontmatter.tags,
        created: frontmatter.created,
        last_active: frontmatter.last_active,
        activity_metrics: frontmatter.activity_metrics,
        related_parts: frontmatter.related_parts,
      },
      // Editable content sections
      content: sections,
    };
  }
});
```

### 4. create_part

```typescript
export const createPartTool = createTool({
  id: 'create_part',
  description: 'Create a new part with minimal metadata and optional initial content.',
  inputSchema: z.object({
    name: z.string(),
    emoji: z.string().optional().default('🧩'),
    category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional().default('unknown'),
    tags: z.array(z.string()).optional().default([]),
    initial_content: z.object({
      role: z.string().optional(),
      evidence: z.string().optional(),
      notes: z.string().optional(),
    }).optional(),
  }),
  execute: async (input, { userId }) => {
    const repo = new PartsRepository();
    const partId = await repo.create(userId, input);
    
    return {
      success: true,
      partId,
    };
  }
});
```

### 5. update_part_metadata

```typescript
export const updatePartMetadataTool = createTool({
  id: 'update_part_metadata',
  description: 'Update YAML frontmatter fields. Use for direct user requests like "tag this part" or "change category". Does NOT modify content sections.',
  inputSchema: z.object({
    partId: z.string(),
    updates: z.object({
      name: z.string().optional(),
      emoji: z.string().optional(),
      category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
      status: z.enum(['active', 'archived']).optional(),
      tags: z.array(z.string()).optional().describe('Replaces existing tags entirely; use read_part first to append'),
    }).strict(),
  }),
  execute: async (input, { userId }) => {
    const storage = await getStorageAdapter();
    const content = await storage.getText(`users/${userId}/parts/${input.partId}.md`);
    const { frontmatter, sections } = parsePartMarkdown(content);
    
    // Merge updates into frontmatter
    const updated = {
      ...frontmatter,
      ...input.updates,
      last_active: new Date().toISOString(), // Update timestamp on metadata change
    };
    
    const markdown = serializePart(updated, sections);
    await storage.write(`users/${userId}/parts/${input.partId}.md`, markdown);
    
    return {
      success: true,
      updated_fields: Object.keys(input.updates),
      frontmatter: updated,
    };
  }
});
```

**Usage examples:**
- User: "Tag the Inner Critic with 'perfectionism'" → Agent reads part, appends tag, calls update_part_metadata
- User: "Change this part to a Manager" → Agent calls update_part_metadata with category: 'manager'
- User: "Archive this part" → Agent calls update_part_metadata with status: 'archived'

**Agent orchestration pattern:**
```typescript
// User: "Add 'anxiety' tag to the Inner Critic"

// 1. Find the part
const { parts } = await list_parts({ query: { name_contains: 'critic' } });
const partId = parts[0].id;

// 2. Read current state
const { metadata } = await read_part({ partId });

// 3. Merge new tag
const updatedTags = [...metadata.tags, 'anxiety'];

// 4. Update metadata
await update_part_metadata({
  partId,
  updates: { tags: updatedTags }
});
```

**Note:** For tags, agent MUST read current tags first and merge, since the tool replaces the entire tags array.

### 6. update_part_content

```typescript
export const updatePartContentTool = createTool({
  id: 'update_part_content',
  description: 'Update a content section. Does NOT modify metadata (YAML).',
  inputSchema: z.object({
    partId: z.string(),
    section: z.enum(['## Role & Purpose', '## Evidence & Observations', '## Therapeutic Notes', '## Session Log']),
    operation: z.enum(['replace', 'append', 'prepend']),
    content: z.string(),
  }),
  execute: async (input, { userId }) => {
    const repo = new PartsRepository();
    await repo.updateContent(
      userId, 
      input.partId, 
      input.section, 
      input.content, 
      input.operation
    );
    
    return { success: true };
  }
});
```

### 7. search_part_sections

```typescript
export const searchPartSectionsTool = createTool({
  id: 'search_part_sections',
  description: 'Search for text patterns in part content. Use before replace operations.',
  inputSchema: z.object({
    partId: z.string(),
    query: z.string(),
    sections: z.array(z.enum(['## Role & Purpose', '## Evidence & Observations', '## Therapeutic Notes', '## Session Log'])).optional(),
  }),
  execute: async (input, { userId }) => {
    // Search and return matches with line numbers
  }
});
```

### 8. replace_in_part_section

```typescript
export const replaceInPartSectionTool = createTool({
  id: 'replace_in_part_section',
  description: 'Find and replace text in a content section.',
  inputSchema: z.object({
    partId: z.string(),
    section: z.enum(['## Role & Purpose', '## Evidence & Observations', '## Therapeutic Notes', '## Session Log']),
    search: z.string(),
    replace: z.string(),
  }),
  execute: async (input, { userId }) => {
    // Perform find/replace in section
  }
});
```

### 9. batch_update_part_content

```typescript
export const batchUpdatePartContentTool = createTool({
  id: 'batch_update_part_content',
  description: 'Apply multiple content updates atomically.',
  inputSchema: z.object({
    partId: z.string(),
    updates: z.array(z.object({
      section: z.enum(['## Role & Purpose', '## Evidence & Observations', '## Therapeutic Notes', '## Session Log']),
      operation: z.enum(['replace', 'append', 'prepend']),
      content: z.string(),
    })),
  }),
  execute: async (input, { userId }) => {
    // Apply all updates in single read-modify-write
  }
});
```

---

## Staged Commit Plan

1. `feat(parts): add spec module with parser/serializer`
2. `feat(parts): add PartsRepository for markdown CRUD`
3. `feat(agent): add content-only tools for conversational agent`
4. `refactor(garden): update UI to use PartsRepository`
5. `refactor(check-ins): load parts from PartsRepository`
6. `chore(parts): delete deprecated database code`
7. `docs(parts): update feature docs with new architecture`
8. `chore(db): migration to drop parts table`

---

## Testing Checklist

- [ ] Parser/serializer round-trips correctly
- [ ] Repository CRUD operations work with storage adapter
- [ ] Agent tools only modify content sections
- [ ] Agent tools read YAML context correctly
- [ ] Garden UI displays parts from markdown
- [ ] Check-ins load parts from markdown
- [ ] No database queries for parts
- [ ] Docs CI passes

---

## Success Criteria

- ✅ Clean separation: YAML = metadata, Markdown = content
- ✅ Conversational agent never touches YAML (except auto-updated last_active)
- ✅ All queries/filters work on YAML fields
- ✅ All narrative content in markdown sections
- ✅ No overlap or drift between YAML and markdown
- ✅ Foundation ready for metadata agent (next task)
