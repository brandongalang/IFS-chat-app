# Inbox Feature Overview

The Inbox surface ships incrementally: a pragmatic Next.js API route that unblocks UX work today and a clean Supabase pipeline that can replace it without touching the frontend. This document consolidates system architecture, frontend behavior, and backend implementation details that were previously scattered across `/be-pragmatic`, `/be-clean`, `/fe`, and `/sys-arch`.

## Architecture Snapshot
- The frontend consumes a stable `InboxEnvelope` contract rendered through the registry-driven `InboxShelf` surface.
- Data sources are swappable: the pragmatic API route is production-ready today, while the clean Supabase edge pipeline delivers normalized data with richer analytics once migrations finish.
- Analytics instrumentation (`emitInboxEvent`) keeps UX and backend telemetry aligned across both pipelines.

| Aspect | Pragmatic (Next.js API) | Clean (Supabase Edge) |
| --- | --- | --- |
| Delivery | Static JSON feed via `getPragmaticInboxFeed()` | Edge function joins normalized tables with per-user filters |
| Latency | Served from Vercel edge/cacheable responses | Close to data, leverages Supabase region locality |
| Personalization | Manual extension or query params | SQL filters + RLS for full fidelity |
| Reaction Logging | Session-only (no durable store yet) | `inbox_message_events` table with policy-aligned inserts |
| Effort | ✅ Ready now | 🚧 Requires migration + ops playbook |

## Pragmatic Backend (Next.js API)
- Ships `/api/inbox` powered by `lib/inbox/pragmaticData`, guaranteeing contract safety even when mocks drive the feed.
- Mock data lives alongside network logic so card types can be toggled quickly during iteration.
- Designed to swap in Supabase RPC later by replacing `getPragmaticInboxFeed()`.

**Open questions**
- Should the pragmatic feed expose personalization via query params before the clean backend lands?
- Is dismissal persistence required in this path, or can we keep it session-only?

**Verification**
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Unit safety comes from `scripts/tests/unit/inbox-normalize.test.ts`.

## Clean Supabase Backend
- Normalized tables (`inbox_message_subjects`, `inbox_message_payloads`, `inbox_message_events`) power personalized feeds.
- Edge function scaffolding maps SQL rows into the shared `InboxEnvelope` contract before normalizing with existing frontend utilities.
- Supabase service-role helper (`createSupabaseClient`) keeps secrets and RLS policies centralized for serverless contexts.

**Reaction logging plan**
- `inbox_message_events` tracks `delivered`, `opened`, `dismissed`, and `cta_clicked` with flexible JSON attributes.
- The `logInboxReaction` helper records events from Next.js routes or Supabase Edge Functions.
- Analytics pipelines can later sink events into ClickHouse/BigQuery without changing the contract.

**Open questions**
- Should insight spotlight payloads be denormalized for faster reads or stay JSON for flexibility?
- What expiration or archival strategy should run after `expires_at` (cron job vs trigger)?

**Reference assets**
- Schema: [`schema.sql`](./clean-backend/schema.sql)
- Edge function handler: [`edge-function.ts`](./clean-backend/edge-function.ts)
- Supabase client helper: [`supabaseClient.ts`](./clean-backend/supabaseClient.ts)

## Frontend Shelf Implementation
- Today page replaces the meditation card with `InboxShelf`, a reusable surface in `components/inbox/` backed by `useInboxFeed`.
- Shared typing contracts live in `types/inbox.ts`, with analytics stubs and normalization utilities ensuring resilient rendering.
- Insight spotlight cards include an accessible modal detail view styled with Tailwind tokens.

**Open questions**
- Do we promote multiple inbox cards on the Today grid or keep a single spotlight for MVP?
- Should `useInboxFeed` expose pagination metadata now or defer until additional card types exist?

**Verification**
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Visual spot-check recommended once the dev server is running.

## Migration Checklist
1. Ship pragmatic route to unblock Today page testing and iteration.
2. Begin Supabase migration so the clean pipeline can replace the pragmatic feed without frontend changes.
3. Keep the pragmatic endpoint as a fallback for unauthenticated/dev flows when the clean path is live.
4. Align analytics taxonomy between `emitInboxEvent` and `inbox_message_events` before GA.
5. Add pagination cursor support in `InboxFeedResponse` once more than five envelopes per user are enabled.
