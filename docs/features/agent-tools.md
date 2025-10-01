---
title: Feature: Agent Tools
owner: @brandongalang
status: shipped
last_updated: 2025-09-26
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
- Inbox observation tooling now lives in `mastra/tools/inbox-observation-tools.ts`; it exposes search primitives (`searchMarkdown`, `searchSessions`, `searchCheckIns`) that the observation agent invokes during daily queue generation.
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
