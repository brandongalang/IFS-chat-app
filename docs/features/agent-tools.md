---
title: Feature: Agent Tools
owner: @brandongalang
status: shipped
last_updated: 2025-10-10
feature_flag: null
code_paths:
  - mastra/tools/*.ts
  - mastra/tools/memory-markdown-tools.ts
  - mastra/agents/*.ts
  - lib/insights/generator.ts
  - lib/memory/overview.ts
  - app/api/chat/logic.ts
related_prs:
  - #35
  - #285
---

## What
The tools and agent definitions powering the IFS companion’s capabilities.

## Why
Encapsulates privileged operations (e.g., db mutations) behind auditable tools, enabling safe agent workflows.

## How it works
- Mastra tools implement capabilities (parts, relationships, evidence, assessments, proposals, rollback)
- Inbox observation tooling now lives in `mastra/tools/inbox-observation-tools.ts`; it now exposes list/search/read helpers for markdown, sessions, and check-ins (including `listMarkdown`, `readMarkdown`, `listSessions`, `getSessionDetail`, `listCheckIns`, `getCheckInDetail`) so agents can enumerate context before fetching details.
- The primary IFS chat agent now hydrates markdown context when `IFS_ENABLE_MARKDOWN_CONTEXT` is enabled. During agent bootstrap we resolve an overview snapshot via `lib/memory/overview.ts`, append selected anchors (`identity v1`, `current_focus v1`, `change_log v1`) to the system prompt, and expose read-only `listMarkdown`, `searchMarkdown`, and `readMarkdown` tools via `mastra/tools/markdown-tools.ts`.
- Chat now also exposes scoped write helpers (`previewMarkdownSectionPatch`, `writeMarkdownSection`, `createMarkdownFile`) from `mastra/tools/markdown-write-tools.ts`, enabling the agent to diff or persist updates while respecting per-user storage namespaces and section anchors.
- Memory markdown tooling (`mastra/tools/memory-markdown-tools.ts`) exposes shared helpers for reading overview sections, appending changelog entries, and updating part notes. Both the chat agent and the background summarizer load the same factory so they operate on identical capabilities.
- Unprocessed update sync tooling remains available for background agents but is no longer wired into the chat agent toolset.
- Tool factories defer user resolution until execution. `createObservationResearchTools` accepts an optional profile user ID and falls back to the runtime context; this keeps build-time agent instantiation (e.g., cron routes) safe in multi-tenant environments.
- Memory sync tooling (`mastra/tools/update-sync-tools.ts`) now returns a `success` flag with friendly error strings when Supabase queries fail or no user is resolved; structured logging in `lib/memory/service.ts` captures Supabase codes/messages for monitoring.
- Trace enrichment in `lib/inbox/observation-engine.ts` pulls snippets for referenced markdown, sessions, and check-ins so persisted observations include verifiable evidence metadata.
- Observation search helpers emit telemetry via `inbox_observation_telemetry`, capturing tool name, duration, and metadata for monitoring cron health.
- Tool handlers co-locate Zod input/output schemas; malformed payloads short-circuit before hitting providers/Supabase
- Session analysis utilities read recent sessions via StorageAdapter snapshots to keep lookback/limit semantics consistent across environments
- Agent prompt and configuration live under mastra/agents/
- The inbox observation agent (`mastra/agents/inbox-observation.ts`) wires those search tools and enforces queue-safe prompts for the daily cron job.
- Insights generator scaffolding exists in lib/insights/generator.ts

## Data model
- agent_actions (audit log), part_assessments, parts/relationships

## Configuration
- Provider configuration centralized in `config/model.ts` and `mastra/index.ts`
- Agents default to the hard-coded `OPENROUTER_API_BASE_URL` (`https://openrouter.ai/api/v1`); only `IFS_MODEL` and `IFS_TEMPERATURE` remain configurable via env vars
- Agents share the single `openrouter` provider created during Mastra bootstrap
- `IFS_ENABLE_MARKDOWN_CONTEXT` (default `true`) gates overview hydration and markdown tooling for the chat agent; disable when diagnosing storage issues or runaway token budgets.

## Testing
- Unit tests for tool logic; integration tests via smoke scripts (scripts/smoke-*)

## Operational notes
- Ensure rollback tooling remains functional; log all mutations
