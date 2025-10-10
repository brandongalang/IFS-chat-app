---
title: Feature: Chat
owner: @brandongalang
status: shipped
last_updated: 2025-01-11
feature_flag: null
code_paths:
  - app/chat/page.tsx
  - app/api/chat/route.ts
  - app/_shared/hooks/useChat.ts
  - components/ethereal/EtherealChat.tsx
  - components/ethereal/EtherealMessageList.tsx
  - components/tasks/TaskList.tsx
  - components/ai-elements/tool.tsx
related_prs:
  - #34
  - #292
---

## What
The conversational interface for interacting with the IFS companion.

## Why
Enables guided self-reflection, parts work, and agent-assisted workflows.

## How it works
- UI at app/chat/page.tsx with streaming responses
- `useChat` consumes AI SDK UI message parts (text/tool/data) and streams via `DefaultChatTransport`, yielding a single assistant response per turn while preserving token-by-token rendering; tool/dynamic parts now map into Task events keyed by tool call, with simplified status copy (`Looking through my notes…`, `Writing notes…`) and previews sourced from tool input/output.
- End-session requests now run through a lightweight state machine (`'idle'` → `'closing'` → `'cleanup'` → `'ended'` → `'idle'`) so the composer locks while the closing prompt streams, then automatically resets after 1.5s to allow starting a new session without page refresh, preventing stuck input when streaming completes or fails.
  - **Session restart fix (PR #292)**: Separated 'ended' → 'idle' transition into dedicated effect to prevent timer cancellation, ensuring composer reliably re-enables after cleanup
  - Session status message ("ending session…") includes `role="status"` and `aria-live="polite"` for screen reader accessibility
- **Tool display**: Active tools show friendly labels via `friendlyToolLabel` fallback when tool names aren't explicitly provided (e.g., "Searching notes…" instead of raw IDs)
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
