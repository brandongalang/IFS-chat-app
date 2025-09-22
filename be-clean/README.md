# Clean Inbox Backend

## Summary
- Proposes normalized Supabase schema (`schema.sql`) for inbox subjects, payloads, and reaction events.
- Provides edge function scaffolding (`edge-function.ts`) that maps SQL rows into `InboxEnvelope` contracts shared with the frontend.
- Adds service client helper for secure service-role access in serverless contexts.

## Reaction Logging Plan
- `inbox_message_events` table tracks `delivered`, `opened`, `dismissed`, and `cta_clicked` events with JSON attributes for flexible metadata.
- Edge function exposes `logInboxReaction` helper to record events from Next.js API routes or Supabase Edge Functions.
- Analytics pipeline can later sink events into ClickHouse/BigQuery via Supabase Functions or webhooks without changing the frontend contract.

## Open Questions
- Should we denormalize insight spotlight payloads for faster reads, or keep JSONB payloads for flexibility?
- How should we expire or archive inbox subjects once `expires_at` passes—cron job or trigger?

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm test`
- No runtime Supabase verification performed yet (design-time scaffolding only).
