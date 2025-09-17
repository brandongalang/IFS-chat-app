---
title: Feature: Authentication (Google Sign-In)
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
feature_flag: null
code_paths:
  - components/auth/login-form.tsx
  - components/auth/sign-up-form.tsx
  - lib/hooks/use-google-auth.ts
  - app/auth/callback/route.ts
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
- Migration ensures new users are handled with provider metadata

## Data model
- users/auth tables managed by Supabase; ensure provider fields are captured

## Configuration
- Env vars for Supabase and Google OAuth (names only)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth Client ID for native sign-in
- Ensure Google Client ID is configured in Supabase Dashboard for token validation

## Testing
- Mock provider flows in integration tests where possible; manual verification of OAuth callback

## Operational notes
- Verify redirect URIs and provider credentials across environments

## Debugging tips
- Use the built-in console logs from `useGoogleAuth` (enabled when `NODE_ENV !== 'production'`) to confirm the nonce lifecycle. You should see whether a nonce is generated, reused, and the redacted value supplied to Supabase. A nonce mismatch will surface as `Supabase sign-in failed` with `AuthApiError` details containing `Nonce not valid`.
- Check the environment diagnostics log on first render; it redacts `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing or unexpected values typically mean the wrong `.env` file is loaded or build-time envs differ from runtime.
- If you suspect Supabase configuration, temporarily set `skip_nonce_check = true` under `[auth.external.google]` in `supabase/config.toml`, restart Supabase, and retry sign-in. If sign-in succeeds with the skip in place, the issue is almost certainly nonce-related. Remember to revert this flag after testing.
- Supabase credential issues (bad client ID/secret) usually return HTTP 400 with `invalid_client` or `unauthorized_client` errors. Capture the full `authError` object from the console log to distinguish these from nonce problems.
