# IFS Therapy Companion (ifs-full)

An Internal Family Systems companion app built on Next.js 15 with a Mastra-powered agent, Supabase for persistence, and a modern shadcn/Radix UI front-end. The chat UI and UI component library were migrated from IFSFrontEnd/IFS-Front-End into this app so we can stitch the backend in incrementally.

Repo: https://github.com/brandongalang/IFS-chat-app.git


## Tech stack
- Next.js 15, React 19, TypeScript
- Tailwind CSS 3 with tailwindcss-animate and @tailwindcss/typography
- shadcn/Radix UI components (accordion, alerts, dialogs, etc.)
- Mastra Agent + OpenRouter provider for the IFS agent
- Supabase (sessions, parts, relationships, action logging)
- Vercel AI SDK endpoint (optional alternative for UI-formatted streaming)


## Project layout (high level)
- app/
  - page.tsx -> redirects to /chat
  - chat/page.tsx -> renders the migrated ChatLayout front-end
  - api/
    - chat/route.ts -> Mastra agent streaming endpoint
    - chat/ui/route.ts -> Vercel AI SDK UIMessage streaming endpoint (optional)
    - session/start/route.ts -> returns sessionId (Supabase-backed when env is set)
- components/
  - chat/ -> migrated chat experience (ChatLayout, Composer, MessageList, etc.)
  - ui/ -> full shadcn/Radix component set from IFSFrontEnd
  - theme-provider.tsx -> next-themes wrapper for system/dark/light
- hooks/ -> useChat (mock streaming), useSpeechRecognition
- lib/
  - supabase/ -> client.ts, server.ts
  - database/ -> action-logger.ts, validate.ts
  - session-service.ts -> start/add/end/fetch sessions via Supabase
  - mastra.ts -> Mastra client (optional)
  - types/ -> database schema types
- mastra/
  - agents/ifs-agent.ts -> IFS agent definition (tools, model, system prompt)
- supabase/
  - config.toml, migrations/ -> SQL migrations for core tables


