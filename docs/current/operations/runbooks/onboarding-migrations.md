# Runbook: Apply Onboarding Migrations (staging/dev)

Problem
- API /api/onboarding/state returns 500 with PGRST205: table public.user_onboarding not found.
- Completion summaries fail because `onboarding_responses` or `user_onboarding.stage2_selected_questions` is missing.
- Root cause: onboarding migrations (009–011) not yet applied to the remote Supabase database.

Safety and prerequisites
- Confirm target is NON-PRODUCTION. Project ref: pegclbtzfaccnhmkviqb
- Ensure you have access to the staging Supabase project (Dashboard + DB connection).
- Do NOT paste secrets in terminals or commit secrets to git.

Two supported methods
A) Supabase CLI (preferred)
- Pros: versioned, consistent, applies in order, CI-friendly.
- Caveat: Will attempt to apply ALL pending migrations. If there are unrelated pending migrations, prefer method B below to apply only onboarding.

B) Direct psql (apply only specific files)
- Pros: precise (apply exactly 009–011 only).
- Caveat: Requires STAGING_SUPABASE_DB_URL set locally (do not commit).

## Verification checklist (post-migration)
1. **Tables present**
   - `select * from user_onboarding limit 1;`
   - `select * from onboarding_responses limit 1;`
   - Ensure `stage2_selected_questions` and `answers_snapshot` columns exist (JSONB).
2. **Question bank**
   - `select count(*) from onboarding_questions where stage = 2 and active = true;` (expect ≥4 for adaptive selection).
   - Confirm `requirements` JSON exists for stages 1–3.
3. **Version column**
   - `select column_name from information_schema.columns where table_name = 'user_onboarding' and column_name = 'version';`
   - Results should include `version` (int4) defaulting to 0.
4. **Completion summary**
   - Run `select build_onboarding_summary('<user-uuid>');` or hit `POST /api/onboarding/complete` for a staged account.
   - Verify response includes populated `summary.parts`, `summary.themes`, and `summary.somatic` arrays.
5. **Dev playground sanity check**
   - Visit `/dev/onboarding`, enable "Show completion summary", and confirm summary chips render without errors.

## Backfill guidance
- If migrating existing users, run `scripts/onboarding/backfill-summary.ts` (or equivalent) to regenerate `CompletionSummary` caches.
- For large batches, temporarily disable analytics events to avoid rate limits, then re-enable once the backfill finishes.
- Document affected user IDs in the deployment log for support follow-up.

Quick checklist
1) Verify repo and environment
- pwd is project root
- git remote -v shows the expected repo
- git status is clean (or stash changes)

2) Determine project ref and ensure non-prod
- From .env.local, NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
- For this project: PROJECT_REF=pegclbtzfaccnhmkviqb (staging/dev)

3) Preview pending migrations (CLI)
- supabase link --project-ref pegclbtzfaccnhmkviqb
- supabase db push --dry-run
- If ONLY 009–011 are pending: proceed with CLI push. If others are pending, use psql method below to scope the change.

4A) Apply with Supabase CLI (if safe to apply all pending)
- supabase db push
- Save output (redact secrets) for PR notes.

4B) Apply only onboarding migrations via psql
- Export a secure DB URL (never commit):
  export STAGING_SUPABASE_DB_URL="postgresql://postgres:${DB_PASSWORD}@db.pegclbtzfaccnhmkviqb.supabase.co:5432/postgres"
- Apply files in order:
  psql -v ON_ERROR_STOP=1 "$STAGING_SUPABASE_DB_URL" -f supabase/migrations/009_onboarding_schema.sql
  psql -v ON_ERROR_STOP=1 "$STAGING_SUPABASE_DB_URL" -f supabase/migrations/010_onboarding_rls.sql
  psql -v ON_ERROR_STOP=1 "$STAGING_SUPABASE_DB_URL" -f supabase/migrations/011_onboarding_seed.sql
- Optionally refresh PostgREST schema cache:
  psql "$STAGING_SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';"

5) Verify objects and policies
- psql "$STAGING_SUPABASE_DB_URL" -c "select to_regclass('public.user_onboarding');"
- psql "$STAGING_SUPABASE_DB_URL" -c "select relrowsecurity from pg_class where relname='user_onboarding';"
- psql "$STAGING_SUPABASE_DB_URL" -c "select polname from pg_policies where schemaname='public' and tablename='user_onboarding';"

6) App/API checks
- Local dev: run the app with .env.local pointing to the same project
- curl http://localhost:3000/api/onboarding/state → expect 200 or 401 (auth), not 500
- Load /onboarding in the browser → no 5xx responses; content renders

Notes
- Never commit or log secrets. Use environment variables.
- Keep main green. Perform this work on a feature branch and open a PR with a Conventional Commits title.
