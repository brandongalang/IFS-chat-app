# Product Requirements Document (PRD)

Title: IFS Therapy Companion (aka “Self Guide”)
Owner: Product + Engineering
Status: Draft v0.1
Date: 2025-08-27

1) Overview and Vision
- Vision: A curious, non-judgmental Internal Family Systems (IFS) companion that helps people notice, name, and relate to their internal parts, track relationships between parts, and reflect on their experiences over time.
- Product tagline: A gentle companion for getting to know your parts.
- Primary value: Guided self-reflection via chat, durable tracking of parts and relationships, and auditability/undo for agent-driven changes.

2) Problem Statement
- People practicing IFS often struggle to keep track of parts, shifting internal dynamics, and evidence for emergence. They want a low-friction way to reflect, name patterns, and see progress—without replacing therapy.

3) Goals and Non-Goals
- Goals (MVP)
  - Conversational companion with IFS-informed tone and prompts
  - Track parts (emerging → acknowledged → active → integrated)
  - Persist chat sessions and messages
  - Log and audit agent actions with ability to rollback
  - Represent and query relationships (polarized, protector-exile, allied)
  - Strict evidence and confirmation before creating new parts (safety)
- Non-Goals
  - Provide clinical diagnosis or therapy
  - Replace professional therapeutic relationship

4) Target Users and Personas
- Self-guided user: familiar with IFS basics, seeks a daily reflection partner
- Therapy client: wants to capture insights between sessions
- (Future) Practitioner support role: therapist reviewing part maps co-created by the client

5) User Stories and Use Cases (MVP)
- As a user, I want to talk with a companion that reflects parts-aware language so I can explore safely.
- As a user, I want the agent to surface potential parts with evidence and ask for my confirmation before tracking anything.
- As a user, I want summary and durability—my sessions and actions are saved for later review.
- As a user, I want to see how parts relate (e.g., protectors versus exiles) and changes over time (polarization rising/falling).
- As a user, I want to undo changes the agent made if I say “that’s wrong.”

6) Scope
- MVP Scope
  - Chat with streaming assistant (Next.js 15 UI)
  - Sessions persisted; messages stored with timestamps
  - Parts data model with story, evidence log (recent evidence cap 10), confidence score
  - Relationships model with types (polarized, protector-exile, allied) and polarization level
  - Action logging for all DB mutations and rollback tools
  - Development mode for local testing with a default user id and verbose logging
- Future Scope
  - Insight cards and onboarding (e.g., /insights)
  - Guided protocols (assessments, check-ins)
  - Visualization of parts map and relationship graph
  - Auth + multi-device sync, data export, privacy controls
  - Human review workflows (therapist-facing tools)

7) Functional Requirements (MVP)
- Chat
  - Renders chat UI with streaming tokens
  - Sends user messages and persists them to the active session
  - Receives assistant tokens and persists final assistant message
  - Voice input for composing messages (browser mic permissions)
- Sessions
  - Create on first message; persist messages (role, content, timestamp)
  - End sessions and compute duration
  - Retrieve prior sessions and messages
- Parts
  - Create emerging part only with >= 3 evidence items AND explicit user confirmation via chat
  - Update attributes (status, category, age, emotions, beliefs, somatic markers, role)
  - Maintain confidence score (direct updates or via assessment tool)
- Relationships
  - Create/update pairwise relationships among parts with type and polarization level
  - Append dynamics/observations and optionally adjust polarization
  - Query relationships with optional part details
- Action Logging and Rollback
  - Log all create/update operations with old/new state and metadata
  - List recent actions; rollback by ID or description
- Development mode
  - IFS_DEV_MODE + IFS_DEFAULT_USER_ID for local testing without auth
  - Verbose logging with IFS_VERBOSE

8) Non-Functional Requirements
- Privacy & Safety: No clinical claims; clear consent and user confirmation on destructive operations. RLS in Supabase ensures data isolation per user.
- Reliability: Agent failures degrade to dev fallback stream (where safe). All mutations logged with audit trail and rollback.
- Performance: Streaming responses feel real-time; typical latency target < 1s to first token, subject to model/provider.
- Accessibility: Keyboard navigation, contrast, readable fonts; voice input optional.
- Internationalization: Future (not MVP).

9) Success Metrics
- Engagement: daily/weekly active users, average session length, number of sessions per user
- Safety & Trust: rate of rollbacks, user confirmations observed, reported misclassifications
- Insight Creation: parts created/updated over time, relationships logged, assessments recorded
- Reliability: streaming success rate, API error rate

10) Risks and Mitigations
- Misclassification of parts (hallucination): enforce 3+ evidence and user confirmation; add undo.
- Privacy concerns: clear RLS, environment variable hygiene, optional local-only mode for testing.
- Provider dependency: OpenRouter outages—fallback messaging and error handling.

11) Dependencies
- Next.js 15, React 19, Tailwind
- Mastra agent framework + OpenRouter provider
- Supabase (Postgres) for persistence and RLS
- Vercel AI SDK (optional formatting/streaming utilities)

12) Milestones and Roadmap (proposal)
- M0 (Now)
  - Write PRD and System Design (this doc set)
  - Decide on unified chat endpoint (/api/chat)
- M1 (Plumbing)
  - Ensure session persistence end-to-end
  - Ensure action logging and rollback working in dev and with RLS
  - Basic unit + Playwright e2e baseline
- M2 (IFS features)
  - Solidify part creation/updates and relationship logging flows from chat
  - Surface tool calls in UI (tool cards, evidence, relationships)
  - Optional assessments (confidence updates)
- M3 (UX and Launch-readiness)
  - Insights screen(s), basic parts visualization
  - Auth & multi-device sessions
  - Privacy policy, export/delete account; docs and onboarding

13) Open Questions (to finalize PRD)
- Branding: “IFS Therapy Companion” vs “Self Guide” in product UI and docs
- Personas prioritization: consumer-only or also therapist assist?
- Compliance expectations (HIPAA-level storage vs consumer wellness); hosting constraints
- Data retention defaults and export/delete policy
- Model/config budgets and supported providers (OpenRouter models to target)
- Do we require auth for MVP or continue dev-mode default user for private alpha?

