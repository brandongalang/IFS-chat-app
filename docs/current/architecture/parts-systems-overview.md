# Parts Systems Architecture Overview

**Last Updated**: 2025-10-17  
**Status**: Current production architecture

## Summary

The parts platform now centers on the PRD schema (`parts_v2`, `part_relationships_v2`, `sessions_v2`, `observations`, `timeline_events`). Markdown snapshots remain available for read-only context during the transition but are no longer treated as a write path. All user-facing reads and writes flow through the PRD interfaces exposed in `lib/data/schema/` and Mastra tool factories.

## Active Components

### 1. PRD Schema (Canonical Source of Truth)
**Location**: `supabase/migrations/111_prd_core_tables.sql`, `lib/data/schema/**`, `mastra/tools/part-tools.mastra`  
**Purpose**: Authoritative storage for parts, relationships, sessions, observations, and timeline events  
**Used By**: IFS agent tools, Garden UI, proposals, therapy workflows

**Key Files**:
- `lib/data/schema/parts-agent.ts` – Server-safe adapters that shape PRD rows into legacy `PartRow` responses (search, read, create, update).
- `lib/data/schema/parts.ts` – Low-level CRUD helpers for `parts_v2`.
- `lib/data/schema/relationships.ts` – CRUD helpers for `part_relationships_v2`.
- `lib/data/parts-lite.ts` – Browser-safe queries that now read directly from `parts_v2`.
- `lib/data/parts-server.ts` – Server-only API that wraps `parts-agent` for server actions.
- `mastra/tools/part-tools.mastra` – Mastra tool factory backed by the PRD schema helpers.

**Storage**:
- `parts_v2` – canonical part records (name, status, charge, metadata JSON).
- `part_relationships_v2` – normalized relationships between parts.
- `sessions_v2`, `observations`, `timeline_events` – structured therapy context.

**Characteristics**:
- ✅ Fully typed and validated via Zod schemas.
- ✅ RLS-protected per user.
- ✅ Indexed for search and dashboard queries.
- ✅ All writes and audits funnel through PRD (action logger + Supabase telemetry).

### 2. Snapshot Context (Read-Only Markdown)
**Location**: `lib/memory/`  
**Purpose**: Hydrate rich context (overview/part markdown) for prompts and legacy session logs  
**Used By**: IFS chat agent when `IFS_ENABLE_MARKDOWN_CONTEXT` is enabled

**Key Files**:
- `lib/memory/read.ts` – Reads overview, part, and relationship markdown sections.
- `mastra/tools/memory-markdown-tools.ts` – Exposes the read-only `readOverviewSnapshot` tool.
- `mastra/tools/markdown-tools.ts` – Lists/searches/reads markdown files through the observation research adapter.

**Storage**:
- Supabase Storage bucket `memory-snapshots` (production).
- Local filesystem `.data/memory-snapshots/` (development/testing).

**Characteristics**:
- ✅ Structured via YAML frontmatter and anchor sections.
- ✅ Read-only in production flows as of 2025-10-17.
- ✅ Serves as supplemental context while PRD telemetry achieves parity with historical markdown logs.

## Data Flow (Current)

```
┌──────────────────────────────────────────────────────────┐
│ 1. Agent / UI issues tool call                          │
│    - Mastra part tools → lib/data/schema/parts-agent.ts │
│    - Server actions → lib/data/parts-server.ts          │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. PRD schema mutation / query                          │
│    - Tables: parts_v2, part_relationships_v2, sessions_v2│
│    - Observability: action logger, Supabase telemetry    │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. UI + workflows consume PRD rows                      │
│    - Garden Grid / Graph via lib/data/parts-lite.ts     │
│    - Therapy tools via mastra/tools/therapy-tools.ts    │
│    - Proposals/evidence via lib/data/schema adapters    │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Optional snapshot hydration                          │
│    - readOverviewSnapshot (prompt context)              │
│    - readPartProfileSections / readRelationship...      │
│    - No write-back to markdown in production            │
└──────────────────────────────────────────────────────────┘
```

## Observations & Timeline Logging

- Background summary jobs (`lib/memory/update-runner.ts`) now persist digests to `observations` with type `note`, producing durable telemetry without mutating markdown.
- Timeline milestones should be emitted via `timeline_events` as PRD tooling rolls out (see `lib/data/schema/timeline.ts`).
- Markdown change-log anchors remain for historical review but are no longer updated by agents.

## Client Access Patterns

| Use Case                      | Entry Point                           | Notes |
|-------------------------------|---------------------------------------|-------|
| Garden list/search            | `lib/data/parts-lite.ts`              | Uses `parts_v2` directly with user-scoped filters. |
| Garden detail / server actions| `lib/data/parts-server.ts`            | Wraps PRD mappers and action logging. |
| Agent part management         | `mastra/tools/part-tools.mastra`      | Calls `parts-agent` helpers; writes PRD rows. |
| Relationship management       | `mastra/tools/part-tools.mastra`      | Uses `lib/data/schema/relationships.ts`. |
| Prompt context hydration      | `mastra/tools/memory-markdown-tools.ts` (read-only) | Pulls overview sections; no writes. |

## Decommissioned / Legacy Paths

- `lib/data/parts.ts` and `lib/data/parts-query.ts` have been removed (replaced by PRD schema helpers).
- Markdown write tooling (`mastra/tools/markdown-write-tools.ts`) has been retired. Any future write needs should target PRD tables or explicit Supabase APIs.
- The markdown sync pipeline (`lib/memory/parts-sync.ts`) is slated for archival once PRD telemetry fully replaces markdown usage.

## Upgrade / Rollback Notes

- **Feature flag**: `IFS_ENABLE_MARKDOWN_CONTEXT` controls whether prompts include snapshot context. Disable if markdown storage causes issues; agents continue to operate against PRD.
- **Rollback**: To revert to the legacy schema, re-enable markdown write tooling and point `lib/data/parts-lite.ts` at `parts`/`part_relationships`. This requires redeploying the prior branch and re-running the markdown sync.
- **Forward plan**: Migrate remaining consumers of markdown snapshots to PRD observables, then archive the storage bucket.
