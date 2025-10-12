# System Design: Insights & Parts Garden

**Status:** Draft v1.0
**Date:** 2025-08-28

## 1. Overview

This document outlines the technical design for the "Insights & Parts Garden" feature set, as specified in the Product Requirements Document (PRD). The implementation will follow an **"AI Scaffolding"** model, meaning all backend and frontend infrastructure will be built to support the full feature set, but the AI-driven content generation will be mocked.

The core components of this feature set are:
1.  **A daily insight generation system.**
2.  **A user-facing "Insights Tab"** to view and interact with generated insights.
3.  **A "Parts Garden"** to view and manage discovered parts.
4.  **Backend services** to support these features.

## 2. Database Schema

Two new tables will be added to the Supabase Postgres database.

### 2.1. `insights` Table

This table stores the insights presented to the user and supports the card lifecycle (pending → revealed → actioned).

```sql
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('session_summary','nudge','follow_up','observation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','revealed','actioned')),
  content JSONB NOT NULL,   -- e.g., { "title": "...", "body": "...", "highlights": [], "sourceSessionIds": [] }
  rating JSONB NULL,        -- e.g., { "scheme": "quartile-v1", "value": 1..4, "label": "..." }
  feedback TEXT NULL,
  revealed_at TIMESTAMPTZ NULL,  -- set when the user reveals the card
  actioned_at TIMESTAMPTZ NULL,  -- set when the user submits rating/feedback
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_insights_user ON insights(user_id);
CREATE INDEX idx_insights_user_status ON insights(user_id, status);
CREATE INDEX idx_insights_user_status_created ON insights(user_id, status, created_at DESC);
```
**Justification:**
- JSONB for `content` allows flexible card layouts without schema churn.
- JSONB for `rating` allows different rating schemes (e.g., quartiles now, other scales later) without migrations.
- `revealed_at` separates “opening the card” from actioning it.
- Status is intentionally minimal for MVP (no dismissed/denied). Cards persist until actioned.

Daily top-up is aligned to the user's timezone (users.settings.timezone) by a background job (out of scope for this change). A JIT top-up option is also available if the background job fails.

### 2.2. `potential_refinements` Table

This table supports the "Patient Persistence" logic for Part Refinement suggestions that the user denies.

```sql
CREATE TABLE potential_refinements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    suggestion_details JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'denied' CHECK (status IN ('denied', 're-evaluating')),
    denied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_evaluated_at TIMESTAMP WITH TIME ZONE
);
```
**Justification:**
- This table prevents the system from losing valuable (but unconfirmed) hypotheses from the AI.
- It allows the system to implement a "cool-down" period and re-evaluate suggestions when more evidence is gathered, making the AI feel more patient and intelligent.

## 3. Backend Architecture

### 3.1. Mock Insight Generation Service

A new daily job will be responsible for populating the `insights` table.

- **Trigger:** Vercel Cron job (`vercel.json` schedule `0 8 * * *`).
- **Logic:**
    1. For each active user, check the number of `pending` insights.
    2. If fewer than 3, calculate how many new insights to generate.
    3. Call a `mockInsightGenerator()` function.
    4. This function will contain business logic to decide which type of mock insight to create (e.g., 70% `session_summary`, 15% `part_discovery`, 10% `nudge`, 5% `follow_up`).
    5. The function will return placeholder content for the chosen type (e.g., "This is a placeholder for a Part Discovery card.").
    6. The service will insert the new mock insight(s) into the `insights` table.

### 3.2. API Endpoints

A set of new API endpoints will be created to support the frontend.

**1. Fetch Insights**
- `GET /api/insights`
- **Response:** A JSON array of the user's pending insights.
```json
[
  {
    "id": "...",
    "type": "session_summary",
    "content": "This is a placeholder for a session summary insight."
  }
]
```

**2. Submit Insight Feedback**
- `POST /api/insights/[id]/feedback`
- **Request Body:**
```json
{
  "rating": 4,
  "feedback": "This was helpful."
}
```
- **Action:** Updates the corresponding row in the `insights` table, setting its status to `actioned`.

**3. Part Discovery/Refinement Flow**
- `POST /api/parts/confirm-discovery`
- **Request Body:**
```json
{
  "insightId": "...",
  "confirmation": true,
  "partDetails": { "name": "The Procrastinator", "description": "..." }
}
```
- **Action:** If `confirmation` is true, creates a new entry in the `parts` table. Updates the insight status.

## 4. Frontend Architecture

### 4.1. `Insights` Page (`/insights`)
- **Container Component:** `InsightsPage.tsx`
    - Fetches data from the `GET /api/insights` endpoint.
    - Manages the state of the insights queue.
    - Renders a list of `InsightCard` components.
- **Presentational Component:** `InsightCard.tsx`
    - Receives a single insight object as a prop.
    - Renders the `content` of the insight.
    - Contains the UI for rating and feedback.
    - Calls the `POST /api/insights/[id]/feedback` endpoint on submission.
    - Will have specialized variants for `part_discovery` and `part_refinement` types, presenting different UI and actions.

### 4.2. `PartsGarden` Page (`/garden`)
- **Container Component:** `PartsGardenPage.tsx`
    - Fetches a list of all confirmed parts for the user from a new `/api/parts` endpoint.
    - Renders a grid or list of `PartCard` components.
- **Presentational Component:** `PartCard.tsx`
    - Displays a summary of a single part (e.g., name, emoji).
    - Links to the `PartDetailPage`.

### 4.3. `PartDetail` Page (`/garden/[partId]`)
- **Container Component:** `PartDetailPage.tsx`
    - Fetches detailed information for a single part from `/api/parts/[partId]`.
    - Renders the part's story, attributes, and a timeline of its interactions.
    - Includes the "Chat with this Part" button.

## 5. Data Flow Diagram: Insight Feedback Loop

```mermaid
sequenceDiagram
    participant User
    participant Browser (React App)
    participant API Server
    participant Database

    User->>Browser: Views /insights page
    Browser->>API Server: GET /api/insights
    API Server->>Database: SELECT * FROM insights WHERE user_id = ? AND status = 'pending'
    Database-->>API Server: Returns insights data
    API Server-->>Browser: Returns JSON
    Browser->>User: Renders Insight Cards

    User->>Browser: Rates and provides feedback on a card
    Browser->>API Server: POST /api/insights/[id]/feedback
    API Server->>Database: UPDATE insights SET status='actioned', rating=?, feedback=? WHERE id = ?
    Database-->>API Server: Success
    API Server-->>Browser: Success
    Browser->>User: Hides or updates the card UI
```
