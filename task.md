# Task: Implement the User Memory System (Backend MVP)

## 1. High-Level Goal

The primary goal of this task is to implement a backend system for a differential user memory. This system will create and maintain an intelligent, evolving summary of a user's state, which can be used by other services and AI agents in the future. This summary acts as a central "hub" of understanding the user, with links to more granular data sources (the "spokes").

## 2. Core Architecture: Differential Snapshots

The system will be built using a "differential snapshot" approach.

- **Rationale:** Instead of storing a full copy of the user's memory every time it's updated, we will only store the *changes* from the previous version. This is highly efficient for storage and for an AI agent's context window, as it can be fed only the most recent changes.
- **Mechanism:** Changes will be stored using the **JSON Patch (RFC 6902)** standard. This provides a robust, standardized way to represent diffs in a JSON structure.
- **Checkpoints:** To ensure read performance doesn't degrade over time, the system will periodically store a full snapshot of the memory state (e.g., every 50 versions). This acts as a checkpoint for faster reconstruction.

## 3. Database Schema

A new table, `user_memory_snapshots`, must be created. This can be done by creating a new migration file in `supabase/migrations/`.

**Migration SQL:**
```sql
-- User Memory System Schema
-- Migration: 006_user_memory
-- Created: 2025-08-28

-- Table: user_memory_snapshots
CREATE TABLE IF NOT EXISTS user_memory_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  patch jsonb NOT NULL,
  is_full_snapshot boolean NOT NULL DEFAULT FALSE,
  full_snapshot_content jsonb NULL,
  source_description text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Make sure version is unique per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_snapshots_user_version ON user_memory_snapshots(user_id, version);

-- Add other useful indexes
CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_user_id ON user_memory_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_user_created_at ON user_memory_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_checkpoints ON user_memory_snapshots(user_id, created_at DESC) WHERE is_full_snapshot = TRUE;


-- RLS
ALTER TABLE user_memory_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own memory snapshots"
  ON user_memory_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory snapshots"
  ON user_memory_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory snapshots"
  ON user_memory_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory snapshots"
  ON user_memory_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE user_memory_snapshots IS 'Stores the history of a user''s memory as differential snapshots (JSON Patches).';
COMMENT ON COLUMN user_memory_snapshots.version IS 'A sequential version number for each user''s memory history.';
COMMENT ON COLUMN user_memory_snapshots.patch IS 'A JSON Patch (RFC 6902) object describing the change from the previous version.';
COMMENT ON COLUMN user_memory_snapshots.is_full_snapshot IS 'If TRUE, this row is a checkpoint containing the full memory state.';
COMMENT ON COLUMN user_memory_snapshots.full_snapshot_content IS 'The full memory state, only present for checkpoints (when is_full_snapshot is TRUE).';
```

## 4. Memory Content Schema (MVP)

The JSON object representing the user's memory should adhere to the following structure for the MVP.

```json
{
  "version": 1,
  "last_updated_by": "system",
  "summary": "High-level text summary of the user's state.",
  "parts": {
    "part_id_1": {
      "name": "Inner Critic",
      "status": "active",
      "recency_score": 0.9,
      "influence_score": 0.7,
      "goals": [
        { "goal": "To feel safer during presentations." }
      ]
    }
  },
  "triggers_and_goals": [
    {
      "trigger": "Public speaking",
      "desired_outcome": "Feel calm and confident",
      "related_parts": ["part_id_1"]
    }
  ],
  "safety_notes": "Important reminders for the agent when interacting with this user."
}
```

## 5. The Update Process

The memory should be updated via a daily, automated job.

- **Trigger:** The job should run once per day for every user who has had activity (new sessions, insight interactions, etc.) in the last 24 hours.
- **Mechanism:** This is an LLM-driven process.
    1.  The job retrieves the user's current memory state by reconstructing it from the snapshots.
    2.  It gathers all new user data from the day.
    3.  It formats the current memory and the new data into a prompt for an LLM (a "summarizer agent").
    4.  The LLM returns a *new, updated JSON object* representing the desired future state of the memory.
    5.  The backend service then compares the old and new JSON objects to generate a JSON Patch.
    6.  This patch is saved as a new version in the `user_memory_snapshots` table.

## 6. High-Level Implementation Plan

1.  **Database Migration:** Create and apply the migration for the `user_memory_snapshots` table as specified above.
2.  **Backend Service (Memory Logic):**
    -   Implement a service in `lib/memory/` or a similar location.
    -   Create the `reconstruct_memory(user_id)` function to get the latest state from the snapshots.
    -   Create the `generate_memory_update(user_id)` function to perform the core logic of gathering data, calling the LLM, and generating the patch.
    -   Create the `save_new_snapshot(user_id, patch)` function to store the new version.
3.  **Scheduler/Cron Job:**
    -   Implement an API route (e.g., in `app/api/cron/memory-update/route.ts`) that can be called by a scheduler.
    -   This route should contain the logic to find active users and trigger the update process for each.
4.  **Testing:**
    -   Add robust unit tests for the patch generation and application logic.
    -   Add integration tests for the end-to-end update flow.

## 7. Scope

### In Scope for this Task:
- All backend infrastructure for the user memory system as described above.
- Creating the database migration.
- Implementing the services for memory reconstruction, update generation, and storage.
- Setting up the daily cron job handler.

### Out of Scope for this Task:
- Building the conversational agent's tools to use this system (e.g., `get_user_memory`).
- Implementing citations within the memory object. This is deferred for a future version.
- Building any front-end UI to display the user memory.
