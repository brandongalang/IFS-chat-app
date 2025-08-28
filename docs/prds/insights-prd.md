# Insights PRD (MVP)

Status: Draft v0.1
Owner: Product + Engineering
Date: 2025-08-28

1. Overview and Goals
- Deliver an MVP “Insights” system comprised of:
  - A backend table to store insights with flexible JSON payloads
  - A simple card lifecycle: pending → revealed → actioned
  - APIs to fetch active insights, reveal a card, and submit rating/feedback
  - Optional JIT top-up as a fallback when the background job fails
- Non-goals (MVP): Parts discovery/refinement flows, cool-down, analytics dashboards

2. User Value
- Provide short, digestible reflections that the user can consider at their own pace
- Allow the user to acknowledge and rate resonance without forcing a binary decision
- Keep the system resilient: cards persist until actively handled

3. Key Requirements
3.1 Card lifecycle
- pending: created and available to be shown; not yet opened
- revealed: user opened the card; can think about it before acting
- actioned: user submitted rating (and optional feedback); slot becomes empty

3.2 Rating philosophy
- Spectrum rating (no neutral) to avoid ambiguous “middle” selection
- JSON storage so we can evolve the scheme per insight type
- Initial recommended shape: { scheme: "quartile-v1", value: 1..4, label?: string }

3.3 Daily slots
- Up to 3 active cards per user (pending or revealed) at any time
- If a card isn’t used, it persists; no auto-replacement within the day
- Daily top-up aligned to the user’s local day boundary (users.settings.timezone) via a background job
- Optional JIT top-up from the GET endpoint (env-gated) when the job fails

4. Data Model
- Table: insights
  - id (uuid, PK)
  - user_id (uuid, FK users, CASCADE)
  - type (text enum: session_summary | nudge | follow_up | observation)
  - status (text enum: pending | revealed | actioned)
  - content (jsonb): { title, body, highlights?, sourceSessionIds? }
  - rating (jsonb | null): { scheme, value, label? }
  - feedback (text | null)
  - revealed_at (timestamptz | null)
  - actioned_at (timestamptz | null)
  - meta (jsonb): { generator: "cron|jit", version, etc. }
  - created_at, updated_at (timestamptz)
- Indexes:
  - (user_id), (user_id, status), (user_id, status, created_at DESC)
- RLS: user-owned rows only

5. APIs
- GET /api/insights?limit=3&includeStatus=pending,revealed&jit=false
  - Returns up to 3 active cards, ordered: revealed first, then oldest pending
  - If jit=true and IFS_INSIGHTS_JIT='true', attempts to fill to the requested limit
- POST /api/insights/[id]/reveal
  - Idempotent transition from pending → revealed, sets revealed_at
- POST /api/insights/[id]/feedback
  - Body: { rating: { scheme, value, label? }, feedback? }
  - Sets status='actioned' and actioned_at; updates rating/feedback

6. UX Notes
- The Insights tab lists up to three cards
- Tapping a card reveals it (if pending), moving it to revealed state
- Rating uses a 4-point slider (no neutral). Text feedback is optional
- Revealed-but-unrated cards persist across days

7. Operational Model
- Background job: at daily boundary in user’s timezone, top-up active slots to three (if possible)
- JIT top-up: optional fallback on GET when the job failed and capacity is below target
- Logging/observability can be added later (e.g., action logs for reveal/action)

8. Risks and Mitigations
- Low card quality (mock phase): keep content JSON flexible; iterate copy quickly
- Starvation when job fails: enable JIT fallback (env-gated) to top-up on demand
- Over-notifying: revealed state lets users pace themselves; no forced dismissals

9. Future Extensions (out of scope for this PR)
- Parts discovery/refinement suggestions + cool-down/resubmission
- Insight categories and personalized weighting
- Multi-axis ratings (e.g., resonance and clarity)
- Analytics on engagement and outcomes

10. Acceptance Criteria
- Migration adds insights table with JSON content and rating, status lifecycle, and RLS
- GET returns ≤3 active insights in correct order; JIT works when enabled
- POST reveal idempotently sets revealed state; POST feedback idempotently actioned
- Docs updated: System Design, README, and this PRD

