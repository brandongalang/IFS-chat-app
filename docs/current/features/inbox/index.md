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
| Reaction Logging | Durable events for Supabase-backed envelopes written to `inbox_message_events`; fallback feed remains session-only analytics | `inbox_message_events` table with policy-aligned inserts |
| Effort | ✅ Ready now | 🚧 Requires migration + ops playbook |

## Next.js API Feed (pragmatic path)
- `/api/inbox` queries `inbox_items_view` through the authenticated Supabase client, normalizes results, and writes first-delivery rows into `inbox_message_events`.
- `lib/inbox/pragmaticData` still powers mock/fallback data; when Supabase fails the shelf surfaces a "Preview data" badge and emits analytics with `source: 'fallback'`.
- Cursor pagination is supported via `after` query param (base64 payload); `useInboxFeed` handles optimistic reloads while keeping the current page visible.

**Open questions**
- Should the pragmatic feed expose personalization via query params before the clean backend lands?
- Should we persist dismissals for fallback envelopes or keep them session-only to avoid confusing analytics?

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
- Today page replaces the meditation card with `InboxShelf`, spanning the full width of the dashboard grid and backed by `useInboxFeed`.
- `InboxShelf` centralizes analytics payload construction via `emitEnvelopeEvent(...)`, preventing drift in `emitInboxEvent`
  metadata across open, dismiss, and CTA flows.
- Shared typing contracts live in `types/inbox.ts`, with analytics stubs and normalization utilities ensuring resilient rendering.
- Insight spotlight and nudge cards include accessible modal detail views styled with Tailwind tokens.
- CTA envelopes render via `CallToActionCard`, trigger `recordCta` in `useInboxFeed`, fire an `inbox_cta_clicked` analytics event, and persist `actioned` events through `/api/inbox/events`.
- `useInboxFeed` exposes `markAsRead`, `submitAction`, and `recordCta` helpers so state updates, optimistic UI, and analytics remain consistent across card types.

**Open questions**
- Should the Today grid ever demote the Inbox shelf when zero unread items exist, or continue showing the latest confirmed CTA/notification?
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
