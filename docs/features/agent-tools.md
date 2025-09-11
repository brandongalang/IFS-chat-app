---
title: Feature: Agent Tools
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
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
- Session analysis utilities read recent sessions via StorageAdapter snapshots to keep lookback/limit semantics consistent across environments
- Agent prompt and configuration live under mastra/agents/
- Insights generator scaffolding exists in lib/insights/generator.ts

## Data model
- agent_actions (audit log), part_assessments, parts/relationships

## Configuration
- Provider/model configuration via env vars (names only)

## Testing
- Unit tests for tool logic; integration tests via smoke scripts (scripts/smoke-*)

## Operational notes
- Ensure rollback tooling remains functional; log all mutations
