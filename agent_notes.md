# Inbox MVP Implementation Plan (2025-10-01)

## Current Scope
- Map `public.inbox_items_view` rows to `InboxEnvelope` responses in `GET /api/inbox` so the shelf renders Supabase-backed content.
- Replace boolean quick actions with a four-slot response slider for Spotlight/Nudge cards; notifications use a single acknowledge action. Persist outcomes + optional notes to `insights.meta` and mark items `actioned`.
- Emit durable inbox analytics (`delivered`, `opened`, `actioned`) into a new `inbox_message_events` table.
- Provide a minimal admin/CLI path to validate and insert `insights` rows with required JSON fields for authoring.

## Execution Checklist
- [ ] Implement server-side mapper from `inbox_items_view` → `InboxEnvelope`.
- [ ] Update API + types: support 4-point action values (`agree_strong`, `agree`, `disagree`, `disagree_strong`, `ack`).
- [ ] Adjust `/api/inbox/[id]/action` to store new outcomes and clear items.
- [ ] Add durable analytics table + server emitters for delivered/opened/actioned.
- [ ] Create guarded admin/CLI helper for authoring validated `insights` entries.
- [ ] Ship unit/e2e coverage for mapper, action flow, and analytics logging.

## Open Decisions / Assumptions
- Slider labels: "Agree a lot", "Agree a little", "Disagree a little", "Disagree a lot" (can be refined with UX copy later).
- Nudge cards share the 4-point slider; notification cards expose only acknowledge + notes.
- Event payloads record user id, source id, envelope type, action value, notes, and timestamp. Additional campaign tags can be added later if needed.
