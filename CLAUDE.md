<!--
NOTE: This document includes Vite-era guidance and may be out of date.
See docs/SystemDesign.md and docs/PRD.md for current architecture and product intent.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Core Development Workflow
```bash
# Development server (frontend on port 3000, Mastra dev server on 3001)
npm run dev

# Development with Mastra agent server
npm run dev:mastra

# Build application
npm run build

# Build Mastra agents and tools
npm run build:mastra

# Run tests
npm run test

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Required environment variables:
# - OPENROUTER_API_KEY: For the IFS agent
# - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous key
# - IFS_DEV_MODE=true: Enable development mode for testing
# - IFS_DEFAULT_USER_ID: UUID for development testing
```

## Architecture Overview

This is an IFS (Internal Family Systems) therapy companion built with React + Vite frontend, Vercel serverless backend, and Mastra AI framework for agent orchestration.

### Key Components

**Frontend (React + Vite)**
- `src/App.tsx`: Root component rendering ChatInterface
- `src/components/ChatInterface.tsx`: Main chat UI component
- `src/hooks/useSessionChat.ts`: Core hook wrapping AI SDK's useChat with session management
- `src/lib/session-service.ts`: Database abstraction for chat sessions

**Backend (Vercel Serverless)**
- `api/chat.ts`: Single serverless function handling chat requests
- `server.cjs`: Development proxy server (simulates Vercel environment)

**AI Agent (Mastra Framework)**
- `mastra/agents/ifs-agent.ts`: IFS companion agent with system prompt and tools
- `mastra/tools/`: Agent tools for part management, assessments, proposals, rollbacks
- `mastra.config.ts`: Mastra configuration with OpenRouter provider and Supabase

**Database (Supabase)**
- `supabase/migrations/`: Database schema definitions
- Tables: users, sessions, actions, parts, part_assessments, part_change_proposals

### Development Architecture

The app uses a dual-server setup in development:
- Vite dev server (port 3000) for frontend
- Mastra dev server (port 3001) for agent API
- Vite proxy forwards `/api/*` requests to Mastra server

### Data Flow

1. User types message in ChatInterface
2. `useSessionChat` creates/manages session in Supabase
3. Message sent to `/api/chat` endpoint
4. Serverless function calls `ifsAgent.stream()`
5. Agent processes with LLM (OpenRouter) and tools
6. Streamed response displayed in chat
7. Messages saved to Supabase session

## Development Mode Configuration

The application supports development mode for testing without full authentication:

- Set `IFS_DEV_MODE=true` and `IFS_DEFAULT_USER_ID` in `.env`
- Tools automatically use default user ID when none provided
- User confirmation always required through chat interface
- Verbose logging available with `IFS_VERBOSE=true`

## Agent Tools System

The IFS agent has access to several tool categories:

**Part Tools** (`mastra/tools/part-tools.ts`)
- `searchParts`: Find existing parts
- `createEmergingPart`: Create new parts (requires 3+ evidence pieces + user confirmation)
- `updatePart`: Update existing parts
- `getPartRelationships`: Query part relationships

**Rollback Tools** (`mastra/tools/rollback-tools.ts`)
- `getRecentActions`: View recent actions for undo
- `rollbackAction`: Undo specific action by ID
- `rollbackByDescription`: Undo using natural language

**Assessment Tools** (`mastra/tools/assessment-tools.ts`)
- Tools for assessing user confidence in parts

**Proposal Tools** (`mastra/tools/proposal-tools.ts`)
- Tools for proposing part splits/merges

## Key Dependencies and Frameworks

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **AI**: @ai-sdk/react for chat UI, @mastra/core for agent framework
- **Backend**: Vercel serverless functions, Express (dev proxy)
- **Database**: Supabase (PostgreSQL), @supabase/supabase-js
- **LLM Provider**: OpenRouter with z-ai/glm-4.5 model
- **Testing**: Vitest, ESLint for linting

## File Structure Patterns

```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── lib/
│   ├── database/       # Database utilities and logging
│   ├── supabase/       # Supabase client configuration
│   └── types/          # TypeScript type definitions
mastra/
├── agents/             # Mastra AI agents
├── tools/              # Agent tools grouped by functionality
└── config/             # Environment-specific configurations
api/                    # Vercel serverless functions
supabase/
└── migrations/         # Database schema migrations
```

## Testing and Code Quality

- Run tests with `npm run test` (Vitest)
- Lint with `npm run lint` (ESLint with TypeScript, React hooks, and React refresh plugins)
- TypeScript strict mode enabled
- Path aliases: `@/` for src, `@mastra/` for mastra directory

## Important Implementation Notes

- All agent tools require user confirmation through chat for destructive operations
- Development mode bypasses authentication but maintains all other safeguards
- Session management is handled automatically by useSessionChat hook
- Agent uses streaming responses for real-time chat experience
- Database actions are logged for auditing and rollback capabilities