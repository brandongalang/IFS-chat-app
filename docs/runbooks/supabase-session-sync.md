# Runbook: Supabase Session Synchronization

This runbook covers how to diagnose and recover issues with the client → server session bridge introduced by the Supabase session listener.

## When to use this runbook
- `/auth/callback` POST requests start failing (400/403/500)
- Users report being signed out after refresh even though the modal confirmed sign-in
- Background tab sign-outs are not mirrored across the app or API calls suddenly 401

## Architecture snapshot
- **Client listener:** `components/auth/supabase-session-listener.tsx` subscribes to Supabase auth events and posts `{ event, session }` payloads to `/auth/callback` with exponential backoff (3 attempts, 250ms → 1s).
- **Callback (GET):** `app/auth/callback/route.ts` exchanges OAuth codes, validates errors, and redirects back to `next`.
- **Callback (POST):** Validates the `Origin` header, ensures the event is one of `SIGNED_IN | TOKEN_REFRESHED | SIGNED_OUT`, verifies the session against Supabase, and persists it via `supabase.auth.setSession` or `signOut` using the shared server client created in `lib/supabase/clients`.
- **Origins allowlist:** Built from request origin, `BASE_URL`, `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`, and `https://${VERCEL_URL}`.

## Preconditions
- `SUPABASE_SERVICE_ROLE_KEY` is available to the server runtime (required to validate and set sessions)
- `IFS_MODEL`, `IFS_TEMPERATURE`, `IFS_PROVIDER_BASE_URL` configured alongside Supabase keys so Mastra agents invoked during callback reuse the same provider defaults
- Supabase Auth has refresh token rotation enabled (`enable_refresh_token_rotation = true`)
- `BASE_URL` (or equivalent) matches the domain being used

## Triage checklist
1. **Confirm origin allowlist**
   - Inspect failing request’s `Origin` header
   - Ensure it matches one of the configured base URLs or Vercel preview domains
   - Update env vars or `additional_redirect_urls` if missing
2. **Inspect response codes**
   - `400`: usually missing tokens → check network payload for `session.refresh_token`
   - `403`: origin rejected → fix allowlist
   - `500`: Supabase call threw → tail server logs for `setSession` errors
3. **Validate refresh token rotation**
   - In Supabase dashboard, Auth → Settings → JWT → confirm `Enable refresh token rotation` is on
   - Ensure `refresh_token_reuse_interval` is ≥10 seconds (default 10)
4. **Verify service role availability**
   - In the failing environment run `echo $SUPABASE_SERVICE_ROLE_KEY` (redacted) or check deployment variables
   - Missing key prevents `setSession`
5. **Check Supabase Auth logs**
   - Look for `AuthApiError` or `Auth session missing` tied to the user email/ID

## Recovery actions
- **Update origins:** deploy with corrected `BASE_URL`/`APP_BASE_URL`; for previews set `NEXT_PUBLIC_APP_URL` to the preview hostname before re-testing.
- **Rotate refresh tokens:** toggle rotation off/on in Supabase and have affected users sign out/in to receive new tokens.
- **Clear stale cookies locally:** Advise signing out/in or clearing the Supabase auth cookie if mismatched users were reported.
- **Rollback session listener (temporary):** Comment the `<SupabaseSessionListener />` import in `app/layout.tsx` and redeploy to unblock users while root cause is investigated. Re-enable once fixed.

## Verification
- Trigger a fresh login in an incognito window; confirm `/auth/callback` POST returns 200 and cookies persist across page refreshes.
- Execute a sign-out in one tab and ensure another open tab registers the change within a second (listener logs appear).
- Review logs for absence of new `Auth callback` warnings for the last 10 minutes.

## Related resources
- `components/auth/supabase-session-listener.tsx`
- `app/auth/callback/route.ts`
- `supabase/config.toml`
