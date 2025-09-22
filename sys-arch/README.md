# Inbox Architecture Decisions

## Overview
- Frontend consumes an abstract `InboxEnvelope` contract rendered through a registry-driven `InboxShelf` surface.
- Data enters via `useInboxFeed`, which can target the pragmatic API route immediately and the clean Supabase pipeline once ready.
- Analytics instrumentation (`emitInboxEvent`) keeps UX and backend telemetry aligned.

## Variant Comparison
| Aspect | Pragmatic (Next.js API) | Clean (Supabase Edge) |
| --- | --- | --- |
| Delivery | Static JSON feed via `getPragmaticInboxFeed()` | Edge function joins normalized tables with per-user filters |
| Latency | Served from Vercel edge/cacheable responses | Close to data, leverages Supabase region locality |
| Personalization | Requires manual extension or query params | Full fidelity with SQL filters + RLS |
| Reaction Logging | Not persistent (pending session store) | `inbox_message_events` table with policy-aligned inserts |
| Effort | ✅ Ready now | 🚧 Requires migration + ops playbook |

## Recommendation
- Ship the pragmatic route first to unblock Today page testing and fast iteration.
- Begin Supabase migration immediately so the clean pipeline can replace the pragmatic feed without frontend changes.
- When enabling the clean path, keep the pragmatic endpoint as a fallback for unauthenticated/dev flows.

## Follow-ups
1. Define dismissal persistence (local storage vs Supabase event) before launching multi-card inbox.
2. Align analytics taxonomy between frontend `emitInboxEvent` and backend `inbox_message_events` before GA.
3. Introduce a lightweight pagination cursor in `InboxFeedResponse` when we add more than five envelopes per user.
