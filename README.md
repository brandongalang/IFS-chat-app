# IFS Therapy Companion

An Internal Family Systems (IFS) companion app built around agentic AI for structured personal reflection—demonstrating how product thinking translates into technical architecture.

## What It Does

IFS Therapy Companion helps users explore their internal psychological landscape using IFS methodology through conversational AI. Users engage with a streaming chat interface that identifies, tracks, and maps relationships between internal "parts"—the subpersonalities that make up our psyche. The agent maintains context through a differential memory system, generates insights from patterns across sessions, and visualizes part relationships in an interactive force-directed graph ("Parts Garden").

## Key Features

- **IFS-Informed Chat**: Streaming AI conversation trained in IFS methodology with evidence-based part detection
- **Parts Tracking**: Lifecycle management (emerging → acknowledged → active → integrated) with confidence scoring
- **Relationship Mapping**: Track dynamics between parts (protector-exile, polarization, allied)
- **Memory System**: Differential snapshot architecture maintaining psychological continuity across sessions
- **Insights Generation**: Daily AI-generated reflections and pattern detection with user feedback loop
- **Parts Garden**: Interactive D3.js force-directed visualization of parts and their relationships
- **Action Logging**: Complete audit trail with rollback capability for all AI-driven changes
- **Markdown-Based Storage**: Structured note-taking with integrity tracking and event sourcing

## Architecture Overview

### Components

**Web Application**: Next.js 15 (App Router) with React 19, TypeScript, and Tailwind CSS. Server-side rendering with streaming responses via Vercel AI SDK.

**Agent Layer**: Built on Mastra framework with 15+ specialized tool modules (parts, assessments, proposals, evidence, memory, inbox observation). Agent loop orchestrates tool selection, execution, and response generation. Custom prompt engineering for IFS domain expertise.

**Model Access**: OpenRouter integration (Grok-4-Fast primary model) proxied through LiteLLM for prompt injection detection and model fallback.

**Data Layer**: PostgreSQL via Supabase with Row Level Security enforcing complete user data isolation. Zod schemas with `.strict()` validation and server-injected user identity. Differential memory snapshots with JSON Patch (RFC 6902) for efficient state tracking.

**Background Jobs**: Vercel Cron for daily memory refresh, session finalization, and insight generation. Event-driven architecture with idempotent queue processing.

### Data Flow

1. User input → Next.js API route (`/api/chat`)
2. Agent bootstrap with personalized system prompt and memory context
3. LLM processes conversation history + available tools
4. Tool execution (e.g., `searchParts`, `createEmergingPart`) with action logging
5. Response generation incorporating tool results
6. Streaming response to client with real-time task visualization
7. Background memory update pipeline processes session data into markdown notes

→ See [`docs/architecture/`](docs/architecture/) for detailed component documentation

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Radix UI
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth), Vercel Cron
- **AI/Agent**: Mastra framework, OpenRouter (Grok-4-Fast), LiteLLM proxy, Vercel AI SDK
- **Data**: Supabase Postgres with RLS, differential snapshots (JSON Patch), markdown storage
- **Validation**: Zod strict schemas with server-side user injection
- **Security**: gitleaks secret scanning, environment-based secrets, RLS policies
- **Deployment**: Vercel (app + cron), Supabase Cloud (data + auth)

## Project Context

This is a portfolio project demonstrating agentic AI architecture for personal reflection use cases. Built by a Product Manager using AI development tools—architectural decisions (database design, IFS domain logic, agent loop design, tool orchestration, memory system) were human-led, while implementation was AI-assisted. The codebase (~26,000 lines of TypeScript) showcases both product design thinking and technical decision-making around multi-agent systems, real-time state management, and domain-specific AI applications

## Setup & Development

### Prerequisites

- Node.js 18+ LTS
- npm or pnpm
- Supabase account (for database and auth)
- OpenRouter API key (for LLM access)

### Local Development

1. **Environment Configuration**

```bash
cp .env.example .env.local
```

Set required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `CRON_SECRET` (for background jobs)

2. **Install Dependencies**

```bash
npm install
```

3. **Run Development Servers**

You'll need three terminal windows:

```bash
# Terminal 1: LiteLLM proxy (LLM gateway)
export OPENROUTER_API_KEY=your_key_here
npx litellm --config litellm.config.yaml --port 4000

# Terminal 2: Mastra agent tools (watches for changes)
npm run dev:mastra

# Terminal 3: Next.js development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Database Setup

Apply migrations via Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Or apply manually via Supabase Studio SQL editor.

### Troubleshooting

- **ECONNREFUSED on port 4000**: Ensure LiteLLM proxy is running
- **Agent tool errors**: Restart Mastra dev server (`npm run dev:mastra`)
- **Auth issues**: Verify Supabase env variables and RLS policies

## Documentation

- **[Product Overview](docs/overview.md)** - Vision, user stories, and product requirements
- **[System Architecture](docs/current_state/01_system_architecture.md)** - Component breakdown and data flow
- **[Feature Documentation](docs/features/)** - Detailed specs for chat, parts garden, insights, memory system
- **[User Memory System](docs/user-memory.md)** - Differential snapshot architecture and background jobs
- **[Development Workflow](docs/ops/warp-workflow.md)** - Repository guidelines and PR process
- **[Ethereal Theme](docs/theme/ethereal.md)** - Visual styling and customization

## Security

- **Row Level Security**: Supabase RLS policies enforce complete user data isolation
- **Schema Validation**: Zod `.strict()` schemas with server-injected user identity
- **Secret Scanning**: Automated gitleaks scanning in CI (`.gitleaks.toml`)
- **Environment-Based Secrets**: No secrets committed to repository
- **Action Audit Trail**: All agent mutations logged for review and rollback

## API Architecture

Key endpoints demonstrating agentic patterns:

- **`/api/chat`** - Primary agent interface with streaming responses and tool orchestration
- **`/api/chat/dev`** - Development agent simulator (dev mode only)
- **`/api/insights`** - Dynamic insight generation with JIT provisioning
- **`/api/memory/preflight`** - Real-time memory context loading before chat
- **`/api/cron/memory-update`** - Daily background job for memory snapshots and session finalization

→ See [feature documentation](docs/features/) for detailed API specs

## 🔐 Secret Scanning

This repository uses [gitleaks](https://github.com/gitleaks/gitleaks) to prevent committing secrets.
Every pull request runs a gitleaks scan in CI and the build fails if any secrets are detected.

Run a scan locally before pushing changes:

```bash
gitleaks detect --source=. --config=.gitleaks.toml --no-git
```
