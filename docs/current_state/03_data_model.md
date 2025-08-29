# Current Data Model

This document describes the application's data model as implemented in the Supabase PostgreSQL database. The schema is defined via a series of SQL migration files located in `supabase/migrations/`.

## Overview

The data model is designed to be a comprehensive representation of a user's internal psychological system as understood through IFS principles. It is relational, with extensive use of JSONB columns for flexible, semi-structured data. All tables are protected by Row Level Security (RLS) to ensure data privacy.

## Core Tables

#### `users`
Stores user profile information, authentication details (via Supabase Auth), and user-level settings and statistics.

-   **Key Columns:**
    -   `id (UUID)`: Primary key, linked to `auth.users.id`.
    -   `settings (JSONB)`: Stores user preferences like `privacyMode` and `aiDepth`.
    -   `stats (JSONB)`: Stores aggregated stats like `totalParts` and `totalSessions`.

#### `parts`
The central table of the application. Each row represents a single internal "part" identified by a user.

-   **Key Columns:**
    -   `id (UUID)`: Primary key.
    -   `user_id (UUID)`: Foreign key to `users.id`.
    -   `name (TEXT)`: The user-given name for the part (e.g., "The Critic").
    -   `status (TEXT)`: The part's lifecycle stage (`emerging`, `acknowledged`, `active`, `integrated`).
    -   `category (TEXT)`: The IFS category (`manager`, `firefighter`, `exile`, `unknown`).
    -   `confidence (FLOAT)`: The AI's confidence in this part's identification (0.0 to 1.0).
    -   `recent_evidence (JSONB)`: A JSON array storing the last 10 pieces of evidence (e.g., direct quotes) that support this part's existence.
    -   `relationships (JSONB)`: A flexible field for storing metadata about the part's lineage, such as which part it was `superseded_by` in a merge operation.

#### `sessions`
Records each conversational session a user has with the agent.

-   **Key Columns:**
    -   `id (UUID)`: Primary key.
    -   `user_id (UUID)`: Foreign key to `users.id`.
    -   `messages (JSONB)`: A JSON array storing the full message history of the session, including the role (`user` or `assistant`) and content of each message.

#### `part_relationships`
Models the connections and dynamics between different parts for a user.

-   **Key Columns:**
    -   `id (UUID)`: Primary key.
    -   `parts (JSONB)`: A JSON array containing the two `part.id` UUIDs that are involved in this relationship.
    -   `type (TEXT)`: The nature of the relationship (`polarized`, `protector-exile`, `allied`).
    -   `dynamics (JSONB)`: A JSON array logging specific interactions or observations about this relationship over time.

## Supporting Tables & Data Flow

Several other tables exist to support the agent's advanced functionality.

-   **`agent_actions`**: This is a critical table that functions as an audit log. Every significant, data-mutating action taken by an agent tool is logged here.
    -   **Data Flow:** When a tool like `updatePartTool` is called, it wraps the database `UPDATE` call with the `actionLogger`. The logger first records the `old_state` of the row, then performs the update, and finally records the `new_state` in a single row in `agent_actions`. The `rollbackAction` tool can then use this row to reverse the operation.
-   **`part_assessments`**: Stores records of confidence assessments for a given part, including the score, rationale, and source (`human` or `agent_llm`). This provides a historical record of how the confidence in a part has evolved.
-   **`part_change_proposals`**: This table supports the multi-step workflow for splitting or merging parts. It stores the proposal details and its status (`pending`, `approved`, `executed`), acting as a state machine for these complex operations.

## Schema Implementation Status

While the database schema is very comprehensive, not all columns and tables are actively being written to by the current application logic. This is key for any developer to know before they try to use this data.

-   **`insights` Table:** This table is **unused**. It exists as a placeholder for the future Insight Generation feature, which is not implemented.
-   **`user_memory` Table:** This table is **unused**. The cron job that would populate it is not active.
-   **Columns in the `sessions` Table:** The following columns are defined but are **never populated** by the current agent:
    -   `summary`
    -   `breakthroughs`
    -   `emotional_arc`

    As detailed in the `02_feature_implementations.md` document, the agent currently has no tools to perform the necessary analysis to generate and save this summary data. Any feature relying on this data will require a new agent tool to be built first.
