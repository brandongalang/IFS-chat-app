# Parts Systems Architecture Overview

**Last Updated**: 2025-10-19  
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
- `lib/data/parts-lite.ts` – Browser-safe queries that read from `parts_display` and `timeline_display` views.
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

### 2. Snapshot Context (Legacy Markdown)
**Location**: `lib/memory/`  
**Purpose**: Historical context for legacy session logs and read-only snapshot queries  
**Used By**: Legacy utilities and historical data review only; not used by the IFS chat agent

**Key Files**:
- `lib/memory/read.ts` – Reads overview, part, and relationship markdown sections.

**Storage**:
- Supabase Storage bucket `memory-snapshots` (production).
- Local filesystem `.data/memory-snapshots/` (development/testing).

**Characteristics**:
- ✅ Structured via YAML frontmatter and anchor sections.
- ✅ Deprecated as of 2025-10-18: markdown tools removed from agent wiring.
- ✅ Archived for historical review; no new writes by agents.
- ℹ️ Markdown context tools (`mastra/tools/markdown-tools.ts`, `mastra/tools/memory-markdown-tools.ts`) have been removed; all agent flows now use PRD tables exclusively.

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
| Garden list/search            | `lib/data/parts-lite.ts`              | Uses `parts_display` view with user-scoped filters. |
| Garden detail / server actions| `lib/data/parts-server.ts`            | Wraps PRD mappers and action logging. |
| Agent part management         | `mastra/tools/part-tools.mastra`      | Calls `parts-agent` helpers; writes PRD rows. |
| Relationship management       | `mastra/tools/part-tools.mastra`      | Uses `lib/data/schema/relationships.ts`. |
| Therapy context & observations| `mastra/tools/therapy-tools.ts`       | PRD-backed tool factory for session analysis and data mutations. |

## Decommissioned / Legacy Paths

- `lib/data/parts.ts` and `lib/data/parts-query.ts` have been removed (replaced by PRD schema helpers).
- Markdown write tooling (`mastra/tools/markdown-write-tools.ts`) has been retired. Any future write needs should target PRD tables or explicit Supabase APIs.
- **Markdown tool modules (2025-10-18)**: `mastra/tools/markdown-tools.ts` and `mastra/tools/memory-markdown-tools.ts` have been removed from the agent wiring. All agent context flows now use PRD tables exclusively. Legacy snapshots remain archived for historical review.
- The markdown sync pipeline (`lib/memory/parts-sync.ts`) is slated for archival once PRD telemetry fully replaces markdown usage.

## Upgrade / Rollback Notes

- **Feature flag**: `IFS_ENABLE_MARKDOWN_CONTEXT` now defaults to `false` as of 2025-10-18. Agents operate exclusively against the PRD schema by default. To opt-in to optional markdown snapshot enrichment for parts queries, set `IFS_ENABLE_MARKDOWN_CONTEXT=true`.
- **Rollback**: To revert to the legacy schema and markdown tooling, set `IFS_ENABLE_MARKDOWN_CONTEXT=true`, re-apply markdown tool factories to the agent, and restore the prior git commits. This is not recommended in production; open a support ticket if needed.
- **Forward plan**: Archive the `memory-snapshots` storage bucket once all stakeholders confirm no dependency on historical markdown snapshots.
