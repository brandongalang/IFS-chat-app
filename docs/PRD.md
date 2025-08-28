# Moved

This document has been replaced by docs/overview.md and docs/prds/insights-prd.md.

## 1. Overview and Vision
- **Vision:** A curious, non-judgmental Internal Family Systems (IFS) companion that helps people notice, name, and relate to their internal parts, track relationships between parts, and reflect on their experiences over time.
- **Product tagline:** A gentle companion for getting to know your parts.
- **Primary value:** Guided self-reflection via chat, durable tracking of parts and relationships, and auditability/undo for agent-driven changes.

## 2. Problem Statement
- People practicing IFS often struggle to keep track of parts, shifting internal dynamics, and evidence for emergence. They want a low-friction way to reflect, name patterns, and see progress—without replacing therapy.

## 3. Goals and Non-Goals
- **Goals (MVP)**
  - Conversational companion with IFS-informed tone and prompts
  - Track parts (emerging → acknowledged → active → integrated)
  - Persist chat sessions and messages
  - Log and audit agent actions with ability to rollback
  - Represent and query relationships (polarized, protector-exile, allied)
  - Strict evidence and confirmation before creating new parts (safety)
- **Non-Goals**
  - Provide clinical diagnosis or therapy
  - Replace professional therapeutic relationship

## 4. Target Users and Personas
- **Self-guided user:** familiar with IFS basics, seeks a daily reflection partner
- **Therapy client:** wants to capture insights between sessions
- **(Future) Practitioner support role:** therapist reviewing part maps co-created by the client

## 5. User Stories and Use Cases (MVP)
- As a user, I want to talk with a companion that reflects parts-aware language so I can explore safely.
- As a user, I want the agent to surface potential parts with evidence and ask for my confirmation before tracking anything.
- As a user, I want summary and durability—my sessions and actions are saved for later review.
- As a user, I want to see how parts relate (e.g., protectors versus exiles) and changes over time (polarization rising/falling).
- As a user, I want to undo changes the agent made if I say “that’s wrong.”

## 6. Scope
- **MVP Scope**
  - Chat with streaming assistant (Next.js 15 UI)
  - Sessions persisted; messages stored with timestamps
  - Parts data model with story, evidence log (recent evidence cap 10), confidence score
  - Relationships model with types (polarized, protector-exile, allied) and polarization level
  - Action logging for all DB mutations and rollback tools
  - Development mode for local testing with a default user id and verbose logging
- **Phase 2 Scope (Insights & Garden)**
  - This is detailed in **Attachment A** of this document. The implementation will follow an "AI Scaffolding" model, where all UI and data flows are built, but the AI-driven content generation is mocked.

## 7. Functional Requirements (MVP)
- **Chat:** Renders chat UI with streaming tokens, persists messages.
- **Sessions:** Create, update, and retrieve sessions and messages.
- **Parts:** Create emerging part only with >= 3 evidence items AND explicit user confirmation. Update attributes.
- **Relationships:** Create/update pairwise relationships among parts.
- **Action Logging and Rollback:** Log all mutations, provide rollback capability.
- **Development mode:** Enable local testing without auth.

## 8. Non-Functional Requirements
- **Privacy & Safety:** No clinical claims; clear consent and user confirmation on destructive operations. RLS in Supabase ensures data isolation per user.
- **Reliability:** Agent failures degrade gracefully. All mutations logged with audit trail.
- **Performance:** Streaming responses feel real-time.
- **Accessibility:** Keyboard navigation, contrast, readable fonts.

## 9. Success Metrics
- **Engagement:** DAU/WAU, average session length, number of sessions per user.
- **Safety & Trust:** Rate of rollbacks, user confirmations observed.
- **Insight Creation:** Parts created/updated, relationships logged.

## 10. Risks and Mitigations
- **Misclassification of parts (hallucination):** Enforce evidence and user confirmation; add undo.
- **Privacy concerns:** Clear RLS, environment variable hygiene.
- **Provider dependency:** Graceful error handling and fallbacks.

## 11. Dependencies
- Next.js 15, React 19, Tailwind
- Mastra agent framework + OpenRouter provider (for future AI integration)
- Supabase (Postgres) for persistence and RLS

## 12. Milestones and Roadmap (proposal)
- **M0 (Complete):** PRD and System Design for MVP.
- **M1 (Complete):** Core plumbing for sessions, logging, rollback.
- **M2 (Complete):** Core IFS features for part/relationship creation from chat.
- **M3 (Next Up):** Insights & Garden Scaffolding (detailed in Attachment A).

