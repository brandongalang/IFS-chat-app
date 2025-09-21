# Pragmatic Inbox Backend

## Summary
- Ships `/api/inbox` Next.js route that returns a hydrated inbox feed from `lib/inbox/pragmaticData`.
- Shares envelope normalization logic with the frontend to guarantee contract safety even for mocked data.
- Designed to swap in Supabase RPC later by replacing `getPragmaticInboxFeed()` implementation.

## Seed Data
- `lib/inbox/pragmaticData.ts` delivers the shipping feed, keeping mocks colocated with network logic for quick iteration.
- Data tags align with the frontend registry so new message types can be toggled in one place.

## Open Questions
- Should pragmatic feed support user personalization via query params before the clean backend lands?
- Do we need persistence for dismissals in the pragmatic path, or can we keep them session-only?

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Unit coverage relies on `scripts/tests/unit/inbox-normalize.test.ts` to ensure envelopes remain well-formed.
