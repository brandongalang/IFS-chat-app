# README Delta (Proposed Updates)

This file summarizes recommended updates to bring README.md in line with the current code and design decisions.

1) Current State section
- Update: Chat UI now streams via /api/chat through hooks/useChat.ts and lib/chatClient.ts. It is no longer using a purely mocked client by default.
- Keep: Dev fallback stream still supported if OPENROUTER_API_KEY is absent (so UI works without secrets).

2) Backend endpoints
- Prefer a single chat path: /api/chat (Mastra-based). Deprecate /api/chat/ui unless there’s a specific need for AI SDK UIMessage format.
- Session endpoints: /api/session/start and /api/session/message are active; mention their dev fallback behavior if Supabase is not configured.

3) Environment variables
- Add Development Mode section explicitly (IFS_DEV_MODE, IFS_DEFAULT_USER_ID, IFS_VERBOSE, IFS_DISABLE_POLARIZATION_UPDATE) and highlight that it is for local dev only.

4) Data and tools overview
- Add a short summary of agent tools and safety rules (≥3 pieces of evidence + user confirmation for creating parts; action logging + rollback tools).

5) Testing
- Add Playwright as the recommended e2e framework with a short example of running tests (once scaffolded).

6) Roadmap alignment
- Update the short roadmap to reflect: unify chat endpoint, wire persistence + logging, expose tool events in UI, add auth, and add e2e coverage.

