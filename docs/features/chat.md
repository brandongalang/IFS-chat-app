---
title: Feature: Chat
owner: @brandongalang
status: shipped
last_updated: 2025-10-11
feature_flag: null
code_paths:
  - app/chat/page.tsx
  - app/api/chat/route.ts
  - app/_shared/hooks/useChat.ts
  - components/ethereal/EtherealChat.tsx
  - components/ethereal/EtherealMessageList.tsx
  - components/tasks/TaskList.tsx
related_prs:
  - #34
---

## What
The conversational interface for interacting with the IFS companion.

## Why
Enables guided self-reflection, parts work, and agent-assisted workflows.

## How it works
- UI at app/chat/page.tsx with streaming responses
- `useChat` consumes AI SDK UI message parts (text/tool/data) and streams via `DefaultChatTransport`, yielding a single assistant response per turn while preserving token-by-token rendering; tool/dynamic parts now map into Task events keyed by tool call, with simplified status copy (`Looking through my notes…`, `Writing notes…`) and previews sourced from tool input/output.
- End-session requests only lock the composer once the closing prompt is dispatched, and the composer unlocks again immediately after cleanup so auth/session bootstrap failures do not leave the UI disabled.
- Client data access uses `@/lib/data/parts-lite` (browser-safe)
- Server routes/actions use `@/lib/data/parts-server` for writes, logging, and snapshots
- Agent actions are logged via lib/database/action-logger.ts (server-only); task updates arrive via `data-taskUpdate` parts and tool event streams.
- The active task overlay now anchors above the streaming assistant message, hiding raw tool cards when task metadata is present so Tasks become the primary representation.

## Data model
- sessions, messages, agent_actions tables

## Configuration
- Env vars for model/provider configuration (names only in code); see project env

## Testing
- Unit tests around parsing/format functions where present
- Add Playwright coverage for core chat flows (send message, receive response)

## Operational notes
- Ensure action logging remains enabled for auditability
