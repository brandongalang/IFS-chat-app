---
title: Feature: Parts Garden
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
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
- Grid overview at app/garden/page.tsx (client) uses `@/lib/data/parts-lite`
- Detail at app/garden/[partId]/page.tsx (server) uses `@/lib/data/parts-server`
- PartActions server actions import from `@/lib/data/parts-server`
- Mastra tools provide part querying and updates

## Data model
- parts, part_relationships (read/derived views)

## Configuration
- ENABLE_GARDEN feature flag (default off in prod; document your env)

## Testing
- Unit tests for helper logic; Playwright for navigation (overview → detail)

## Operational notes
- Confirm flag defaults and access control for non-authenticated users
