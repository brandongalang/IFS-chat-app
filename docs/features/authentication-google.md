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
