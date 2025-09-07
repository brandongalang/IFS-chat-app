# Supabase Migrations

This project uses timestamp-less, lexicographically ordered SQL migrations in `supabase/migrations`.

Current migration files (in recommended apply order):

1. 001_initial_schema.sql
2. 002_agent_actions.sql (neutralized in Memory v2; drops legacy table if present)
3. 003_part_assessments.sql
4. 004_part_change_proposals.sql
5. 005_insights.sql
6. 006_user_memory.sql (neutralized in Memory v2; drops legacy table if present)
7. 007_check_ins.sql
8. 007_handle_new_users.sql
9. 008_add_charge_to_parts.sql
10. 008_message_feedback.sql
11. 014_events.sql (Memory v2 events ledger)
12. 015_idempotency_records.sql (Memory v2 idempotency)

Notes about duplicate numeric prefixes
- There are two files with the prefix `007_` and two with `008_`.
- Supabase applies migrations in lexicographic order of the full filename, so the effective order is stable:
  - `007_check_ins.sql` < `007_handle_new_users.sql`
  - `008_add_charge_to_parts.sql` < `008_message_feedback.sql`
- Because these migrations may already be applied in existing environments, do NOT rename these files retroactively.

Bootstrapping a fresh environment
- The recommended path is to let the Supabase CLI apply the migrations in filename order:
  - `supabase start`
  - `supabase db reset` (for a clean slate)
  - `supabase db migrate`
- This will apply files in the lexicographic order listed above.

Future clean-up plan (optional)
- Legacy migrations 002_agent_actions.sql and 006_user_memory.sql have been neutralized to support the Memory v2 baseline without re-numbering.
- If and when we confirm these migrations are not applied to any shared/long-lived environment, we can re-number to a clean, unique baseline. Until then, avoid renaming to preserve applied state integrity.

Verification
- A small script exists to flag duplicate numeric prefixes:
  - `npm run migrations:verify`
- It will warn if any numeric prefix (e.g., `007`) is used by multiple files.
