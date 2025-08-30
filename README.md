# IFS Therapy Companion

- See docs/user-memory.md for the new User Memory backend (differential snapshots, cron endpoint, and env setup).

An Internal Family Systems companion app built on Next.js 15 with a Mastra-powered agent, Supabase for persistence, and a modern shadcn/Radix UI front-end. The chat UI and UI component library were migrated from IFSFrontEnd/IFS-Front-End into this app so we can stitch the backend in incrementally.

Repo: https://github.com/brandongalang/IFS-chat-app.git


## Tech stack
- Next.js 15, React 19, TypeScript
- Tailwind CSS 3 with tailwindcss-animate and @tailwindcss/typography
- shadcn/Radix UI components (accordion, alerts, dialogs, etc.)
- Mastra Agent + OpenRouter provider for the IFS agent
- Supabase (sessions, parts, relationships, action logging)
- Vercel AI SDK UI message stream for server-driven steps (tasks) rendered with AI Elements


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
- The chat page (/chat) renders the IFS UI and streams from the unified /api/chat endpoint via hooks/useChat.ts and lib/chatClient.ts.
- Server now streams AI SDK UI message events with reasoning disabled; the client renders server-driven task steps (planning, writing, formatting, tools) above the assistant bubble.
- /api/chat provides Mastra-based streaming from ifsAgent with a dev fallback when OPENROUTER_API_KEY is not set.
- A dev simulator is available at /api/chat/dev; the client automatically targets it when NEXT_PUBLIC_IFS_DEV_MODE=true.
- ToolCard is removed in favor of AI Elements Task-based UI.
- Supabase integration exists for sessions and action logging; the front-end persists messages through /api/session/*.
- Theme tokens and utilities are merged; ThemeProvider is in app/layout.tsx.

Result: Run the app and use /chat. Messages are streamed from /api/chat and persisted when Supabase env is configured.


## Getting started

1) Install dependencies
```bash path=null start=null
npm install
```

2) Environment variables
Copy `.env.example` to `.env.local` and fill in all required values. This now includes variables for Stripe and feature gating. Do not commit `.env` files; they are gitignored.
```bash
# Mastra / OpenRouter
OPENROUTER_API_KEY={{YOUR_OPENROUTER_API_KEY}}

# Supabase (optional for local dev; required for persistence)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY={{YOUR_SUPABASE_ANON_KEY}}

# Optional Mastra client base URL (used by lib/mastra.ts if needed)
VITE_MASTRA_API_URL=http://localhost:4111

# Development mode (local only) — enables dev simulator route
NEXT_PUBLIC_IFS_DEV_MODE=true
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


## Backend chat endpoints
- Primary: /api/chat
  - POST { messages } and returns UI message stream from ifsAgent (format: 'aisdk')
  - Reasoning is disabled in the stream (sendReasoning: false)
  - Falls back to data stream/plain text when necessary
- Dev simulator: /api/chat/dev
  - Emits a valid UI message stream with task steps and final text; used automatically when NEXT_PUBLIC_IFS_DEV_MODE=true

Note: /api/chat/ui remains deprecated.


## Insights API (MVP)
- Migration: supabase/migrations/005_insights.sql
- Endpoints:
  - GET /api/insights?limit=3&includeStatus=pending,revealed&jit=false
    - Returns up to 3 active cards (status in pending/revealed)
    - If jit=true and IFS_INSIGHTS_JIT='true', the server will attempt a JIT top-up to reach the requested limit
  - POST /api/insights/[id]/reveal
    - Body: {}
    - Idempotent: sets status='revealed' and revealed_at if previously pending
  - POST /api/insights/[id]/feedback
    - Body: { rating: { scheme: 'quartile-v1', value: 1..4, label?: string }, feedback?: string }
    - Sets status='actioned' and actioned_at, and persists rating JSON and feedback

Env flags:
- IFS_INSIGHTS_JIT=false (default). When true, GET /api/insights?jit=true can fill empty slots on demand.


## Subscription Features
This application is now equipped with a full subscription system powered by Stripe.

- **Pricing Page:** A new `/pricing` page displays the available plans.
- **Stripe Checkout:** Users can upgrade to a paid plan via a secure Stripe Checkout session.
- **Customer Portal:** Users can manage their subscription (update payment methods, cancel, etc.) via a Stripe-hosted customer portal, accessible from the `/settings` page.
- **Webhooks:** A webhook at `/api/stripe/webhook` listens for events from Stripe to keep the application's database in sync with subscription statuses.

### Feature Gating
The application now supports two tiers: Free and Paid.
- **Free Tier:**
  - Limited to 15 messages per day.
  - Can only view the first 2 "parts" they discover.
  - Uses a standard, economical AI model.
- **Paid Tier:**
  - Unlimited messages.
  - Unlimited visible parts.
  - Uses a premium, more powerful AI model.


## Next steps: stitch backend + data stores to the migrated frontend

### Step 1: Ensure streaming from /api/chat and SSE handling
hooks/useChat.ts streams via lib/chatClient.ts. The SSE reader now parses AI SDK UI message events for task steps and text, ignores reasoning, and updates the assistant message and tasks list incrementally.


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


### Step 4 (done): AI SDK UI events via /api/chat
The unified /api/chat route emits AI SDK-compatible UI message events via agent.streamVNext({ format: 'aisdk' }) when available (with reasoning disabled). If not available, it falls back to the agent’s data stream or plain text. The client SSE reader (lib/chatClient.ts) handles both.


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
- Add user identity/auth (Supabase Auth or session cookie) to personalize data and enforce RLS (done).
- **Implement Stripe Subscriptions & Feature Gating (done).**
  - Full Stripe integration with checkout and customer portal.
  - Tiered system (Free/Paid) with limits on message count and part visibility.
  - Dynamic AI model selection based on subscription tier.
- Task-based UI for server-driven steps is implemented; explore deeper tool visualization as the agent tools are actively used.
- e2e coverage for core chat flows after wiring (use Playwright MCP when needed).

## Feature flags and Coming Soon gating
We are shipping v0 with only the Chat experience enabled. Home (Today) remains accessible, and the + button launches Chat. Other areas (Insights, Garden, Journey, Settings, Profile) are gated.

- Central config: `config/features.ts`
  - `FeatureStatus`: 'enabled' | 'coming_soon' | 'disabled'
  - `features`: per-feature default states (Home and Chat are enabled; others are coming_soon)
  - `statusForPath(path)`: resolve a path to a feature key and its effective status
  - Dev mode: when enabled, treats all non-`disabled` features as `enabled` for local iteration.

Dev mode controls (UI gating and behavior)
- `NEXT_PUBLIC_IFS_DEV_MODE` (boolean): enables dev mode when `true` (also defaults to enabled when `NODE_ENV === 'development'`).
- `NEXT_PUBLIC_IFS_SHOW_DEV_TOGGLE` (boolean): shows the "Enable Dev Mode" UI toggle on the home header when `true`. Defaults to shown in development, hidden in production.
- Local override: when the toggle is shown, clicking it sets `localStorage.IFS_DEV_MODE='true'` and reloads. On the client, `statusForPath()` respects this override.

UI gating:
- Clicks to not-yet-enabled routes use `GuardedLink`, which opens a global `ComingSoonDialog` instead of navigating when the feature is not enabled.
- In dev mode (env flag or local override), `GuardedLink` will allow navigation for any feature not explicitly `disabled`.
- Direct deep links (e.g., `/insights`) render the real page when enabled; otherwise render a friendly Coming Soon treatment.

How to enable a feature:
- Flip the feature in `config/features.ts` from `coming_soon` to `enabled`.
- Replace the route’s `ComingSoonPage` with the actual implementation.

Notes:
- Never commit secrets in `.env*` files. Only `.env.example` is committed. `.env.local` is gitignored.
