# Supabase Migrations

This project uses timestamp-less, lexicographically ordered SQL migrations in `supabase/migrations`.

Current migration files (Supabase applies these in lexicographic order):

1. 001_initial_schema.sql
2. 002_agent_actions.sql (neutralized in Memory v2; drops legacy table if present)
3. 003_part_assessments.sql
4. 004_part_change_proposals.sql
5. 005_insights.sql
6. 006_user_memory.sql (neutralized in Memory v2; drops legacy table if present)
7. 007_check_ins.sql
8. 008_add_charge_to_parts.sql
9. 009_onboarding_schema.sql
10. 010_onboarding_rls.sql
11. 011_onboarding_seed.sql
12. 012_handle_new_users.sql
13. 013_message_feedback.sql
14. 014_events.sql (Memory v2 events ledger)
15. 015_idempotency_records.sql (Memory v2 idempotency)
16. 016_cleanup_legacy.sql
17. 017_memory_updates.sql
18. 017_part_notes.sql
19. 018_sessions_auth_context.sql
20. 022_add_avatar_url_to_users.sql
21. 104_inbox_items_view.sql

Notes about duplicate numeric prefixes
- There are currently two files with the prefix `017_`:
  - `017_memory_updates.sql`
  - `017_part_notes.sql`
- Supabase applies migrations in lexicographic order of the full filename, so the effective order is stable:
  - `017_memory_updates.sql` < `017_part_notes.sql`
- Because these migrations have already been applied in shared environments, do NOT rename these files retroactively.
- Treat the duplicate prefix as consuming two "slots"—the next migration should use the next unused number (`018`, `019`, etc.) even though `017` appears twice.

Bootstrapping a fresh environment
- The recommended path is to let the Supabase CLI apply the migrations in filename order:
  - `supabase start`
  - `supabase db reset` (for a clean slate)
  - `supabase db migrate`
- This will apply files in the lexicographic order listed above.

Future clean-up plan (optional)
- Legacy migrations 002_agent_actions.sql and 006_user_memory.sql have been neutralized to support the Memory v2 baseline without re-numbering.
- If and when we confirm these migrations are not applied to any shared/long-lived environment, we can re-number to a clean, unique baseline. Until then, avoid renaming to preserve applied state integrity.
- If we ever determine that every environment has been rebuilt from a clean slate, we can reissue migrations with unique prefixes (for example, promoting the `017_` files to `017_` and `018_`) and update downstream documentation accordingly.

Verification
- A small script exists to flag duplicate numeric prefixes:
  - `npm run migrations:verify`
- It will warn if any numeric prefix (e.g., `017`) is used by multiple files and list the affected filenames.