---

# Attachment A: Phase 2 Feature Set: Insights, Parts, and Garden

This section details the requirements for the next major feature set. The implementation will follow an **"AI Scaffolding"** model: all database tables, API endpoints, and UI components will be fully built, but the AI-generated content will be replaced by mock data from a placeholder service. This allows for full testing of the application flow while the AI inference logic is developed separately.

## A1: The Insights System

### User Stories
- As a user, I want to receive daily, personalized reflections on my sessions and interactions so I can notice patterns and deepen my self-awareness.
- As a user, I want to give feedback on these reflections to help the system understand me better over time.
- As a user, I want the system to proactively help me identify new internal parts that I may not be aware of.
- As a user, I want the system to help me notice when my understanding of a part might need to be updated or refined.

### Functional Requirements

**F1: Insight Generation (Mock Service)**
- The system shall have a backend service that runs daily (e.g., via a cron job).
- This service will generate a queue of up to 3 "insight" cards for each user per day.
- A new insight will only be generated if a slot in the queue is empty.
- The service will use a **mock data generator** to create placeholder insights of various types. It will NOT call a real LLM.
- **Insight Types (to be mocked):**
    - `session_summary`: A reflection on a recent session.
    - `part_discovery`: A proposal for a new part the user might have.
    - `part_refinement`: A proposal for splitting or re-characterizing an existing part.
    - `nudge`: A prompt to re-engage with a part the user hasn't interacted with in a while.
    - `follow_up`: A check-in related to a breakthrough from a previous session.

**F2: Insights Tab UI**
- The `/insights` page will display the queue of pending insight cards.
- Each card will be dismissible.
- Interacting with a card (rating, feedback) "exhausts" its slot for the day. The slot will be eligible for a new insight at the next 24-hour refresh cycle.

**F3: Insight Card Interaction**
- Each insight card will have the following interactive elements:
    - A 5-point slider for the user to rate how much the insight "resonates".
    - A binary toggle/button (e.g., Thumbs Up/Down) for quick feedback.
    - An optional text area for the user to add more context or reflections.
- User feedback will be saved to the database, linked to the specific insight.

**F4: "Part Discovery" and "Part Refinement" Flows**
- Cards of type `part_discovery` or `part_refinement` will have a specialized UI.
- This UI will present the (mock) proposal and provide clear actions for the user to "Confirm" or "Deny" the suggestion.
- The system must handle user denial gracefully by logging the suggestion and entering a "cool-down" period before a similar suggestion can be made. This requires a dedicated database table for `potential_refinements`.

## A2: Guided Check-ins (Future Integration Point)

### User Stories
- As a user, I want a quick way to check in with myself in the morning and evening to foster a routine of self-reflection.
- As a user, I want these check-ins to be lightweight but also provide an opportunity to go deeper if I choose.

### Functional Requirements

**F1: The "Guided Check-in" Model**
- This feature will provide a structured, multi-step flow for morning and evening check-ins.
- **Phase 1 (Quick Scan):** A series of simple prompts (e.g., mood rating, setting an intention) to gather structured data.
- **Phase 2 (Optional "Dive Deeper"):** After the scan, the user is offered the chance to start a short, focused chat session pre-contextualized with their check-in answers.
- **Data Source:** The data from these check-ins will be a primary source for generating insights in the future.
- **Implementation Note:** For the scaffolding phase, the UI for the "Quick Scan" can be built, and the "Dive Deeper" can link to the main chat page.

## A3: The Parts Garden

### User Stories
- As a user, I want a dedicated space where I can see all of my discovered parts in one place.
- As a user, I want to be able to explore the history, story, and relationships of each of my parts.
- As a user, I want an easy way to initiate a conversation focused on a specific part.

### Functional Requirements

**F1: Parts Garden UI**
- A new page (e.g., `/garden`) will display a gallery of all the user's confirmed parts.
- Parts created through the mock "Part Discovery" flow will appear here.

**F2: Part Detail Page**
- Clicking on a part in the garden will navigate to a dedicated detail page for that part.
- This page will display all known information about the part, including its story, triggers, and relationships.
- It will also feature a timeline of all interactions (sessions, check-ins) where this part was active.

**F3: Part-Specific Chat**
- The Part Detail page will include a button to "Chat with this Part."
- In the scaffolding phase, this will link to the main chat. In the future, it will initiate a chat session with the LLM's context focused on that specific part.
