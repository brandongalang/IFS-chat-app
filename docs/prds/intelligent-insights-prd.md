# PRD: Intelligent Insight Generation System

**Status:** Implemented
**Owner:** Product + Engineering
**Date:** 2025-08-30

## 1. Overview and Goal

To provide users with timely, relevant, and high-quality reflections ("insights," "nudges," or "questions") based on their activity within the app. The primary goal is to deepen user engagement and self-reflection without causing "insight fatigue." The system should feel like a thoughtful, proactive assistant that respects the user's space but also provides opportunities for deeper engagement when the user is ready.

## 2. The Model: "Thoughtful Assistant with an Optional Boost"

The system is built on a hybrid model that combines a low-volume, proactive insight stream with a user-controlled, on-demand feature.

### 2.1. The Default Cadence: The "Thoughtful Overnight Assistant"

This is the baseline experience for all users, designed to be proactive but respectful.

*   **Trigger:** A daily background job runs for each user.
*   **Recency Gate:** The job first checks for meaningful user activity in the last 24 hours (e.g., new chat sessions). If there is no activity, the job exits. This ensures insights are always relevant to recent events.
*   **Quality Gate:** The job uses an intelligent agent to look for "insight-worthy" moments. If no high-quality opportunities are found, the agent generates **zero** insights. This prioritizes signal over noise.
*   **Cool-down:** When an insight *is* generated, a system-wide cool-down (e.g., 48-72 hours) is initiated for that user, during which the daily job will not generate new insights. This gives the user space to reflect.

The result is a slow, thoughtful trickle of 1-3 high-quality insights per week for an active user.

### 2.2. The User-Controlled "Boost": Request an Insight

This feature gives the user agency over the rate of insights.

*   **Trigger:** A "Request an Insight" button in the UI.
*   **Action:** When clicked, the system immediately triggers the Insight Generation Agent to find a new insight for the user, bypassing the daily job's cool-down.
*   **Cadence:** The button has its own simple cool-down (e.g., can be used once every 24 hours) to encourage mindful use.

## 3. The Insight Generation Agent

The core of the system is a Mastra agent designed as a "Researcher/Hypothesis Writer."

*   **Phase 1: Research:** The agent uses a set of specialized tools to query the database for the user's recent sessions, active parts, polarized relationships, and recent insights.
*   **Phase 2: Writing:** After completing its research, the agent analyzes its findings using a "Playbook" of strategies to identify opportunities. It then formulates these opportunities into gentle, provocative nudges or questions.

### 3.1. The Playbook

The agent's "Playbook" contains a set of strategies for finding insights, including:
*   **"New Part Candidate":** Identifying recurring themes that may represent a new, undefined part.
*   **"Relationship Tension":** Probing the dynamics of a polarized relationship between two parts.
*   **"Dormant Part Check-in":** Re-engaging with a part that has not been active recently.
*   **"Session Follow-up":** Helping the user integrate a key moment from a recent session.

## 4. Insight Types

The `insights` table supports the following types:
*   `session_summary`
*   `nudge`
*   `follow_up`
*   `observation`
*   `question` (newly added)

## 5. Technical Implementation

*   **On-Demand Endpoint:** `POST /api/insights/request`
*   **Cron Job Endpoint:** `GET /api/cron/generate-insights`
*   **Agent Definition:** `mastra/agents/insight-generator.ts`
*   **Agent Tools:** `mastra/tools/insight-research-tools.ts`
*   **Database Migration:** `supabase/migrations/005_insights.sql`
*   **Test Script:** `scripts/smoke-test-insights.ts`
