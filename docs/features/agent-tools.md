---
title: Feature: Agent Tools
owner: @brandongalang
status: shipped
last_updated: 2025-10-02
feature_flag: null
code_paths:
  - mastra/tools/*.ts
  - mastra/agents/*.ts
  - lib/insights/generator.ts
related_prs:
  - #35
---

## What
The tools and agent definitions powering the IFS companion’s capabilities.

## Why
Encapsulates privileged operations (e.g., db mutations) behind auditable tools, enabling safe agent workflows.

## How it works
- Mastra tools implement capabilities (parts, relationships, evidence, assessments, proposals, rollback)
- Inbox observation tooling now lives in `mastra/tools/inbox-observation-tools.ts`; it now exposes list/search/read helpers for markdown, sessions, and check-ins (including `listMarkdown`, `readMarkdown`, `listSessions`, `getSessionDetail`, `listCheckIns`, `getCheckInDetail`) so agents can enumerate context before fetching details.
- Tool factories defer user resolution until execution. `createObservationResearchTools` accepts an optional profile user ID and falls back to the runtime context; this keeps build-time agent instantiation (e.g., cron routes) safe in multi-tenant environments.
- Trace enrichment in `lib/inbox/observation-engine.ts` pulls snippets for referenced markdown, sessions, and check-ins so persisted observations include verifiable evidence metadata.
- Tool handlers co-locate Zod input/output schemas; malformed payloads short-circuit before hitting providers/Supabase
- Session analysis utilities read recent sessions via StorageAdapter snapshots to keep lookback/limit semantics consistent across environments
- Agent prompt and configuration live under mastra/agents/
- The inbox observation agent (`mastra/agents/inbox-observation.ts`) wires those search tools and enforces queue-safe prompts for the daily cron job.
- Insights generator scaffolding exists in lib/insights/generator.ts

## Data model
- agent_actions (audit log), part_assessments, parts/relationships

## Configuration
- Provider configuration centralized in `config/model.ts` and `mastra/index.ts`
- Override defaults with `IFS_MODEL`, `IFS_TEMPERATURE`, and `IFS_PROVIDER_BASE_URL` env vars (fallback to `OPENROUTER_BASE_URL`)
- Agents share the single `openrouter` provider created during Mastra bootstrap

## Testing
- Unit tests for tool logic; integration tests via smoke scripts (scripts/smoke-*)

## Operational notes
- Ensure rollback tooling remains functional; log all mutations