## Current state
- The chat page (/chat) renders the migrated IFS UI and streams from the unified /api/chat endpoint via hooks/useChat.ts and lib/chatClient.ts.
- /api/chat provides Mastra-based streaming from ifsAgent with a dev fallback when OPENROUTER_API_KEY is not set.
- /api/chat/ui has been deprecated in favor of /api/chat.
- Supabase integration exists for sessions and action logging; the front-end persists messages through /api/session/*.
- Theme tokens and utilities are merged; ThemeProvider is in app/layout.tsx.

Result: Run the app and use /chat. Messages are streamed from /api/chat and persisted when Supabase env is configured.


## Getting started

1) Install dependencies
```bash path=null start=null
npm install
```

2) Environment variables
Create a .env in the repo root with the following (replace placeholders):
```bash path=null start=null
# Mastra / OpenRouter
OPENROUTER_API_KEY={{YOUR_OPENROUTER_API_KEY}}

# Supabase (optional for local dev; required for persistence)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY={{YOUR_SUPABASE_ANON_KEY}}

# Optional Mastra client base URL (used by lib/mastra.ts if needed)
VITE_MASTRA_API_URL=http://localhost:4111

# Development mode (local only)
IFS_DEV_MODE=true
IFS_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000000
IFS_VERBOSE=true
# Optional: workaround for dev runtime quirk when updating relationship polarization
IFS_DISABLE_POLARIZATION_UPDATE=true
```
For details, see DEVELOPMENT.md.

3) Run the app
```bash path=null start=null
npm run dev
# App will start on http://localhost:3000 (or next free port)
```

4) Optional: run Mastra dev (if you plan to use the Mastra CLI for tooling/dev)
```bash path=null start=null
npm run dev:mastra
```


## Backend chat endpoint
- Unified endpoint: /api/chat
  - POST { messages } and returns a streaming response from ifsAgent
  - Emits AI SDK-compatible events when available (streamVNext(format: 'aisdk')), else falls back to data stream/plain text
  - Dev fallback stream is returned when OPENROUTER_API_KEY is not configured

Note: /api/chat/ui has been deprecated.


## Next steps: stitch backend + data stores to the migrated frontend

### Step 1: Ensure streaming from /api/chat and SSE handling
hooks/useChat.ts already streams via lib/chatClient.ts to /api/chat. Keep the message shape minimal: { role: 'user'|'assistant', content: string }. The SSE reader in lib/chatClient.ts parses AI SDK-like events or plain text and updates the assistant message incrementally.


### Step 2: Session lifecycle and persistence
- On first user message, call /api/session/start with userId to get sessionId. Store it in the hook state and include it in subsequent API calls (e.g., via header or request body).
- In /api/chat/route.ts, after receiving the user message and before/after agent response, log messages to Supabase via chatSessionService.addMessage. When the conversation ends or the tab closes, call chatSessionService.endSession.

Example front-end session start:
```ts path=null start=null
const res = await fetch('/api/session/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'dev-user-1' })
})
const { sessionId } = await res.json()
// store sessionId for subsequent calls
```

Example message persistence in API route (sketch):
```ts path=null start=null
import { chatSessionService } from '@/lib/session-service'

// inside POST handler for /api/chat, after parsing request json
const { messages, sessionId, userId } = await req.json()

if (sessionId && userId) {
  // last user message
  const userMsg = messages.filter((m: any) => m.role === 'user').slice(-1)[0]
  if (userMsg) {
    await chatSessionService.addMessage(sessionId, {
      role: 'user',
      content: userMsg.content
    })
  }
}

// After streaming completes, capture assistant output and log it similarly
```


### Step 3: Wire agent context and action logging
- The agent tools already log to the database via lib/database/action-logger.ts. Ensure you pass userId (and optionally sessionId) through your API layer so tools and logging are attributed correctly.
- Confirm Supabase environment variables are set so the action logger can write to agent_actions, sessions, parts, etc.


### Step 4 (optional): AI SDK-compatible events via /api/chat
The unified /api/chat route attempts to emit AI SDK-compatible events via agent.streamVNext({ format: 'aisdk' }) when available. If not available, it falls back to the agent’s data stream or plain text. The client SSE reader (lib/chatClient.ts) handles both.


### Step 5: Supabase setup
- Apply migrations in supabase/migrations to initialize tables for users, parts, sessions, relationships, agent actions, etc.
- Ensure RLS and functions are present. The lib/database/validate.ts suite can help you verify configuration.

Suggested commands (using the Supabase CLI):
```bash path=null start=null
# install
brew install supabase/tap/supabase

# start a local instance (Docker required)
supabase start

# link your project (if using remote)
supabase link --project-ref YOUR_PROJECT_REF

# apply migrations
supabase db push
```


## Scripts
- Dev server: `npm run dev`
- Build & start: `npm run build && npm start`
- Lint: `npm run lint`
- Mastra dev/build: `npm run dev:mastra`, `npm run build:mastra`
- Smoke tests (Mastra helpers): `npm run smoke:evidence`, `npm run smoke:relationships`


## Known notes and gotchas
- Voice input requires mic permissions; browser may require HTTPS for full access.
- OPENROUTER_API_KEY is required for the agent; without it, /api/chat returns a dev fallback stream for local UI testing.
- Supabase env vars are required for persistence; otherwise /api/session/start returns a dev session id and data isn’t stored.
- The lib/mastra.ts uses VITE_MASTRA_API_URL; in Next.js, prefer process.env if you start consuming it on the server.
- /api/chat/ui is deprecated. Use /api/chat for all chat requests.


## Roadmap (short)
- Unify on /api/chat for all chat streaming (done).
- Add user identity/auth (Supabase Auth or session cookie) to personalize data and enforce RLS.
- Expand the chat UI to visualize tool calls and part relationships once the agent tools are actively used.
- e2e coverage for core chat flows after wiring (use Playwright MCP when needed).

## Feature flags and Coming Soon gating
We are shipping v0 with only the Chat experience enabled. Home (Today) remains accessible, and the + button launches Chat. Other areas (Insights, Garden, Journey, Settings, Profile) are gated.

- Central config: `config/features.ts`
  - `FeatureStatus`: 'enabled' | 'coming_soon' | 'disabled'
  - `features`: per-feature default states (Home and Chat are enabled; others are coming_soon)
  - `statusForPath(path)`: resolve a path to a feature key and its effective status
  - `NEXT_PUBLIC_IFS_DEV_MODE=true` treats `coming_soon` as `enabled` in client-side checks to speed up local iteration.

UI gating:
- Clicks to not-yet-enabled routes use `GuardedLink`, which opens a global `ComingSoonDialog` instead of navigating.
- Direct deep links (e.g., `/insights`) render a friendly `ComingSoonPage` with a Back to Chat action (HTTP 200).

How to enable a feature:
- Flip the feature in `config/features.ts` from `coming_soon` to `enabled`.
- Replace the route’s `ComingSoonPage` with the actual implementation.
