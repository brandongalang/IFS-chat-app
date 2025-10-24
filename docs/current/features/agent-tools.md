---
title: Feature: Agent Tools
owner: @brandongalang
status: shipped
last_updated: 2025-10-23
feature_flag: null
code_paths:
  - mastra/tools/assessment-tools.ts
  - mastra/tools/evidence-tools.ts
  - mastra/tools/inbox-observation-tools.ts
  - mastra/tools/memory-tools.ts
  - mastra/tools/part-tools.mastra.ts
  - mastra/tools/part-tools.ts
  - mastra/tools/proposal-tools.ts
  - mastra/tools/rollback-tools.ts
  - mastra/tools/update-sync-tools.ts
  - mastra/tools/therapy-tools.ts
  - mastra/agents/*.ts
  - mastra/agents/ifs_agent_prompt.ts
  - mastra/agents/inbox-observation.ts
  - lib/data/schema/parts-agent.ts
  - lib/data/schema/therapy-tools.schema.ts
  - lib/data/therapy-tools.ts
  - lib/memory/markdown/logging.ts
  - lib/memory/markdown/frontmatter.ts
  - lib/insights/generator.ts
  - lib/memory/overview.ts
  - lib/inbox/search/checkins.ts
  - app/api/chat/logic.ts
  - components/ethereal/EtherealChat.tsx
  - config/env.ts
  - config/model.ts
related_prs:
  - #35
  - #285
  - #293
  - #304
  - #305
  - '#310'
  - '#311'
  - #330
  - '#338'
  - '#339'
  - '#340'
  - '#357'
---

## What
The tools and agent definitions powering the IFS companion’s capabilities.

## Why
Encapsulates privileged operations (e.g., db mutations) behind auditable tools, enabling safe agent workflows.

## How it works
- **Therapy tools integration (PR #330)**: New therapy-focused tools have been added to support therapy-related data management and session context insights. The `mastra/tools/therapy-tools.ts` provides tools for creating, querying, and updating therapy-related items with robust input validation. Session context insights include time since last contact, recent topics, open threads, active parts, suggested focus areas, and reminders. These tools are integrated into the IFS agent for seamless in-app access during therapy sessions.
- **Inbox observation tooling refactor (PR #357)**: Inbox observation agent now uses Supabase-backed tools instead of markdown files. The `mastra/tools/inbox-observation-tools.ts` exposes `searchParts`, `getPartById`, `getPartDetail` for accessing part data; `queryTherapyData`, `writeTherapyData`, `updateTherapyData` for therapy-related observations; and `listCheckIns`, `searchCheckIns`, `getCheckInDetail` for check-in data. This enables observations to be generated from structured database records rather than markdown files, providing more reliable and auditable insights.
- **Markdown tools removal (2025-10-17)**: Legacy markdown tools (`mastra/tools/markdown-tools.ts` and `mastra/tools/memory-markdown-tools.ts`) have been deprecated and removed. The IFS chat agent now operates exclusively with PRD-backed tools (therapy tools, memory tools, update sync tools). All agent context flows through the PRD schema (`observations`, `timeline_events`).
- **Logging instrumentation**: The active agent path uses PRD tables (`observations`, `timeline_events`) for all change tracking and context hydration. Background digests are recorded via Supabase; markdown snapshots remain read-only for legacy queries but are no longer written by agents.
- **System 1 cleanup (2025-01-14)**: Removed orphaned `mastra/tools/part-content-tools.ts` which was never registered with any agent. All part operations now use System 2 (`lib/memory/`) with frontmatter support.
- **PRD parts adapter (2025-10-14)**: Mastra part-facing tools now call `lib/data/schema/parts-agent.ts`, which maps legacy tool payloads onto the PRD `parts_v2` / `part_relationships_v2` tables while preserving action logging and markdown-driven context. Evidence tools reuse the same adapter, keeping user IDs server-derived and compatible with the existing audit trail.
- **YAML frontmatter support (PR #311)**: Part profiles now include YAML frontmatter with structured metadata (id, name, emoji, category, status, tags, timestamps). Tools accept optional `emoji` parameter that gets stored in frontmatter and synced to database visualization field. The system is backward compatible with parts lacking frontmatter. See `lib/memory/markdown/frontmatter.ts` for parsing/serialization and `lib/memory/parts-repository.ts` for repository-style APIs.
- **Update sync workflow**: The agent prompt emphasizes read-only markdown context. `listUnprocessedUpdates` still surfaces pending items, but digests are persisted automatically through PRD observations (see `lib/memory/update-runner.ts`). Agents acknowledge updates with the user and then call `markUpdatesProcessed` without editing markdown files.
- Stub creation tooling remains in `mastra/tools/stub-tools.ts` for dev scaffolding but is no longer wired into the production chat agent, preventing dummy part responses at runtime.
- Update sync tooling (`mastra/tools/update-sync-tools.ts`) is registered with the IFS chat agent, exposing `listUnprocessedUpdates` to fetch pending sessions/insights/check-ins and `markUpdatesProcessed` to mark them as processed after memory updates are written, enabling agent-driven sync workflows.
- Tool factories defer user resolution until execution. `createObservationResearchTools` accepts an optional profile user ID and falls back to the runtime context; this keeps build-time agent instantiation (e.g., cron routes) safe in multi-tenant environments.
- Memory sync tooling (`mastra/tools/update-sync-tools.ts`) now returns a `success` flag with friendly error strings when Supabase queries fail or no user is resolved; structured logging in `lib/memory/service.ts` captures Supabase codes/messages for monitoring.
- Trace enrichment in `lib/inbox/observation-engine.ts` pulls snippets for referenced markdown, sessions, and check-ins so persisted observations include verifiable evidence metadata.
- Observation search helpers emit telemetry via `inbox_observation_telemetry`, capturing tool name, duration, and metadata for monitoring cron health.
- Tool handlers co-locate Zod input/output schemas; malformed payloads short-circuit before hitting providers/Supabase
- Session analysis utilities read recent sessions via StorageAdapter snapshots to keep lookback/limit semantics consistent across environments
- Agent prompt and configuration live under mastra/agents/
- **Inbox context integration (PR #310)**: The IFS agent prompt generator (`mastra/agents/ifs_agent_prompt.ts`) now accepts optional `systemContext` parameter that prepends custom instructions to the agent prompt, enabling context-aware responses when users navigate from inbox observations to chat
- The inbox observation agent (`mastra/agents/inbox-observation.ts`) wires those search tools and enforces queue-safe prompts for the daily cron job.
- Insights generator scaffolding exists in lib/insights/generator.ts

## Data model
- agent_actions (audit log), part_assessments, parts/relationships

## Configuration
- Provider configuration centralized in `config/model.ts` and `mastra/index.ts`
- Agents default to the hard-coded `OPENROUTER_API_BASE_URL` (`https://openrouter.ai/api/v1`); only `IFS_MODEL` and `IFS_TEMPERATURE` remain configurable via env vars
- Default `IFS_MODEL` resolves to `google/gemini-2.5-flash-preview-09-2025` unless overridden; `config/env.ts` and `config/model.ts` maintain the fallback mapping.
- Agents share the single `openrouter` provider created during Mastra bootstrap
- All agents now use PRD-backed tools exclusively; `IFS_ENABLE_MARKDOWN_CONTEXT` now defaults to `false`. Set to `true` to opt-in to optional markdown snapshot enrichment for parts queries (e.g., `getPartById` hydration)

## Testing
- Unit tests for tool logic; integration tests via smoke scripts (scripts/smoke-*)

## Operational notes
- Ensure rollback tooling remains functional; log all mutations
- **UI Tool Display**: The `EtherealChat` component now uses `friendlyToolLabel` as a fallback when `toolName` is not provided, ensuring all active tools display user-friendly titles (e.g., "Searching notes…" instead of raw tool IDs)
- Markdown write logging is non-fatal by design; if Supabase is unreachable, writes still succeed and warnings are logged for monitoring
