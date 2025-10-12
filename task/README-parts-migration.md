# Parts Markdown Migration - Plan Summary

## Overview

Two separate but related tasks:

1. **THIS TASK**: `parts-markdown-migration-updated.md`
   - Migrate parts to markdown with clean YAML/markdown separation
   - Build conversational agent tools (read YAML, write markdown)
   - Foundation for metadata management

2. **FUTURE TASK**: `parts-yaml-metadata-agent.md`
   - LLM-powered metadata inference and management
   - Event hooks for activity tracking
   - Relationship detection and tag suggestions

## Clean Separation Principle

```
YAML Frontmatter          |  Markdown Body
(metadata-agent managed)  |  (conversational-agent written)
--------------------------|----------------------------------
✅ id, name, emoji         |  ✅ Role & Purpose (narrative)
✅ category, status, tags  |  ✅ Evidence & Observations
✅ timestamps              |  ✅ Therapeutic Notes
✅ activity_metrics        |  ✅ Session Log
✅ related_parts (IDs)     |  
```

**No overlap** - each field has exactly one owner.

## Conversational Agent Tools (10 Tools)

The conversational agent gets minimal CRUD tools that:
- **Discover** what metadata exists (tags, categories, counts)
- **Read** YAML for context (name, category, tags, relationships)
- **Write** markdown sections AND simple metadata updates

1. `get_parts_metadata_summary` - Overview of all metadata (discover query options)
2. `list_parts` - Discover by YAML metadata
3. `query_parts` - Advanced filtering
4. `read_part` - Get YAML context + markdown content
5. `create_part` - Minimal YAML + optional initial content
6. `update_part_metadata` - Update YAML fields (direct user requests)
7. `update_part_content` - Modify sections (append/replace/prepend)
8. `search_part_sections` - Find text in markdown
9. `replace_in_part_section` - Edit markdown text
10. `batch_update_part_content` - Multiple updates atomically

## Key Components

### 1. Spec Module (`lib/parts/spec.ts`)
- Single source of truth for schema
- Zod validation for YAML frontmatter (strict, no userId)
- Parser: text → { frontmatter, sections }
- Serializer: { frontmatter, sections } → canonical text
- Guarantees format consistency

### 2. Parts Repository (`lib/parts/repository.ts`)
- CRUD operations: list, get, create, updateContent
- Always uses spec's parser/serializer
- Filters/queries work on YAML fields
- Content updates only modify markdown sections

### 3. Agent Tools (`mastra/tools/part-content-tools.ts`)
- Thin wrappers around repository
- Validate inputs with Zod
- Inject userId at tool layer (not in payload)
- Return structured responses

## Implementation Phases

1. **Phase 1**: Core infrastructure (spec + repository)
2. **Phase 2**: Agent tools (markdown-only)
3. **Phase 3**: Metadata agent (separate task, see parts-yaml-metadata-agent.md)
4. **Phase 4**: Migration & cleanup (UI, check-ins, delete old code)

## Staged Commits

1. `feat(parts): add spec module with parser/serializer`
2. `feat(parts): add PartsRepository for markdown CRUD`
3. `feat(agent): add content-only tools for conversational agent`
4. `refactor(garden): update UI to use PartsRepository`
5. `refactor(check-ins): load parts from PartsRepository`
6. `chore(parts): delete deprecated database code`
7. `docs(parts): update feature docs with new architecture`
8. `chore(db): migration to drop parts table`

## Success Criteria

- ✅ Clean separation: YAML = metadata, Markdown = content
- ✅ Conversational agent never touches YAML (except last_active)
- ✅ All queries work on YAML fields
- ✅ All narrative content in markdown sections
- ✅ No overlap or drift
- ✅ Foundation ready for metadata agent

## What's Out of Scope (For Now)

These belong in the metadata agent task:
- ❌ LLM-powered tag inference
- ❌ Relationship detection from conversations
- ❌ Activity metric computation
- ❌ Category classification suggestions

The current task just sets up the structure; metadata management comes later.

## Questions Resolved

**Q: Should YAML and markdown overlap?**
A: No. YAML = structured metadata, Markdown = narrative content. Zero overlap.

**Q: Who updates YAML?**
A: Both! Conversational agent can do simple, direct updates ("tag this part"). Metadata agent/hooks handle complex inference (auto-tagging, relationship detection).

**Q: Who updates markdown?**
A: Conversational agent only. Via content-specific tools.

**Q: What about last_active timestamp?**
A: Auto-updated on any change (content or metadata).

**Q: Can the agent use frontmatter for anything?**
A: Yes! Agent reads YAML for discovery/filtering/context AND can update it for direct user requests. Complex inference handled by metadata agent (future).

**Q: Why give the conversational agent a metadata update tool?**
A: Let the agent orchestrate simple cases ("tag this", "archive that"). If agent can't orchestrate well, a dedicated metadata agent can use the same tool later.
