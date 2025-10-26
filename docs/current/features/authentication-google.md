---
title: Feature: Authentication (Google Sign-In)
owner: @brandongalang
status: shipped
last_updated: 2025-10-17
feature_flag: null
code_paths:
  - components/auth/login-form.tsx
  - components/auth/sign-up-form.tsx
  - app/auth/login/page.tsx
  - app/auth/sign-up/page.tsx
  - components/auth/supabase-session-listener.tsx
  - lib/hooks/use-google-auth.ts
  - app/auth/callback/route.ts
  - app/auth/demo-login/route.ts
  - config/demo-auth.ts
  - config/env.ts
  - scripts/tests/unit/demo-auth-config.test.ts
  - scripts/tests/unit/demo-auth-route.test.ts
  - supabase/migrations/007_handle_new_users.sql
related_prs:
  - #30
---

## What
OAuth-based authentication via Google provider.

## Why
Lower-friction sign-in and account creation with secure provider flows.

## How it works
- Native Google Sign-In using Google Identity Services
- UI components for login and sign-up with native authentication
- Direct token validation with Supabase using `signInWithIdToken`
- Client-side Supabase session listener mirrors browser auth state into server cookies via `/auth/callback`
- Server-side session writes now use the shared Supabase client factory (`lib/supabase/clients`) so cookies are managed consistently across features
- Callback route validates origins, events, and refresh tokens before persisting sessions through `supabase.auth.setSession`
- Optional demo mode exposes `/auth/demo-login` (flagged via env) which signs into a pre-provisioned shared Supabase user and mirrors the returned session to both server cookies and the browser client.

### Trailhead UI refresh (2025-10-17)
- Login and sign-up cards now use the Trailhead palette (rounded 24px cards, Epilogue typography, and pill-shaped primary/secondary buttons) instead of the ethereal glassmorphism variant.
- Global auth wrappers (`app/auth/login/page.tsx`, `app/auth/sign-up/page.tsx`) no longer rely on `--eth-letter-spacing-*`; they inherit the Trailhead font stack and parchment background for consistency with the dashboard.
- Demo CTA and Google OAuth buttons remain, but adopt rounded-full shapes and the warm border treatments defined in `app/globals.css`.

### Session synchronization lifecycle
1. User signs in or out through GIS-driven components.
2. Supabase emits an auth event; `SupabaseSessionListener` retries a `POST /auth/callback` up to three times with exponential backoff.
3. Server handler (`app/auth/callback/route.ts`) verifies the origin header, allowed event (`SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`), and session payload.
4. On sign-in/refresh the server exchanges or sets the session, ensuring cookies stay current for Route Handlers and Server Actions; on sign-out it clears the session.
5. A successful response stops retries; failures surface in the console for debugging.

## Data model
- users/auth tables managed by Supabase; ensure provider fields are captured

## Configuration
- Env vars for Supabase and Google OAuth (names only)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth Client ID for native sign-in
- `BASE_URL` / `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL`: used by the callback to compute an origin allowlist.
- `SUPABASE_SERVICE_ROLE_KEY`: required server-side to exchange auth codes and validate sessions.
- Demo mode:
  - `IFS_DEMO_AUTH_ENABLED`: server-side toggle to provision and authenticate with the shared demo user.
  - `NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED`: build-time flag to expose the “Try the demo” CTA in the login UI.
  - `IFS_DEMO_AUTH_EMAIL` / `IFS_DEMO_AUTH_PASSWORD`: credentials for the shared Supabase user; stored server-side only.
  - Demo accounts require the Supabase service-role key so the route can provision the user if it is missing.
- Ensure Google Client ID is configured in Supabase Dashboard for token validation.
- For local Supabase, keep `skip_nonce_check = false` and `enable_refresh_token_rotation = true` so refresh tokens are issued for session sync.

## Testing
- Mock provider flows in integration tests where possible; manual verification of OAuth callback

## Operational notes
- Verify redirect URIs and provider credentials across environments.
- Session listener is mounted globally in `app/layout.tsx`; keep it client-side to avoid hydration warnings.
- Demo mode grants full read/write capabilities to the shared account; plan a manual reset cadence if the sandbox data needs to stay pristine. Avoid storing private information when exercising the shared user.
- When adding new origins (preview URLs, staging), update environment variables so the callback allowlist accepts them.
- Refresh token reuse is guarded; missing refresh tokens will abort the sync with a 400 response.

- Use the built-in console logs from `useGoogleAuth`. In production builds, enable them by running `localStorage.setItem('IFS_GOOGLE_AUTH_DEBUG', 'true')` (or append `?debugGoogleAuth=1` to the URL) and refresh. You should then see whether a nonce is generated, reused, and the redacted value supplied to Supabase. A nonce mismatch will surface as `Supabase sign-in failed` with `AuthApiError` details containing `Nonce not valid`.
- Check the environment diagnostics log on first render; it redacts `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing or unexpected values typically mean the wrong `.env` file is loaded or build-time envs differ from runtime.
- If you suspect Supabase configuration, temporarily set `skip_nonce_check = true` under `[auth.external.google]` in `supabase/config.toml`, restart Supabase, and retry sign-in. If sign-in succeeds with the skip in place, the issue is almost certainly nonce-related. Remember to revert this flag after testing.
- Supabase credential issues (bad client ID/secret) usually return HTTP 400 with `invalid_client` or `unauthorized_client` errors. Capture the full `authError` object from the console log to distinguish these from nonce problems.
- For session listener failures, check the network panel for `/auth/callback` POST responses. A 403 typically indicates an origin mismatch; a 400 indicates missing tokens; repeated 500s point to Supabase configuration or service-role issues.
