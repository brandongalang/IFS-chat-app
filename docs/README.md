# Constellation Documentation

This directory contains all of the product, design, and engineering documentation for Constellation. It is organized into two primary sections:

## 1. `/vision`

This directory contains the **"North Star"** documentation. It describes the long-term product vision, strategic goals, and the ideal architecture we are working towards. It is derived from the original Product Strategy document and should be used as a guiding light for our development efforts.

## 2. `/current_state`

This directory contains the **"Map"** of our application. It provides a practical, human-readable description of how the system *actually works today*. This includes its current architecture, feature implementations, and data models. This section is intended to be a living document, updated as the codebase evolves, to help team members understand the current reality of the system.

## Recently updated highlights (September 20, 2025)
- `docs/features/onboarding.md` — staged onboarding flow, adaptive question selection, completion summary hand-off.
- `docs/features/authentication-google.md` & `docs/auth/google-oauth-setup.md` — Supabase session listener lifecycle, origin allowlist, refresh rotation requirements.
- `docs/runbooks/supabase-session-sync.md` — troubleshooting guide for the new auth session bridge.
- `docs/runbooks/memory-cron-vercel.md` & `docs/user-memory.md` — Vercel Cron migration details and dual-header auth requirements.
- `docs/current_state/01_system_architecture.md` / `02_feature_implementations.md` — updates covering onboarding summary and daily memory refresh pipeline.
