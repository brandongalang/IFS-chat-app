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


## Current state (post-migration)
- The chat page (/chat) renders the migrated IFSFrontEnd chat UI using an internal mock streaming client (lib/mockAIClient.ts) via hooks/useChat.ts.
- We replaced the previous chat page implementation; it’s no longer wired to the backend.
- Two backend chat options exist but are not yet used by the front-end hook:
  1) app/api/chat/route.ts -> streams from the Mastra IFS agent (ifsAgent.stream(messages))
  2) app/api/chat/ui/route.ts -> streams UIMessage via the Vercel AI SDK
- Supabase integration exists for sessions and action logging but is not yet driven by the front-end chat flow.
- Theme tokens and utilities are merged; ThemeProvider is in app/layout.tsx.

Result: You can run the app and use /chat with the migrated UI. Next step is to swap the mock client for the real API and stitch session persistence and agent tools.


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
```

3) Run the app
```bash path=null start=null
npm run dev
# App will start on http://localhost:3000 (or next free port)
```

4) Optional: run Mastra dev (if you plan to use the Mastra CLI for tooling/dev)
```bash path=null start=null
npm run dev:mastra
```


## How the two backend options differ
- Mastra agent endpoint (/api/chat)
  - POST { messages } and returns a streaming response from ifsAgent.stream
  - Best for connecting the migrated UI to the IFS agent and tool ecosystem
- Vercel AI SDK endpoint (/api/chat/ui)
  - POST { messages: UIMessage[], model? } and returns UIMessage stream
  - Useful if you want to leverage the AI SDK’s UIMessage format and tooling

You can use either. The plan below wires the migrated UI to Mastra first, then shows how to switch to the AI SDK endpoint if desired.


## Next steps: stitch backend + data stores to the migrated frontend

### Step 1: Swap mock streaming with the Mastra chat API
Edit hooks/useChat.ts and replace the mockAIClient.streamMessage with a call to /api/chat that consumes the streaming response. Keep the message shape minimal: { role: 'user'|'assistant', content: string }.

Example streaming client logic (client-side):
```ts path=null start=null
async function streamFromMastra(messages: { role: 'user'|'assistant'; content: string }[], onToken: (t: string, done: boolean) => void) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  })
  if (!res.ok || !res.body) throw new Error('Failed to start stream')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Depending on stream format, split on newlines/chunks
    // Call onToken for partial tokens or whole chunks
    onToken(buffer, false)
    buffer = ''
  }
  onToken('', true)
}
```
In useChat.ts, replace mockAIClient.streamMessage with a call that uses this helper and continuously updates the assistant message content as tokens arrive.


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


### Step 4 (optional): Use the AI SDK endpoint instead
If you prefer the Vercel AI SDK’s UIMessage format and optional reasoning stream, post to /api/chat/ui with UIMessage[]. You’ll need to map your local Message type to UIMessage, and update rendering if you want to display reasoning/parts as structured entries.

```ts path=null start=null
const res = await fetch('/api/chat/ui', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: uiMessages, model: 'openai/gpt-4o' })
})
// Consume the stream with the AI SDK’s prescribed reader
```


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
- OPENROUTER_API_KEY is required for the agent.
- Supabase env vars are required for persistence; otherwise /api/session/start returns a dev session id and data isn’t stored.
- The lib/mastra.ts uses VITE_MASTRA_API_URL; in Next.js, prefer process.env if you start consuming it on the server.


## Roadmap (short)
- Replace mock streaming with real agent streaming (/api/chat) and persist messages.
- Add user identity/auth (Supabase Auth or session cookie) to personalize data and enforce RLS.
- Expand the chat UI to visualize tool calls and part relationships once the agent tools are actively used.
- e2e coverage for core chat flows after wiring (Playwright recommended).
