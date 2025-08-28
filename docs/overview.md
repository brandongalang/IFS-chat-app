# Product Overview

Title: IFS Therapy Companion (aka “Self Guide”)
Owner: Product + Engineering
Status: Draft v0.2 (Includes Phase 2 Feature Spec)
Date: 2025-08-28

1. Overview and Vision
- Vision: A curious, non-judgmental Internal Family Systems (IFS) companion that helps people notice, name, and relate to their internal parts, track relationships between parts, and reflect on their experiences over time.
- Product tagline: A gentle companion for getting to know your parts.
- Primary value: Guided self-reflection via chat, durable tracking of parts and relationships, and auditability/undo for agent-driven changes.

2. Problem Statement
- People practicing IFS often struggle to keep track of parts, shifting internal dynamics, and evidence for emergence. They want a low-friction way to reflect, name, patterns, and see progress—without replacing therapy.

3. Goals and Non-Goals
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

4. Target Users and Personas
- Self-guided user: familiar with IFS basics, seeks a daily reflection partner
- Therapy client: wants to capture insights between sessions
- (Future) Practitioner support role: therapist reviewing part maps co-created by the client

5. User Stories and Use Cases (MVP)
- As a user, I want to talk with a companion that reflects parts-aware language so I can explore safely.
- As a user, I want the agent to surface potential parts with evidence and ask for my confirmation before tracking anything.
- As a user, I want summary and durability—my sessions and actions are saved for later review.
- As a user, I want to see how parts relate (e.g., protectors versus exiles) and changes over time (polarization rising/falling).
- As a user, I want to undo changes the agent made if I say “that’s wrong.”

6. Scope
- MVP Scope
  - Chat with streaming assistant (Next.js 15 UI)
  - Sessions persisted; messages stored with timestamps
  - Parts data model with story, evidence log (recent evidence cap 10), confidence score
  - Relationships model with types (polarized, protector-exile, allied) and polarization level
  - Action logging for all DB mutations and rollback tools
  - Development mode for local testing with a default user id and verbose logging
- Phase 2 Scope (Insights & Garden)
  - Detailed in docs/prds/insights-prd.md; built with AI scaffolding initially (mock content)

7. Non-Functional Requirements
- Privacy & Safety: No clinical claims; clear consent and user confirmation on destructive operations. RLS in Supabase ensures data isolation per user.
- Reliability: Agent failures degrade gracefully. All mutations logged with audit trail.
- Performance: Streaming responses feel real-time.
- Accessibility: Keyboard navigation, contrast, readable fonts.

8. Success Metrics
- Engagement: DAU/WAU, average session length, number of sessions per user.
- Safety & Trust: Rate of rollbacks, user confirmations observed.
- Insight Creation: Parts created/updated, relationships logged.

9. Risks and Mitigations
- Misclassification of parts (hallucination): Enforce evidence and user confirmation; add undo.
- Privacy concerns: Clear RLS, environment variable hygiene.
- Provider dependency: Graceful error handling and fallbacks.

10. Dependencies
- Next.js 15, React 19, Tailwind
- Mastra agent framework + OpenRouter provider
- Supabase (Postgres) for persistence and RLS

11. Roadmap (high-level)
- M0: PRD and System Design for MVP.
- M1: Core plumbing for sessions, logging, rollback.
- M2: Core IFS features for part/relationship creation from chat.
- M3: Insights & Garden Scaffolding (see docs/prds/insights-prd.md).

