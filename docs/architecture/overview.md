# Architecture Overview

This document provides a high-level overview of Trailhead's technical architecture.

## System Components

### Web Application Layer

- **Framework**: Next.js 15 with App Router
- **UI**: React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Rendering**: Server-side rendering with streaming responses
- **State Management**: React hooks + Vercel AI SDK for chat state

### Agent Layer

- **Framework**: Mastra (`@mastra/core`) - TypeScript framework for stateful AI agents
- **Tool Registry**: 15+ specialized tool modules:
  - `part-tools.ts` - Parts CRUD and search
  - `assessment-tools.ts` - Part assessments and evaluations
  - `proposal-tools.ts` - Agent proposals for user confirmation
  - `evidence-tools.ts` - Evidence collection and tracking
  - `memory-tools.ts`, `memory-markdown-tools.ts` - Memory management
  - `inbox-observation-tools.ts` - Context discovery and research
  - `rollback-tools.ts` - Action reversal and audit
- **Prompt Engineering**: Custom IFS-trained system prompts with domain expertise
- **Agent Loop**: Tool selection → execution → response generation cycle

### Model Access Layer

- **Provider**: OpenRouter API (primary model: `x-ai/grok-4-fast`)
- **Proxy**: LiteLLM for:
  - Prompt injection detection
  - Model fallback handling
  - Request/response logging
- **Streaming**: Real-time token streaming via Vercel AI SDK

### Data Layer

- **Database**: PostgreSQL hosted on Supabase
- **Security**: Row Level Security (RLS) policies per user
- **Validation**: Zod schemas with `.strict()` mode
- **Identity**: Server-injected user context (never client-provided)
- **Memory**: Differential snapshots using JSON Patch (RFC 6902)
- **Storage**: Markdown files for structured notes with integrity tracking

### Background Jobs

- **Scheduler**: Vercel Cron (daily at 08:00 UTC)
- **Jobs**:
  - Memory snapshot generation
  - Session finalization (close idle sessions)
  - Insight generation
- **Queue**: Event-driven with idempotent processing via `memory_updates` table

## Key Design Patterns

### Multi-Agent Orchestration

Agent loop manages:
1. Context assembly (user profile, memory snapshot, conversation history)
2. Tool availability based on user state
3. LLM tool selection decisions
4. Tool execution with validation
5. Result integration into response
6. Action logging for audit trail

### Differential Memory

Instead of storing complete memory snapshots:
- Store JSON Patch diffs between versions
- Create full checkpoints every N versions (default: 50)
- Reconstruct memory by applying patches forward from last checkpoint
- Enables efficient storage and fast lookups

### Evidence-Based Part Detection

Agents cannot create parts without:
1. ≥3 pieces of evidence from user language
2. Explicit user confirmation
3. Logged action for auditability

This prevents hallucination and maintains user agency.

## Data Flow

See [detailed data flow documentation](./data-flow.md) for sequence diagrams and request/response examples.

## Related Documentation

- [Agent Loop](./agent-loop.md) - Tool orchestration and execution
- [Data Model](./data-model.md) - Database schema and relationships
- [System Architecture (Current State)](../current_state/01_system_architecture.md) - Legacy architecture doc
