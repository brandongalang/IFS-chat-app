---
title: Feature: Parts Garden
owner: @brandongalang
status: shipped
last_updated: 2025-09-02
feature_flag: ENABLE_GARDEN
code_paths:
  - app/garden/page.tsx
  - app/garden/[partId]/page.tsx
  - components/garden/PartActions.tsx
  - mastra/tools/part-tools.ts
related_prs:
  - #41
---

## What
Visual exploration interface for browsing and drilling into Parts.

## Why
Offers a spatial/visual way to understand internal parts and relationships.

## How it works
- Grid overview at app/garden/page.tsx (client) uses `@/lib/data/parts-client`
- Detail at app/garden/[partId]/page.tsx (server) uses `@/lib/data/parts.server`
- PartActions server actions import from `@/lib/data/parts.server`
- Mastra tools provide part querying and updates

## Data model
- parts, part_relationships (read/derived views)

## Configuration
- Enabled by default via `config/features.ts`. Environments that need to hide the Garden must set `ENABLE_GARDEN` to a falsey value (`false`, `0`, or `off`). The feature flag is read during build, with optional support for mirroring via `NEXT_PUBLIC_ENABLE_GARDEN` when client overrides are required.

## Testing
- Unit tests for helper logic; Playwright for navigation (overview → detail)

## Operational notes
- Confirm flag defaults and access control for non-authenticated users
