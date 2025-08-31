---
title: Feature: Chat
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
feature_flag: null
code_paths:
  - app/chat/page.tsx
  - hooks/useChat.ts
  - lib/database/action-logger.ts
  - lib/database/validate.ts
related_prs:
  - #34
---

## What
The conversational interface for interacting with the IFS companion.

## Why
Enables guided self-reflection, parts work, and agent-assisted workflows.

## How it works
- UI at app/chat/page.tsx with streaming responses
- useChat hook manages message state and streaming
- Agent actions are logged via lib/database/action-logger.ts

## Data model
- sessions, messages, agent_actions tables

## Configuration
- Env vars for model/provider configuration (names only in code); see project env

## Testing
- Unit tests around parsing/format functions where present
- Add Playwright coverage for core chat flows (send message, receive response)

## Operational notes
- Ensure action logging remains enabled for auditability
