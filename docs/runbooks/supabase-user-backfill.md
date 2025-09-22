# Runbook: Backfill Missing `public.users` Rows

Production incident: chat session inserts can fail with `error code 23503` and message `insert or update on table "sessions" violates foreign key constraint "sessions_user_id_fkey"`. This occurs when a Supabase auth user exists without a matching row in `public.users`.

## When to use this runbook
- Logs show the foreign key violation above when starting a chat session or storing a message.
- Supabase CLI / dashboard data explorer reveals entries in `auth.users` that are missing from `public.users`.

## Background
- Historically we relied on the `public.handle_new_user` trigger to mirror `auth.users` into `public.users`.
- Accounts created before that trigger existed—or during outages where it failed—lack a profile, so any session insert referencing that user breaks.
- The application now calls `ChatSessionService.ensureUserRecord()` before starting a session, but we still need to repair existing data.

## Backfill procedure
1. **Open the SQL editor** in the Supabase dashboard for the impacted project (or connect via `psql` using the service-role key).
2. **Execute the backfill statement**:
   ```sql
   insert into public.users (id, email, name)
   select au.id,
          au.email,
          coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.email)
   from auth.users au
   where not exists (
     select 1
     from public.users pu
     where pu.id = au.id
   );
   ```
   - The query is idempotent; re-running it is safe.
   - Expect `INSERT 0 <n>` where `<n>` equals the number of missing users.
3. **Verify** by selecting a sample user:
   ```sql
   select id, email, name
   from public.users
   where id = '<affected-user-id>';
   ```
4. **Redeploy / retry** the failing action in production. The application should now complete the session insert without errors.

## Post-backfill checks
- Review Supabase logs for 5–10 minutes to ensure no new `sessions_user_id_fkey` violations occur.
- Ask the affected user to refresh and start a chat; confirm success.
- Consider adding a dashboard alert for new occurrences of the constraint violation.

## Related code
- `lib/session-service.ts` → `ensureUserRecord`
- `lib/api/supabaseGuard.ts` → uses `auth.getUser()` for verified identity
- `supabase/migrations/012_handle_new_users.sql` → trigger that mirrors `auth.users`

## Mitigation status
- ✅ Runtime safeguard added in code.
- ⏳ Historical data must be backfilled using the steps above.
