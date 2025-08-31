---
title: Feature: Authentication (Google Sign-In)
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
feature_flag: null
code_paths:
  - components/auth/login-form.tsx
  - components/auth/sign-up-form.tsx
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
- UI components for login and sign-up
- Next.js route handler for OAuth callback
- Migration ensures new users are handled with provider metadata

## Data model
- users/auth tables managed by Supabase; ensure provider fields are captured

## Configuration
- Env vars for Supabase and Google OAuth (names only)

## Testing
- Mock provider flows in integration tests where possible; manual verification of OAuth callback

## Operational notes
- Verify redirect URIs and provider credentials across environments
