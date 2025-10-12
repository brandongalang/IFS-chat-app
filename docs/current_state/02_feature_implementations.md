# Current Feature Implementations

This document describes the features of the IFS Therapy Companion application that are currently implemented. It is intended for new technical and product team members who want to understand what the application can do *today*.

## Overview

The primary implemented feature is the core conversational experience, where a user can interact with the AI agent to discover, define, and manage their internal "parts" and the relationships between them. The system is built around a "human-in-the-loop" model, where the AI makes suggestions and the user provides confirmation.

Several features from the product vision, particularly those related to fully automated discovery and insight generation, are either partially implemented or not yet started.

## Core Feature: Conversational Part Discovery & Management

The main user-facing feature is the chat interface. The agent's capabilities within this chat are defined by its available tools.

### Agent Capabilities (Implemented via Tools)

-   **Part & Relationship Management (`part-tools.ts`):**
    -   `searchPartsTool`: Search for existing parts by name, role, status, or category.
    -   `getPartByIdTool`: Retrieve detailed information for a single, known part.
    -   `createEmergingPartTool`: Create a new part in the database. Crucially, this tool has a hard-coded requirement for `userConfirmed: true`, meaning the agent cannot create a part without the user explicitly agreeing to it in the conversation.
    -   `updatePartTool`: Modify attributes of an existing part (e.g., changing its category from 'unknown' to 'manager').
    -   `getPartRelationshipsTool` & `logRelationshipTool`: List, create, and update the relationships between parts, including their type (`polarized`, `allied`) and status.

-   **Evidence & Pattern Analysis (`evidence-tools.ts`):**
    -   `logEvidence`: Add a specific piece of evidence (e.g., a direct quote) to an *existing* part's profile.
    -   `findPatterns`: Scans recent session snapshots via the StorageAdapter for regex patterns that suggest part language (e.g., "part of me feels..."). This is a standalone analysis tool and is not currently integrated into the agent's main conversational loop.

-   **Research Helpers (`insight-research-tools.ts`):**
    -   `getRecentSessions`: Retrieves session snapshots for a user through the StorageAdapter, filtered by lookback window and limit.
    -   `getActiveParts`, `getPolarizedRelationships`, `getRecentInsights`: Query Supabase for other research data.

-   **Confidence & Workflow Management:**
    -   `recordPartAssessmentTool` (`assessment-tools.ts`): Records a confidence score for a part's identification, creating an entry in the `part_assessments` table and updating the part's `confidence` field.
    -   `proposalTools` (`proposal-tools.ts`): A suite of tools (`proposePartSplit`, `approveProposal`, `executeSplit`, etc.) that manage a safe, multi-step workflow for complex operations like merging two parts into one.
    -   `rollbackTools` (`rollback-tools.ts`): A critical set of tools (`getRecentActions`, `rollbackAction`) that allow the agent to undo its own actions by reversing transactions logged in the `agent_actions` table.

### Example Workflow: Creating a New Part

1.  **User:** "I feel like a part of me is a harsh critic, always judging what I do."
2.  **Agent:** "That sounds important. It seems like a 'Critic' part might be present. Would you like me to create an entry for this part so we can explore it further?"
3.  **User:** "Yes, that sounds right."
4.  **Agent (Internal Action):** The agent now has user confirmation. It calls the `createEmergingPartTool` with the required `userConfirmed: true` parameter.
5.  **Tool Execution:** The tool creates a new row in the `parts` table with the name "Critic" and a status of "emerging." It also logs this action in the `agent_actions` table.
6.  **Agent (Response):** "Great. I've made a note of the Critic part. We can now add details to its profile or explore its role in your system."

## Current Features (Index)

This section provides a quick, human-readable map of shipped and in-progress features. Each entry links to a canonical feature page with full details and code anchors.

- Parts Garden — Visual exploration UI for Parts. Status: shipped (enabled by default; gate environments with `ENABLE_GARDEN=false`). See docs/features/parts-garden.md
  - Key routes: /garden, /garden/[partId]. Key paths: app/garden/*, components/garden/*
- Guided Check-ins — Morning and evening structured flows. Status: shipped. See docs/features/check-ins.md
  - Key routes: /check-in/morning, /check-in/evening. Key paths: app/check-in/*, components/check-in/*
- Chat — Conversational interface. Status: shipped. See docs/features/chat.md
  - Key route: /chat. Key paths: app/chat/page.tsx, hooks/useChat.ts, lib/database/*
- Authentication (Google) — OAuth via Google with Supabase session sync. Status: shipped. See docs/features/authentication-google.md and docs/runbooks/supabase-session-sync.md
  - Key paths: components/auth/*, app/auth/callback/route.ts, components/auth/supabase-session-listener.tsx, supabase/migrations/007_handle_new_users.sql
- Onboarding Flow — Staged questionnaire with adaptive Stage 2 and completion summary hand-off. Status: shipped. See docs/features/onboarding.md
  - Key paths: app/onboarding/page.tsx, components/onboarding/*, app/api/onboarding/*, lib/onboarding/*
- Agent Tools — Mastra tools and agent definitions. Status: shipped. See docs/features/agent-tools.md
  - Key paths: mastra/tools/*, mastra/agents/*
- Insights — Scaffolding for insights generation. Status: experimental. See docs/features/insights.md
  - Key paths: app/api/insights/*, lib/insights/generator.ts
- Memory Updates — Daily refresh pipeline for user memory snapshots. Status: shipped. See docs/user-memory.md and docs/runbooks/memory-cron-vercel.md
  - Key paths: app/api/cron/memory-update/route.ts, lib/memory/*, lib/api/cron-auth.ts, vercel.json

## Implementation Gaps & In-Progress Features

The following features from the product vision are not yet fully implemented. This is a critical distinction for understanding the current user experience.

### 1. Automated Part Detection ("Discovery Flow")

-   **Current State:** Part detection is **not** automated or real-time as envisioned. The process is manual and confirmation-based, as shown in the example workflow above. The vision of "inline highlighting" of potential parts as the user types is not implemented.
-   **Technical Gap:** The `findPatterns` tool provides a basic, heuristic-based method for identifying potential parts from past conversations. However, it is not called by the main `/api/chat` agent. To implement the vision, a new client-side or server-side mechanism would be needed to run a lightweight model on the user's input in real-time and display the results in the UI.

### 2. Insight Generation ("Integration Flow")

-   **Current State:** This feature is **not implemented**.
-   **Technical Gap:** The agent has no tools for performing the synthesis required to generate high-level insights (e.g., "Your Critic appears most often on Sundays"). The `insights` API routes and database table exist as placeholders, but the core analytical logic to populate them has not been built.

### 3. Session Summaries & Analysis

-   **Current State:** The agent does not create summaries or analyze sessions.
-   **Technical Gap:** While the `sessions` table has columns for `summary`, `emotional_arc`, and `breakthroughs`, the agent has no tools to populate this data. A new tool would need to be created that can take a session's message history and generate these summary artifacts.
