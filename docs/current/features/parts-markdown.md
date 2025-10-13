---
title: Feature: Parts Markdown Content Layer with YAML Frontmatter
owner: @brandongalang
status: shipped
last_updated: 2025-01-14
feature_flag: null
code_paths:
  - lib/memory/markdown/frontmatter.ts
  - lib/memory/markdown/README.md
  - lib/memory/snapshots/grammar.ts
  - lib/memory/snapshots/updater.ts
  - lib/memory/read.ts
  - lib/memory/parts-repository.ts
  - lib/memory/parts-sync.ts
  - scripts/test-frontmatter-system.ts
  - app/garden/[partId]/page.tsx
related_prs:
  - #TBD
---

What
- Enhanced the existing memory system (System 2) with YAML frontmatter support
- Part profiles now have structured metadata at the top of the file (YAML) plus narrative content in sections below
- Backward compatible: parts without frontmatter continue to work
- Database sync automatically extracts emoji and other metadata from frontmatter

Why
- Combines the best of both worlds:
  - YAML frontmatter for structured, typed metadata (id, name, emoji, category, status, tags, timestamps)
  - Section anchors for precise content editing (Role, Evidence, Notes, Change Log)
- Enables better tooling, validation, and querying of part data
- Prepares for future metadata agents while keeping conversational agent focused on content

How it works
- Frontmatter Module (lib/memory/markdown/frontmatter.ts)
  - Zod schema validates YAML frontmatter: id, name, emoji?, category, status, tags[], related_parts[], timestamps, activity_metrics?
  - `parsePartMarkdown()`: extracts frontmatter + content using gray-matter library
  - `buildPartMarkdownWithFrontmatter()`: combines frontmatter + content into a complete document
  - `updatePartFrontmatter()`: updates metadata while preserving content
  - Backward compatible: returns null frontmatter if not present
  
- Part Profile Creation (lib/memory/snapshots/grammar.ts)
  - `buildPartProfileMarkdown()` now generates YAML frontmatter at the top
  - Followed by section-based content with anchors (e.g., `[//]: # (anchor: identity v1)`)
  - Format combines structured metadata + narrative content
  
- Reading Parts (lib/memory/read.ts)
  - `readPartProfile()`: returns both frontmatter and sections
  - `readPartProfileSections()` (legacy): returns sections only
  - Parses frontmatter using gray-matter, builds section map from content
  
- Repository API (lib/memory/parts-repository.ts)
  - `listParts(userId, filters)`: query parts by category, status, tag, name
  - `readPart(userId, partId)`: get complete part with frontmatter + sections
  - `updatePartFrontmatter()`: update metadata
  - `updatePartSection()`: edit specific content sections
  - Uses StorageAdapter (works with Supabase Storage or local filesystem)
  
- Database Sync (lib/memory/parts-sync.ts)
  - `syncPartToDatabase()` prefers frontmatter data when available
  - Falls back to parsing sections for legacy parts
  - Syncs emoji from frontmatter to database visualization field
  - Triggered automatically on part creation/update

## Example Part Profile Format

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440000
name: Inner Critic
emoji: 🎭
category: manager
status: active
tags: [perfectionism, protection]
related_parts: []
created_at: 2024-01-01T00:00:00Z
updated_at: 2024-01-01T00:00:00Z
last_active: 2024-01-14T00:00:00Z
---

# Part: Inner Critic

## Identity
[//]: # (anchor: identity v1)

- Part ID: 550e8400-e29b-41d4-a716-446655440000
- User ID: user-uuid-here
- Status: active
- Category: manager

## Role
[//]: # (anchor: role v1)

- Protects against failure by setting high standards

## Evidence (curated)
[//]: # (anchor: evidence v1)

- Harsh self-criticism during work tasks
- Perfectionist tendencies in creative projects

## Change Log
[//]: # (anchor: change_log v1)

- 2024-01-01T00:00:00Z: initialized profile
- 2024-01-14T00:00:00Z: updated role description
```

## Out of Scope (Future Work)
- Automated tag inference, relationship detection, activity metrics computation
- Metadata agent for managing frontmatter
- Removing database-backed parts entirely (hybrid model is intentional)

## Data Model
- YAML frontmatter mirrors database enums for status and category
- User ID is stored in file path (`memory/users/{userId}/parts/{partId}/profile.md`), not in frontmatter
- Emoji syncs from frontmatter → database visualization field

## Operational Notes
- Files stored in Supabase Storage bucket `memory-snapshots` (production) or `.data/memory-snapshots/` (dev)
- Backward compatible: parts without frontmatter parse metadata from sections
- Test script: `scripts/test-frontmatter-system.ts`
- Storage mode controlled by `MEMORY_STORAGE_ADAPTER` env var (default: local)
