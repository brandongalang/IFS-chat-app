# Runbook: Apply Onboarding Migrations (staging/dev)

Problem
- API /api/onboarding/state returns 500 with PGRST205: table public.user_onboarding not found.
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
